// =============================================================================
// Stock Advisors - Trade Timeline Component
// =============================================================================
// Vertical timeline showing the master orchestrator's recommended trade
// execution sequence. Each entry is a card with timing, action badge, symbol,
// position size, and rationale, connected by a vertical line on the left.
// =============================================================================

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  PieChart,
} from 'lucide-react';
import type {
  TradeTimeline as TradeTimelineType,
  TimelineEntry,
  RecommendationAction,
} from '../../agents/base/types';
import { formatPercent } from '../../lib/formatters';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface TradeTimelineProps {
  timeline: TradeTimelineType;
}

// -----------------------------------------------------------------------------
// Action Color Helpers
// -----------------------------------------------------------------------------

function getActionColor(action: RecommendationAction): {
  text: string;
  bg: string;
  dot: string;
  border: string;
} {
  switch (action) {
    case 'STRONG_BUY':
      return {
        text: 'text-[var(--color-sa-green)]',
        bg: 'bg-[var(--color-sa-green)]/20',
        dot: 'bg-[var(--color-sa-green)]',
        border: 'border-[var(--color-sa-green)]/30',
      };
    case 'BUY':
      return {
        text: 'text-[var(--color-sa-green)]',
        bg: 'bg-[var(--color-sa-green-dim)]',
        dot: 'bg-[var(--color-sa-green)]',
        border: 'border-[var(--color-sa-green)]/20',
      };
    case 'HOLD':
      return {
        text: 'text-[var(--color-sa-amber)]',
        bg: 'bg-[var(--color-sa-amber-dim)]',
        dot: 'bg-[var(--color-sa-amber)]',
        border: 'border-[var(--color-sa-amber)]/20',
      };
    case 'SELL':
      return {
        text: 'text-[var(--color-sa-red)]',
        bg: 'bg-[var(--color-sa-red-dim)]',
        dot: 'bg-[var(--color-sa-red)]',
        border: 'border-[var(--color-sa-red)]/20',
      };
    case 'STRONG_SELL':
      return {
        text: 'text-[var(--color-sa-red)]',
        bg: 'bg-[var(--color-sa-red)]/20',
        dot: 'bg-[var(--color-sa-red)]',
        border: 'border-[var(--color-sa-red)]/30',
      };
  }
}

function getActionIcon(action: RecommendationAction): React.ReactNode {
  switch (action) {
    case 'STRONG_BUY':
    case 'BUY':
      return <TrendingUp size={12} strokeWidth={2} />;
    case 'HOLD':
      return <Minus size={12} strokeWidth={2} />;
    case 'SELL':
    case 'STRONG_SELL':
      return <TrendingDown size={12} strokeWidth={2} />;
  }
}

function getActionLabel(action: RecommendationAction): string {
  return action.replace('_', ' ');
}

// -----------------------------------------------------------------------------
// Timeline Entry Card
// -----------------------------------------------------------------------------

function TimelineEntryCard({
  entry,
  isLast,
}: {
  entry: TimelineEntry;
  isLast: boolean;
}) {
  const colors = getActionColor(entry.action);
  const icon = getActionIcon(entry.action);
  const positionPercent = formatPercent(entry.positionSize);

  return (
    <div className="relative flex gap-4">
      {/* Left: timeline dot and connecting line */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div
          className={`
            relative z-10 flex h-5 w-5 shrink-0 items-center justify-center
            rounded-full border-2 ${colors.border} bg-[var(--color-sa-bg-tertiary)]
          `}
        >
          <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
        </div>
        {/* Connecting line (hidden on last item) */}
        {!isLast && (
          <div className="w-px flex-1 bg-[var(--color-sa-border)]" />
        )}
      </div>

      {/* Right: entry card */}
      <div
        className={`
          mb-4 flex-1 rounded-lg border ${colors.border}
          bg-[var(--color-sa-bg-tertiary)] p-3
          transition-colors duration-200 hover:border-[var(--color-sa-border-hover)]
        `}
      >
        {/* Timing label */}
        <div className="mb-2 flex items-center gap-2">
          <Clock
            size={12}
            strokeWidth={1.8}
            className="text-[var(--color-sa-text-dim)]"
          />
          <span className="text-[11px] font-medium text-[var(--color-sa-text-secondary)]">
            {entry.timing}
          </span>
        </div>

        {/* Action badge + symbol row */}
        <div className="mb-2 flex items-center gap-2.5">
          {/* Action badge */}
          <span
            className={`
              inline-flex items-center gap-1 rounded-full px-2 py-0.5
              text-[11px] font-bold tracking-wide
              ${colors.bg} ${colors.text}
            `}
          >
            {icon}
            {getActionLabel(entry.action)}
          </span>
          {/* Symbol */}
          <span className="text-[16px] font-bold tracking-tight text-[var(--color-sa-text-primary)]">
            {entry.symbol}
          </span>
        </div>

        {/* Position size */}
        <div className="mb-2 flex items-center gap-2">
          <PieChart
            size={12}
            strokeWidth={1.8}
            className="text-[var(--color-sa-text-dim)]"
          />
          <span className="text-[11px] text-[var(--color-sa-text-muted)]">
            Position Size
          </span>
          <span className="ml-auto text-[12px] font-mono font-semibold text-[var(--color-sa-text-primary)]">
            {positionPercent.text}
          </span>
        </div>

        {/* Rationale */}
        <p className="text-[12px] leading-relaxed text-[var(--color-sa-text-secondary)]">
          {entry.rationale}
        </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TradeTimeline Component
// -----------------------------------------------------------------------------

export default function TradeTimeline({ timeline }: TradeTimelineProps) {
  const { entries, strategy } = timeline;

  return (
    <div className="flex flex-col">
      {/* Strategy summary */}
      <div
        className="
          mb-4 rounded-lg border border-[var(--color-sa-border)]
          bg-[var(--color-sa-bg-elevated)] px-4 py-3
        "
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
          Strategy
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--color-sa-text-primary)]">
          {strategy}
        </p>
      </div>

      {/* Timeline entries */}
      <div className="pl-1">
        {entries.map((entry, index) => (
          <TimelineEntryCard
            key={`${entry.symbol}-${index}`}
            entry={entry}
            isLast={index === entries.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
