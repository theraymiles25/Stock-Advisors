// =============================================================================
// Stock Advisors - Performance Page (Agent Leaderboard)
// =============================================================================
// Agent leaderboard ranked by composite score, plus individual agent report
// cards showing key performance metrics. Loads data asynchronously from
// AgentMemory and displays gold/silver/bronze styling for top 3 agents.
// =============================================================================

import { useState, useEffect } from 'react';
import { Trophy, Medal, Star } from 'lucide-react';
import { AgentId } from '../agents/base/types';
import { AGENT_PERSONALITIES } from '../agents/prompts/personalities';
import {
  getLeaderboard,
  getAgentStats,
  type LeaderboardEntry,
  type AgentStats,
} from '../services/database/AgentMemory';
import { formatPercent } from '../lib/formatters';
import AgentAvatar from '../components/agents/AgentAvatar';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Check if a string is a valid AgentId */
function isValidAgentId(value: string): value is AgentId {
  return Object.values(AgentId).includes(value as AgentId);
}

/** Get the rank badge styling for top 3 */
function getRankStyle(rank: number): { bg: string; text: string; border: string } {
  switch (rank) {
    case 1:
      return {
        bg: 'bg-[#D4AF37]/15',
        text: 'text-[#D4AF37]',
        border: 'border-[#D4AF37]/30',
      };
    case 2:
      return {
        bg: 'bg-[#C0C0C0]/15',
        text: 'text-[#C0C0C0]',
        border: 'border-[#C0C0C0]/30',
      };
    case 3:
      return {
        bg: 'bg-[#CD7F32]/15',
        text: 'text-[#CD7F32]',
        border: 'border-[#CD7F32]/30',
      };
    default:
      return {
        bg: 'bg-[var(--color-sa-bg-tertiary)]',
        text: 'text-[var(--color-sa-text-muted)]',
        border: 'border-[var(--color-sa-border)]',
      };
  }
}

// -----------------------------------------------------------------------------
// Leaderboard Row
// -----------------------------------------------------------------------------

function LeaderboardRow({
  entry,
  rank,
}: {
  entry: LeaderboardEntry;
  rank: number;
}) {
  const personality = isValidAgentId(entry.agentId)
    ? AGENT_PERSONALITIES[entry.agentId]
    : null;

  const rankStyle = getRankStyle(rank);
  const winRateResult = formatPercent(entry.winRate);
  const avgReturnResult = formatPercent(entry.avgReturn);

  return (
    <tr className="border-b border-[var(--color-sa-border)] hover:bg-[var(--color-sa-bg-hover)] transition-colors duration-100">
      {/* Rank */}
      <td className="px-3 py-3">
        <div
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${rankStyle.bg} ${rankStyle.text}`}
        >
          {rank}
        </div>
      </td>

      {/* Agent */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          {personality && (
            <AgentAvatar
              avatarColor={personality.avatarColor}
              avatarIcon={personality.avatarIcon}
              size="sm"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
              {personality?.agentName ?? entry.agentId}
            </p>
            {personality && (
              <p className="truncate text-[11px] text-[var(--color-sa-text-muted)]">
                {personality.firmName}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Win Rate */}
      <td className="px-3 py-3">
        <span
          className={`text-[12px] font-semibold ${
            winRateResult.color === 'green'
              ? 'text-[var(--color-sa-green)]'
              : winRateResult.color === 'red'
              ? 'text-[var(--color-sa-red)]'
              : 'text-[var(--color-sa-text-secondary)]'
          }`}
        >
          {entry.winRate.toFixed(1)}%
        </span>
      </td>

      {/* Avg Return */}
      <td className="px-3 py-3">
        <span
          className={`text-[12px] font-semibold ${
            avgReturnResult.color === 'green'
              ? 'text-[var(--color-sa-green)]'
              : avgReturnResult.color === 'red'
              ? 'text-[var(--color-sa-red)]'
              : 'text-[var(--color-sa-text-secondary)]'
          }`}
        >
          {avgReturnResult.text}
        </span>
      </td>

      {/* Sharpe Ratio */}
      <td className="px-3 py-3 text-[12px] text-[var(--color-sa-text-secondary)]">
        {entry.sharpeRatio.toFixed(2)}
      </td>

      {/* Total Trades */}
      <td className="px-3 py-3 text-[12px] text-[var(--color-sa-text-secondary)]">
        {entry.totalRecommendations}
      </td>

      {/* Score */}
      <td className="px-3 py-3">
        <span className="text-[12px] font-bold text-[var(--color-sa-accent)]">
          {entry.score.toFixed(1)}
        </span>
      </td>
    </tr>
  );
}

// -----------------------------------------------------------------------------
// Agent Report Card
// -----------------------------------------------------------------------------

function AgentReportCard({
  stats,
  rank,
}: {
  stats: AgentStats;
  rank: number | null;
}) {
  const personality = isValidAgentId(stats.agentId)
    ? AGENT_PERSONALITIES[stats.agentId]
    : null;

  const rankStyle = rank !== null && rank <= 3 ? getRankStyle(rank) : null;
  const winRateResult = formatPercent(stats.winRate);
  const avgReturnResult = formatPercent(stats.avgReturn);
  const bestReturnResult = formatPercent(stats.bestReturn);
  const worstReturnResult = formatPercent(stats.worstReturn);

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-150 ${
        rankStyle
          ? `${rankStyle.border} bg-[var(--color-sa-bg-secondary)]`
          : 'border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {personality && (
            <AgentAvatar
              avatarColor={personality.avatarColor}
              avatarIcon={personality.avatarIcon}
              size="md"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
              {personality?.agentName ?? stats.agentId}
            </p>
            {personality && (
              <p className="truncate text-[11px] text-[var(--color-sa-text-muted)]">
                {personality.firmName}
              </p>
            )}
          </div>
        </div>

        {rank !== null && rank <= 3 && (
          <div className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${rankStyle?.bg} ${rankStyle?.text}`}>
            <Medal size={11} />
            #{rank}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Win Rate
          </p>
          <p
            className={`mt-0.5 text-[14px] font-bold ${
              winRateResult.color === 'green'
                ? 'text-[var(--color-sa-green)]'
                : winRateResult.color === 'red'
                ? 'text-[var(--color-sa-red)]'
                : 'text-[var(--color-sa-text-primary)]'
            }`}
          >
            {stats.winRate.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Avg Return
          </p>
          <p
            className={`mt-0.5 text-[14px] font-bold ${
              avgReturnResult.color === 'green'
                ? 'text-[var(--color-sa-green)]'
                : avgReturnResult.color === 'red'
                ? 'text-[var(--color-sa-red)]'
                : 'text-[var(--color-sa-text-primary)]'
            }`}
          >
            {avgReturnResult.text}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Best Call
          </p>
          <p
            className={`mt-0.5 text-[13px] font-semibold ${
              bestReturnResult.color === 'green'
                ? 'text-[var(--color-sa-green)]'
                : bestReturnResult.color === 'red'
                ? 'text-[var(--color-sa-red)]'
                : 'text-[var(--color-sa-text-secondary)]'
            }`}
          >
            {stats.resolvedCount > 0 ? bestReturnResult.text : '--'}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Worst Call
          </p>
          <p
            className={`mt-0.5 text-[13px] font-semibold ${
              worstReturnResult.color === 'green'
                ? 'text-[var(--color-sa-green)]'
                : worstReturnResult.color === 'red'
                ? 'text-[var(--color-sa-red)]'
                : 'text-[var(--color-sa-text-secondary)]'
            }`}
          >
            {stats.resolvedCount > 0 ? worstReturnResult.text : '--'}
          </p>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Performance Page
// -----------------------------------------------------------------------------

export default function PerformancePage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [agentStatsMap, setAgentStatsMap] = useState<Record<string, AgentStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const lb = await getLeaderboard();
        if (cancelled) return;
        setLeaderboard(lb);

        // Load individual stats for all agents on the leaderboard
        const statsEntries: [string, AgentStats][] = [];
        for (const entry of lb) {
          const stats = await getAgentStats(entry.agentId);
          if (cancelled) return;
          statsEntries.push([entry.agentId, stats]);
        }

        const statsMap: Record<string, AgentStats> = {};
        for (const [id, stats] of statsEntries) {
          statsMap[id] = stats;
        }
        setAgentStatsMap(statsMap);
      } catch (err) {
        console.error('[PerformancePage] Failed to load data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const isEmpty = leaderboard.length === 0 && !loading;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-sa-accent-dim)]">
              <Trophy size={18} className="text-[var(--color-sa-accent)]" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-[var(--color-sa-text-primary)]">
                Agent Performance
              </h1>
              <p className="text-[14px] text-[var(--color-sa-text-secondary)]">
                Leaderboard rankings and individual agent track records
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-12 text-center">
            <p className="text-[13px] text-[var(--color-sa-text-muted)]">Loading performance data...</p>
          </div>
        )}

        {/* Empty State */}
        {isEmpty && (
          <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-12 text-center">
            <Star size={40} className="mx-auto text-[var(--color-sa-text-dim)]" />
            <p className="mt-4 text-[14px] font-medium text-[var(--color-sa-text-secondary)]">
              No performance data yet.
            </p>
            <p className="mt-1 text-[13px] text-[var(--color-sa-text-muted)]">
              Performance data will accumulate as agents make recommendations and trades are resolved.
            </p>
          </div>
        )}

        {/* Leaderboard Table */}
        {!isEmpty && !loading && (
          <>
            <div className="mb-8">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                Agent Leaderboard
              </h2>
              <div className="overflow-hidden rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-sa-border)] bg-[var(--color-sa-bg-tertiary)]">
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                          Rank
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                          Agent
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                          Win Rate
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                          Avg Return
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                          Sharpe
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                          Total Trades
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry, index) => (
                        <LeaderboardRow
                          key={entry.agentId}
                          entry={entry}
                          rank={index + 1}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Agent Report Cards */}
            <div>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                Agent Report Cards
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {leaderboard.map((entry, index) => {
                  const stats = agentStatsMap[entry.agentId];
                  if (!stats) return null;
                  return (
                    <AgentReportCard
                      key={entry.agentId}
                      stats={stats}
                      rank={index + 1}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
