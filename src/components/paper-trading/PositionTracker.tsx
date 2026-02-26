// =============================================================================
// Stock Advisors - Position Tracker Component
// =============================================================================
// Displays all open paper trading positions with real-time P&L calculated from
// live prices passed as a prop. Shows a sortable table of positions with entry
// vs current price, dollar and percent P&L, stop/target levels, and a summary
// footer with total unrealized P&L.
// =============================================================================

import { useMemo } from 'react';
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  Package,
  ShieldCheck,
  Target,
  Minus,
} from 'lucide-react';
import { usePaperTradingStore } from '../../stores/usePaperTradingStore';
import { formatCurrency, formatPercent } from '../../lib/formatters';
import type { TradeRecord } from '../../services/database/TradeMemory';
import type { RecommendationAction } from '../../agents/base/types';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface PositionTrackerProps {
  /** Map of symbol -> current market price for live P&L calculations */
  currentPrices: Record<string, number>;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function isLongAction(action: RecommendationAction): boolean {
  return action === 'BUY' || action === 'STRONG_BUY';
}

/** Compute unrealized P&L for a single position given its current price. */
function computePnL(trade: TradeRecord, currentPrice: number) {
  const isLong = isLongAction(trade.action);
  const priceDiff = isLong
    ? currentPrice - trade.entry_price
    : trade.entry_price - currentPrice;
  const pnlDollars = priceDiff * trade.quantity;
  const pnlPercent =
    trade.entry_price > 0 ? (priceDiff / trade.entry_price) * 100 : 0;
  return { pnlDollars, pnlPercent };
}

/** Badge color class for the action column. */
function actionBadgeClass(action: RecommendationAction): string {
  if (action === 'BUY' || action === 'STRONG_BUY') {
    return 'bg-[var(--color-sa-green)]/15 text-[var(--color-sa-green)]';
  }
  if (action === 'SELL' || action === 'STRONG_SELL') {
    return 'bg-[var(--color-sa-red)]/15 text-[var(--color-sa-red)]';
  }
  return 'bg-[var(--color-sa-amber)]/15 text-[var(--color-sa-amber)]';
}

/** Determine a status label for the position relative to its stops/targets. */
function positionStatusLabel(
  trade: TradeRecord,
  currentPrice: number | undefined
): { label: string; colorClass: string } {
  if (currentPrice === undefined) {
    return { label: 'No Price', colorClass: 'text-[var(--color-sa-text-dim)]' };
  }

  const isLong = isLongAction(trade.action);

  // Check proximity to stop-loss (within 2%)
  if (trade.stop_loss !== null) {
    const distToStop = isLong
      ? (currentPrice - trade.stop_loss) / currentPrice
      : (trade.stop_loss - currentPrice) / currentPrice;
    if (distToStop <= 0.02 && distToStop >= 0) {
      return { label: 'Near Stop', colorClass: 'text-[var(--color-sa-red)]' };
    }
  }

  // Check proximity to take-profit (within 2%)
  if (trade.take_profit !== null) {
    const distToTarget = isLong
      ? (trade.take_profit - currentPrice) / currentPrice
      : (currentPrice - trade.take_profit) / currentPrice;
    if (distToTarget <= 0.02 && distToTarget >= 0) {
      return { label: 'Near Target', colorClass: 'text-[var(--color-sa-green)]' };
    }
  }

  // Default: active
  return { label: 'Active', colorClass: 'text-[var(--color-sa-accent)]' };
}

// -----------------------------------------------------------------------------
// Table Header Cell
// -----------------------------------------------------------------------------

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
      {children}
    </th>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function PositionTracker({ currentPrices }: PositionTrackerProps) {
  const positions = usePaperTradingStore((s) => s.positions);

  // Compute per-position P&L and the portfolio total
  const { rows, totalPnlDollars, totalPnlPercent, totalCost } = useMemo(() => {
    let sumPnl = 0;
    let sumCost = 0;

    const computed = positions.map((trade) => {
      const currentPrice = currentPrices[trade.symbol];
      const hasCurrent = currentPrice !== undefined;

      const { pnlDollars, pnlPercent } = hasCurrent
        ? computePnL(trade, currentPrice)
        : { pnlDollars: 0, pnlPercent: 0 };

      const positionCost = trade.entry_price * trade.quantity;
      sumPnl += pnlDollars;
      sumCost += positionCost;

      const status = positionStatusLabel(trade, currentPrice);

      return {
        trade,
        currentPrice: hasCurrent ? currentPrice : null,
        pnlDollars,
        pnlPercent,
        status,
      };
    });

    const totalPct = sumCost > 0 ? (sumPnl / sumCost) * 100 : 0;

    return {
      rows: computed,
      totalPnlDollars: sumPnl,
      totalPnlPercent: totalPct,
      totalCost: sumCost,
    };
  }, [positions, currentPrices]);

  const totalPnlFormatted = formatPercent(totalPnlPercent);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Crosshair size={14} className="text-[var(--color-sa-text-dim)]" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
          Open Positions
        </h2>
        {positions.length > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-sa-accent)]/15 px-1.5 text-[10px] font-bold text-[var(--color-sa-accent)]">
            {positions.length}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-card)]">
        {positions.length === 0 ? (
          /* ---- Empty State ---- */
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-[var(--color-sa-text-dim)]" />
            <p className="mt-4 text-[14px] font-medium text-[var(--color-sa-text-secondary)]">
              No open positions
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-sa-text-dim)]">
              Positions will appear here once paper trades are executed.
            </p>
          </div>
        ) : (
          /* ---- Positions Table ---- */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-sa-border)] bg-[var(--color-sa-bg-card)]">
                  <Th>Symbol</Th>
                  <Th>Action</Th>
                  <Th>Qty</Th>
                  <Th>Entry Price</Th>
                  <Th>Current Price</Th>
                  <Th>P&L ($)</Th>
                  <Th>P&L (%)</Th>
                  <Th>Stop Loss</Th>
                  <Th>Target</Th>
                  <Th>Status</Th>
                </tr>
              </thead>

              <tbody>
                {rows.map(({ trade, currentPrice, pnlDollars, pnlPercent, status }) => {
                  const pnlDollarColor =
                    pnlDollars > 0
                      ? 'text-[var(--color-sa-green)]'
                      : pnlDollars < 0
                      ? 'text-[var(--color-sa-red)]'
                      : 'text-[var(--color-sa-text-dim)]';

                  const pnlPctResult = formatPercent(pnlPercent);
                  const pnlPctColor =
                    pnlPctResult.color === 'green'
                      ? 'text-[var(--color-sa-green)]'
                      : pnlPctResult.color === 'red'
                      ? 'text-[var(--color-sa-red)]'
                      : 'text-[var(--color-sa-text-dim)]';

                  return (
                    <tr
                      key={trade.id}
                      className="border-b border-[var(--color-sa-border)] transition-colors duration-100 hover:bg-[var(--color-sa-bg-card)]/80"
                    >
                      {/* Symbol */}
                      <td className="px-3 py-2.5 text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
                        {trade.symbol}
                      </td>

                      {/* Action badge */}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${actionBadgeClass(trade.action)}`}
                        >
                          {trade.action}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-secondary)]">
                        {trade.quantity}
                      </td>

                      {/* Entry Price */}
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-secondary)]">
                        {formatCurrency(trade.entry_price)}
                      </td>

                      {/* Current Price */}
                      <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-primary)]">
                        {currentPrice !== null ? (
                          formatCurrency(currentPrice)
                        ) : (
                          <span className="text-[var(--color-sa-text-dim)]">--</span>
                        )}
                      </td>

                      {/* P&L ($) */}
                      <td className="px-3 py-2.5">
                        <span className={`text-[12px] font-semibold ${pnlDollarColor}`}>
                          {currentPrice !== null ? (
                            <>
                              {pnlDollars >= 0 ? '+' : ''}
                              {formatCurrency(pnlDollars)}
                            </>
                          ) : (
                            <span className="text-[var(--color-sa-text-dim)]">--</span>
                          )}
                        </span>
                      </td>

                      {/* P&L (%) */}
                      <td className="px-3 py-2.5">
                        <span className={`text-[12px] font-semibold ${pnlPctColor}`}>
                          {currentPrice !== null ? (
                            pnlPctResult.text
                          ) : (
                            <span className="text-[var(--color-sa-text-dim)]">--</span>
                          )}
                        </span>
                      </td>

                      {/* Stop Loss */}
                      <td className="px-3 py-2.5 text-[12px]">
                        {trade.stop_loss !== null ? (
                          <span className="inline-flex items-center gap-1 text-[var(--color-sa-red)]">
                            <ShieldCheck size={11} />
                            {formatCurrency(trade.stop_loss)}
                          </span>
                        ) : (
                          <Minus size={12} className="text-[var(--color-sa-text-dim)]" />
                        )}
                      </td>

                      {/* Target */}
                      <td className="px-3 py-2.5 text-[12px]">
                        {trade.take_profit !== null ? (
                          <span className="inline-flex items-center gap-1 text-[var(--color-sa-green)]">
                            <Target size={11} />
                            {formatCurrency(trade.take_profit)}
                          </span>
                        ) : (
                          <Minus size={12} className="text-[var(--color-sa-text-dim)]" />
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded-md bg-[var(--color-sa-border)]/30 px-2 py-0.5 text-[11px] font-semibold ${status.colorClass}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ---- Summary Footer ---- */}
              <tfoot>
                <tr className="border-t border-[var(--color-sa-border)] bg-[var(--color-sa-bg-card)]">
                  <td
                    colSpan={5}
                    className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]"
                  >
                    Total Unrealized P&L
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[13px] font-bold ${
                        totalPnlDollars > 0
                          ? 'text-[var(--color-sa-green)]'
                          : totalPnlDollars < 0
                          ? 'text-[var(--color-sa-red)]'
                          : 'text-[var(--color-sa-text-primary)]'
                      }`}
                    >
                      <span className="mr-1 inline-block align-middle">
                        {totalPnlDollars >= 0 ? (
                          <TrendingUp size={13} />
                        ) : (
                          <TrendingDown size={13} />
                        )}
                      </span>
                      {totalPnlDollars >= 0 ? '+' : ''}
                      {formatCurrency(totalPnlDollars)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[13px] font-bold ${
                        totalPnlFormatted.color === 'green'
                          ? 'text-[var(--color-sa-green)]'
                          : totalPnlFormatted.color === 'red'
                          ? 'text-[var(--color-sa-red)]'
                          : 'text-[var(--color-sa-text-primary)]'
                      }`}
                    >
                      {totalPnlFormatted.text}
                    </span>
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
