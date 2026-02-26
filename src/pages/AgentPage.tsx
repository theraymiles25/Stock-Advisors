// =============================================================================
// Stock Advisors - Agent Detail Page
// =============================================================================
// Full-page view for interacting with a single agent. Left panel shows the
// AgentChat component. Right sidebar shows agent personality info, traits,
// and a summary of previous outputs if available.
// =============================================================================

import { useParams, Navigate } from 'react-router-dom';
import { Info, MessageSquareQuote, Sparkles } from 'lucide-react';
import { AgentId, AgentStatus } from '../agents/base/types';
import { AGENT_PERSONALITIES } from '../agents/prompts/personalities';
import { useAgentStore } from '../stores/useAgentStore';
import { formatConfidence } from '../lib/formatters';
import AgentChat from '../components/agents/AgentChat';
import AgentAvatar from '../components/agents/AgentAvatar';

// -----------------------------------------------------------------------------
// Agent ID Validation
// -----------------------------------------------------------------------------

/** Check if a string is a valid AgentId enum value */
function isValidAgentId(value: string): value is AgentId {
  return Object.values(AgentId).includes(value as AgentId);
}

// -----------------------------------------------------------------------------
// Agent Description Map
// -----------------------------------------------------------------------------

const AGENT_DESCRIPTIONS: Partial<Record<AgentId, string>> = {
  [AgentId.GOLDMAN_SCREENER]:
    'Screens stocks using institutional-grade criteria including P/E analysis, revenue growth, debt health, dividend sustainability, moat ratings, and generates bull/bear price targets.',
  [AgentId.MORGAN_STANLEY_DCF]:
    'Builds discounted cash flow models with three scenarios (base, bull, bear) to determine intrinsic value and margin of safety.',
  [AgentId.BRIDGEWATER_RISK]:
    'Evaluates portfolio and position risk through the lens of economic cycles, debt dynamics, and macro regime analysis.',
  [AgentId.JPMORGAN_EARNINGS]:
    'Analyzes earnings quality, guidance revisions, and whisper numbers to identify catalyst-driven opportunities.',
  [AgentId.BLACKROCK_PORTFOLIO]:
    'Assesses individual positions within portfolio context, analyzing factor exposures, correlations, and marginal Sharpe contribution.',
  [AgentId.CITADEL_TECHNICAL]:
    'Provides quantitative technical analysis with probability-weighted price targets across multiple timeframes.',
  [AgentId.HARVARD_DIVIDEND]:
    'Evaluates dividend sustainability, payout trends, and total return potential with a long-term endowment perspective.',
  [AgentId.BAIN_COMPETITIVE]:
    'Applies strategic frameworks (Porter\'s Five Forces, VRIO) to assess competitive moats and business model durability.',
  [AgentId.RENTECH_PATTERNS]:
    'Identifies statistical patterns and regime shifts using signal processing and information theory approaches.',
  [AgentId.MCKINSEY_MACRO]:
    'Connects stock analysis to global macro themes including rates, currencies, commodities, and geopolitical forces.',
  [AgentId.SENTINEL_SENTIMENT]:
    'Monitors social sentiment, insider activity, and narrative velocity to detect inflection points.',
  [AgentId.SUSQUEHANNA_OPTIONS]:
    'Analyzes implied volatility surfaces, skew, and unusual options flow to identify mispriced opportunities.',
  [AgentId.PERFORMANCE_ANALYST]:
    'Decomposes returns into factor contributions and benchmarks performance with statistical rigor.',
  [AgentId.SHORT_TERM_TRADER]:
    'Identifies short-term catalysts and tactical setups with defined risk/reward over days to weeks.',
  [AgentId.NEWS_RESEARCH]:
    'Processes breaking news in real-time, categorizes by impact tier, and cross-references historical precedents.',
};

// -----------------------------------------------------------------------------
// Sidebar Component
// -----------------------------------------------------------------------------

function AgentSidebar({ agentId }: { agentId: AgentId }) {
  const personality = AGENT_PERSONALITIES[agentId];
  const status = useAgentStore((s) => s.agentStatuses[agentId]);
  const output = useAgentStore((s) => s.agentOutputs[agentId]);
  const description = AGENT_DESCRIPTIONS[agentId] ?? 'Specialist analysis agent.';

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]">
      {/* Agent Identity */}
      <div className="flex flex-col items-center px-4 pt-6 pb-4 text-center">
        <AgentAvatar
          avatarColor={personality.avatarColor}
          avatarIcon={personality.avatarIcon}
          size="lg"
          status={status}
        />
        <h3 className="mt-3 text-[15px] font-semibold text-[var(--color-sa-text-primary)]">
          {personality.agentName}
        </h3>
        <p className="mt-0.5 text-[12px] text-[var(--color-sa-text-secondary)]">
          {personality.title}
        </p>
        <p className="text-[12px] text-[var(--color-sa-text-muted)]">
          {personality.firmName}
        </p>
      </div>

      {/* Description */}
      <div className="mx-4 border-t border-[var(--color-sa-border)] pt-3 pb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Info size={12} className="text-[var(--color-sa-text-dim)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            About
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-[var(--color-sa-text-secondary)]">
          {description}
        </p>
      </div>

      {/* Personality Traits */}
      <div className="mx-4 border-t border-[var(--color-sa-border)] pt-3 pb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={12} className="text-[var(--color-sa-text-dim)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Personality Traits
          </span>
        </div>
        <ul className="space-y-1.5">
          {personality.quirks.map((quirk, i) => (
            <li
              key={i}
              className="text-[11.5px] leading-relaxed text-[var(--color-sa-text-muted)]"
            >
              <span className="mr-1 text-[var(--color-sa-text-dim)]">&bull;</span>
              {quirk}
            </li>
          ))}
        </ul>
      </div>

      {/* Catchphrases */}
      <div className="mx-4 border-t border-[var(--color-sa-border)] pt-3 pb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageSquareQuote size={12} className="text-[var(--color-sa-text-dim)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Signature Phrases
          </span>
        </div>
        <ul className="space-y-1.5">
          {personality.catchphrases.map((phrase, i) => (
            <li
              key={i}
              className="text-[11.5px] italic leading-relaxed text-[var(--color-sa-text-muted)]"
            >
              "{phrase}"
            </li>
          ))}
        </ul>
      </div>

      {/* Previous Output Summary */}
      {output && output.status === AgentStatus.COMPLETE && (
        <div className="mx-4 border-t border-[var(--color-sa-border)] pt-3 pb-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Last Analysis
          </span>
          <div className="mt-2 rounded-lg bg-[var(--color-sa-bg-tertiary)] p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-sa-text-secondary)]">Confidence</span>
              <span className="font-semibold text-[var(--color-sa-text-primary)]">
                {output.confidence}% ({formatConfidence(output.confidence)})
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-sa-text-secondary)]">Recommendations</span>
              <span className="font-semibold text-[var(--color-sa-text-primary)]">
                {output.recommendations.length}
              </span>
            </div>
            {output.warnings.length > 0 && (
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-[var(--color-sa-text-secondary)]">Warnings</span>
                <span className="font-semibold text-[var(--color-sa-amber)]">
                  {output.warnings.length}
                </span>
              </div>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-sa-text-muted)]">
              {output.summary.slice(0, 120)}
              {output.summary.length > 120 ? '...' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Agent Page
// -----------------------------------------------------------------------------

export default function AgentPage() {
  const { agentId: rawAgentId } = useParams<{ agentId: string }>();

  // Validate the agent ID from the URL
  if (!rawAgentId || !isValidAgentId(rawAgentId)) {
    return <Navigate to="/" replace />;
  }

  const agentId = rawAgentId as AgentId;

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 min-w-0">
        <AgentChat agentId={agentId} />
      </div>

      {/* Info sidebar */}
      <AgentSidebar agentId={agentId} />
    </div>
  );
}
