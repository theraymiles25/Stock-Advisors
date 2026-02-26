// =============================================================================
// Stock Advisors - Trade History Store
// =============================================================================
// Zustand store wrapping TradeMemory and AgentMemory for reactive UI access.
// Loads trades from the database, exposes actions for paper trading, and
// maintains the agent leaderboard.
// =============================================================================

import { create } from 'zustand';
import type { Recommendation } from '../agents/base/types';
import type { TradeRecord, TradeFilters } from '../services/database/TradeMemory';
import type { LeaderboardEntry } from '../services/database/AgentMemory';
import {
  recordTrade,
  closeTrade,
  getOpenTrades,
  getClosedTrades,
  updateTradeStatus,
} from '../services/database/TradeMemory';
import {
  recordRecommendation,
  getLeaderboard,
} from '../services/database/AgentMemory';

// -----------------------------------------------------------------------------
// State Types
// -----------------------------------------------------------------------------

interface TradeHistoryState {
  /** All currently open paper trades */
  openTrades: TradeRecord[];
  /** Closed trades matching the current filter */
  closedTrades: TradeRecord[];
  /** Agent performance leaderboard, ranked by composite score */
  leaderboard: LeaderboardEntry[];
  /** Whether data is currently being loaded from the database */
  loading: boolean;
  /** Last error encountered during a database operation */
  error: string | null;
}

interface TradeHistoryActions {
  /**
   * Load open and closed trades from the database.
   * Optionally pass filters for the closed trades query.
   */
  loadTrades: (filters?: TradeFilters) => Promise<void>;

  /**
   * Execute a paper trade based on an agent's recommendation.
   * Records both the trade and the recommendation in the agent's track record.
   *
   * @param recommendation - The agent recommendation to act on
   * @param quantity - Number of shares to trade
   * @param agentId - Which agent made the recommendation
   * @param pipelineId - Optional pipeline run ID for traceability
   * @returns The ID of the newly created trade
   */
  executePaperTrade: (
    recommendation: Recommendation,
    quantity: number,
    agentId: string,
    pipelineId?: string
  ) => Promise<number>;

  /**
   * Close an open paper trade at a specified price.
   *
   * @param id - Trade ID to close
   * @param price - Exit price
   */
  closePaperTrade: (id: number, price: number) => Promise<void>;

  /**
   * Refresh the agent leaderboard from the database.
   */
  refreshLeaderboard: () => Promise<void>;

  /** Clear the error state */
  clearError: () => void;
}

type TradeHistoryStore = TradeHistoryState & TradeHistoryActions;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

/**
 * Reactive store for trade history, paper trading actions, and agent rankings.
 *
 * Usage:
 * ```tsx
 * const openTrades = useTradeHistoryStore((s) => s.openTrades);
 * const executeTrade = useTradeHistoryStore((s) => s.executePaperTrade);
 * const leaderboard = useTradeHistoryStore((s) => s.leaderboard);
 * ```
 */
export const useTradeHistoryStore = create<TradeHistoryStore>()((set, get) => ({
  // State
  openTrades: [],
  closedTrades: [],
  leaderboard: [],
  loading: false,
  error: null,

  // Actions
  loadTrades: async (filters?: TradeFilters) => {
    set({ loading: true, error: null });
    try {
      const [open, closed] = await Promise.all([
        getOpenTrades(),
        getClosedTrades(filters),
      ]);
      set({ openTrades: open, closedTrades: closed, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load trades';
      console.error('[TradeHistoryStore] loadTrades error:', err);
      set({ loading: false, error: message });
    }
  },

  executePaperTrade: async (
    recommendation: Recommendation,
    quantity: number,
    agentId: string,
    pipelineId?: string
  ): Promise<number> => {
    set({ error: null });
    try {
      const now = new Date().toISOString();

      // Record the trade
      const tradeId = await recordTrade({
        symbol: recommendation.symbol,
        action: recommendation.action,
        quantity,
        entry_price: recommendation.targetPrice ?? 0,
        entry_date: now,
        stop_loss: recommendation.stopLoss ?? null,
        take_profit: recommendation.targetPrice ?? null,
        recommended_by: agentId,
        confidence: recommendation.confidence,
        pipeline_id: pipelineId ?? null,
        notes: recommendation.rationale,
      });

      // Also record in the agent's track record
      await recordRecommendation(
        agentId,
        recommendation.symbol,
        recommendation.action,
        recommendation.confidence,
        recommendation.targetPrice ?? null,
        recommendation.stopLoss ?? null
      );

      // Refresh open trades
      const openTrades = await getOpenTrades();
      set({ openTrades });

      return tradeId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to execute paper trade';
      console.error('[TradeHistoryStore] executePaperTrade error:', err);
      set({ error: message });
      throw err;
    }
  },

  closePaperTrade: async (id: number, price: number) => {
    set({ error: null });
    try {
      const now = new Date().toISOString();
      await closeTrade(id, price, now);

      // Determine new status based on the trade's stop loss / take profit
      const { openTrades: currentOpen } = get();
      const trade = currentOpen.find((t) => t.id === id);
      if (trade) {
        if (trade.stop_loss !== null && price <= trade.stop_loss) {
          await updateTradeStatus(id, 'stopped_out');
        } else if (trade.take_profit !== null && price >= trade.take_profit) {
          await updateTradeStatus(id, 'target_hit');
        }
      }

      // Refresh both open and closed trades
      const [openTrades, closedTrades] = await Promise.all([
        getOpenTrades(),
        getClosedTrades(),
      ]);
      set({ openTrades, closedTrades });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close trade';
      console.error('[TradeHistoryStore] closePaperTrade error:', err);
      set({ error: message });
      throw err;
    }
  },

  refreshLeaderboard: async () => {
    set({ error: null });
    try {
      const leaderboard = await getLeaderboard();
      set({ leaderboard });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load leaderboard';
      console.error('[TradeHistoryStore] refreshLeaderboard error:', err);
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
