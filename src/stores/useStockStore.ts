// =============================================================================
// Stock Advisors - Stock Data Store
// =============================================================================
// Zustand store for stock quotes, watchlist management, and search state.
// Caches quote data in memory and persists the watchlist to localStorage.
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  updatedAt: string;
}

interface StockState {
  /** Symbols the user is watching */
  watchlist: string[];
  /** Cached quotes keyed by symbol */
  quotes: Record<string, StockQuote>;
  /** Current search query in the search bar */
  searchQuery: string;
  /** Whether a quote fetch is in progress */
  loading: boolean;
  /** Most recent error */
  error: string | null;
}

interface StockActions {
  /** Add a symbol to the watchlist */
  addToWatchlist: (symbol: string) => void;
  /** Remove a symbol from the watchlist */
  removeFromWatchlist: (symbol: string) => void;
  /** Replace the entire watchlist */
  setWatchlist: (symbols: string[]) => void;
  /** Store a quote for a symbol */
  setQuote: (symbol: string, quote: StockQuote) => void;
  /** Store multiple quotes at once */
  setQuotes: (quotes: Record<string, StockQuote>) => void;
  /** Update the search query */
  setSearchQuery: (query: string) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Clear all cached quotes */
  clearQuotes: () => void;
}

type StockStore = StockState & StockActions;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

/**
 * Global store for stock data, watchlist, and search state.
 * Watchlist is persisted to localStorage; quotes are in-memory only.
 *
 * Usage:
 * ```tsx
 * const watchlist = useStockStore((s) => s.watchlist);
 * const quote = useStockStore((s) => s.quotes['AAPL']);
 * const addSymbol = useStockStore((s) => s.addToWatchlist);
 * ```
 */
export const useStockStore = create<StockStore>()(
  persist(
    (set, get) => ({
      // State
      watchlist: [],
      quotes: {},
      searchQuery: '',
      loading: false,
      error: null,

      // Actions
      addToWatchlist: (symbol: string) => {
        const upper = symbol.toUpperCase().trim();
        const { watchlist } = get();
        if (!upper || watchlist.includes(upper)) return;
        set({ watchlist: [...watchlist, upper] });
      },

      removeFromWatchlist: (symbol: string) => {
        const upper = symbol.toUpperCase().trim();
        set((state) => ({
          watchlist: state.watchlist.filter((s) => s !== upper),
        }));
      },

      setWatchlist: (symbols: string[]) => {
        set({ watchlist: symbols.map((s) => s.toUpperCase().trim()) });
      },

      setQuote: (symbol: string, quote: StockQuote) => {
        set((state) => ({
          quotes: { ...state.quotes, [symbol.toUpperCase()]: quote },
        }));
      },

      setQuotes: (quotes: Record<string, StockQuote>) => {
        set((state) => ({
          quotes: { ...state.quotes, ...quotes },
        }));
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setLoading: (loading: boolean) => {
        set({ loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearQuotes: () => {
        set({ quotes: {} });
      },
    }),
    {
      name: 'stock-advisors-stocks',
      partialize: (state) => ({
        watchlist: state.watchlist,
      }),
    }
  )
);
