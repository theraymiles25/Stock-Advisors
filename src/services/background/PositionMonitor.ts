// =============================================================================
// Stock Advisors - Position Monitor (Background Service)
// =============================================================================
// Periodically checks open positions against live prices and triggers
// stop-loss / take-profit closures via TradeOutcomeService.
// =============================================================================

import { checkAndCloseTriggeredTrades } from '../trading/TradeOutcomeService';
import { usePaperTradingStore } from '../../stores/usePaperTradingStore';

// Try to import Tauri notification API; gracefully degrade in browser context
let sendNotification: ((options: { title: string; body: string }) => void) | null = null;

try {
  // Dynamic import handled at module level; if the plugin is not available
  // (e.g., running in a plain browser), notifications are silently skipped.
  import('@tauri-apps/plugin-notification')
    .then((mod) => {
      sendNotification = mod.sendNotification;
    })
    .catch(() => {
      // Not running in Tauri or plugin not installed - notifications disabled
    });
} catch {
  // Static import analysis failed - running outside Tauri
}

// -----------------------------------------------------------------------------
// Price Fetching (Placeholder)
// -----------------------------------------------------------------------------

/**
 * Fetch current prices for a list of symbols.
 *
 * TODO: Wire this up to Alpha Vantage or another market data provider.
 * For now it logs a warning and returns an empty map so the rest of the
 * pipeline can be tested end-to-end once a data source is connected.
 */
async function fetchCurrentPrices(
  symbols: string[]
): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};

  console.log(
    '[PositionMonitor] Price fetch not yet connected to Alpha Vantage ' +
    `(${symbols.length} symbols requested: ${symbols.join(', ')})`
  );

  return {};
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
    // 1. Determine which symbols have open positions
    const positions = usePaperTradingStore.getState().positions;

    if (positions.length === 0) {
      console.log('[PositionMonitor] Checked 0 positions, 0 triggered');
      return;
    }

    const symbols = [...new Set(positions.map((p) => p.symbol))];

    // 2. Fetch current prices
    const currentPrices = await fetchCurrentPrices(symbols);

    // 3. Check for stop-loss / take-profit triggers
    const closedTrades = await checkAndCloseTriggeredTrades(currentPrices);

    console.log(
      `[PositionMonitor] Checked ${positions.length} positions, ` +
      `${closedTrades.length} triggered`
    );

    // 4. Refresh store if any trades were closed
    if (closedTrades.length > 0) {
      await usePaperTradingStore.getState().refreshPositions();

      // 5. Send system notification if Tauri notification API is available
      if (sendNotification) {
        const summary = closedTrades
          .map((t) => `${t.symbol} ${t.status}`)
          .join(', ');

        try {
          sendNotification({
            title: 'Stock Advisors - Trade Alert',
            body: `${closedTrades.length} trade(s) triggered: ${summary}`,
          });
        } catch (err) {
          console.warn('[PositionMonitor] Failed to send notification:', err);
        }
      }
    }
  } catch (err) {
    console.error('[PositionMonitor] Error during tick:', err);
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Start the position monitor. Checks open positions on a fixed interval.
 *
 * @param intervalMs - Polling interval in milliseconds (default: 60 000 = 1 minute)
 * @returns A stop function that clears the interval
 */
export function startPositionMonitor(intervalMs = 60_000): () => void {
  // Prevent duplicate monitors
  if (intervalId !== null) {
    console.warn('[PositionMonitor] Already running - ignoring duplicate start');
    return stopPositionMonitor;
  }

  console.log(
    `[PositionMonitor] Started (polling every ${intervalMs / 1000}s)`
  );

  // Run an initial tick immediately, then on interval
  tick();

  intervalId = setInterval(tick, intervalMs);

  return stopPositionMonitor;
}

/**
 * Stop the position monitor if it is running.
 */
export function stopPositionMonitor(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[PositionMonitor] Stopped');
  }
}
