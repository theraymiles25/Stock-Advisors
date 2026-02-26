// =============================================================================
// Stock Advisors - History Page (Trade Journal)
// =============================================================================
// Trade history and analysis journal page with filters and a table of past
// trades. Users can filter by agent, symbol, and outcome. Color-coded returns
// and agent avatars provide quick visual context.
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Filter, Search } from 'lucide-react';
import { AgentId } from '../agents/base/types';
import { AGENT_PERSONALITIES } from '../agents/prompts/personalities';
import { useTradeHistoryStore } from '../stores/useTradeHistoryStore';
import type { TradeRecord } from '../services/database/TradeMemory';
import { formatCurrency, formatPercent, formatDate } from '../lib/formatters';
import AgentAvatar from '../components/agents/AgentAvatar';

// -----------------------------------------------------------------------------
// Filter Types
// -----------------------------------------------------------------------------

type OutcomeFilter = 'all' | 'win' | 'loss' | 'pending';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Check if a string is a valid AgentId */
function isValidAgentId(value: string): value is AgentId {
  return Object.values(AgentId).includes(value as AgentId);
}

/** Get display name for an agent ID */
function getAgentDisplayName(agentId: string): string {
  if (isValidAgentId(agentId)) {
    return AGENT_PERSONALITIES[agentId].agentName;
  }
  return agentId;
}

/** Get the action badge styling */
function getActionBadge(action: string): { bg: string; text: string } {
  switch (action) {
    case 'STRONG_BUY':
    case 'BUY':
      return { bg: 'bg-[var(--color-sa-green)]/15', text: 'text-[var(--color-sa-green)]' };
    case 'SELL':
    case 'STRONG_SELL':
      return { bg: 'bg-[var(--color-sa-red)]/15', text: 'text-[var(--color-sa-red)]' };
    default:
      return { bg: 'bg-[var(--color-sa-amber)]/15', text: 'text-[var(--color-sa-amber)]' };
  }
}

/** Determine trade outcome from trade record */
function getTradeOutcome(trade: TradeRecord): 'win' | 'loss' | 'pending' {
  if (trade.status === 'open') return 'pending';
  if (trade.pnl_dollars !== null && trade.pnl_dollars > 0) return 'win';
  if (trade.pnl_dollars !== null && trade.pnl_dollars <= 0) return 'loss';
  return 'pending';
}

// -----------------------------------------------------------------------------
// Trade Row
// -----------------------------------------------------------------------------

function TradeRow({ trade }: { trade: TradeRecord }) {
  const agentId = trade.recommended_by;
  const personality = isValidAgentId(agentId) ? AGENT_PERSONALITIES[agentId] : null;
  const actionBadge = getActionBadge(trade.action);
  const outcome = getTradeOutcome(trade);

  const pnlResult = trade.pnl_percent !== null ? formatPercent(trade.pnl_percent) : null;

  return (
    <tr className="border-b border-[var(--color-sa-border)] hover:bg-[var(--color-sa-bg-hover)] transition-colors duration-100">
      {/* Date */}
      <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-secondary)]">
        {formatDate(new Date(trade.entry_date))}
      </td>

      {/* Symbol */}
      <td className="px-3 py-2.5">
        <span className="text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
          {trade.symbol}
        </span>
      </td>

      {/* Agent */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          {personality && (
            <AgentAvatar
              avatarColor={personality.avatarColor}
              avatarIcon={personality.avatarIcon}
              size="sm"
            />
          )}
          <span className="text-[12px] text-[var(--color-sa-text-secondary)]">
            {getAgentDisplayName(agentId)}
          </span>
        </div>
      </td>

      {/* Action */}
      <td className="px-3 py-2.5">
        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${actionBadge.bg} ${actionBadge.text}`}>
          {trade.action}
        </span>
      </td>

      {/* Confidence */}
      <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-secondary)]">
        {trade.confidence !== null ? `${trade.confidence}%` : '--'}
      </td>

      {/* Outcome */}
      <td className="px-3 py-2.5">
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            outcome === 'win'
              ? 'bg-[var(--color-sa-green)]/15 text-[var(--color-sa-green)]'
              : outcome === 'loss'
              ? 'bg-[var(--color-sa-red)]/15 text-[var(--color-sa-red)]'
              : 'bg-[var(--color-sa-amber)]/15 text-[var(--color-sa-amber)]'
          }`}
        >
          {outcome === 'win' ? 'Win' : outcome === 'loss' ? 'Loss' : 'Pending'}
        </span>
      </td>

      {/* Return */}
      <td className="px-3 py-2.5">
        {pnlResult ? (
          <span
            className={`text-[12px] font-semibold ${
              pnlResult.color === 'green'
                ? 'text-[var(--color-sa-green)]'
                : pnlResult.color === 'red'
                ? 'text-[var(--color-sa-red)]'
                : 'text-[var(--color-sa-text-muted)]'
            }`}
          >
            {pnlResult.text}
          </span>
        ) : (
          <span className="text-[12px] text-[var(--color-sa-text-dim)]">--</span>
        )}
      </td>

      {/* Days Held */}
      <td className="px-3 py-2.5 text-[12px] text-[var(--color-sa-text-secondary)]">
        {trade.holding_days !== null ? `${trade.holding_days}d` : '--'}
      </td>
    </tr>
  );
}

// -----------------------------------------------------------------------------
// History Page
// -----------------------------------------------------------------------------

export default function HistoryPage() {
  const { openTrades, closedTrades, loading, loadTrades } = useTradeHistoryStore();

  // Filters
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');

  // Load trades on mount
  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  // Combine open and closed trades, then apply filters
  const allTrades = useMemo(() => {
    const combined = [...openTrades, ...closedTrades];
    // Sort by entry date descending
    combined.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
    return combined;
  }, [openTrades, closedTrades]);

  const filteredTrades = useMemo(() => {
    return allTrades.filter((trade) => {
      // Agent filter
      if (agentFilter !== 'all' && trade.recommended_by !== agentFilter) {
        return false;
      }

      // Symbol filter
      if (symbolFilter.trim() !== '') {
        const query = symbolFilter.trim().toUpperCase();
        if (!trade.symbol.toUpperCase().includes(query)) {
          return false;
        }
      }

      // Outcome filter
      if (outcomeFilter !== 'all') {
        const outcome = getTradeOutcome(trade);
        if (outcome !== outcomeFilter) {
          return false;
        }
      }

      return true;
    });
  }, [allTrades, agentFilter, symbolFilter, outcomeFilter]);

  // Get unique agent IDs from trades for the dropdown
  const uniqueAgents = useMemo(() => {
    const ids = new Set(allTrades.map((t) => t.recommended_by));
    return Array.from(ids).sort();
  }, [allTrades]);

  const isEmpty = allTrades.length === 0 && !loading;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-sa-accent-dim)]">
              <BookOpen size={18} className="text-[var(--color-sa-accent)]" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-[var(--color-sa-text-primary)]">
                Trade Journal
              </h1>
              <p className="text-[14px] text-[var(--color-sa-text-secondary)]">
                History and analysis of all paper trades
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-4">
          <div className="flex items-center gap-2 text-[var(--color-sa-text-dim)]">
            <Filter size={14} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Filters</span>
          </div>

          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-1.5
                       text-[12px] text-[var(--color-sa-text-primary)] outline-none
                       focus:border-[var(--color-sa-accent)] transition-colors"
          >
            <option value="all">All Agents</option>
            {uniqueAgents.map((id) => (
              <option key={id} value={id}>
                {getAgentDisplayName(id)}
              </option>
            ))}
            {/* Also list all agent IDs when there are no trades yet */}
            {uniqueAgents.length === 0 &&
              Object.values(AgentId).map((id) => (
                <option key={id} value={id}>
                  {AGENT_PERSONALITIES[id].agentName}
                </option>
              ))}
          </select>

          {/* Symbol Filter */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-sa-text-dim)]" />
            <input
              type="text"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              placeholder="Symbol..."
              className="w-28 rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] py-1.5 pl-7 pr-3
                         text-[12px] text-[var(--color-sa-text-primary)] placeholder:text-[var(--color-sa-text-dim)]
                         outline-none focus:border-[var(--color-sa-accent)] transition-colors"
            />
          </div>

          {/* Outcome Filter */}
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
            className="rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)] px-3 py-1.5
                       text-[12px] text-[var(--color-sa-text-primary)] outline-none
                       focus:border-[var(--color-sa-accent)] transition-colors"
          >
            <option value="all">All Outcomes</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="pending">Pending</option>
          </select>

          {/* Trade count */}
          <span className="ml-auto text-[11px] text-[var(--color-sa-text-dim)]">
            {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Empty State */}
        {isEmpty && (
          <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-12 text-center">
            <BookOpen size={40} className="mx-auto text-[var(--color-sa-text-dim)]" />
            <p className="mt-4 text-[14px] font-medium text-[var(--color-sa-text-secondary)]">
              No trade history yet.
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-sa-text-muted)]">
              Start paper trading to build your journal.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-12 text-center">
            <p className="text-[13px] text-[var(--color-sa-text-muted)]">Loading trades...</p>
          </div>
        )}

        {/* Trade Table */}
        {!isEmpty && !loading && (
          <div className="overflow-hidden rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-sa-border)] bg-[var(--color-sa-bg-tertiary)]">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                      Date
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                      Symbol
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                      Agent
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                      Action
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                      Confidence
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                      Outcome
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                      Return
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                      Days Held
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length > 0 ? (
                    filteredTrades.map((trade) => (
                      <TradeRow key={trade.id} trade={trade} />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[13px] text-[var(--color-sa-text-muted)]">
                        No trades match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
