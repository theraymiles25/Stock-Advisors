// =============================================================================
// Stock Advisors - Dashboard Page
// =============================================================================
// Landing page showing the platform overview, quick action buttons, and a
// responsive grid of all 15 agent cards. If API keys aren't configured, a
// banner prompts the user to visit Settings.
// =============================================================================

import { useNavigate, Link } from 'react-router-dom';
import {
  Workflow,
  Search,
  Briefcase,
  AlertCircle,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { AgentId, AgentStatus, SPECIALIST_AGENT_IDS } from '../agents/base/types';
import { AGENT_PERSONALITIES } from '../agents/prompts/personalities';
import { AGENT_DISPLAY_ORDER } from '../lib/constants';
import { useAgentStore } from '../stores/useAgentStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import AgentAvatar from '../components/agents/AgentAvatar';

// -----------------------------------------------------------------------------
// Agent Short Descriptions
// -----------------------------------------------------------------------------

const AGENT_ONE_LINERS: Record<AgentId, string> = {
  [AgentId.GOLDMAN_SCREENER]: 'Institutional stock screening with P/E, growth, and moat analysis',
  [AgentId.MORGAN_STANLEY_DCF]: 'Discounted cash flow models with bull/base/bear scenarios',
  [AgentId.BRIDGEWATER_RISK]: 'Macro risk analysis through economic cycles and debt dynamics',
  [AgentId.JPMORGAN_EARNINGS]: 'Earnings quality, guidance tracking, and whisper number analysis',
  [AgentId.BLACKROCK_PORTFOLIO]: 'Portfolio-level factor exposure and correlation analysis',
  [AgentId.CITADEL_TECHNICAL]: 'Quantitative technical analysis with probability distributions',
  [AgentId.HARVARD_DIVIDEND]: 'Long-term dividend sustainability and total return evaluation',
  [AgentId.BAIN_COMPETITIVE]: 'Strategic moat assessment using Porter\'s and VRIO frameworks',
  [AgentId.RENTECH_PATTERNS]: 'Statistical pattern detection and regime shift identification',
  [AgentId.MCKINSEY_MACRO]: 'Global macro themes: rates, currencies, and geopolitical forces',
  [AgentId.SENTINEL_SENTIMENT]: 'Social sentiment, insider filings, and narrative velocity tracking',
  [AgentId.SUSQUEHANNA_OPTIONS]: 'Implied volatility analysis and options flow intelligence',
  [AgentId.PERFORMANCE_ANALYST]: 'Return attribution and risk-adjusted performance benchmarking',
  [AgentId.SHORT_TERM_TRADER]: 'Short-term catalyst identification and tactical trade setups',
  [AgentId.NEWS_RESEARCH]: 'Real-time news impact assessment and historical precedent matching',
  [AgentId.MASTER_ORCHESTRATOR]: 'Synthesizes all agent outputs into unified recommendations',
};

// -----------------------------------------------------------------------------
// Status Badge Dot
// -----------------------------------------------------------------------------

function StatusDot({ status }: { status: AgentStatus }) {
  const colorMap: Record<AgentStatus, string> = {
    [AgentStatus.IDLE]: 'bg-[var(--color-sa-text-dim)]/40',
    [AgentStatus.THINKING]: 'bg-[var(--color-sa-amber)] agent-thinking',
    [AgentStatus.STREAMING]: 'bg-[var(--color-sa-accent)] animate-pulse',
    [AgentStatus.COMPLETE]: 'bg-[var(--color-sa-green)]',
    [AgentStatus.ERROR]: 'bg-[var(--color-sa-red)]',
  };

  return (
    <span className={`inline-block h-2 w-2 rounded-full ${colorMap[status]}`} />
  );
}

// -----------------------------------------------------------------------------
// Agent Card
// -----------------------------------------------------------------------------

function AgentCard({ agentId }: { agentId: AgentId }) {
  const navigate = useNavigate();
  const personality = AGENT_PERSONALITIES[agentId];
  const status = useAgentStore((s) => s.agentStatuses[agentId]);
  const oneLiner = AGENT_ONE_LINERS[agentId];

  return (
    <button
      onClick={() => navigate(`/agent/${agentId}`)}
      className="group flex flex-col rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]
                 p-4 text-left transition-all duration-150
                 hover:border-[var(--color-sa-border-hover)] hover:bg-[var(--color-sa-bg-hover)]"
    >
      {/* Top row: avatar + status */}
      <div className="flex items-start justify-between">
        <AgentAvatar
          avatarColor={personality.avatarColor}
          avatarIcon={personality.avatarIcon}
          size="md"
          status={status !== AgentStatus.IDLE ? status : undefined}
        />
        <StatusDot status={status} />
      </div>

      {/* Agent info */}
      <div className="mt-3 min-w-0">
        <h3 className="truncate text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
          {personality.agentName}
        </h3>
        <p className="truncate text-[11px] text-[var(--color-sa-text-secondary)]">
          {personality.firmName}
        </p>
      </div>

      {/* Description */}
      <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--color-sa-text-muted)]">
        {oneLiner}
      </p>

      {/* Hover arrow */}
      <div className="mt-auto pt-3 flex items-center gap-1 text-[11px] text-[var(--color-sa-text-dim)] group-hover:text-[var(--color-sa-accent)] transition-colors">
        <span>Open agent</span>
        <ArrowRight
          size={11}
          className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150"
        />
      </div>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Quick Action Button
// -----------------------------------------------------------------------------

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}

function QuickAction({ icon, label, description, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--color-sa-border)]
                 bg-[var(--color-sa-bg-secondary)] px-4 py-3.5 text-left transition-all duration-150
                 hover:border-[var(--color-sa-border-hover)] hover:bg-[var(--color-sa-bg-hover)]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-sa-accent-dim)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
          {label}
        </p>
        <p className="text-[11px] text-[var(--color-sa-text-muted)]">
          {description}
        </p>
      </div>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Dashboard Page
// -----------------------------------------------------------------------------

export default function DashboardPage() {
  const navigate = useNavigate();
  const isConfigured = useSettingsStore((s) => s.isConfigured);

  // Only show specialist agents (not the master orchestrator) in the grid
  const agentIds = AGENT_DISPLAY_ORDER.filter(
    (id) => id !== AgentId.MASTER_ORCHESTRATOR
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-[var(--color-sa-text-primary)]">
            Stock Advisors
          </h1>
          <p className="mt-1 text-[14px] text-[var(--color-sa-text-secondary)]">
            15 AI Agents &middot; Real-Time Analysis
          </p>
        </div>

        {/* Configuration Banner */}
        {!isConfigured && (
          <Link
            to="/settings"
            className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-sa-amber)]/30
                       bg-[var(--color-sa-amber-dim)] px-4 py-3 transition-all duration-150
                       hover:border-[var(--color-sa-amber)]/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-sa-amber)]/20">
              <AlertCircle size={16} className="text-[var(--color-sa-amber)]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-[var(--color-sa-amber)]">
                Set up your API keys to get started
              </p>
              <p className="text-[12px] text-[var(--color-sa-amber)]/70">
                Configure your Anthropic and Alpha Vantage API keys in Settings to enable live analysis.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-sa-amber)]">
              <Settings size={14} />
              <span>Settings</span>
              <ArrowRight size={12} />
            </div>
          </Link>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Quick Actions
          </h2>
          <div className="flex gap-3">
            <QuickAction
              icon={<Workflow size={18} className="text-[var(--color-sa-accent)]" />}
              label="Full Analysis"
              description="Run all 15 agents on a stock"
              onClick={() => navigate('/analysis')}
            />
            <QuickAction
              icon={<Search size={18} className="text-[var(--color-sa-accent)]" />}
              label="Screen Stocks"
              description="Goldman Sachs equity screener"
              onClick={() => navigate(`/agent/${AgentId.GOLDMAN_SCREENER}`)}
            />
            <QuickAction
              icon={<Briefcase size={18} className="text-[var(--color-sa-accent)]" />}
              label="Check Portfolio"
              description="View holdings and performance"
              onClick={() => navigate('/portfolio')}
            />
          </div>
        </div>

        {/* Agent Grid */}
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Analysis Agents
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agentIds.map((agentId) => (
              <AgentCard key={agentId} agentId={agentId} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
