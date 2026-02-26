// =============================================================================
// Stock Advisors - Portfolio Store
// =============================================================================
// Zustand store for managing saved portfolios. Each portfolio is a named
// collection of holdings with allocation weights. Persisted to localStorage.
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Holding {
  symbol: string;
  /** Number of shares */
  shares: number;
  /** Average cost basis per share */
  avgCost: number;
  /** Optional target allocation weight (0-100) */
  targetWeight?: number;
}

export interface Portfolio {
  id: string;
  name: string;
  holdings: Holding[];
  createdAt: string;
  updatedAt: string;
}

interface PortfolioState {
  /** All saved portfolios */
  portfolios: Portfolio[];
  /** Currently active portfolio ID */
  activePortfolioId: string | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
}

interface PortfolioActions {
  /** Create a new portfolio */
  createPortfolio: (name: string) => string;
  /** Delete a portfolio by ID */
  deletePortfolio: (id: string) => void;
  /** Rename a portfolio */
  renamePortfolio: (id: string, name: string) => void;
  /** Set the active portfolio */
  setActivePortfolio: (id: string | null) => void;
  /** Add a holding to a portfolio */
  addHolding: (portfolioId: string, holding: Holding) => void;
  /** Remove a holding from a portfolio */
  removeHolding: (portfolioId: string, symbol: string) => void;
  /** Update a holding in a portfolio */
  updateHolding: (portfolioId: string, symbol: string, updates: Partial<Holding>) => void;
  /** Clear error */
  clearError: () => void;
}

interface PortfolioComputed {
  /** Get the currently active portfolio */
  activePortfolio: Portfolio | null;
}

type PortfolioStore = PortfolioState & PortfolioActions & PortfolioComputed;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function generateId(): string {
  return `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

/**
 * Portfolio management store. Supports multiple named portfolios with holdings.
 *
 * Usage:
 * ```tsx
 * const portfolios = usePortfolioStore((s) => s.portfolios);
 * const active = usePortfolioStore((s) => s.activePortfolio);
 * const create = usePortfolioStore((s) => s.createPortfolio);
 * ```
 */
export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      // State
      portfolios: [],
      activePortfolioId: null,
      loading: false,
      error: null,

      // Computed
      get activePortfolio(): Portfolio | null {
        const { portfolios, activePortfolioId } = get();
        if (!activePortfolioId) return portfolios[0] ?? null;
        return portfolios.find((p) => p.id === activePortfolioId) ?? null;
      },

      // Actions
      createPortfolio: (name: string) => {
        const id = generateId();
        const now = new Date().toISOString();
        const portfolio: Portfolio = {
          id,
          name,
          holdings: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          portfolios: [...state.portfolios, portfolio],
          activePortfolioId: state.activePortfolioId ?? id,
        }));
        return id;
      },

      deletePortfolio: (id: string) => {
        set((state) => {
          const filtered = state.portfolios.filter((p) => p.id !== id);
          return {
            portfolios: filtered,
            activePortfolioId:
              state.activePortfolioId === id
                ? (filtered[0]?.id ?? null)
                : state.activePortfolioId,
          };
        });
      },

      renamePortfolio: (id: string, name: string) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === id
              ? { ...p, name, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      setActivePortfolio: (id: string | null) => {
        set({ activePortfolioId: id });
      },

      addHolding: (portfolioId: string, holding: Holding) => {
        set((state) => ({
          portfolios: state.portfolios.map((p) => {
            if (p.id !== portfolioId) return p;
            const existing = p.holdings.find(
              (h) => h.symbol === holding.symbol.toUpperCase()
            );
            if (existing) {
              // Merge: average the cost basis, add shares
              const totalShares = existing.shares + holding.shares;
              const avgCost =
                (existing.avgCost * existing.shares +
                  holding.avgCost * holding.shares) /
                totalShares;
              return {
                ...p,
                holdings: p.holdings.map((h) =>
                  h.symbol === holding.symbol.toUpperCase()
                    ? { ...h, shares: totalShares, avgCost }
                    : h
                ),
                updatedAt: new Date().toISOString(),
              };
            }
            return {
              ...p,
              holdings: [
                ...p.holdings,
                { ...holding, symbol: holding.symbol.toUpperCase() },
              ],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      removeHolding: (portfolioId: string, symbol: string) => {
        const upper = symbol.toUpperCase();
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === portfolioId
              ? {
                  ...p,
                  holdings: p.holdings.filter((h) => h.symbol !== upper),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      updateHolding: (
        portfolioId: string,
        symbol: string,
        updates: Partial<Holding>
      ) => {
        const upper = symbol.toUpperCase();
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === portfolioId
              ? {
                  ...p,
                  holdings: p.holdings.map((h) =>
                    h.symbol === upper ? { ...h, ...updates } : h
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'stock-advisors-portfolios',
      partialize: (state) => ({
        portfolios: state.portfolios,
        activePortfolioId: state.activePortfolioId,
      }),
    }
  )
);
