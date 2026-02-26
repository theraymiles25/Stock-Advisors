// =============================================================================
// Stock Advisors - Agent State Store
// =============================================================================
// Zustand store for tracking real-time agent execution state. Used by the UI
// to display agent statuses, streaming output, pipeline progress, and results.
// =============================================================================

import { create } from 'zustand';
import {
  AgentId,
  AgentOutput,
  AgentStatus,
  SPECIALIST_AGENT_IDS,
} from '../agents/base/types';

// -----------------------------------------------------------------------------
// State Types
// -----------------------------------------------------------------------------

interface AgentState {
  /** Current execution status for every agent */
  agentStatuses: Record<AgentId, AgentStatus>;
  /** Final output from each agent after execution completes (null if not yet run) */
  agentOutputs: Record<string, AgentOutput | null>;
  /** Which agent is currently selected / active in the UI */
  activeAgent: AgentId | null;
  /** Live streaming text per agent (accumulated as chunks arrive) */
  streamingText: Record<string, string>;
  /** Pipeline execution progress (null when no pipeline is running) */
  pipelineProgress: {
    completed: AgentId[];
    total: number;
  } | null;
}

interface AgentActions {
  /** Update the execution status for a specific agent */
  setAgentStatus: (agentId: AgentId, status: AgentStatus) => void;
  /** Store the final output for an agent */
  setAgentOutput: (agentId: string, output: AgentOutput | null) => void;
  /** Set which agent is active / selected in the UI */
  setActiveAgent: (agentId: AgentId | null) => void;
  /** Append a text chunk to the streaming buffer for an agent */
  appendStreamingText: (agentId: string, chunk: string) => void;
  /** Clear the streaming text buffer for an agent */
  clearStreamingText: (agentId: string) => void;
  /** Clear all agent outputs and streaming text */
  clearOutputs: () => void;
  /** Update pipeline progress tracking */
  setPipelineProgress: (progress: { completed: AgentId[]; total: number } | null) => void;
}

type AgentStore = AgentState & AgentActions;

// -----------------------------------------------------------------------------
// Initial Status Map
// -----------------------------------------------------------------------------

/**
 * Build the initial agent status map with all agents set to IDLE.
 */
function buildInitialStatuses(): Record<AgentId, AgentStatus> {
  const statuses = {} as Record<AgentId, AgentStatus>;
  for (const id of Object.values(AgentId)) {
    statuses[id] = AgentStatus.IDLE;
  }
  return statuses;
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

/**
 * Global store for agent execution state. Provides real-time status tracking,
 * streaming text buffers, and pipeline progress for the UI layer.
 *
 * Usage:
 * ```tsx
 * const status = useAgentStore((s) => s.agentStatuses[AgentId.GOLDMAN_SCREENER]);
 * const streaming = useAgentStore((s) => s.streamingText['goldman_screener']);
 * const setStatus = useAgentStore((s) => s.setAgentStatus);
 * ```
 */
export const useAgentStore = create<AgentStore>()((set, get) => ({
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  agentStatuses: buildInitialStatuses(),
  agentOutputs: {},
  activeAgent: null,
  streamingText: {},
  pipelineProgress: null,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  setAgentStatus: (agentId: AgentId, status: AgentStatus) => {
    set((state) => ({
      agentStatuses: {
        ...state.agentStatuses,
        [agentId]: status,
      },
    }));
  },

  setAgentOutput: (agentId: string, output: AgentOutput | null) => {
    set((state) => ({
      agentOutputs: {
        ...state.agentOutputs,
        [agentId]: output,
      },
    }));
  },

  setActiveAgent: (agentId: AgentId | null) => {
    set({ activeAgent: agentId });
  },

  appendStreamingText: (agentId: string, chunk: string) => {
    set((state) => ({
      streamingText: {
        ...state.streamingText,
        [agentId]: (state.streamingText[agentId] ?? '') + chunk,
      },
    }));
  },

  clearStreamingText: (agentId: string) => {
    set((state) => {
      const updated = { ...state.streamingText };
      delete updated[agentId];
      return { streamingText: updated };
    });
  },

  clearOutputs: () => {
    set({
      agentOutputs: {},
      streamingText: {},
      agentStatuses: buildInitialStatuses(),
      pipelineProgress: null,
    });
  },

  setPipelineProgress: (
    progress: { completed: AgentId[]; total: number } | null
  ) => {
    set({ pipelineProgress: progress });
  },
}));
