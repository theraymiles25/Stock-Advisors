// =============================================================================
// Stock Advisors - News Monitor (Background Service)
// =============================================================================
// Periodically polls for news on watchlisted symbols. When significant news
// is detected (future implementation), it can trigger system notifications
// or surface alerts in the UI.
// =============================================================================

import { useStockStore } from '../../stores/useStockStore';

// -----------------------------------------------------------------------------
// News Fetching (Placeholder)
// -----------------------------------------------------------------------------

/**
 * Fetch news for a single symbol.
 *
 * TODO: Wire up to a news API (e.g., Alpha Vantage NEWS_SENTIMENT, Finnhub,
 * or NewsAPI). For now this is a stub that logs intent and returns nothing.
 */
async function fetchNewsForSymbol(
  _symbol: string
): Promise<void> {
  console.log(`[NewsMonitor] Would fetch news for ${_symbol}`);
  // Future: return parsed news items, check for significance, etc.
}

// -----------------------------------------------------------------------------
// Monitor State
// -----------------------------------------------------------------------------

let intervalId: ReturnType<typeof setInterval> | null = null;

// -----------------------------------------------------------------------------
// Core Tick
// -----------------------------------------------------------------------------

async function tick(): Promise<void> {
  try {
    const watchlist = useStockStore.getState().watchlist;

    if (watchlist.length === 0) {
      console.log('[NewsMonitor] No symbols on watchlist - skipping');
      return;
    }

    console.log(
      `[NewsMonitor] Checking news for ${watchlist.length} symbol(s): ` +
      watchlist.join(', ')
    );

    for (const symbol of watchlist) {
      await fetchNewsForSymbol(symbol);
    }

    // Placeholder: if significant news is found in the future, send
    // notifications or update a news store here.

    console.log(
      `[NewsMonitor] Completed news check for ${watchlist.length} symbol(s)`
    );
  } catch (err) {
    console.error('[NewsMonitor] Error during tick:', err);
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Start the news monitor. Polls for news on watchlisted symbols at a fixed
 * interval.
 *
 * @param intervalMs - Polling interval in milliseconds (default: 300 000 = 5 minutes)
 * @returns A stop function that clears the interval
 */
export function startNewsMonitor(intervalMs = 300_000): () => void {
  // Prevent duplicate monitors
  if (intervalId !== null) {
    console.warn('[NewsMonitor] Already running - ignoring duplicate start');
    return stopNewsMonitor;
  }

  console.log(
    `[NewsMonitor] Started (polling every ${intervalMs / 1000}s)`
  );

  // Run an initial tick immediately, then on interval
  tick();

  intervalId = setInterval(tick, intervalMs);

  return stopNewsMonitor;
}

/**
 * Stop the news monitor if it is running.
 */
export function stopNewsMonitor(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[NewsMonitor] Stopped');
  }
}
