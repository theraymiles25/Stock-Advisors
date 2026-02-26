// =============================================================================
// Stock Advisors - Portfolio Page
// =============================================================================
// Portfolio tracking page showing total value, P&L, cash balance, win rate,
// and a table of current holdings. Integrates with the paper trading store
// for real-time position data. Shows an empty state when no positions exist.
// =============================================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  ArrowRight,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { usePaperTradingStore } from '../stores/usePaperTradingStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { formatCurrency, formatPercent } from '../lib/formatters';

// -----------------------------------------------------------------------------
// Metric Card
// -----------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  subColor?: 'green' | 'red' | 'neutral';
  icon: React.ReactNode;
}

function MetricCard({ label, value, subValue, subColor, icon }: MetricCardProps) {
  const subColorClass =
    subColor === 'green'
      ? 'text-[var(--color-sa-green)]'
      : subColor === 'red'
        ? 'text-[var(--color-sa-red)]'
        : 'text-[var(--color-sa-text-muted)]';

  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-sa-accent-dim)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
          {label}
        </p>
        <p className="text-[16px] font-bold text-[var(--color-sa-text-primary)] tabular-nums">
          {value}
        </p>
        {subValue && (
          <p className={`text-[11px] font-medium tabular-nums ${subColorClass}`}>
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Empty State
// -----------------------------------------------------------------------------

function EmptyPortfolio() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-sa-accent-dim)] mb-4">
        <Briefcase size={28} className="text-[var(--color-sa-accent)]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--color-sa-text-primary)]">
        No holdings yet
      </h3>
      <p className="mt-1.5 max-w-sm text-[13px] text-[var(--color-sa-text-muted)]">
        Execute paper trades to build your portfolio. Track positions, P&L, and performance
        all in one place.
      </p>
      <button
        onClick={() => navigate('/paper-trading')}
        className="mt-5 flex items-center gap-2 rounded-lg bg-[var(--color-sa-accent)]
                   px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-150
                   hover:brightness-110"
      >
        Start Paper Trading
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Holdings Table
// -----------------------------------------------------------------------------

function HoldingsTable() {
  const positions = usePaperTradingStore((s) => s.positions);

  if (positions.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-sa-border)]">
        <h3 className="text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
          Holdings
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-sa-border)]">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                Symbol
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                Shares
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                Avg Cost
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                Current Price
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                P&L
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                % Change
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              // Use entry price as current price placeholder when live data isn't available
              const currentPrice = position.entry_price;
              const costBasis = position.entry_price * position.quantity;
              const currentValue = currentPrice * position.quantity;
              const pnl = currentValue - costBasis;
              const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
              const pnlResult = formatPercent(pnlPercent);

              const pnlColorClass =
                pnl > 0
                  ? 'text-[var(--color-sa-green)]'
                  : pnl < 0
                    ? 'text-[var(--color-sa-red)]'
                    : 'text-[var(--color-sa-text-secondary)]';

              return (
                <tr
                  key={position.id}
                  className="border-b border-[var(--color-sa-border)] last:border-b-0 hover:bg-[var(--color-sa-bg-hover)] transition-colors"
                >
                  <td className="px-5 py-2.5">
                    <span className="text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
                      {position.symbol}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right text-[12px] text-[var(--color-sa-text-secondary)] tabular-nums">
                    {position.quantity}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[12px] text-[var(--color-sa-text-secondary)] tabular-nums">
                    {formatCurrency(position.entry_price)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[12px] text-[var(--color-sa-text-secondary)] tabular-nums">
                    {formatCurrency(currentPrice)}
                  </td>
                  <td className={`px-5 py-2.5 text-right text-[12px] font-medium tabular-nums ${pnlColorClass}`}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                  </td>
                  <td className={`px-5 py-2.5 text-right text-[12px] font-medium tabular-nums ${pnlColorClass}`}>
                    {pnlResult.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Portfolio Page
// -----------------------------------------------------------------------------

export default function PortfolioPage() {
  const navigate = useNavigate();
  const initialized = usePaperTradingStore((s) => s.initialized);
  const totalPortfolioValue = usePaperTradingStore((s) => s.totalPortfolioValue);
  const virtualCash = usePaperTradingStore((s) => s.virtualCash);
  const pnl = usePaperTradingStore((s) => s.pnl);
  const positions = usePaperTradingStore((s) => s.positions);
  const initialize = usePaperTradingStore((s) => s.initialize);
  const startingCapital = useSettingsStore((s) => s.paperTradingCapital);

  // Initialize paper trading store if not already done
  useEffect(() => {
    if (!initialized) {
      initialize(startingCapital);
    }
  }, [initialized, initialize, startingCapital]);

  const pnlResult = formatPercent(pnl.percent);

  // Calculate a mock win rate from positions (in a real app, this would come from closed trades)
  const winRate = positions.length > 0 ? '--' : '0%';

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-bold text-[var(--color-sa-text-primary)]">
              Portfolio
            </h1>
            <p className="mt-1 text-[14px] text-[var(--color-sa-text-secondary)]">
              Track your paper trading holdings and performance
            </p>
          </div>
          <button
            onClick={() => navigate('/paper-trading')}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-sa-border)]
                       bg-[var(--color-sa-bg-secondary)] px-4 py-2 text-[13px] font-medium
                       text-[var(--color-sa-text-primary)] transition-all duration-150
                       hover:border-[var(--color-sa-border-hover)] hover:bg-[var(--color-sa-bg-hover)]"
          >
            <DollarSign size={14} className="text-[var(--color-sa-accent)]" />
            Paper Trading
          </button>
        </div>

        {/* Portfolio Metrics */}
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Portfolio Value"
            value={formatCurrency(totalPortfolioValue)}
            icon={<Briefcase size={18} className="text-[var(--color-sa-accent)]" />}
          />
          <MetricCard
            label="Cash Balance"
            value={formatCurrency(virtualCash)}
            icon={<Wallet size={18} className="text-[var(--color-sa-accent)]" />}
          />
          <MetricCard
            label="Total P&L"
            value={pnl.total >= 0 ? `+${formatCurrency(pnl.total)}` : formatCurrency(pnl.total)}
            subValue={pnlResult.text}
            subColor={pnlResult.color}
            icon={
              pnl.total >= 0 ? (
                <TrendingUp size={18} className="text-[var(--color-sa-green)]" />
              ) : (
                <TrendingDown size={18} className="text-[var(--color-sa-red)]" />
              )
            }
          />
          <MetricCard
            label="Win Rate"
            value={winRate}
            icon={<Target size={18} className="text-[var(--color-sa-accent)]" />}
          />
        </div>

        {/* Holdings Table or Empty State */}
        {positions.length > 0 ? (
          <div className="space-y-6">
            <HoldingsTable />

            {/* Summary Bar */}
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] px-5 py-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-[var(--color-sa-text-dim)]" />
                <span className="text-[12px] text-[var(--color-sa-text-muted)]">
                  {positions.length} open position{positions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => navigate('/analysis')}
                className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-sa-accent)] hover:underline"
              >
                Run analysis on holdings
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]">
            <EmptyPortfolio />
          </div>
        )}
      </div>
    </div>
  );
}
