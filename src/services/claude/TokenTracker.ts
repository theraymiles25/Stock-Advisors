// =============================================================================
// Stock Advisors - Token Usage Tracker
// =============================================================================
// Tracks per-agent and aggregate Claude API token usage and estimated costs.
// Used by the UI to display running cost totals and by the pipeline to
// report total resource consumption after analysis completes.
// =============================================================================

import type { AgentId } from '../../agents/base/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Usage statistics for a single agent or aggregate total */
export interface UsageRecord {
  /** Total input tokens consumed */
  input: number;
  /** Total output tokens consumed */
  output: number;
  /** Sum of input + output tokens */
  total: number;
  /** Estimated cost in USD */
  cost: number;
}

/** Per-model pricing in USD per token */
interface ModelPricing {
  inputPerToken: number;
  outputPerToken: number;
}

// -----------------------------------------------------------------------------
// Pricing Table
// -----------------------------------------------------------------------------

/**
 * Current Claude model pricing. Values are in USD per token.
 * Update these when Anthropic changes pricing.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': {
    inputPerToken: 0.003 / 1000,
    outputPerToken: 0.015 / 1000,
  },
  'claude-opus-4-20250514': {
    inputPerToken: 0.015 / 1000,
    outputPerToken: 0.075 / 1000,
  },
  'claude-haiku-3-20250307': {
    inputPerToken: 0.00025 / 1000,
    outputPerToken: 0.00125 / 1000,
  },
};

/** Default pricing when model is not recognized (falls back to Sonnet) */
const DEFAULT_PRICING: ModelPricing = {
  inputPerToken: 0.003 / 1000,
  outputPerToken: 0.015 / 1000,
};

// -----------------------------------------------------------------------------
// Internal tracking data
// -----------------------------------------------------------------------------

interface AgentUsageEntry {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  callCount: number;
}

// -----------------------------------------------------------------------------
// TokenTracker
// -----------------------------------------------------------------------------

/**
 * Tracks Claude API token usage and estimated costs across all agents.
 * Supports per-agent breakdowns and aggregate totals.
 *
 * Usage:
 * ```ts
 * const tracker = new TokenTracker();
 *
 * // Record usage after an API call
 * tracker.record('goldman_screener', 1500, 800, 'claude-sonnet-4-20250514');
 *
 * // Get usage for a specific agent
 * const usage = tracker.getUsage('goldman_screener');
 * console.log(`Cost: $${usage.cost.toFixed(4)}`);
 *
 * // Get total across all agents
 * const total = tracker.getTotalUsage();
 * ```
 */
export class TokenTracker {
  /** Per-agent usage data */
  private agentUsage: Map<string, AgentUsageEntry> = new Map();

  /** Current model for cost calculation (can be overridden per-call) */
  private defaultModel: string;

  constructor(defaultModel: string = 'claude-sonnet-4-20250514') {
    this.defaultModel = defaultModel;
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  /**
   * Record token usage for an agent after an API call completes.
   *
   * @param agentId - The agent that made the API call
   * @param inputTokens - Number of input tokens consumed
   * @param outputTokens - Number of output tokens produced
   * @param model - Optional model override for cost calculation
   */
  record(
    agentId: AgentId | string,
    inputTokens: number,
    outputTokens: number,
    model?: string
  ): void {
    const pricing = this.getPricing(model ?? this.defaultModel);
    const callCost =
      pricing.inputPerToken * inputTokens +
      pricing.outputPerToken * outputTokens;

    const existing = this.agentUsage.get(agentId);

    if (existing) {
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      existing.cost += callCost;
      existing.callCount += 1;
    } else {
      this.agentUsage.set(agentId, {
        inputTokens,
        outputTokens,
        cost: callCost,
        callCount: 1,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Querying
  // ---------------------------------------------------------------------------

  /**
   * Get the estimated cost for a specific agent, or the total across all
   * agents if no agentId is provided.
   *
   * @param agentId - Optional agent to query. If omitted, returns total cost.
   * @returns Estimated cost in USD
   */
  getCost(agentId?: AgentId | string): number {
    if (agentId) {
      return this.agentUsage.get(agentId)?.cost ?? 0;
    }
    return this.getTotalUsage().cost;
  }

  /**
   * Get detailed usage statistics for a specific agent, or the total
   * across all agents if no agentId is provided.
   *
   * @param agentId - Optional agent to query. If omitted, returns total.
   * @returns Usage record with input, output, total tokens and cost
   */
  getUsage(agentId?: AgentId | string): UsageRecord {
    if (agentId) {
      const entry = this.agentUsage.get(agentId);
      if (!entry) {
        return { input: 0, output: 0, total: 0, cost: 0 };
      }
      return {
        input: entry.inputTokens,
        output: entry.outputTokens,
        total: entry.inputTokens + entry.outputTokens,
        cost: entry.cost,
      };
    }
    return this.getTotalUsage();
  }

  /**
   * Get aggregate usage across all tracked agents.
   */
  getTotalUsage(): UsageRecord {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    for (const entry of this.agentUsage.values()) {
      totalInput += entry.inputTokens;
      totalOutput += entry.outputTokens;
      totalCost += entry.cost;
    }

    return {
      input: totalInput,
      output: totalOutput,
      total: totalInput + totalOutput,
      cost: totalCost,
    };
  }

  /**
   * Get the number of API calls made by a specific agent or total.
   */
  getCallCount(agentId?: AgentId | string): number {
    if (agentId) {
      return this.agentUsage.get(agentId)?.callCount ?? 0;
    }
    let total = 0;
    for (const entry of this.agentUsage.values()) {
      total += entry.callCount;
    }
    return total;
  }

  /**
   * Get a breakdown of usage by all tracked agents.
   */
  getBreakdown(): Record<string, UsageRecord> {
    const result: Record<string, UsageRecord> = {};
    for (const [agentId, entry] of this.agentUsage.entries()) {
      result[agentId] = {
        input: entry.inputTokens,
        output: entry.outputTokens,
        total: entry.inputTokens + entry.outputTokens,
        cost: entry.cost,
      };
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Management
  // ---------------------------------------------------------------------------

  /**
   * Clear all tracked usage data.
   */
  reset(): void {
    this.agentUsage.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Look up pricing for a model ID. Handles partial matches for model IDs
   * that may include date suffixes.
   */
  private getPricing(model: string): ModelPricing {
    // Direct lookup
    if (MODEL_PRICING[model]) {
      return MODEL_PRICING[model];
    }

    // Partial match (model string may be a prefix or contain the key)
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (model.includes(key) || key.includes(model)) {
        return pricing;
      }
    }

    return DEFAULT_PRICING;
  }
}
