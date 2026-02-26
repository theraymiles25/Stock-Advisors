// =============================================================================
// Stock Advisors - Paper Trading Store
// =============================================================================
// Zustand store for real-time paper trading portfolio state. Tracks virtual
// cash balance, open positions, portfolio value, and P&L calculations.
// Integrates with TradeMemory for persistence.
// =============================================================================

import { create } from 'zustand';
import type { TradeRecord } from '../services/database/TradeMemory';
import { getOpenTrades, getPortfolioValue } from '../services/database/TradeMemory';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PnLSummary {
  /** P&L for today's session */
  today: number;
  /** Lifetime total P&L (realized + unrealized) */
  total: number;
  /** Total P&L as a percentage of starting capital */
  percent: number;
}

interface PaperTradingState {
  /** Available cash not allocated to any position */
  virtualCash: number;
  /** Total portfolio value (cash + position market values) */
  totalPortfolioValue: number;
  /** Starting capital for percentage calculations */
  startingCapital: number;
  /** Currently open positions */
  positions: TradeRecord[];
  /** Profit and loss summary */
  pnl: PnLSummary;
  /** Whether the store has been initialized */
  initialized: boolean;
  /** Whether positions are currently being updated */
  updating: boolean;
  /** Last time positions were updated with live prices */
  lastUpdated: string | null;
  /** Most recent error */
  error: string | null;
}

interface PaperTradingActions {
  /**
   * Initialize the paper trading system with a starting capital amount.
   * Loads existing open positions from the database and computes the
   * remaining cash balance.
   */
  initialize: (startingCapital: number) => Promise<void>;

  /**
   * Update all open positions with current market prices.
   * Recalculates portfolio value and P&L.
   *
   * @param currentPrices - Map of symbol -> current market price
   */
  updatePositions: (currentPrices: Record<string, number>) => void;

  /**
   * Recalculate P&L from current state.
   * Call after trades are opened/closed.
   */
  calculatePnL: () => void;

  /**
   * Reload positions from the database.
   * Useful after external trade operations.
   */
  refreshPositions: () => Promise<void>;

  /**
   * Adjust virtual cash after a trade is executed.
   * Positive amount = cash added (e.g., selling), negative = cash spent (buying).
   */
  adjustCash: (amount: number) => void;

  /** Clear the error state */
  clearError: () => void;
}

type PaperTradingStore = PaperTradingState & PaperTradingActions;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

/**
 * Real-time paper trading portfolio state.
 *
 * Usage:
 * ```tsx
 * const cash = usePaperTradingStore((s) => s.virtualCash);
 * const portfolio = usePaperTradingStore((s) => s.totalPortfolioValue);
 * const pnl = usePaperTradingStore((s) => s.pnl);
 * const init = usePaperTradingStore((s) => s.initialize);
 * ```
 */
export const usePaperTradingStore = create<PaperTradingStore>()((set, get) => ({
  // State
  virtualCash: 0,
  totalPortfolioValue: 0,
  startingCapital: 0,
  positions: [],
  pnl: { today: 0, total: 0, percent: 0 },
  initialized: false,
  updating: false,
  lastUpdated: null,
  error: null,

  // Actions
  initialize: async (startingCapital: number) => {
    try {
      const positions = await getOpenTrades();

      // Calculate how much cash is allocated to open positions
      const allocatedCash = positions.reduce(
        (sum, trade) => sum + trade.entry_price * trade.quantity,
        0
      );

      const virtualCash = Math.max(0, startingCapital - allocatedCash);

      set({
        startingCapital,
        virtualCash,
        positions,
        totalPortfolioValue: startingCapital,
        pnl: { today: 0, total: 0, percent: 0 },
        initialized: true,
        error: null,
      });

      console.log(
        `[PaperTrading] Initialized with $${startingCapital.toLocaleString()} capital, ` +
        `${positions.length} open positions, $${virtualCash.toLocaleString()} available cash`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize paper trading';
      console.error('[PaperTradingStore] initialize error:', err);
      set({ error: message });
    }
  },

  updatePositions: (currentPrices: Record<string, number>) => {
    const { positions, virtualCash, startingCapital } = get();

    set({ updating: true });

    try {
      const portfolio = getPortfolioValue(positions, currentPrices);

      const totalPortfolioValue = virtualCash + portfolio.totalValue;
      const totalPnl = totalPortfolioValue - startingCapital;
      const totalPnlPercent = startingCapital > 0
        ? (totalPnl / startingCapital) * 100
        : 0;

      // Today's P&L: difference from yesterday's close would require
      // historical data; for now, track unrealized change from entry
      const todayPnl = portfolio.unrealizedPnl;

      set({
        totalPortfolioValue,
        pnl: {
          today: todayPnl,
          total: totalPnl,
          percent: totalPnlPercent,
        },
        updating: false,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update positions';
      console.error('[PaperTradingStore] updatePositions error:', err);
      set({ updating: false, error: message });
    }
  },

  calculatePnL: () => {
    const { positions, virtualCash, startingCapital } = get();

    // Without live prices, estimate using entry prices (unrealized = 0)
    const positionValue = positions.reduce(
      (sum, trade) => sum + trade.entry_price * trade.quantity,
      0
    );

    const totalPortfolioValue = virtualCash + positionValue;
    const totalPnl = totalPortfolioValue - startingCapital;
    const totalPnlPercent = startingCapital > 0
      ? (totalPnl / startingCapital) * 100
      : 0;

    set({
      totalPortfolioValue,
      pnl: {
        today: get().pnl.today, // preserve today's P&L from last price update
        total: totalPnl,
        percent: totalPnlPercent,
      },
    });
  },

  refreshPositions: async () => {
    try {
      const positions = await getOpenTrades();
      set({ positions });

      // Recalculate cash based on current positions
      const { startingCapital } = get();
      const allocatedCash = positions.reduce(
        (sum, trade) => sum + trade.entry_price * trade.quantity,
        0
      );
      const virtualCash = Math.max(0, startingCapital - allocatedCash);

      set({ virtualCash });

      // Trigger P&L recalculation
      get().calculatePnL();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh positions';
      console.error('[PaperTradingStore] refreshPositions error:', err);
      set({ error: message });
    }
  },

  adjustCash: (amount: number) => {
    const { virtualCash } = get();
    set({ virtualCash: virtualCash + amount });
  },

  clearError: () => set({ error: null }),
}));
