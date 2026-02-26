// =============================================================================
// Stock Advisors - Trade Recommendation Card
// =============================================================================
// Card component displaying a single agent trade recommendation with action
// badge, confidence meter, key price levels, rationale, and an optional
// "Paper Trade" action button.
// =============================================================================

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ShieldAlert,
  Clock,
  FlaskConical,
} from 'lucide-react';
import type { Recommendation, AgentId, RecommendationAction } from '../../agents/base/types';
import { AGENT_PERSONALITIES } from '../../agents/prompts/personalities';
import AgentAvatar from '../agents/AgentAvatar';
import { formatCurrency, formatConfidence } from '../../lib/formatters';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface TradeRecommendationProps {
  recommendation: Recommendation;
  agentId: AgentId;
  onPaperTrade?: (recommendation: Recommendation, agentId: AgentId) => void;
}

// -----------------------------------------------------------------------------
// Action Badge Configuration
// -----------------------------------------------------------------------------

const ACTION_CONFIG: Record<
  RecommendationAction,
  { label: string; bgClass: string; textClass: string; icon: React.ReactNode }
> = {
  STRONG_BUY: {
    label: 'STRONG BUY',
    bgClass: 'bg-[var(--color-sa-green)]/20',
    textClass: 'text-[var(--color-sa-green)]',
    icon: <TrendingUp size={12} strokeWidth={2.5} />,
  },
  BUY: {
    label: 'BUY',
    bgClass: 'bg-[var(--color-sa-green-dim)]',
    textClass: 'text-[var(--color-sa-green)]',
    icon: <TrendingUp size={12} strokeWidth={2} />,
  },
  HOLD: {
    label: 'HOLD',
    bgClass: 'bg-[var(--color-sa-amber-dim)]',
    textClass: 'text-[var(--color-sa-amber)]',
    icon: <Minus size={12} strokeWidth={2} />,
  },
  SELL: {
    label: 'SELL',
    bgClass: 'bg-[var(--color-sa-red-dim)]',
    textClass: 'text-[var(--color-sa-red)]',
    icon: <TrendingDown size={12} strokeWidth={2} />,
  },
  STRONG_SELL: {
    label: 'STRONG SELL',
    bgClass: 'bg-[var(--color-sa-red)]/20',
    textClass: 'text-[var(--color-sa-red)]',
    icon: <TrendingDown size={12} strokeWidth={2.5} />,
  },
};

// -----------------------------------------------------------------------------
// Action Badge
// -----------------------------------------------------------------------------

function ActionBadge({ action }: { action: RecommendationAction }) {
  const config = ACTION_CONFIG[action];

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full px-2.5 py-1
        text-[11px] font-bold tracking-wide
        ${config.bgClass} ${config.textClass}
      `}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Confidence Meter
// -----------------------------------------------------------------------------

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const label = formatConfidence(confidence);
  const clamped = Math.max(0, Math.min(100, confidence));

  // Color the bar based on confidence level
  let barColor: string;
  if (clamped >= 65) {
    barColor = 'bg-[var(--color-sa-green)]';
  } else if (clamped >= 45) {
    barColor = 'bg-[var(--color-sa-amber)]';
  } else {
    barColor = 'bg-[var(--color-sa-red)]';
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-sa-text-dim)]">
          Confidence
        </span>
        <span className="text-[11px] font-semibold text-[var(--color-sa-text-secondary)]">
          {confidence}% &middot; {label}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-sa-bg-elevated)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Detail Row
// -----------------------------------------------------------------------------

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--color-sa-text-dim)]">{icon}</span>
      <span className="text-[11px] text-[var(--color-sa-text-muted)]">
        {label}
      </span>
      <span className="ml-auto text-[12px] font-mono font-semibold text-[var(--color-sa-text-primary)]">
        {value}
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TradeRecommendation Component
// -----------------------------------------------------------------------------

export default function TradeRecommendation({
  recommendation,
  agentId,
  onPaperTrade,
}: TradeRecommendationProps) {
  const personality = AGENT_PERSONALITIES[agentId];
  const { symbol, action, confidence, targetPrice, stopLoss, timeHorizon, rationale } =
    recommendation;

  return (
    <div
      className="
        flex flex-col gap-3 rounded-xl border border-[var(--color-sa-border)]
        bg-[var(--color-sa-bg-tertiary)] p-4 transition-colors duration-200
        hover:border-[var(--color-sa-border-hover)]
      "
    >
      {/* Header: Agent avatar + firm name + action badge */}
      <div className="flex items-center gap-3">
        <AgentAvatar
          avatarColor={personality.avatarColor}
          avatarIcon={personality.avatarIcon}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
            {personality.agentName}
          </p>
          <p className="truncate text-[11px] text-[var(--color-sa-text-muted)]">
            {personality.firmName}
          </p>
        </div>
        <ActionBadge action={action} />
      </div>

      {/* Symbol */}
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-bold tracking-tight text-[var(--color-sa-text-primary)]">
          {symbol}
        </span>
      </div>

      {/* Key metrics */}
      <div className="flex flex-col gap-2 rounded-lg bg-[var(--color-sa-bg-elevated)] p-3">
        {targetPrice != null && (
          <DetailRow
            icon={<Target size={13} strokeWidth={1.8} />}
            label="Target Price"
            value={formatCurrency(targetPrice)}
          />
        )}
        {stopLoss != null && (
          <DetailRow
            icon={<ShieldAlert size={13} strokeWidth={1.8} />}
            label="Stop Loss"
            value={formatCurrency(stopLoss)}
          />
        )}
        <DetailRow
          icon={<Clock size={13} strokeWidth={1.8} />}
          label="Time Horizon"
          value={timeHorizon}
        />
      </div>

      {/* Confidence meter */}
      <ConfidenceMeter confidence={confidence} />

      {/* Rationale */}
      <div className="rounded-lg bg-[var(--color-sa-bg-secondary)] px-3 py-2.5">
        <p className="text-[12px] leading-relaxed text-[var(--color-sa-text-secondary)]">
          {rationale}
        </p>
      </div>

      {/* Paper Trade button */}
      {onPaperTrade && (
        <button
          onClick={() => onPaperTrade(recommendation, agentId)}
          className="
            flex items-center justify-center gap-2 rounded-lg
            bg-[var(--color-sa-accent)] px-4 py-2.5
            text-[13px] font-semibold text-white
            transition-all duration-150
            hover:bg-[var(--color-sa-accent-hover)]
            active:scale-[0.98]
          "
        >
          <FlaskConical size={14} strokeWidth={2} />
          Paper Trade
        </button>
      )}
    </div>
  );
}
