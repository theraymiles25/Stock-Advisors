// =============================================================================
// Stock Advisors Agent Platform - Typed Event Bus
// =============================================================================
// A simple, type-safe publish/subscribe event bus that connects agents,
// the pipeline orchestrator, and the UI layer. All events are strongly
// typed via AgentEventMap so subscribers always receive the correct payload.
// =============================================================================

import {
  AgentEvent,
  AgentEventMap,
  AgentId,
  AgentOutput,
  AgentStatus,
  AgentCompletePayload,
  AgentStatusPayload,
  PipelineProgressPayload,
} from './types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** A handler function for a specific event type */
type EventHandler<T> = (payload: T) => void;

/** Function returned by `on()` that removes the subscription when called */
type Unsubscribe = () => void;

/** Internal storage for a single subscription */
interface Subscription<K extends AgentEvent = AgentEvent> {
  event: K;
  handler: EventHandler<AgentEventMap[K]>;
  /** If set, the subscription auto-removes after this many invocations */
  remaining?: number;
}

// -----------------------------------------------------------------------------
// AgentEventBus
// -----------------------------------------------------------------------------

/**
 * Centralized event bus for the agent platform. Provides type-safe pub/sub
 * with convenience methods for the most common event patterns.
 *
 * Usage:
 * ```ts
 * const bus = new AgentEventBus();
 *
 * // Subscribe to agent completions
 * const unsub = bus.onAgentComplete((payload) => {
 *   console.log(`${payload.agentId} finished in ${payload.durationMs}ms`);
 * });
 *
 * // Emit from an agent
 * bus.emit(AgentEvent.AGENT_COMPLETE, { agentId, output, durationMs });
 *
 * // Clean up
 * unsub();
 * ```
 */
export class AgentEventBus {
  /** Map of event type to array of subscriptions */
  private listeners: Map<AgentEvent, Subscription[]> = new Map();

  /** Debug mode logs every emit to the console */
  private debug: boolean;

  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug ?? false;
  }

  // ---------------------------------------------------------------------------
  // Core API
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   *
   * @param event - The event type to listen for
   * @param handler - Callback invoked with the event's typed payload
   * @returns A function that removes this subscription when called
   */
  on<K extends AgentEvent>(
    event: K,
    handler: EventHandler<AgentEventMap[K]>
  ): Unsubscribe {
    const subscription: Subscription<K> = { event, handler };
    const existing = this.listeners.get(event) ?? [];
    existing.push(subscription as unknown as Subscription);
    this.listeners.set(event, existing);

    // Return the unsubscribe function
    return () => {
      const subs = this.listeners.get(event);
      if (subs) {
        const index = subs.indexOf(subscription as unknown as Subscription);
        if (index !== -1) {
          subs.splice(index, 1);
        }
      }
    };
  }

  /**
   * Subscribe to an event, but automatically unsubscribe after it fires once.
   *
   * @param event - The event type to listen for
   * @param handler - Callback invoked with the event's typed payload
   * @returns A function that removes this subscription early if called before the event fires
   */
  once<K extends AgentEvent>(
    event: K,
    handler: EventHandler<AgentEventMap[K]>
  ): Unsubscribe {
    const unsub = this.on(event, (payload) => {
      unsub();
      handler(payload);
    });
    return unsub;
  }

  /**
   * Emit an event to all subscribers. Handlers are invoked synchronously
   * in the order they were registered.
   *
   * @param event - The event type to emit
   * @param payload - The typed payload for this event
   */
  emit<K extends AgentEvent>(event: K, payload: AgentEventMap[K]): void {
    if (this.debug) {
      console.log(`[AgentEventBus] ${event}`, payload);
    }

    const subs = this.listeners.get(event);
    if (!subs || subs.length === 0) return;

    // Iterate over a shallow copy so handlers can safely unsubscribe
    const snapshot = [...subs];
    for (const sub of snapshot) {
      try {
        (sub.handler as EventHandler<AgentEventMap[K]>)(payload);
      } catch (err) {
        console.error(
          `[AgentEventBus] Error in handler for ${event}:`,
          err
        );
      }
    }
  }

  /**
   * Remove all subscribers for a specific event, or all events if no
   * event type is provided.
   */
  clear(event?: AgentEvent): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Returns the number of active subscribers for a given event type.
   */
  listenerCount(event: AgentEvent): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Convenience Subscription Methods
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to all agent completion events.
   */
  onAgentComplete(
    handler: EventHandler<AgentCompletePayload>
  ): Unsubscribe {
    return this.on(AgentEvent.AGENT_COMPLETE, handler);
  }

  /**
   * Subscribe to completion events for a specific agent only.
   *
   * @param agentId - Only invoke the handler when this agent completes
   * @param handler - Callback with the completion payload
   */
  onSpecificAgentComplete(
    agentId: AgentId,
    handler: EventHandler<AgentCompletePayload>
  ): Unsubscribe {
    return this.on(AgentEvent.AGENT_COMPLETE, (payload) => {
      if (payload.agentId === agentId) {
        handler(payload);
      }
    });
  }

  /**
   * Subscribe to all agent status change events.
   */
  onAgentStatus(
    handler: EventHandler<AgentStatusPayload>
  ): Unsubscribe {
    return this.on(AgentEvent.AGENT_STATUS_CHANGED, handler);
  }

  /**
   * Subscribe to status changes for a specific agent.
   */
  onSpecificAgentStatus(
    agentId: AgentId,
    handler: EventHandler<AgentStatusPayload>
  ): Unsubscribe {
    return this.on(AgentEvent.AGENT_STATUS_CHANGED, (payload) => {
      if (payload.agentId === agentId) {
        handler(payload);
      }
    });
  }

  /**
   * Subscribe to pipeline progress updates.
   */
  onPipelineProgress(
    handler: EventHandler<PipelineProgressPayload>
  ): Unsubscribe {
    return this.on(AgentEvent.PIPELINE_PROGRESS, handler);
  }

  /**
   * Wait for a specific agent to reach a target status. Returns a promise
   * that resolves with the status payload. Useful for pipeline coordination.
   *
   * @param agentId - The agent to wait for
   * @param targetStatus - The status to wait for
   * @param timeoutMs - Maximum time to wait (default: 120000ms / 2 minutes)
   */
  waitForStatus(
    agentId: AgentId,
    targetStatus: AgentStatus,
    timeoutMs: number = 120_000
  ): Promise<AgentStatusPayload> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(
          new Error(
            `Timed out waiting for ${agentId} to reach status ${targetStatus} after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);

      const unsub = this.onSpecificAgentStatus(agentId, (payload) => {
        if (payload.currentStatus === targetStatus) {
          clearTimeout(timer);
          unsub();
          resolve(payload);
        }
      });
    });
  }

  /**
   * Wait for a specific agent to complete. Returns a promise that resolves
   * with the agent's output.
   *
   * @param agentId - The agent to wait for
   * @param timeoutMs - Maximum time to wait (default: 120000ms)
   */
  waitForAgent(
    agentId: AgentId,
    timeoutMs: number = 120_000
  ): Promise<AgentOutput> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(
          new Error(
            `Timed out waiting for ${agentId} to complete after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);

      const unsub = this.onSpecificAgentComplete(agentId, (payload) => {
        clearTimeout(timer);
        unsub();
        resolve(payload.output);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Convenience Emit Methods
  // ---------------------------------------------------------------------------

  /**
   * Emit an agent status change event with automatic timestamp.
   */
  emitStatusChange(
    agentId: AgentId,
    previousStatus: AgentStatus,
    currentStatus: AgentStatus
  ): void {
    this.emit(AgentEvent.AGENT_STATUS_CHANGED, {
      agentId,
      previousStatus,
      currentStatus,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit an error event with structured details.
   */
  emitError(
    source: string,
    message: string,
    error?: Error,
    agentId?: AgentId
  ): void {
    this.emit(AgentEvent.ERROR, { source, message, error, agentId });
  }
}
