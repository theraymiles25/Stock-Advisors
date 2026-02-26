// =============================================================================
// Stock Advisors - Session Token Tracking Store
// =============================================================================
// Zustand store that tracks cumulative Claude API token usage across the
// current browser session. Not persisted -- resets on page refresh.
//
// Usage:
// ```tsx
// const totalTokens = useTokenTracking((s) => s.totalTokens);
// const addUsage = useTokenTracking((s) => s.addUsage);
// addUsage(1200, 800, 0.024);
// ```
// =============================================================================

import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TokenTrackingState {
  /** Cumulative input (prompt) tokens for the session */
  totalInputTokens: number;
  /** Cumulative output (completion) tokens for the session */
  totalOutputTokens: number;
  /** Sum of input + output tokens */
  totalTokens: number;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Number of API calls made */
  callCount: number;
}

interface TokenTrackingActions {
  /** Record usage from a single API call */
  addUsage: (input: number, output: number, cost: number) => void;
  /** Reset all counters to zero */
  reset: () => void;
}

type TokenTrackingStore = TokenTrackingState & TokenTrackingActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: TokenTrackingState = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  estimatedCost: 0,
  callCount: 0,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useTokenTracking = create<TokenTrackingStore>()((set) => ({
  ...INITIAL_STATE,

  addUsage: (input: number, output: number, cost: number) => {
    set((state) => ({
      totalInputTokens: state.totalInputTokens + input,
      totalOutputTokens: state.totalOutputTokens + output,
      totalTokens: state.totalTokens + input + output,
      estimatedCost: state.estimatedCost + cost,
      callCount: state.callCount + 1,
    }));
  },

  reset: () => {
    set(INITIAL_STATE);
  },
}));
