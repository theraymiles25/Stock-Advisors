// =============================================================================
// Stock Advisors - Pipeline View Component
// =============================================================================
// Visual pipeline progress component for multi-agent analysis execution. Shows
// agents grouped by tier/phase with real-time status updates, connecting lines
// between tiers, and animated status indicators.
// =============================================================================

import { CheckCircle2, Loader2, XCircle, Clock, ChevronDown } from 'lucide-react';
import { AgentId, AgentStatus } from '../../agents/base/types';
import { AGENT_PERSONALITIES } from '../../agents/prompts/personalities';
import AgentAvatar from './AgentAvatar';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface PipelineViewProps {
  /** Agent IDs grouped by execution phase/tier */
  phases: AgentId[][];
  /** Current status of each agent */
  statuses: Record<AgentId, AgentStatus>;
  /** Which phase is currently executing (0-indexed) */
  currentPhase: number;
  /** Optional: compact mode for sidebar */
  compact?: boolean;
}

// -----------------------------------------------------------------------------
// Status Helpers
// -----------------------------------------------------------------------------

/** Status indicator icon for each agent state */
function StatusIcon({
  status,
  compact,
}: {
  status: AgentStatus;
  compact: boolean;
}) {
  const size = compact ? 12 : 14;

  switch (status) {
    case AgentStatus.COMPLETE:
      return (
        <CheckCircle2
          size={size}
          className="text-[var(--color-sa-green)]"
          strokeWidth={2}
        />
      );
    case AgentStatus.ERROR:
      return (
        <XCircle
          size={size}
          className="text-[var(--color-sa-red)]"
          strokeWidth={2}
        />
      );
    case AgentStatus.THINKING:
      return (
        <Loader2
          size={size}
          className="animate-spin text-[var(--color-sa-amber)]"
          strokeWidth={2}
        />
      );
    case AgentStatus.STREAMING:
      return (
        <Loader2
          size={size}
          className="animate-spin text-[var(--color-sa-accent)]"
          strokeWidth={2}
        />
      );
    case AgentStatus.IDLE:
    default:
      return (
        <Clock
          size={size}
          className="text-[var(--color-sa-text-dim)]"
          strokeWidth={2}
        />
      );
  }
}

/** CSS class for the card border glow based on agent status */
function getCardBorderClass(status: AgentStatus): string {
  switch (status) {
    case AgentStatus.THINKING:
      return 'border-[var(--color-sa-amber)]/50 shadow-[0_0_8px_rgba(245,158,11,0.15)]';
    case AgentStatus.STREAMING:
      return 'border-[var(--color-sa-accent)]/50 shadow-[0_0_8px_rgba(59,130,246,0.15)]';
    case AgentStatus.COMPLETE:
      return 'border-[var(--color-sa-green)]/30';
    case AgentStatus.ERROR:
      return 'border-[var(--color-sa-red)]/30';
    default:
      return 'border-[var(--color-sa-border)]';
  }
}

/** Whether an agent is in an active/animated state */
function isAnimating(status: AgentStatus): boolean {
  return status === AgentStatus.THINKING || status === AgentStatus.STREAMING;
}

// -----------------------------------------------------------------------------
// Phase Label
// -----------------------------------------------------------------------------

function getPhaseState(
  phaseIndex: number,
  currentPhase: number,
  agentStatuses: AgentStatus[]
): 'pending' | 'active' | 'complete' | 'error' {
  if (phaseIndex > currentPhase) return 'pending';
  if (phaseIndex < currentPhase) {
    const hasError = agentStatuses.some((s) => s === AgentStatus.ERROR);
    return hasError ? 'error' : 'complete';
  }
  // Current phase
  const allComplete = agentStatuses.every(
    (s) => s === AgentStatus.COMPLETE || s === AgentStatus.ERROR
  );
  if (allComplete) return 'complete';
  return 'active';
}

function phaseLabelColor(
  state: 'pending' | 'active' | 'complete' | 'error'
): string {
  switch (state) {
    case 'active':
      return 'text-[var(--color-sa-accent)]';
    case 'complete':
      return 'text-[var(--color-sa-green)]';
    case 'error':
      return 'text-[var(--color-sa-red)]';
    default:
      return 'text-[var(--color-sa-text-dim)]';
  }
}

// -----------------------------------------------------------------------------
// Agent Card (Full)
// -----------------------------------------------------------------------------

function AgentCard({
  agentId,
  status,
}: {
  agentId: AgentId;
  status: AgentStatus;
}) {
  const personality = AGENT_PERSONALITIES[agentId];
  const borderClass = getCardBorderClass(status);
  const animating = isAnimating(status);

  return (
    <div
      className={`
        flex items-center gap-2.5 rounded-lg border px-3 py-2.5
        bg-[var(--color-sa-bg-tertiary)] transition-all duration-300
        ${borderClass}
        ${animating ? 'agent-thinking' : ''}
      `}
    >
      <AgentAvatar
        avatarColor={personality.avatarColor}
        avatarIcon={personality.avatarIcon}
        size="sm"
        status={status}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-[var(--color-sa-text-primary)]">
          {personality.agentName}
        </p>
        <p className="truncate text-[10px] text-[var(--color-sa-text-muted)]">
          {personality.firmName}
        </p>
      </div>
      <StatusIcon status={status} compact={false} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Agent Pill (Compact)
// -----------------------------------------------------------------------------

function AgentPill({
  agentId,
  status,
}: {
  agentId: AgentId;
  status: AgentStatus;
}) {
  const personality = AGENT_PERSONALITIES[agentId];
  const borderClass = getCardBorderClass(status);
  const animating = isAnimating(status);

  return (
    <div
      className={`
        flex items-center gap-1.5 rounded-md border px-2 py-1.5
        bg-[var(--color-sa-bg-tertiary)] transition-all duration-300
        ${borderClass}
        ${animating ? 'agent-thinking' : ''}
      `}
      title={`${personality.agentName} - ${personality.firmName}`}
    >
      <AgentAvatar
        avatarColor={personality.avatarColor}
        avatarIcon={personality.avatarIcon}
        size="sm"
        status={status}
      />
      <StatusIcon status={status} compact={true} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tier Connector (CSS arrow between tiers)
// -----------------------------------------------------------------------------

function TierConnector({ compact }: { compact: boolean }) {
  return (
    <div className={`flex items-center justify-center ${compact ? 'py-1' : 'py-2'}`}>
      <div className="flex flex-col items-center">
        <div
          className={`w-px bg-[var(--color-sa-border)] ${compact ? 'h-2' : 'h-4'}`}
        />
        <ChevronDown
          size={compact ? 12 : 16}
          className="text-[var(--color-sa-text-dim)] -mt-0.5"
          strokeWidth={2}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// PipelineView Component
// -----------------------------------------------------------------------------

export default function PipelineView({
  phases,
  statuses,
  currentPhase,
  compact = false,
}: PipelineViewProps) {
  return (
    <div className="flex flex-col">
      {phases.map((phaseAgents, phaseIndex) => {
        const phaseStatuses = phaseAgents.map(
          (id) => statuses[id] ?? AgentStatus.IDLE
        );
        const phaseState = getPhaseState(
          phaseIndex,
          currentPhase,
          phaseStatuses
        );
        const labelColor = phaseLabelColor(phaseState);

        return (
          <div key={phaseIndex}>
            {/* Connector between tiers (not before first tier) */}
            {phaseIndex > 0 && <TierConnector compact={compact} />}

            {/* Tier container */}
            <div>
              {/* Tier label */}
              {!compact && (
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${labelColor}`}
                  >
                    Tier {phaseIndex + 1}
                  </span>
                  <div className="h-px flex-1 bg-[var(--color-sa-border)]" />
                  <span className="text-[10px] text-[var(--color-sa-text-dim)]">
                    {phaseAgents.length} agent{phaseAgents.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Agent cards/pills in this tier */}
              <div
                className={`flex flex-wrap ${
                  compact ? 'gap-1.5' : 'gap-2'
                }`}
              >
                {phaseAgents.map((agentId) => {
                  const agentStatus = statuses[agentId] ?? AgentStatus.IDLE;

                  return compact ? (
                    <AgentPill
                      key={agentId}
                      agentId={agentId}
                      status={agentStatus}
                    />
                  ) : (
                    <AgentCard
                      key={agentId}
                      agentId={agentId}
                      status={agentStatus}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
