// =============================================================================
// Stock Advisors - Trade Memory (Paper Trading CRUD)
// =============================================================================
// Manages all paper trade operations: recording new trades, closing positions,
// querying open/closed trades, and computing portfolio-level summaries.
// =============================================================================

import { execute, select } from './Database';
import type { AgentId, RecommendationAction } from '../../agents/base/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Status values a trade can hold */
export type TradeStatus =
  | 'open'
  | 'closed'
  | 'stopped_out'
  | 'target_hit'
  | 'expired'
  | 'cancelled';

/**
 * A single paper trade record as stored in the database.
 */
export interface TradeRecord {
  id: number;
  symbol: string;
  action: RecommendationAction;
  quantity: number;
  entry_price: number;
  entry_date: string;
  exit_price: number | null;
  exit_date: string | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: TradeStatus;
  pnl_dollars: number | null;
  pnl_percent: number | null;
  holding_days: number | null;
  recommended_by: string;
  confidence: number | null;
  pipeline_id: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Filters for querying closed trades.
 */
export interface TradeFilters {
  symbol?: string;
  agentId?: string;
  startDate?: string;
  endDate?: string;
  /** 'win' = pnl_dollars > 0, 'loss' = pnl_dollars <= 0 */
  outcome?: 'win' | 'loss';
  status?: TradeStatus;
}

/**
 * Aggregated portfolio summary derived from open trades and current prices.
 */
export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  positionCount: number;
  largestPosition: { symbol: string; value: number } | null;
}

/** Input shape for recording a new trade (excludes computed / auto fields). */
export interface NewTrade {
  symbol: string;
  action: RecommendationAction;
  quantity: number;
  entry_price: number;
  entry_date: string;
  stop_loss?: number | null;
  take_profit?: number | null;
  recommended_by: AgentId | string;
  confidence?: number | null;
  pipeline_id?: string | null;
  notes?: string | null;
}

// -----------------------------------------------------------------------------
// CRUD Operations
// -----------------------------------------------------------------------------

/**
 * Insert a new paper trade into the database.
 * Returns the ID of the newly created trade.
 */
export async function recordTrade(trade: NewTrade): Promise<number> {
  const result = await execute(
    `INSERT INTO trades
      (symbol, action, quantity, entry_price, entry_date, stop_loss, take_profit,
       status, recommended_by, confidence, pipeline_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
    [
      trade.symbol.toUpperCase(),
      trade.action,
      trade.quantity,
      trade.entry_price,
      trade.entry_date,
      trade.stop_loss ?? null,
      trade.take_profit ?? null,
      trade.recommended_by,
      trade.confidence ?? null,
      trade.pipeline_id ?? null,
      trade.notes ?? null,
    ]
  );
  return result.lastInsertId;
}

/**
 * Close an open trade. Computes realized P&L and holding period.
 */
export async function closeTrade(
  id: number,
  exitPrice: number,
  exitDate: string
): Promise<void> {
  // Fetch the existing trade to compute P&L
  const trades = await select<TradeRecord>(
    'SELECT * FROM trades WHERE id = ?',
    [id]
  );

  if (trades.length === 0) {
    throw new Error(`[TradeMemory] Trade #${id} not found`);
  }

  const trade = trades[0];

  if (trade.status !== 'open') {
    throw new Error(`[TradeMemory] Trade #${id} is already ${trade.status}`);
  }

  // Compute P&L
  const isLong = trade.action === 'BUY' || trade.action === 'STRONG_BUY';
  const priceDiff = isLong
    ? exitPrice - trade.entry_price
    : trade.entry_price - exitPrice;
  const pnlDollars = priceDiff * trade.quantity;
  const pnlPercent = (priceDiff / trade.entry_price) * 100;

  // Compute holding days
  const entryMs = new Date(trade.entry_date).getTime();
  const exitMs = new Date(exitDate).getTime();
  const holdingDays = Math.max(0, Math.round((exitMs - entryMs) / (1000 * 60 * 60 * 24)));

  await execute(
    `UPDATE trades
     SET exit_price = ?, exit_date = ?, status = 'closed',
         pnl_dollars = ?, pnl_percent = ?, holding_days = ?
     WHERE id = ?`,
    [exitPrice, exitDate, pnlDollars, pnlPercent, holdingDays, id]
  );
}

/**
 * Get all trades with status 'open'.
 */
export async function getOpenTrades(): Promise<TradeRecord[]> {
  return select<TradeRecord>(
    'SELECT * FROM trades WHERE status = ? ORDER BY entry_date DESC',
    ['open']
  );
}

/**
 * Get closed trades with optional filters.
 */
export async function getClosedTrades(filters?: TradeFilters): Promise<TradeRecord[]> {
  const conditions: string[] = ['status != ?'];
  const params: unknown[] = ['open'];

  if (filters?.symbol) {
    conditions.push('symbol = ?');
    params.push(filters.symbol.toUpperCase());
  }
  if (filters?.agentId) {
    conditions.push('recommended_by = ?');
    params.push(filters.agentId);
  }
  if (filters?.startDate) {
    conditions.push('exit_date >= ?');
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push('exit_date <= ?');
    params.push(filters.endDate);
  }
  if (filters?.outcome === 'win') {
    conditions.push('pnl_dollars > ?');
    params.push(0);
  } else if (filters?.outcome === 'loss') {
    conditions.push('pnl_dollars <= ?');
    params.push(0);
  }
  if (filters?.status) {
    // Override the first condition if a specific closed status is requested
    conditions[0] = 'status = ?';
    params[0] = filters.status;
  }

  const where = conditions.join(' AND ');
  return select<TradeRecord>(
    `SELECT * FROM trades WHERE ${where} ORDER BY exit_date DESC`,
    params
  );
}

/**
 * Get all trades (open and closed) recommended by a specific agent.
 */
export async function getTradesByAgent(agentId: AgentId | string): Promise<TradeRecord[]> {
  return select<TradeRecord>(
    'SELECT * FROM trades WHERE recommended_by = ? ORDER BY entry_date DESC',
    [agentId]
  );
}

/**
 * Get a single trade by its ID.
 */
export async function getTradeById(id: number): Promise<TradeRecord | null> {
  const rows = await select<TradeRecord>(
    'SELECT * FROM trades WHERE id = ?',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update the status of a trade (e.g., stopped_out, target_hit, expired).
 */
export async function updateTradeStatus(
  id: number,
  status: TradeStatus
): Promise<void> {
  const result = await execute(
    'UPDATE trades SET status = ? WHERE id = ?',
    [status, id]
  );
  if (result.rowsAffected === 0) {
    throw new Error(`[TradeMemory] Trade #${id} not found`);
  }
}

// -----------------------------------------------------------------------------
// Portfolio Aggregations
// -----------------------------------------------------------------------------

/**
 * Calculate total portfolio value from open positions and current market prices.
 *
 * @param openTrades - Array of currently open trades
 * @param currentPrices - Map of symbol -> current price
 */
export function getPortfolioValue(
  openTrades: TradeRecord[],
  currentPrices: Record<string, number>
): PortfolioSummary {
  let totalValue = 0;
  let totalCost = 0;
  let largestValue = 0;
  let largestSymbol = '';

  for (const trade of openTrades) {
    const currentPrice = currentPrices[trade.symbol];
    if (currentPrice === undefined) continue;

    const positionCost = trade.entry_price * trade.quantity;
    const positionValue = currentPrice * trade.quantity;

    totalCost += positionCost;
    totalValue += positionValue;

    if (positionValue > largestValue) {
      largestValue = positionValue;
      largestSymbol = trade.symbol;
    }
  }

  const unrealizedPnl = totalValue - totalCost;
  const unrealizedPnlPercent = totalCost > 0
    ? (unrealizedPnl / totalCost) * 100
    : 0;

  return {
    totalValue,
    totalCost,
    unrealizedPnl,
    unrealizedPnlPercent,
    positionCount: openTrades.length,
    largestPosition: largestSymbol
      ? { symbol: largestSymbol, value: largestValue }
      : null,
  };
}
