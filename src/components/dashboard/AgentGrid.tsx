// =============================================================================
// Stock Advisors - Agent Grid Component
// =============================================================================
// A responsive grid of agent cards showing all 15 specialist agents with their
// latest status and mini output preview. Each card displays the agent's avatar,
// name, firm, status badge, and last confidence score if available.
// =============================================================================

import AgentAvatar from '../agents/AgentAvatar';
import { AGENT_PERSONALITIES } from '../../agents/prompts/personalities';
import {
  AgentId,
  AgentStatus,
  SPECIALIST_AGENT_IDS,
} from '../../agents/base/types';
import { useAgentStore } from '../../stores/useAgentStore';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface AgentGridProps {
  onAgentClick?: (agentId: AgentId) => void;
}

// -----------------------------------------------------------------------------
// Status Badge
// -----------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; dotClass: string }
> = {
  [AgentStatus.IDLE]: {
    label: 'Idle',
    dotClass: 'bg-[var(--color-sa-text-dim)]/40',
  },
  [AgentStatus.THINKING]: {
    label: 'Thinking',
    dotClass: 'bg-[var(--color-sa-amber)] agent-thinking',
  },
  [AgentStatus.STREAMING]: {
    label: 'Streaming',
    dotClass: 'bg-[var(--color-sa-accent)] animate-pulse',
  },
  [AgentStatus.COMPLETE]: {
    label: 'Complete',
    dotClass: 'bg-[var(--color-sa-green)]',
  },
  [AgentStatus.ERROR]: {
    label: 'Error',
    dotClass: 'bg-[var(--color-sa-red)]',
  },
};

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${config.dotClass}`} />
      <span className="text-[10px] text-[var(--color-sa-text-dim)]">
        {config.label}
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Agent Card
// -----------------------------------------------------------------------------

function AgentCard({
  agentId,
  onClick,
}: {
  agentId: AgentId;
  onClick?: (agentId: AgentId) => void;
}) {
  const personality = AGENT_PERSONALITIES[agentId];
  const status = useAgentStore((s) => s.agentStatuses[agentId]);
  const output = useAgentStore((s) => s.agentOutputs[agentId]);

  return (
    <button
      onClick={() => onClick?.(agentId)}
      className="group flex flex-col rounded-xl border border-[var(--color-sa-border)]
                 bg-[var(--color-sa-bg-secondary)] p-4 text-left transition-all duration-150
                 hover:border-[var(--color-sa-border-hover)] hover:bg-[var(--color-sa-bg-hover)]"
    >
      {/* Top row: avatar + status badge */}
      <div className="flex items-start justify-between">
        <AgentAvatar
          avatarColor={personality.avatarColor}
          avatarIcon={personality.avatarIcon}
          size="md"
          status={status !== AgentStatus.IDLE ? status : undefined}
        />
        <StatusBadge status={status} />
      </div>

      {/* Agent identity */}
      <div className="mt-3 min-w-0">
        <h3 className="truncate text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
          {personality.agentName}
        </h3>
        <p className="truncate text-[11px] text-[var(--color-sa-text-secondary)]">
          {personality.firmName}
        </p>
      </div>

      {/* Confidence score or mini preview */}
      <div className="mt-2 min-h-[20px]">
        {output && output.confidence != null ? (
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-sa-bg-elevated)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${output.confidence}%`,
                  backgroundColor:
                    output.confidence >= 60
                      ? 'var(--color-sa-green)'
                      : output.confidence >= 30
                        ? 'var(--color-sa-amber)'
                        : 'var(--color-sa-red)',
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-[var(--color-sa-text-dim)]">
              {output.confidence}%
            </span>
          </div>
        ) : (
          <p className="text-[10px] text-[var(--color-sa-text-dim)]">
            No analysis yet
          </p>
        )}
      </div>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Agent Grid
// -----------------------------------------------------------------------------

export default function AgentGrid({ onAgentClick }: AgentGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SPECIALIST_AGENT_IDS.map((agentId) => (
        <AgentCard key={agentId} agentId={agentId} onClick={onAgentClick} />
      ))}
    </div>
  );
}
