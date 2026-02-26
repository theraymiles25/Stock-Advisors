// =============================================================================
// Stock Advisors - Agent Memory (Track Record Operations)
// =============================================================================
// Manages agent recommendation history: recording new picks, resolving
// outcomes, computing per-agent performance statistics, and ranking agents
// on a leaderboard.
// =============================================================================

import { execute, select } from './Database';
import type { AgentId, RecommendationAction } from '../../agents/base/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Outcome values for a resolved recommendation */
export type RecommendationOutcome =
  | 'win'
  | 'loss'
  | 'breakeven'
  | 'stopped_out'
  | 'target_hit'
  | 'expired'
  | 'pending';

/**
 * A single recommendation track record row from the database.
 */
export interface TrackRecord {
  id: number;
  agent_id: string;
  symbol: string;
  recommendation: RecommendationAction;
  confidence: number | null;
  target_price: number | null;
  stop_loss: number | null;
  recommended_at: string;
  outcome: RecommendationOutcome | null;
  actual_return: number | null;
  peak_return: number | null;
  worst_drawdown: number | null;
  days_to_outcome: number | null;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Aggregated performance statistics for an agent.
 */
export interface AgentStats {
  agentId: string;
  totalRecommendations: number;
  resolvedCount: number;
  pendingCount: number;
  wins: number;
  losses: number;
  winRate: number;
  avgReturn: number;
  avgWinReturn: number;
  avgLossReturn: number;
  bestReturn: number;
  worstReturn: number;
  avgConfidence: number;
  avgDaysToOutcome: number;
  maxDrawdown: number;
  /** Simplified Sharpe-like ratio: avgReturn / stdDevReturn */
  sharpeRatio: number;
  /** Profit factor: gross wins / gross losses */
  profitFactor: number;
}

/**
 * Entry on the agent leaderboard.
 */
export interface LeaderboardEntry {
  agentId: string;
  winRate: number;
  avgReturn: number;
  totalRecommendations: number;
  resolvedCount: number;
  sharpeRatio: number;
  profitFactor: number;
  /** Composite rank score (higher is better) */
  score: number;
}

// -----------------------------------------------------------------------------
// Write Operations
// -----------------------------------------------------------------------------

/**
 * Record a new recommendation from an agent.
 * Returns the ID of the inserted track record.
 */
export async function recordRecommendation(
  agentId: AgentId | string,
  symbol: string,
  recommendation: RecommendationAction,
  confidence: number | null,
  targetPrice: number | null,
  stopLoss: number | null
): Promise<number> {
  const result = await execute(
    `INSERT INTO agent_track_records
      (agent_id, symbol, recommendation, confidence, target_price, stop_loss, recommended_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      agentId,
      symbol.toUpperCase(),
      recommendation,
      confidence,
      targetPrice,
      stopLoss,
    ]
  );
  return result.lastInsertId;
}

/**
 * Resolve a recommendation once the outcome is known.
 */
export async function resolveRecommendation(
  id: number,
  outcome: RecommendationOutcome,
  actualReturn: number,
  peakReturn: number | null,
  worstDrawdown: number | null
): Promise<void> {
  // Fetch original to compute days
  const records = await select<TrackRecord>(
    'SELECT * FROM agent_track_records WHERE id = ?',
    [id]
  );

  if (records.length === 0) {
    throw new Error(`[AgentMemory] Track record #${id} not found`);
  }

  const rec = records[0];
  const recMs = new Date(rec.recommended_at).getTime();
  const nowMs = Date.now();
  const daysToOutcome = Math.max(0, Math.round((nowMs - recMs) / (1000 * 60 * 60 * 24)));

  await execute(
    `UPDATE agent_track_records
     SET outcome = ?, actual_return = ?, peak_return = ?, worst_drawdown = ?,
         days_to_outcome = ?, resolved_at = datetime('now')
     WHERE id = ?`,
    [outcome, actualReturn, peakReturn, worstDrawdown, daysToOutcome, id]
  );
}

// -----------------------------------------------------------------------------
// Read Operations
// -----------------------------------------------------------------------------

/**
 * Get all track records for an agent, most recent first.
 */
export async function getAgentTrackRecord(
  agentId: AgentId | string
): Promise<TrackRecord[]> {
  return select<TrackRecord>(
    'SELECT * FROM agent_track_records WHERE agent_id = ? ORDER BY recommended_at DESC',
    [agentId]
  );
}

/**
 * Get an agent's track record for a specific symbol.
 */
export async function getAgentStatsForSymbol(
  agentId: AgentId | string,
  symbol: string
): Promise<TrackRecord[]> {
  return select<TrackRecord>(
    'SELECT * FROM agent_track_records WHERE agent_id = ? AND symbol = ? ORDER BY recommended_at DESC',
    [agentId, symbol.toUpperCase()]
  );
}

/**
 * Get the N most recent recommendations for an agent.
 * Useful for injecting track record context into agent prompts.
 */
export async function getRecentRecommendations(
  agentId: AgentId | string,
  limit: number = 10
): Promise<TrackRecord[]> {
  return select<TrackRecord>(
    'SELECT * FROM agent_track_records WHERE agent_id = ? ORDER BY recommended_at DESC LIMIT ?',
    [agentId, limit]
  );
}

// -----------------------------------------------------------------------------
// Computed Statistics
// -----------------------------------------------------------------------------

/**
 * Compute comprehensive performance statistics for a single agent.
 */
export async function getAgentStats(
  agentId: AgentId | string
): Promise<AgentStats> {
  const records = await getAgentTrackRecord(agentId);

  const resolved = records.filter((r) => r.outcome !== null && r.outcome !== 'pending');
  const pending = records.filter((r) => r.outcome === null || r.outcome === 'pending');
  const wins = resolved.filter((r) => r.outcome === 'win' || r.outcome === 'target_hit');
  const losses = resolved.filter(
    (r) => r.outcome === 'loss' || r.outcome === 'stopped_out'
  );

  const returns = resolved
    .map((r) => r.actual_return)
    .filter((r): r is number => r !== null);

  const winReturns = wins
    .map((r) => r.actual_return)
    .filter((r): r is number => r !== null);

  const lossReturns = losses
    .map((r) => r.actual_return)
    .filter((r): r is number => r !== null);

  const confidences = records
    .map((r) => r.confidence)
    .filter((c): c is number => c !== null);

  const daysToOutcomes = resolved
    .map((r) => r.days_to_outcome)
    .filter((d): d is number => d !== null);

  const drawdowns = resolved
    .map((r) => r.worst_drawdown)
    .filter((d): d is number => d !== null);

  const avgReturn = returns.length > 0
    ? returns.reduce((sum, r) => sum + r, 0) / returns.length
    : 0;

  const avgWinReturn = winReturns.length > 0
    ? winReturns.reduce((sum, r) => sum + r, 0) / winReturns.length
    : 0;

  const avgLossReturn = lossReturns.length > 0
    ? lossReturns.reduce((sum, r) => sum + r, 0) / lossReturns.length
    : 0;

  // Standard deviation of returns for Sharpe-like ratio
  const stdDev = returns.length > 1
    ? Math.sqrt(
        returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (returns.length - 1)
      )
    : 0;

  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Profit factor: sum of winning returns / |sum of losing returns|
  const grossWins = winReturns.reduce((sum, r) => sum + r, 0);
  const grossLosses = Math.abs(lossReturns.reduce((sum, r) => sum + r, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

  return {
    agentId,
    totalRecommendations: records.length,
    resolvedCount: resolved.length,
    pendingCount: pending.length,
    wins: wins.length,
    losses: losses.length,
    winRate: resolved.length > 0 ? (wins.length / resolved.length) * 100 : 0,
    avgReturn,
    avgWinReturn,
    avgLossReturn,
    bestReturn: returns.length > 0 ? Math.max(...returns) : 0,
    worstReturn: returns.length > 0 ? Math.min(...returns) : 0,
    avgConfidence: confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0,
    avgDaysToOutcome: daysToOutcomes.length > 0
      ? daysToOutcomes.reduce((sum, d) => sum + d, 0) / daysToOutcomes.length
      : 0,
    maxDrawdown: drawdowns.length > 0 ? Math.min(...drawdowns) : 0,
    sharpeRatio,
    profitFactor,
  };
}

/**
 * Rank all agents by a composite performance score.
 * Score formula: (winRate * 0.3) + (avgReturn * 0.3) + (sharpeRatio * 10 * 0.2) + (profitFactor * 5 * 0.2)
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  // Get all unique agent IDs from the track records
  const rows = await select<{ agent_id: string }>(
    'SELECT DISTINCT agent_id FROM agent_track_records ORDER BY agent_id',
    []
  );

  const entries: LeaderboardEntry[] = [];

  for (const row of rows) {
    const stats = await getAgentStats(row.agent_id);

    // Only include agents that have at least one resolved recommendation
    if (stats.resolvedCount === 0) continue;

    const cappedProfitFactor = Math.min(stats.profitFactor, 10); // cap infinity
    const score =
      stats.winRate * 0.3 +
      stats.avgReturn * 0.3 +
      stats.sharpeRatio * 10 * 0.2 +
      cappedProfitFactor * 5 * 0.2;

    entries.push({
      agentId: stats.agentId,
      winRate: stats.winRate,
      avgReturn: stats.avgReturn,
      totalRecommendations: stats.totalRecommendations,
      resolvedCount: stats.resolvedCount,
      sharpeRatio: stats.sharpeRatio,
      profitFactor: stats.profitFactor,
      score,
    });
  }

  // Sort descending by composite score
  entries.sort((a, b) => b.score - a.score);

  return entries;
}
