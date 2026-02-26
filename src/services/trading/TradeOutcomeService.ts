// =============================================================================
// Stock Advisors - Trade Outcome Service
// =============================================================================
// Bridges paper trading outcomes (TradeMemory) to agent track records
// (AgentMemory). When a trade is closed, this service finds the matching
// agent recommendation and resolves it with the actual outcome.
// =============================================================================

import {
  closeTrade,
  getOpenTrades,
  updateTradeStatus,
  type TradeRecord,
  type TradeStatus,
} from '../database/TradeMemory';
import {
  resolveRecommendation,
  type RecommendationOutcome,
} from '../database/AgentMemory';
import { select } from '../database/Database';
import type { TrackRecord } from '../database/AgentMemory';

// -----------------------------------------------------------------------------
// Close Trade with Track Record Update
// -----------------------------------------------------------------------------

/**
 * Close a paper trade AND resolve the corresponding agent track record.
 * This is the preferred way to close trades — it keeps both tables in sync.
 */
export async function closeTradeWithOutcome(
  tradeId: number,
  exitPrice: number,
  exitDate: string,
  status: TradeStatus = 'closed'
): Promise<void> {
  // 1. Close the trade in the trades table
  await closeTrade(tradeId, exitPrice, exitDate);

  // Update status if not just 'closed' (e.g., stopped_out, target_hit)
  if (status !== 'closed') {
    await updateTradeStatus(tradeId, status);
  }

  // 2. Find the matching track record and resolve it
  // Re-fetch the trade to get its computed P&L
  const rows = await select<TradeRecord>(
    'SELECT * FROM trades WHERE id = ?',
    [tradeId]
  );

  if (rows.length === 0) return;
  const trade = rows[0];

  // Find the most recent pending track record for this agent + symbol
  const trackRecords = await select<TrackRecord>(
    `SELECT * FROM agent_track_records
     WHERE agent_id = ? AND symbol = ? AND (outcome IS NULL OR outcome = 'pending')
     ORDER BY recommended_at DESC LIMIT 1`,
    [trade.recommended_by, trade.symbol]
  );

  if (trackRecords.length === 0) return;

  const trackRecord = trackRecords[0];
  const actualReturn = trade.pnl_percent ?? 0;

  // Determine the outcome
  let outcome: RecommendationOutcome;
  if (status === 'stopped_out') {
    outcome = 'stopped_out';
  } else if (status === 'target_hit') {
    outcome = 'target_hit';
  } else if (status === 'expired') {
    outcome = 'expired';
  } else if (actualReturn > 0.5) {
    outcome = 'win';
  } else if (actualReturn < -0.5) {
    outcome = 'loss';
  } else {
    outcome = 'breakeven';
  }

  // Resolve the track record
  await resolveRecommendation(
    trackRecord.id,
    outcome,
    actualReturn,
    trade.pnl_percent ?? null, // peak_return (best approximation without intraday tracking)
    null // worst_drawdown (would need historical price data to compute properly)
  );
}

// -----------------------------------------------------------------------------
// Batch Check: Stop-Loss and Take-Profit Triggers
// -----------------------------------------------------------------------------

/**
 * Check all open trades against current prices and auto-close any that hit
 * their stop-loss or take-profit levels. Returns the list of closed trades.
 */
export async function checkAndCloseTriggeredTrades(
  currentPrices: Record<string, number>
): Promise<TradeRecord[]> {
  const openTrades = await getOpenTrades();
  const closedTrades: TradeRecord[] = [];

  for (const trade of openTrades) {
    const currentPrice = currentPrices[trade.symbol];
    if (currentPrice === undefined) continue;

    const isLong = trade.action === 'BUY' || trade.action === 'STRONG_BUY';

    // Check stop-loss
    if (trade.stop_loss !== null) {
      const stopped = isLong
        ? currentPrice <= trade.stop_loss
        : currentPrice >= trade.stop_loss;

      if (stopped) {
        await closeTradeWithOutcome(
          trade.id,
          trade.stop_loss,
          new Date().toISOString(),
          'stopped_out'
        );
        closedTrades.push({ ...trade, exit_price: trade.stop_loss, status: 'stopped_out' });
        continue;
      }
    }

    // Check take-profit
    if (trade.take_profit !== null) {
      const targeted = isLong
        ? currentPrice >= trade.take_profit
        : currentPrice <= trade.take_profit;

      if (targeted) {
        await closeTradeWithOutcome(
          trade.id,
          trade.take_profit,
          new Date().toISOString(),
          'target_hit'
        );
        closedTrades.push({ ...trade, exit_price: trade.take_profit, status: 'target_hit' });
        continue;
      }
    }
  }

  return closedTrades;
}

// -----------------------------------------------------------------------------
// Manual Close
// -----------------------------------------------------------------------------

/**
 * Manually close a trade at the current market price.
 */
export async function manualCloseTrade(
  tradeId: number,
  currentPrice: number
): Promise<void> {
  await closeTradeWithOutcome(
    tradeId,
    currentPrice,
    new Date().toISOString(),
    'closed'
  );
}
