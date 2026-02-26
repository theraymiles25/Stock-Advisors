// =============================================================================
// Stock Advisors - Settings Store
// =============================================================================
// Zustand store for application configuration. Persists to localStorage so
// API keys and preferences survive page refreshes.
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// -----------------------------------------------------------------------------
// State Types
// -----------------------------------------------------------------------------

interface SettingsState {
  /** Anthropic API key for Claude calls */
  anthropicApiKey: string;
  /** Alpha Vantage API key for market data */
  alphaVantageKey: string;
  /** Starting capital for paper trading simulation (USD) */
  paperTradingCapital: number;
  /** How often to poll for news updates (in milliseconds) */
  newsPollingInterval: number;
}

interface SettingsActions {
  /** Set the Anthropic API key */
  setAnthropicApiKey: (key: string) => void;
  /** Set the Alpha Vantage API key */
  setAlphaVantageKey: (key: string) => void;
  /** Set paper trading starting capital */
  setPaperTradingCapital: (amount: number) => void;
  /** Set news polling interval in milliseconds */
  setNewsPollingInterval: (intervalMs: number) => void;
}

interface SettingsComputed {
  /** True when both API keys are configured and non-empty */
  isConfigured: boolean;
}

type SettingsStore = SettingsState & SettingsActions & SettingsComputed;

// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

const DEFAULT_PAPER_TRADING_CAPITAL = 100_000;
const DEFAULT_NEWS_POLLING_INTERVAL = 30 * 60 * 1000; // 30 minutes in ms

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

/**
 * Global settings store with localStorage persistence.
 *
 * Usage:
 * ```tsx
 * const apiKey = useSettingsStore((s) => s.anthropicApiKey);
 * const isReady = useSettingsStore((s) => s.isConfigured);
 * const setKey = useSettingsStore((s) => s.setAnthropicApiKey);
 * ```
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // State
      anthropicApiKey: '',
      alphaVantageKey: '',
      paperTradingCapital: DEFAULT_PAPER_TRADING_CAPITAL,
      newsPollingInterval: DEFAULT_NEWS_POLLING_INTERVAL,

      // Computed
      get isConfigured(): boolean {
        const state = get();
        return (
          state.anthropicApiKey.length > 0 &&
          state.alphaVantageKey.length > 0
        );
      },

      // Actions
      setAnthropicApiKey: (key: string) => {
        set({ anthropicApiKey: key.trim() });
      },

      setAlphaVantageKey: (key: string) => {
        set({ alphaVantageKey: key.trim() });
      },

      setPaperTradingCapital: (amount: number) => {
        set({ paperTradingCapital: Math.max(0, amount) });
      },

      setNewsPollingInterval: (intervalMs: number) => {
        set({ newsPollingInterval: Math.max(60_000, intervalMs) }); // Minimum 1 minute
      },
    }),
    {
      name: 'stock-advisors-settings',
      // Only persist the data fields, not computed or actions
      partialize: (state) => ({
        anthropicApiKey: state.anthropicApiKey,
        alphaVantageKey: state.alphaVantageKey,
        paperTradingCapital: state.paperTradingCapital,
        newsPollingInterval: state.newsPollingInterval,
      }),
    }
  )
);
