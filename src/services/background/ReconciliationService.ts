// =============================================================================
// Stock Advisors - Reconciliation Service
// =============================================================================
// Runs on app launch to catch up on any price movements that happened while
// the app was closed. Checks all open trades against current prices and
// closes any that hit their stop-loss or take-profit levels.
// =============================================================================

import { getOpenTrades, type TradeRecord } from '../database/TradeMemory';
import { checkAndCloseTriggeredTrades } from '../trading/TradeOutcomeService';
import { usePaperTradingStore } from '../../stores/usePaperTradingStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ReconciliationResult {
  /** Number of open trades that were checked */
  tradesChecked: number;
  /** Number of trades that were closed during reconciliation */
  tradesClosed: number;
  /** The trade records that were closed */
  closedTrades: TradeRecord[];
  /** ISO timestamp of when reconciliation completed */
  timestamp: string;
}

// -----------------------------------------------------------------------------
// Price Fetching (Placeholder)
// -----------------------------------------------------------------------------

/**
 * Fetch current prices for a list of symbols.
 *
 * TODO: Wire this up to Alpha Vantage or another market data provider.
 * Shared intent with PositionMonitor.fetchCurrentPrices - these should be
 * consolidated into a single price service once a data source is connected.
 */
async function fetchCurrentPrices(
  symbols: string[]
): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};

  console.log(
    '[Reconciliation] Price fetch not yet connected to Alpha Vantage ' +
    `(${symbols.length} symbols requested: ${symbols.join(', ')})`
  );

  return {};
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Reconcile open trades against current market prices on app launch.
 *
 * This catches any stop-loss or take-profit triggers that occurred while
 * the application was closed. Should be called once during app startup,
 * after the database has been initialized.
 */
export async function reconcileOnLaunch(): Promise<ReconciliationResult> {
  try {
    // 1. Fetch all open trades
    const openTrades = await getOpenTrades();

    if (openTrades.length === 0) {
      console.log('[Reconciliation] No open positions to reconcile');
      return {
        tradesChecked: 0,
        tradesClosed: 0,
        closedTrades: [],
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Get unique symbols from open trades
    const symbols = [...new Set(openTrades.map((t) => t.symbol))];

    // 3. Fetch current prices
    const currentPrices = await fetchCurrentPrices(symbols);

    // 4. Check for stop-loss / take-profit triggers
    const closedTrades = await checkAndCloseTriggeredTrades(currentPrices);

    // 5. Refresh the paper trading store to reflect any changes
    if (closedTrades.length > 0) {
      await usePaperTradingStore.getState().refreshPositions();
    }

    const result: ReconciliationResult = {
      tradesChecked: openTrades.length,
      tradesClosed: closedTrades.length,
      closedTrades,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[Reconciliation] Checked ${result.tradesChecked} open positions, ` +
      `${result.tradesClosed} were closed during offline period`
    );

    return result;
  } catch (err) {
    console.error('[Reconciliation] Error during launch reconciliation:', err);

    // Return a safe empty result rather than crashing app startup
    return {
      tradesChecked: 0,
      tradesClosed: 0,
      closedTrades: [],
      timestamp: new Date().toISOString(),
    };
  }
}
