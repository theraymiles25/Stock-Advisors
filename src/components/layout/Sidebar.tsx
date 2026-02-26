// =============================================================================
// Stock Advisors - Navigation Sidebar
// =============================================================================
// macOS-style sidebar with stock search, agent list, and navigation links.
// 260px wide, renders below the title bar. Each agent shows its colored dot,
// short name, and live status badge. Uses react-router-dom NavLink for active
// state styling and lucide-react for all icons.
// =============================================================================

import { NavLink } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  Workflow,
  DollarSign,
  Briefcase,
  Eye,
  Clock,
  Trophy,
  Settings,
} from 'lucide-react';
import { AgentId, AgentStatus } from '../../agents/base/types';
import { AGENT_PERSONALITIES } from '../../agents/prompts/personalities';
import { AGENT_DISPLAY_ORDER } from '../../lib/constants';
import { useAgentStore } from '../../stores/useAgentStore';

// -----------------------------------------------------------------------------
// Agent Short Names
// -----------------------------------------------------------------------------
// Concise display names for the sidebar. Derived from the firm names but
// shortened to fit the tight sidebar layout.

const AGENT_SHORT_NAMES: Record<AgentId, string> = {
  [AgentId.GOLDMAN_SCREENER]: 'Goldman Screener',
  [AgentId.MORGAN_STANLEY_DCF]: 'Morgan Stanley DCF',
  [AgentId.JPMORGAN_EARNINGS]: 'JPMorgan Earnings',
  [AgentId.CITADEL_TECHNICAL]: 'Citadel Technical',
  [AgentId.RENTECH_PATTERNS]: 'RenTech Patterns',
  [AgentId.BRIDGEWATER_RISK]: 'Bridgewater Risk',
  [AgentId.BLACKROCK_PORTFOLIO]: 'BlackRock Portfolio',
  [AgentId.HARVARD_DIVIDEND]: 'Harvard Dividend',
  [AgentId.BAIN_COMPETITIVE]: 'Bain Competitive',
  [AgentId.MCKINSEY_MACRO]: 'McKinsey Macro',
  [AgentId.SENTINEL_SENTIMENT]: 'Sentinel Sentiment',
  [AgentId.SUSQUEHANNA_OPTIONS]: 'Susquehanna Options',
  [AgentId.SHORT_TERM_TRADER]: 'Point72 Trader',
  [AgentId.NEWS_RESEARCH]: 'Bloomberg News',
  [AgentId.PERFORMANCE_ANALYST]: 'AQR Performance',
  [AgentId.MASTER_ORCHESTRATOR]: 'Master Orchestrator',
};

// -----------------------------------------------------------------------------
// Status Badge
// -----------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  [AgentStatus.IDLE]: {
    label: 'Idle',
    dotClass: 'bg-[var(--color-sa-text-dim)]',
    textClass: 'text-[var(--color-sa-text-dim)]',
  },
  [AgentStatus.THINKING]: {
    label: 'Thinking',
    dotClass: 'bg-[var(--color-sa-amber)] agent-thinking',
    textClass: 'text-[var(--color-sa-amber)]',
  },
  [AgentStatus.STREAMING]: {
    label: 'Streaming',
    dotClass: 'bg-[var(--color-sa-accent)]',
    textClass: 'text-[var(--color-sa-accent)]',
  },
  [AgentStatus.COMPLETE]: {
    label: 'Complete',
    dotClass: 'bg-[var(--color-sa-green)]',
    textClass: 'text-[var(--color-sa-green)]',
  },
  [AgentStatus.ERROR]: {
    label: 'Error',
    dotClass: 'bg-[var(--color-sa-red)]',
    textClass: 'text-[var(--color-sa-red)]',
  },
};

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config = STATUS_CONFIG[status];
  // Hide the badge entirely when idle to keep the sidebar clean
  if (status === AgentStatus.IDLE) return null;

  return (
    <span
      className={`ml-auto flex items-center gap-1 text-[10px] font-medium leading-none ${config.textClass}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Navigation Item
// -----------------------------------------------------------------------------

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

function NavItem({ to, icon, label, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] font-medium
         transition-colors duration-100
         ${
           isActive
             ? 'bg-[var(--color-sa-bg-elevated)] text-[var(--color-sa-text-primary)]'
             : 'text-[var(--color-sa-text-secondary)] hover:bg-[var(--color-sa-bg-hover)] hover:text-[var(--color-sa-text-primary)]'
         }`
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

// -----------------------------------------------------------------------------
// Section Header
// -----------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="mb-1 mt-4 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
      {label}
    </h3>
  );
}

// -----------------------------------------------------------------------------
// Agent Nav Item
// -----------------------------------------------------------------------------

function AgentNavItem({ agentId }: { agentId: AgentId }) {
  const status = useAgentStore((s) => s.agentStatuses[agentId]);
  const personality = AGENT_PERSONALITIES[agentId];

  return (
    <NavLink
      to={`/agent/${agentId}`}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[12.5px]
         transition-colors duration-100
         ${
           isActive
             ? 'bg-[var(--color-sa-bg-elevated)] text-[var(--color-sa-text-primary)]'
             : 'text-[var(--color-sa-text-secondary)] hover:bg-[var(--color-sa-bg-hover)] hover:text-[var(--color-sa-text-primary)]'
         }`
      }
    >
      {/* Agent color dot */}
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: personality.avatarColor }}
      />

      {/* Agent name */}
      <span className="truncate">{AGENT_SHORT_NAMES[agentId]}</span>

      {/* Status badge (hidden when idle) */}
      <AgentStatusBadge status={status} />
    </NavLink>
  );
}

// -----------------------------------------------------------------------------
// Sidebar Component
// -----------------------------------------------------------------------------

export default function Sidebar() {
  // Only show specialist agents in the sidebar list (not the master orchestrator)
  const specialistAgents = AGENT_DISPLAY_ORDER.filter(
    (id) => id !== AgentId.MASTER_ORCHESTRATOR
  );

  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col border-r border-[var(--color-sa-border)]
                 bg-[var(--color-sa-bg-secondary)]"
    >
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <div
          className="flex items-center gap-2 rounded-lg bg-[var(--color-sa-bg-tertiary)]
                     px-2.5 py-[6px] ring-1 ring-[var(--color-sa-border)]
                     focus-within:ring-[var(--color-sa-accent)]/40 transition-shadow duration-150"
        >
          <Search size={13} className="shrink-0 text-[var(--color-sa-text-dim)]" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search symbol..."
            className="w-full bg-transparent text-[12.5px] text-[var(--color-sa-text-primary)]
                       placeholder:text-[var(--color-sa-text-dim)] outline-none"
          />
        </div>
      </div>

      {/* Scrollable navigation area */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {/* Dashboard */}
        <div className="mb-1">
          <NavItem
            to="/"
            end
            icon={<LayoutGrid size={15} strokeWidth={1.8} />}
            label="Dashboard"
          />
        </div>

        {/* Agents section */}
        <SectionHeader label="Agents" />
        <div className="flex flex-col gap-px">
          {specialistAgents.map((agentId) => (
            <AgentNavItem key={agentId} agentId={agentId} />
          ))}
        </div>

        {/* Analysis & Trading */}
        <SectionHeader label="Analysis" />
        <div className="flex flex-col gap-px">
          <NavItem
            to="/analysis"
            icon={<Workflow size={15} strokeWidth={1.8} />}
            label="Full Pipeline"
          />
          <NavItem
            to="/paper-trading"
            icon={<DollarSign size={15} strokeWidth={1.8} />}
            label="Paper Trading"
          />
        </div>

        {/* Portfolio & Tracking */}
        <SectionHeader label="Tracking" />
        <div className="flex flex-col gap-px">
          <NavItem
            to="/portfolio"
            icon={<Briefcase size={15} strokeWidth={1.8} />}
            label="Portfolio"
          />
          <NavItem
            to="/watchlist"
            icon={<Eye size={15} strokeWidth={1.8} />}
            label="Watchlist"
          />
          <NavItem
            to="/history"
            icon={<Clock size={15} strokeWidth={1.8} />}
            label="History"
          />
          <NavItem
            to="/performance"
            icon={<Trophy size={15} strokeWidth={1.8} />}
            label="Performance"
          />
        </div>
      </nav>

      {/* Settings - pinned to bottom */}
      <div className="border-t border-[var(--color-sa-border)] px-2 py-2">
        <NavItem
          to="/settings"
          icon={<Settings size={15} strokeWidth={1.8} />}
          label="Settings"
        />
      </div>
    </aside>
  );
}
