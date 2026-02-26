// =============================================================================
// Stock Advisors - Paper Trading Page
// =============================================================================
// Paper trading execution and position tracking. Shows a portfolio summary bar,
// a trade execution form, and an open positions table. Integrates with
// usePaperTradingStore for state and useSettingsStore for starting capital.
// =============================================================================

import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRightLeft,
  Send,
  Package,
} from 'lucide-react';
import { AgentId } from '../agents/base/types';
import type { RecommendationAction } from '../agents/base/types';
import { AGENT_PERSONALITIES } from '../agents/prompts/personalities';
import { usePaperTradingStore } from '../stores/usePaperTradingStore';
import { useTradeHistoryStore } from '../stores/useTradeHistoryStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { formatCurrency, formatPercent } from '../lib/formatters';
import AgentAvatar from '../components/agents/AgentAvatar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type TradeAction = 'BUY' | 'SELL' | 'SHORT' | 'COVER';

// Map UI trade actions to RecommendationAction for the store
function toRecommendationAction(action: TradeAction): RecommendationAction {
  switch (action) {
    case 'BUY':
      return 'BUY';
    case 'SELL':
      return 'SELL';
    case 'SHORT':
      return 'STRONG_SELL';
    case 'COVER':
      return 'STRONG_BUY';
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function isValidAgentId(value: string): value is AgentId {
  return Object.values(AgentId).includes(value as AgentId);
}

// -----------------------------------------------------------------------------
// Portfolio Summary Card
// -----------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon,
  valueColor,
  subValue,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueColor?: string;
  subValue?: string;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-sa-accent-dim)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--color-sa-text-dim)]">{label}</p>
        <p className={`text-[15px] font-bold ${valueColor ?? 'text-[var(--color-sa-text-primary)]'}`}>
          {value}
        </p>
        {subValue && (
          <p className="text-[11px] text-[var(--color-sa-text-muted)]">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Paper Trading Page
// -----------------------------------------------------------------------------

export default function PaperTradingPage() {
  const paperTrading = usePaperTradingStore();
  const executePaperTrade = useTradeHistoryStore((s) => s.executePaperTrade);
  const startingCapital = useSettingsStore((s) => s.paperTradingCapital);

  // Initialize paper trading on mount
  useEffect(() => {
    if (!paperTrading.initialized) {
      paperTrading.initialize(startingCapital);
    }
  }, [paperTrading, startingCapital]);

  // Form state
  const [symbol, setSymbol] = useState('');
  const [action, setAction] = useState<TradeAction>('BUY');
  const [quantity, setQuantity] = useState<string>('');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<string>(AgentId.GOLDMAN_SCREENER);
  const [confidence, setConfidence] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Portfolio values
  const pnlResult = formatPercent(paperTrading.pnl.percent);
  const pnlColor =
    pnlResult.color === 'green'
      ? 'text-[var(--color-sa-green)]'
      : pnlResult.color === 'red'
      ? 'text-[var(--color-sa-red)]'
      : 'text-[var(--color-sa-text-primary)]';

  // Form submit handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Validate
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setFormError('Symbol is required.');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Quantity must be a positive number.');
      return;
    }

    const price = parseFloat(entryPrice);
    if (isNaN(price) || price <= 0) {
      setFormError('Entry price must be a positive number.');
      return;
    }

    const sl = stopLoss.trim() !== '' ? parseFloat(stopLoss) : undefined;
    if (sl !== undefined && (isNaN(sl) || sl <= 0)) {
      setFormError('Stop loss must be a positive number.');
      return;
    }

    const tp = takeProfit.trim() !== '' ? parseFloat(takeProfit) : undefined;
    if (tp !== undefined && (isNaN(tp) || tp <= 0)) {
      setFormError('Take profit must be a positive number.');
      return;
    }

    const conf = confidence.trim() !== '' ? parseInt(confidence, 10) : undefined;
    if (conf !== undefined && (isNaN(conf) || conf < 0 || conf > 100)) {
      setFormError('Confidence must be between 0 and 100.');
      return;
    }

    setSubmitting(true);
    try {
      await executePaperTrade(
        {
          symbol: sym,
          action: toRecommendationAction(action),
          confidence: conf ?? 50,
          timeHorizon: 'medium',
          rationale: `Manual paper trade via ${AGENT_PERSONALITIES[selectedAgent as AgentId]?.agentName ?? selectedAgent}`,
          targetPrice: tp,
          stopLoss: sl,
        },
        qty,
        selectedAgent
      );

      // Refresh positions
      await paperTrading.refreshPositions();

      setFormSuccess(`Executed ${action} ${qty} ${sym} at ${formatCurrency(price)}`);

      // Reset form
      setSymbol('');
      setQuantity('');
      setEntryPrice('');
      setStopLoss('');
      setTakeProfit('');
      setConfidence('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to execute trade';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-sa-accent-dim)]">
              <ArrowRightLeft size={18} className="text-[var(--color-sa-accent)]" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-[var(--color-sa-text-primary)]">
                Paper Trading
              </h1>
              <p className="text-[14px] text-[var(--color-sa-text-secondary)]">
                Execute simulated trades and track positions
              </p>
            </div>
          </div>
        </div>

        {/* Portfolio Summary Bar */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Starting Capital"
            value={formatCurrency(paperTrading.startingCapital)}
            icon={<Wallet size={18} className="text-[var(--color-sa-accent)]" />}
          />
          <SummaryCard
            label="Current Value"
            value={formatCurrency(paperTrading.totalPortfolioValue)}
            icon={<DollarSign size={18} className="text-[var(--color-sa-accent)]" />}
          />
          <SummaryCard
            label="Cash Balance"
            value={formatCurrency(paperTrading.virtualCash)}
            icon={<Wallet size={18} className="text-[var(--color-sa-accent)]" />}
          />
          <SummaryCard
            label="Total P&L"
            value={formatCurrency(paperTrading.pnl.total)}
            icon={
              paperTrading.pnl.total >= 0 ? (
                <TrendingUp size={18} className="text-[var(--color-sa-green)]" />
              ) : (
                <TrendingDown size={18} className="text-[var(--color-sa-red)]" />
              )
            }
            valueColor={pnlColor}
            subValue={pnlResult.text}
          />
        </div>

        {/* Execute Trade Form */}
        <div className="mb-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Execute Trade
          </h2>
          <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-5">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Symbol */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-2
                               text-[13px] text-[var(--color-sa-text-primary)] placeholder:text-[var(--color-sa-text-dim)]
                               outline-none focus:border-[var(--color-sa-accent)] transition-colors"
                  />
                </div>

                {/* Action */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                    Action
                  </label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as TradeAction)}
                    className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-2
                               text-[13px] text-[var(--color-sa-text-primary)] outline-none
                               focus:border-[var(--color-sa-accent)] transition-colors"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                    <option value="SHORT">SHORT</option>
                    <option value="COVER">COVER</option>
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="100"
                    min="1"
                    className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-2
                               text-[13px] text-[var(--color-sa-text-primary)] placeholder:text-[var(--color-sa-text-dim)]
                               outline-none focus:border-[var(--color-sa-accent)] transition-colors"
                  />
                </div>

                {/* Entry Price */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                    Entry Price
                  </label>
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="150.00"
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-2
                               text-[13px] text-[var(--color-sa-text-primary)] placeholder:text-[var(--color-sa-text-dim)]
                               outline-none focus:border-[var(--color-sa-accent)] transition-colors"
                  />
                </div>

                {/* Stop Loss */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                    Stop Loss
                    <span className="ml-1 font-normal normal-case tracking-normal text-[var(--color-sa-text-dim)]">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="140.00"
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-2
                               text-[13px] text-[var(--color-sa-text-primary)] placeholder:text-[var(--color-sa-text-dim)]
                               outline-none focus:border-[var(--color-sa-accent)] transition-colors"
                  />
                </div>

                {/* Take Profit */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                    Take Profit
                    <span className="ml-1 font-normal normal-case tracking-normal text-[var(--color-sa-text-dim)]">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="170.00"
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-2
                               text-[13px] text-[var(--color-sa-text-primary)] placeholder:text-[var(--color-sa-text-dim)]
                               outline-none focus:border-[var(--color-sa-accent)] transition-colors"
                  />
                </div>

                {/* Agent Selector */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                    Agent
                  </label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-2
                               text-[13px] text-[var(--color-sa-text-primary)] outline-none
                               focus:border-[var(--color-sa-accent)] transition-colors"
                  >
                    {Object.values(AgentId).map((id) => (
                      <option key={id} value={id}>
                        {AGENT_PERSONALITIES[id].agentName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Confidence */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                    Confidence
                    <span className="ml-1 font-normal normal-case tracking-normal text-[var(--color-sa-text-dim)]">(0-100)</span>
                  </label>
                  <input
                    type="number"
                    value={confidence}
                    onChange={(e) => setConfidence(e.target.value)}
                    placeholder="75"
                    min="0"
                    max="100"
                    className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-2
                               text-[13px] text-[var(--color-sa-text-primary)] placeholder:text-[var(--color-sa-text-dim)]
                               outline-none focus:border-[var(--color-sa-accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Error / Success Messages */}
              {formError && (
                <div className="mt-4 rounded-lg border border-[var(--color-sa-red)]/30 bg-[var(--color-sa-red)]/10 px-3 py-2 text-[12px] text-[var(--color-sa-red)]">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="mt-4 rounded-lg border border-[var(--color-sa-green)]/30 bg-[var(--color-sa-green)]/10 px-3 py-2 text-[12px] text-[var(--color-sa-green)]">
                  {formSuccess}
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-[var(--color-sa-accent)] px-5 py-2.5
                             text-[13px] font-semibold text-white transition-all duration-150
                             hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                  {submitting ? 'Executing...' : 'Execute Paper Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Open Positions Table */}
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Open Positions
          </h2>
          <div className="overflow-hidden rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]">
            {paperTrading.positions.length === 0 ? (
              <div className="p-12 text-center">
                <Package size={40} className="mx-auto text-[var(--color-sa-text-dim)]" />
                <p className="mt-4 text-[14px] font-medium text-[var(--color-sa-text-secondary)]">
                  No open positions
                </p>
                <p className="mt-1 text-[13px] text-[var(--color-sa-text-muted)]">
                  Execute a paper trade above to open your first position.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-sa-border)] bg-[var(--color-sa-bg-tertiary)]">
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                        Symbol
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                        Action
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                        Entry Price
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                        Current Price
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                        P&L
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                        Agent
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paperTrading.positions.map((position) => {
                      const personality = isValidAgentId(position.recommended_by)
                        ? AGENT_PERSONALITIES[position.recommended_by]
                        : null;

                      // Without live prices, show entry price as current
                      const currentPrice = position.entry_price;
                      const positionPnl = 0; // No live prices yet
                      const pnlDisplay = formatPercent(positionPnl);

                      return (
                        <tr
                          key={position.id}
                          className="border-b border-[var(--color-sa-border)] hover:bg-[var(--color-sa-bg-hover)] transition-colors duration-100"
                        >
                          <td className="px-3 py-2.5 text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
                            {position.symbol}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                position.action === 'BUY' || position.action === 'STRONG_BUY'
                                  ? 'bg-[var(--color-sa-green)]/15 text-[var(--color-sa-green)]'
                                  : position.action === 'SELL' || position.action === 'STRONG_SELL'
                                  ? 'bg-[var(--color-sa-red)]/15 text-[var(--color-sa-red)]'
                                  : 'bg-[var(--color-sa-amber)]/15 text-[var(--color-sa-amber)]'
                              }`}
                            >
                              {position.action}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-secondary)]">
                            {position.quantity}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-secondary)]">
                            {formatCurrency(position.entry_price)}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-muted)]">
                            {formatCurrency(currentPrice)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`text-[12px] font-semibold ${
                                pnlDisplay.color === 'green'
                                  ? 'text-[var(--color-sa-green)]'
                                  : pnlDisplay.color === 'red'
                                  ? 'text-[var(--color-sa-red)]'
                                  : 'text-[var(--color-sa-text-muted)]'
                              }`}
                            >
                              {pnlDisplay.text}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-block rounded-md bg-[var(--color-sa-accent)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-sa-accent)]">
                              {position.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {personality && (
                                <AgentAvatar
                                  avatarColor={personality.avatarColor}
                                  avatarIcon={personality.avatarIcon}
                                  size="sm"
                                />
                              )}
                              <span className="text-[12px] text-[var(--color-sa-text-secondary)]">
                                {personality?.agentName ?? position.recommended_by}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
