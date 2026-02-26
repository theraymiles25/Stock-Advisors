// =============================================================================
// Stock Advisors - Paper Trading Execution Engine
// =============================================================================
// Converts agent recommendations into paper trades with intelligent position
// sizing. Handles trade execution, stop-loss / take-profit monitoring, and
// cash balance adjustments via the paper trading store.
//
// Position sizing strategy:
//   1. Kelly criterion estimate from confidence and win-rate proxy
//   2. Max position cap as a % of total portfolio (default 10%)
//   3. Volatility-adjusted sizing via the stop-loss distance
// =============================================================================

import type {
  Recommendation,
  RecommendationAction,
  AgentId,
} from '../../agents/base/types';
import {
  recordTrade,
  closeTrade,
  getOpenTrades,
} from '../database/TradeMemory';
import type { NewTrade, TradeRecord } from '../database/TradeMemory';
import { usePaperTradingStore } from '../../stores/usePaperTradingStore';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default maximum single-position size as a fraction of portfolio */
const DEFAULT_MAX_POSITION_PCT = 0.1;

/** Minimum shares per trade */
const MIN_SHARES = 1;

/**
 * Default assumed risk-per-trade as a fraction of portfolio value.
 * Used when no stop-loss is provided to cap downside exposure.
 */
const DEFAULT_RISK_FRACTION = 0.02;

// -----------------------------------------------------------------------------
// Position Sizing
// -----------------------------------------------------------------------------

/**
 * Calculate the number of whole shares to purchase given portfolio constraints.
 *
 * The algorithm layers three sizing methods and takes the most conservative:
 *
 *   1. **Kelly criterion estimate** -- Uses the recommendation's confidence
 *      as a proxy for edge. Kelly fraction = edge / odds, where we assume
 *      even-money odds (reward = risk). The raw Kelly fraction is halved
 *      ("half-Kelly") for practical conservatism.
 *
 *   2. **Max position cap** -- The position's total cost must not exceed
 *      `maxPositionPct` of the portfolio value (default 10%).
 *
 *   3. **Volatility / stop-loss sizing** -- If a stop-loss is provided, the
 *      per-share risk (|price - stopLoss|) determines how many shares fit
 *      within a fixed portfolio risk budget (2% of portfolio). Wider stops
 *      produce smaller positions, naturally adjusting for volatility.
 *
 * The final share count is the minimum of all three methods, capped by
 * available cash and floored at 1 share.
 */
export function calculatePositionSize(params: {
  price: number;
  stopLoss: number | undefined;
  portfolioValue: number;
  availableCash: number;
  maxPositionPct: number;
  confidence?: number;
}): number {
  const {
    price,
    stopLoss,
    portfolioValue,
    availableCash,
    maxPositionPct,
    confidence = 50,
  } = params;

  if (price <= 0 || portfolioValue <= 0) {
    return MIN_SHARES;
  }

  // --- 1. Kelly criterion estimate (half-Kelly) ---
  // Treat confidence as win probability (scaled 0-1).
  // Kelly fraction = (p * (b + 1) - 1) / b  where b = 1 (even-money).
  // Simplifies to: kelly = 2p - 1.  Apply half-Kelly for safety.
  const winProbability = Math.min(Math.max(confidence / 100, 0.01), 0.99);
  const kellyRaw = Math.max(0, 2 * winProbability - 1);
  const kellyFraction = kellyRaw / 2; // half-Kelly
  const kellyDollars = kellyFraction * portfolioValue;
  const kellyShares = kellyDollars > 0 ? Math.floor(kellyDollars / price) : MIN_SHARES;

  // --- 2. Max position cap ---
  const maxPositionDollars = maxPositionPct * portfolioValue;
  const maxCapShares = Math.floor(maxPositionDollars / price);

  // --- 3. Volatility / stop-loss sizing ---
  let volShares: number;
  if (stopLoss !== undefined && stopLoss > 0) {
    const riskPerShare = Math.abs(price - stopLoss);
    if (riskPerShare > 0) {
      const riskBudget = DEFAULT_RISK_FRACTION * portfolioValue;
      volShares = Math.floor(riskBudget / riskPerShare);
    } else {
      volShares = maxCapShares; // stop-loss equals price -- degenerate case
    }
  } else {
    // No stop-loss: assume default risk fraction applied to price itself
    const impliedRiskPerShare = price * DEFAULT_RISK_FRACTION * 5; // ~10% move
    const riskBudget = DEFAULT_RISK_FRACTION * portfolioValue;
    volShares = Math.floor(riskBudget / impliedRiskPerShare);
  }

  // --- Take the most conservative ---
  const cashShares = Math.floor(availableCash / price);
  const rawShares = Math.min(kellyShares, maxCapShares, volShares, cashShares);

  return Math.max(rawShares, MIN_SHARES);
}

// -----------------------------------------------------------------------------
// Trade Execution
// -----------------------------------------------------------------------------

/**
 * Determine whether a recommendation action represents a long (buy-side) trade.
 */
function isLongAction(action: RecommendationAction): boolean {
  return action === 'BUY' || action === 'STRONG_BUY';
}

/**
 * Execute a paper trade derived from an agent recommendation.
 *
 * Steps:
 *   1. Compute position size using the layered algorithm.
 *   2. Persist the trade via TradeMemory.
 *   3. Debit cash from the paper trading store.
 *   4. Refresh store positions so the UI stays in sync.
 *   5. Return the full TradeRecord.
 */
export async function executePaperTrade(params: {
  recommendation: Recommendation;
  agentId: string;
  portfolioValue: number;
  availableCash: number;
  maxPositionPct?: number;
  pipelineId?: string;
}): Promise<TradeRecord> {
  const {
    recommendation,
    agentId,
    portfolioValue,
    availableCash,
    maxPositionPct = DEFAULT_MAX_POSITION_PCT,
    pipelineId,
  } = params;

  // Use the recommendation's target price as entry (or 0 as fallback -- caller
  // should ensure a valid price).  For sell/short recommendations the entry
  // price is the current market price, which agents typically encode in
  // targetPrice or the caller supplies.
  const entryPrice = recommendation.targetPrice ?? 0;

  if (entryPrice <= 0) {
    throw new Error(
      `[TradingEngine] Cannot execute trade for ${recommendation.symbol}: ` +
      `entry price is ${entryPrice}. Provide a valid targetPrice in the recommendation.`
    );
  }

  // --- Position sizing ---
  const quantity = calculatePositionSize({
    price: entryPrice,
    stopLoss: recommendation.stopLoss,
    portfolioValue,
    availableCash,
    maxPositionPct,
    confidence: recommendation.confidence,
  });

  const totalCost = quantity * entryPrice;

  if (totalCost > availableCash) {
    throw new Error(
      `[TradingEngine] Insufficient cash for ${recommendation.symbol}: ` +
      `need ${totalCost.toFixed(2)} but only ${availableCash.toFixed(2)} available.`
    );
  }

  // --- Persist trade ---
  const now = new Date().toISOString();

  const newTrade: NewTrade = {
    symbol: recommendation.symbol.toUpperCase(),
    action: recommendation.action,
    quantity,
    entry_price: entryPrice,
    entry_date: now,
    stop_loss: recommendation.stopLoss ?? null,
    take_profit: recommendation.targetPrice ?? null,
    recommended_by: agentId,
    confidence: recommendation.confidence,
    pipeline_id: pipelineId ?? null,
    notes: recommendation.rationale,
  };

  const tradeId = await recordTrade(newTrade);

  // --- Adjust paper trading store ---
  const store = usePaperTradingStore.getState();

  // For buy-side trades we spend cash; for sell-side we receive cash.
  if (isLongAction(recommendation.action)) {
    store.adjustCash(-totalCost);
  } else {
    // Short / sell proceeds credited
    store.adjustCash(totalCost);
  }

  // Refresh positions from the database so UI reflects the new trade
  await store.refreshPositions();

  // Build a synthetic TradeRecord to return (matches DB shape)
  const tradeRecord: TradeRecord = {
    id: tradeId,
    symbol: newTrade.symbol,
    action: newTrade.action,
    quantity: newTrade.quantity,
    entry_price: newTrade.entry_price,
    entry_date: newTrade.entry_date,
    exit_price: null,
    exit_date: null,
    stop_loss: newTrade.stop_loss ?? null,
    take_profit: newTrade.take_profit ?? null,
    status: 'open',
    pnl_dollars: null,
    pnl_percent: null,
    holding_days: null,
    recommended_by: agentId,
    confidence: newTrade.confidence ?? null,
    pipeline_id: newTrade.pipeline_id ?? null,
    notes: newTrade.notes ?? null,
    created_at: now,
  };

  console.log(
    `[TradingEngine] Executed ${recommendation.action} ${quantity} x ${newTrade.symbol} ` +
    `@ $${entryPrice.toFixed(2)} (total: $${totalCost.toFixed(2)}) -- agent: ${agentId}`
  );

  return tradeRecord;
}

// -----------------------------------------------------------------------------
// Stop-Loss / Take-Profit Monitor
// -----------------------------------------------------------------------------

/**
 * Check all open positions against current market prices. If a position's
 * stop-loss or take-profit has been triggered, the trade is closed automatically
 * and cash is returned (or debited) to the paper trading store.
 *
 * @param currentPrices - Map of symbol -> current market price
 * @returns Array of TradeRecords that were closed during this check
 */
export async function checkStopsTakeProfits(
  currentPrices: Record<string, number>
): Promise<TradeRecord[]> {
  const openTrades = await getOpenTrades();
  const closedTrades: TradeRecord[] = [];
  const store = usePaperTradingStore.getState();

  for (const trade of openTrades) {
    const currentPrice = currentPrices[trade.symbol];
    if (currentPrice === undefined) continue;

    const isLong = isLongAction(trade.action);
    let triggered = false;
    let triggerReason: 'stopped_out' | 'target_hit' | null = null;

    // --- Stop-loss check ---
    if (trade.stop_loss !== null) {
      if (isLong && currentPrice <= trade.stop_loss) {
        triggered = true;
        triggerReason = 'stopped_out';
      } else if (!isLong && currentPrice >= trade.stop_loss) {
        // For short positions, stop-loss triggers when price rises
        triggered = true;
        triggerReason = 'stopped_out';
      }
    }

    // --- Take-profit check (overrides stop if both somehow trigger) ---
    if (trade.take_profit !== null) {
      if (isLong && currentPrice >= trade.take_profit) {
        triggered = true;
        triggerReason = 'target_hit';
      } else if (!isLong && currentPrice <= trade.take_profit) {
        triggered = true;
        triggerReason = 'target_hit';
      }
    }

    if (triggered && triggerReason) {
      const now = new Date().toISOString();

      // Close the trade in the database (computes realized P&L)
      await closeTrade(trade.id, currentPrice, now);

      // Adjust cash: return proceeds for long, debit cover cost for short
      const proceeds = currentPrice * trade.quantity;
      if (isLong) {
        store.adjustCash(proceeds);
      } else {
        store.adjustCash(-proceeds);
      }

      // Build the closed trade record for the return value
      const priceDiff = isLong
        ? currentPrice - trade.entry_price
        : trade.entry_price - currentPrice;
      const pnlDollars = priceDiff * trade.quantity;
      const pnlPercent = (priceDiff / trade.entry_price) * 100;

      const closedRecord: TradeRecord = {
        ...trade,
        exit_price: currentPrice,
        exit_date: now,
        status: triggerReason,
        pnl_dollars: pnlDollars,
        pnl_percent: pnlPercent,
        holding_days: Math.max(
          0,
          Math.round(
            (new Date(now).getTime() - new Date(trade.entry_date).getTime()) /
            (1000 * 60 * 60 * 24)
          )
        ),
      };

      closedTrades.push(closedRecord);

      console.log(
        `[TradingEngine] ${triggerReason.toUpperCase()}: ${trade.symbol} ` +
        `@ $${currentPrice.toFixed(2)} -- P&L: $${pnlDollars.toFixed(2)} (${pnlPercent.toFixed(2)}%)`
      );
    }
  }

  // Refresh the store if any trades were closed
  if (closedTrades.length > 0) {
    await store.refreshPositions();
  }

  return closedTrades;
}
