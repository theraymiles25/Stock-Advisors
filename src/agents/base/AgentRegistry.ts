// =============================================================================
// Stock Advisors Agent Platform - Agent Registry
// =============================================================================
// Singleton registry that tracks all registered agents. Used by the pipeline
// orchestrator to look up agents by ID, discover agents that can handle
// specific data requirements, and enumerate all available agents.
// =============================================================================

import type { BaseAgent } from './BaseAgent';
import { AgentId, DataRequirement } from './types';

/**
 * Centralized registry for all agent instances. Ensures agents are
 * discoverable by the orchestrator and prevents duplicate registrations.
 *
 * Usage:
 * ```ts
 * const registry = AgentRegistry.getInstance();
 * registry.register(goldmanScreenerAgent);
 * registry.register(morganStanleyDcfAgent);
 *
 * const agent = registry.get(AgentId.GOLDMAN_SCREENER);
 * const technicalAgents = registry.getByCapability(DataRequirement.TECHNICAL_RSI);
 * ```
 */
export class AgentRegistry {
  /** The singleton instance */
  private static instance: AgentRegistry | null = null;

  /** Internal map of AgentId to agent instance */
  private agents: Map<AgentId, BaseAgent> = new Map();

  /** Private constructor enforces singleton pattern */
  private constructor() {}

  /**
   * Get the singleton AgentRegistry instance.
   * Creates it on first access.
   */
  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Reset the singleton instance. Primarily useful for testing.
   */
  static resetInstance(): void {
    AgentRegistry.instance = null;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register an agent instance. Throws if an agent with the same ID is
   * already registered (use `replace` for intentional overwrites).
   *
   * @param agent - The agent instance to register
   * @throws Error if an agent with the same ID is already registered
   */
  register(agent: BaseAgent): void {
    const id = agent.capability.id;

    if (this.agents.has(id)) {
      throw new Error(
        `Agent ${id} is already registered. Use replace() to overwrite.`
      );
    }

    this.agents.set(id, agent);
  }

  /**
   * Register an agent, replacing any existing registration with the same ID.
   * Useful for hot-reloading or test setup.
   *
   * @param agent - The agent instance to register (or replace)
   */
  replace(agent: BaseAgent): void {
    this.agents.set(agent.capability.id, agent);
  }

  /**
   * Remove an agent from the registry.
   *
   * @param id - The agent ID to unregister
   * @returns true if the agent was found and removed, false otherwise
   */
  unregister(id: AgentId): boolean {
    return this.agents.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------------

  /**
   * Get a specific agent by its ID.
   *
   * @param id - The agent ID to look up
   * @returns The agent instance, or undefined if not registered
   */
  get(id: AgentId): BaseAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get a specific agent by its ID, throwing if not found.
   * Use this when the agent is expected to exist (e.g., pipeline execution).
   *
   * @param id - The agent ID to look up
   * @throws Error if the agent is not registered
   */
  getOrThrow(id: AgentId): BaseAgent {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(
        `Agent ${id} is not registered. Available agents: ${this.getRegisteredIds().join(', ')}`
      );
    }
    return agent;
  }

  /**
   * Get all registered agents as an array.
   */
  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all registered agent IDs.
   */
  getRegisteredIds(): AgentId[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Check if a specific agent is registered.
   */
  has(id: AgentId): boolean {
    return this.agents.has(id);
  }

  /**
   * Get the total number of registered agents.
   */
  get size(): number {
    return this.agents.size;
  }

  // ---------------------------------------------------------------------------
  // Capability-Based Discovery
  // ---------------------------------------------------------------------------

  /**
   * Find all agents that require a specific data type. Useful for the
   * data layer to understand which data to pre-fetch.
   *
   * @param requirement - The data requirement to search for
   * @returns Array of agents whose requiredData includes this requirement
   */
  getByCapability(requirement: DataRequirement): BaseAgent[] {
    return this.getAll().filter((agent) =>
      agent.capability.requiredData.includes(requirement)
    );
  }

  /**
   * Find all agents that can operate with a given set of available data.
   * Returns agents whose required data is a subset of what's available.
   *
   * @param availableData - Set of data requirements that are available
   * @returns Agents that have all their data requirements satisfied
   */
  getExecutableAgents(availableData: Set<DataRequirement>): BaseAgent[] {
    return this.getAll().filter((agent) =>
      agent.capability.requiredData.every((req) => availableData.has(req))
    );
  }

  /**
   * Get the union of all data requirements across all registered agents.
   * Useful for the data layer to know everything it needs to fetch.
   */
  getAllRequiredData(): DataRequirement[] {
    const requirements = new Set<DataRequirement>();
    const allAgents = this.getAll();
    for (let i = 0; i < allAgents.length; i++) {
      const reqs = allAgents[i].capability.requiredData;
      for (let j = 0; j < reqs.length; j++) {
        requirements.add(reqs[j]);
      }
    }
    return Array.from(requirements);
  }

  /**
   * Get all specialist agents (everything except the master orchestrator).
   */
  getSpecialists(): BaseAgent[] {
    return this.getAll().filter(
      (agent) => agent.capability.id !== AgentId.MASTER_ORCHESTRATOR
    );
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Remove all registered agents. Primarily useful for testing.
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Returns a summary of all registered agents for debugging.
   */
  toString(): string {
    const lines = ['AgentRegistry:'];
    const ids = this.getRegisteredIds();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const agent = this.agents.get(id)!;
      const dataCount = agent.capability.requiredData.length;
      lines.push(
        `  ${id}: ${agent.capability.name} (${dataCount} data requirements)`
      );
    }
    return lines.join('\n');
  }
}
