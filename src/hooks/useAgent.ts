// =============================================================================
// useAgent Hook - Connect React components to agent execution
// =============================================================================

import { useState, useCallback, useRef } from 'react';
import { AgentId, AgentInput, AgentStatus, DataRequirement } from '../agents/base/types';
import type { AgentOutput } from '../agents/base/types';
import { useAgentStore } from '../stores/useAgentStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { AgentRegistry } from '../agents/base/AgentRegistry';
import { AgentEventBus } from '../agents/base/AgentEventBus';
import type { BaseAgent, IClaudeClient } from '../agents/base/BaseAgent';
import { AlphaVantageClient } from '../services/alphaVantage/AlphaVantageClient';
import { ClaudeClient } from '../services/claude/ClaudeClient';

// Shared event bus instance for all agents
let sharedEventBus: AgentEventBus | null = null;
function getEventBus(): AgentEventBus {
  if (!sharedEventBus) {
    sharedEventBus = new AgentEventBus();
  }
  return sharedEventBus;
}

/**
 * Hook to interact with a single agent from React components.
 * Handles data fetching, agent execution, streaming, and state management.
 */
export function useAgent(agentId: AgentId) {
  const [error, setError] = useState<string | null>(null);

  const {
    agentStatuses,
    agentOutputs,
    streamingText,
    setAgentStatus,
    setAgentOutput,
    appendStreamingText,
    clearStreamingText,
  } = useAgentStore();

  const { anthropicApiKey, alphaVantageKey } = useSettingsStore();

  // Prevent multiple concurrent executions
  const isRunning = useRef(false);

  const status = agentStatuses[agentId] ?? AgentStatus.IDLE;
  const output = agentOutputs[agentId] ?? null;
  const streaming = streamingText[agentId] ?? '';

  /**
   * Execute the agent with the given input.
   */
  const execute = useCallback(
    async (symbols: string[], query?: string, preferences?: AgentInput['preferences']) => {
      if (isRunning.current) return;
      if (!anthropicApiKey || !alphaVantageKey) {
        setError('API keys not configured. Go to Settings to add them.');
        return;
      }

      isRunning.current = true;
      setError(null);
      clearStreamingText(agentId);
      setAgentStatus(agentId, AgentStatus.THINKING);

      try {
        // Create clients
        const claudeClient = new ClaudeClient(anthropicApiKey);
        const avClient = new AlphaVantageClient(alphaVantageKey);

        // Get or create the agent
        const registry = AgentRegistry.getInstance();
        let agent: BaseAgent | undefined = registry.get(agentId);

        if (!agent) {
          // Agent not registered yet — dynamic import based on ID
          const AgentClass = await loadAgentClass(agentId);
          if (AgentClass) {
            agent = AgentClass.create(claudeClient, getEventBus());
            registry.register(agent);
          } else {
            throw new Error(`Agent ${agentId} not available`);
          }
        }

        // Fetch required market data
        setAgentStatus(agentId, AgentStatus.THINKING);
        const stockData = await avClient.fetchBundleForAgent(
          agent.capability.requiredData,
          symbols
        );

        // Execute with streaming
        setAgentStatus(agentId, AgentStatus.STREAMING);
        const result = await agent.executeStreaming(
          { symbols, query, preferences },
          stockData,
          (chunk: string) => {
            appendStreamingText(agentId, chunk);
          }
        );

        setAgentOutput(agentId, result);
        setAgentStatus(agentId, AgentStatus.COMPLETE);

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setAgentStatus(agentId, AgentStatus.ERROR);
        return undefined;
      } finally {
        isRunning.current = false;
      }
    },
    [
      agentId,
      anthropicApiKey,
      alphaVantageKey,
      setAgentStatus,
      setAgentOutput,
      appendStreamingText,
      clearStreamingText,
    ]
  );

  /**
   * Reset the agent to idle state.
   */
  const reset = useCallback(() => {
    setAgentStatus(agentId, AgentStatus.IDLE);
    clearStreamingText(agentId);
    setError(null);
  }, [agentId, setAgentStatus, clearStreamingText]);

  return {
    status,
    output,
    streaming,
    error,
    execute,
    reset,
    isConfigured: Boolean(anthropicApiKey && alphaVantageKey),
  };
}

// -----------------------------------------------------------------------------
// Dynamic Agent Loader
// -----------------------------------------------------------------------------

interface AgentFactory {
  create(claudeClient: IClaudeClient, eventBus: AgentEventBus): BaseAgent;
}

/**
 * Dynamically import an agent class by ID.
 * This avoids loading all 15 agents upfront.
 */
async function loadAgentClass(agentId: AgentId): Promise<AgentFactory | null> {
  try {
    switch (agentId) {
      case AgentId.GOLDMAN_SCREENER: {
        const mod = await import('../agents/implementations/GoldmanScreener');
        return mod.GoldmanScreener as unknown as AgentFactory;
      }
      case AgentId.MORGAN_STANLEY_DCF: {
        const mod = await import('../agents/implementations/MorganStanleyDCF');
        return mod.MorganStanleyDCF as unknown as AgentFactory;
      }
      case AgentId.BRIDGEWATER_RISK: {
        const mod = await import('../agents/implementations/BridgewaterRisk');
        return mod.BridgewaterRisk as unknown as AgentFactory;
      }
      case AgentId.JPMORGAN_EARNINGS: {
        const mod = await import('../agents/implementations/JPMorganEarnings');
        return mod.JPMorganEarnings as unknown as AgentFactory;
      }
      case AgentId.BLACKROCK_PORTFOLIO: {
        const mod = await import('../agents/implementations/BlackRockPortfolio');
        return mod.BlackRockPortfolio as unknown as AgentFactory;
      }
      case AgentId.CITADEL_TECHNICAL: {
        const mod = await import('../agents/implementations/CitadelTechnical');
        return mod.CitadelTechnical as unknown as AgentFactory;
      }
      case AgentId.HARVARD_DIVIDEND: {
        const mod = await import('../agents/implementations/HarvardDividend');
        return mod.HarvardDividend as unknown as AgentFactory;
      }
      case AgentId.BAIN_COMPETITIVE: {
        const mod = await import('../agents/implementations/BainCompetitive');
        return mod.BainCompetitive as unknown as AgentFactory;
      }
      case AgentId.RENTECH_PATTERNS: {
        const mod = await import('../agents/implementations/RentechPatterns');
        return mod.RentechPatterns as unknown as AgentFactory;
      }
      case AgentId.MCKINSEY_MACRO: {
        const mod = await import('../agents/implementations/McKinseyMacro');
        return mod.McKinseyMacro as unknown as AgentFactory;
      }
      case AgentId.SENTINEL_SENTIMENT: {
        const mod = await import('../agents/implementations/SentinelSentiment');
        return mod.SentinelSentiment as unknown as AgentFactory;
      }
      case AgentId.SUSQUEHANNA_OPTIONS: {
        const mod = await import('../agents/implementations/SusquehannaOptions');
        return mod.SusquehannaOptions as unknown as AgentFactory;
      }
      case AgentId.PERFORMANCE_ANALYST: {
        const mod = await import('../agents/implementations/PerformanceAnalyst');
        return mod.PerformanceAnalyst as unknown as AgentFactory;
      }
      case AgentId.SHORT_TERM_TRADER: {
        const mod = await import('../agents/implementations/ShortTermTrader');
        return mod.ShortTermTrader as unknown as AgentFactory;
      }
      case AgentId.NEWS_RESEARCH: {
        const mod = await import('../agents/implementations/NewsResearch');
        return mod.NewsResearch as unknown as AgentFactory;
      }
      default:
        return null;
    }
  } catch (err) {
    console.error(`Failed to load agent ${agentId}:`, err);
    return null;
  }
}
