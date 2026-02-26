// =============================================================================
// Master Orchestrator - Tiered Pipeline Execution Engine
// =============================================================================
// Coordinates all specialist agents in a dependency-aware, tiered pipeline.
// Pre-fetches market data, runs agents in parallel phases, resolves conflicts,
// and produces a unified MasterOutput with trade recommendations and timing.
// =============================================================================

import {
  AgentId,
  AgentInput,
  AgentOutput,
  AgentStatus,
  DataRequirement,
  FinalRecommendation,
  MasterOutput,
  PipelineResult,
  PipelineStep,
  StockDataBundle,
  StockDataMap,
  TokenUsage,
  TradeTimeline,
  TimelineEntry,
} from '../base/types';
import { BaseAgent } from '../base/BaseAgent';
import { AgentRegistry } from '../base/AgentRegistry';
import { AgentEventBus } from '../base/AgentEventBus';
import { ConflictResolver } from './ConflictResolver';
import {
  WorkflowId,
  WorkflowDefinition,
  WORKFLOWS,
  getWorkflowPhases,
} from './WorkflowEngine';
import { ClaudeClient } from '../../services/claude/ClaudeClient';
import { AlphaVantageClient } from '../../services/alphaVantage/AlphaVantageClient';

import masterPromptRaw from '../prompts/system-prompts/master-orchestrator.md?raw';

export class MasterOrchestrator {
  private registry: AgentRegistry;
  private eventBus: AgentEventBus;
  private claudeClient: ClaudeClient;
  private avClient: AlphaVantageClient;
  private conflictResolver: ConflictResolver;

  constructor(
    registry: AgentRegistry,
    eventBus: AgentEventBus,
    claudeClient: ClaudeClient,
    avClient: AlphaVantageClient
  ) {
    this.registry = registry;
    this.eventBus = eventBus;
    this.claudeClient = claudeClient;
    this.avClient = avClient;
    this.conflictResolver = new ConflictResolver();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run a full workflow pipeline for the given symbols.
   */
  async runWorkflow(
    workflowId: WorkflowId,
    symbols: string[],
    preferences?: AgentInput['preferences']
  ): Promise<MasterOutput> {
    const workflow = WORKFLOWS[workflowId];
    if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`);

    const startTime = Date.now();
    const agentOutputs = new Map<AgentId, AgentOutput>();
    const pipelineResults: PipelineResult[] = [];

    // Step 1: Pre-fetch all required market data
    const stockData = await this.prefetchData(workflow, symbols);

    // Step 2: Execute agents in tiered phases
    const phases = getWorkflowPhases(workflowId);

    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
      const phase = phases[phaseIndex];

      // Skip master orchestrator step — we handle synthesis separately below
      const stepsToRun = phase.filter(
        (s) => s.agentId !== AgentId.MASTER_ORCHESTRATOR
      );

      if (stepsToRun.length === 0) continue;

      // Run all agents in this phase in parallel
      const phaseResults = await Promise.allSettled(
        stepsToRun.map((step) =>
          this.executeStep(step, symbols, stockData, agentOutputs, preferences)
        )
      );

      // Collect results
      for (let i = 0; i < phaseResults.length; i++) {
        const result = phaseResults[i];
        const step = stepsToRun[i];

        if (result.status === 'fulfilled') {
          pipelineResults.push(result.value);
          if (result.value.output) {
            agentOutputs.set(step.agentId, result.value.output);
          }
        } else {
          pipelineResults.push({
            step,
            output: null,
            durationMs: 0,
            success: false,
            error: result.reason?.message ?? 'Unknown error',
          });
        }
      }

      // Emit pipeline progress
      this.eventBus.emit('pipeline:progress' as never, {
        completed: Array.from(agentOutputs.keys()),
        total: workflow.steps.length,
        currentPhase: phaseIndex + 1,
        totalPhases: phases.length,
      } as never);
    }

    // Step 3: Synthesize via Claude API (Master Orchestrator analysis)
    const masterOutput = await this.synthesize(
      agentOutputs,
      pipelineResults,
      symbols,
      startTime
    );

    // Emit pipeline complete
    this.eventBus.emit('pipeline:complete' as never, {
      result: masterOutput,
    } as never);

    return masterOutput;
  }

  /**
   * Run a single agent independently (Pattern A from the plan).
   */
  async runSingleAgent(
    agentId: AgentId,
    symbols: string[],
    query?: string,
    preferences?: AgentInput['preferences']
  ): Promise<AgentOutput> {
    const agent = this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not registered`);

    // Fetch required data for this agent
    const stockData = await this.avClient.fetchBundleForAgent(
      agent.capability.requiredData,
      symbols
    );

    const input: AgentInput = { symbols, query, preferences };
    return agent.execute(input, stockData);
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  /**
   * Pre-fetch all required market data for every agent in the workflow.
   */
  private async prefetchData(
    workflow: WorkflowDefinition,
    symbols: string[]
  ): Promise<StockDataMap> {
    // Collect all unique data requirements across all agents in the workflow
    const allRequirements = new Set<DataRequirement>();

    for (const step of workflow.steps) {
      if (step.agentId === AgentId.MASTER_ORCHESTRATOR) continue;

      const agent = this.registry.get(step.agentId);
      if (agent) {
        for (const req of agent.capability.requiredData) {
          allRequirements.add(req);
        }
      }
    }

    return this.avClient.fetchBundleForAgent(
      Array.from(allRequirements),
      symbols
    );
  }

  /**
   * Execute a single pipeline step (one agent).
   */
  private async executeStep(
    step: PipelineStep,
    symbols: string[],
    stockData: StockDataMap,
    priorOutputs: Map<AgentId, AgentOutput>,
    preferences?: AgentInput['preferences']
  ): Promise<PipelineResult> {
    const stepStart = Date.now();

    try {
      const agent = this.registry.get(step.agentId);
      if (!agent) {
        return {
          step,
          output: null,
          durationMs: Date.now() - stepStart,
          success: false,
          error: `Agent ${step.agentId} not registered`,
        };
      }

      // Build context from dependent agents' outputs
      const context: Record<string, unknown> = {};
      for (const depId of step.dependsOn) {
        const depOutput = priorOutputs.get(depId);
        if (depOutput) {
          context[depId] = {
            summary: depOutput.summary,
            confidence: depOutput.confidence,
            recommendations: depOutput.recommendations,
            structured: depOutput.structured,
          };
        }
      }

      const input: AgentInput = {
        symbols,
        context: Object.keys(context).length > 0 ? context : undefined,
        preferences,
      };

      // Execute with timeout
      const output = await Promise.race([
        agent.execute(input, stockData),
        this.timeout(step.timeoutMs, step.agentId),
      ]);

      return {
        step,
        output,
        durationMs: Date.now() - stepStart,
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // If the step is optional, don't propagate the error
      if (step.optional) {
        console.warn(
          `Optional agent ${step.agentId} failed: ${errorMessage}`
        );
      }

      return {
        step,
        output: null,
        durationMs: Date.now() - stepStart,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Synthesize all agent outputs into a unified MasterOutput.
   */
  private async synthesize(
    agentOutputs: Map<AgentId, AgentOutput>,
    pipelineResults: PipelineResult[],
    symbols: string[],
    startTime: number
  ): Promise<MasterOutput> {
    // Detect conflicts
    const conflicts = this.conflictResolver.detect(agentOutputs);

    // Build the prompt for the Master Orchestrator
    const agentSummaries = this.formatAgentOutputsForSynthesis(agentOutputs);
    const conflictSummary = this.conflictResolver.formatForPrompt(conflicts);

    const userMessage = `## Symbols Under Analysis
${symbols.join(', ')}

## Agent Analysis Results
${agentSummaries}

${conflictSummary}

## Task
Synthesize all agent analyses into:
1. Final recommendations for each symbol (action, confidence, target, stop-loss, rationale)
2. A trade timeline ordered by urgency
3. An executive summary
4. An overall risk assessment

Be decisive. Investors need clear direction.`;

    try {
      const response = await this.claudeClient.createMessage({
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        temperature: 0.2,
        system: masterPromptRaw,
        messages: [{ role: 'user', content: userMessage }],
        tools: [
          {
            name: 'master_synthesis',
            description:
              'Produce the master orchestrator synthesis with final recommendations, trade timeline, executive summary, and risk assessment.',
            input_schema: MASTER_SYNTHESIS_SCHEMA,
          },
        ],
        toolChoice: { type: 'tool', name: 'master_synthesis' },
      });

      const toolUse = response.content.find(
        (b: { type: string }) => b.type === 'tool_use'
      );
      const parsed = (toolUse as unknown as { input: MasterSynthesisOutput } | undefined)?.input;

      if (!parsed) {
        return this.buildFallbackOutput(
          agentOutputs,
          pipelineResults,
          conflicts,
          symbols,
          startTime
        );
      }

      // Build the final MasterOutput
      const totalTokens = this.aggregateTokenUsage(agentOutputs, response.usage);

      return {
        timestamp: new Date().toISOString(),
        pipelineResults,
        finalRecommendations: (parsed.recommendations ?? []).map(
          (rec: Record<string, unknown>) =>
            this.mapToFinalRecommendation(rec, agentOutputs)
        ),
        tradeTimeline: {
          entries: (parsed.trade_timeline ?? []).map(
            (entry: Record<string, unknown>) => ({
              timing: (entry.timing as string) ?? 'Watch',
              action: (entry.action as string) ?? 'HOLD',
              symbol: (entry.symbol as string) ?? '',
              positionSize: (entry.position_size_percent as number) ?? 0,
              rationale: (entry.rationale as string) ?? '',
            })
          ) as TimelineEntry[],
          strategy: (parsed.overall_strategy as string) ?? '',
        },
        conflicts,
        executiveSummary: (parsed.executive_summary as string) ?? '',
        riskAssessment: (parsed.risk_assessment as string) ?? '',
        totalTokenUsage: totalTokens,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Master synthesis failed:', error);
      return this.buildFallbackOutput(
        agentOutputs,
        pipelineResults,
        conflicts,
        symbols,
        startTime
      );
    }
  }

  /**
   * Format all agent outputs into a readable summary for the synthesis prompt.
   */
  private formatAgentOutputsForSynthesis(
    outputs: Map<AgentId, AgentOutput>
  ): string {
    const sections: string[] = [];

    for (const [agentId, output] of outputs) {
      const recs = output.recommendations
        .map(
          (r) =>
            `  - ${r.symbol}: ${r.action} (confidence: ${r.confidence}%, target: ${r.targetPrice ?? 'N/A'}, stop: ${r.stopLoss ?? 'N/A'}, horizon: ${r.timeHorizon})\n    Rationale: ${r.rationale}`
        )
        .join('\n');

      sections.push(
        `### ${agentId} (Confidence: ${output.confidence}%)
Summary: ${output.summary}
${output.recommendations.length > 0 ? `Recommendations:\n${recs}` : 'No specific recommendations.'}
${output.warnings.length > 0 ? `Warnings: ${output.warnings.join('; ')}` : ''}`
      );
    }

    return sections.join('\n\n');
  }

  /**
   * Map a raw synthesis recommendation to a FinalRecommendation.
   */
  private mapToFinalRecommendation(
    rec: Record<string, unknown>,
    agentOutputs: Map<AgentId, AgentOutput>
  ): FinalRecommendation {
    const symbol = (rec.symbol as string) ?? '';

    // Find which agents had opinions on this symbol
    const agentBreakdown: FinalRecommendation['agentBreakdown'] = [];
    let consensusCount = 0;

    for (const [agentId, output] of agentOutputs) {
      const agentRec = output.recommendations.find((r) => r.symbol === symbol);
      if (agentRec) {
        agentBreakdown.push({
          agentId,
          action: agentRec.action,
          confidence: agentRec.confidence,
          weight: 1, // Equal weight by default
        });
        if (agentRec.action === rec.action) {
          consensusCount++;
        }
      }
    }

    return {
      symbol,
      action: (rec.action as FinalRecommendation['action']) ?? 'HOLD',
      confidence: (rec.confidence as number) ?? 50,
      targetPrice: rec.target_price as number | undefined,
      stopLoss: rec.stop_loss as number | undefined,
      timeHorizon: (rec.time_horizon as string) ?? '3-6 months',
      rationale: (rec.rationale as string) ?? '',
      agentConsensusCount: consensusCount,
      agentBreakdown,
    };
  }

  /**
   * Build a fallback output when Claude synthesis fails.
   */
  private buildFallbackOutput(
    agentOutputs: Map<AgentId, AgentOutput>,
    pipelineResults: PipelineResult[],
    conflicts: MasterOutput['conflicts'],
    symbols: string[],
    startTime: number
  ): MasterOutput {
    // Simple vote-based fallback
    const recommendations: FinalRecommendation[] = symbols.map((symbol) => {
      const agentBreakdown: FinalRecommendation['agentBreakdown'] = [];
      let totalConfidence = 0;
      let count = 0;

      for (const [agentId, output] of agentOutputs) {
        const rec = output.recommendations.find((r) => r.symbol === symbol);
        if (rec) {
          agentBreakdown.push({
            agentId,
            action: rec.action,
            confidence: rec.confidence,
            weight: 1,
          });
          totalConfidence += rec.confidence;
          count++;
        }
      }

      return {
        symbol,
        action: 'HOLD' as const,
        confidence: count > 0 ? Math.round(totalConfidence / count) : 0,
        timeHorizon: '3-6 months',
        rationale:
          'Automatic synthesis unavailable. Review individual agent analyses.',
        agentConsensusCount: count,
        agentBreakdown,
      };
    });

    return {
      timestamp: new Date().toISOString(),
      pipelineResults,
      finalRecommendations: recommendations,
      tradeTimeline: { entries: [], strategy: 'Review individual agent analyses.' },
      conflicts,
      executiveSummary:
        'Automatic synthesis was unavailable. Please review individual agent analyses below.',
      riskAssessment: 'Unable to produce automated risk assessment.',
      totalTokenUsage: this.aggregateTokenUsage(agentOutputs),
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Aggregate token usage across all agents plus optional synthesis usage.
   */
  private aggregateTokenUsage(
    outputs: Map<AgentId, AgentOutput>,
    synthesisUsage?: { input_tokens: number; output_tokens: number }
  ): TokenUsage {
    let input = 0;
    let output = 0;

    for (const agentOutput of outputs.values()) {
      input += agentOutput.tokenUsage.inputTokens;
      output += agentOutput.tokenUsage.outputTokens;
    }

    if (synthesisUsage) {
      input += synthesisUsage.input_tokens;
      output += synthesisUsage.output_tokens;
    }

    const total = input + output;
    // Approximate cost at Sonnet pricing ($3/$15 per million)
    const cost = (input / 1_000_000) * 3 + (output / 1_000_000) * 15;

    return {
      inputTokens: input,
      outputTokens: output,
      totalTokens: total,
      estimatedCost: Math.round(cost * 10000) / 10000,
    };
  }

  /**
   * Create a timeout promise that rejects after the specified duration.
   */
  private timeout(ms: number, agentId: AgentId): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Agent ${agentId} timed out after ${ms}ms`)),
        ms
      )
    );
  }
}

// -----------------------------------------------------------------------------
// Master Synthesis Output Schema (for Claude tool_use)
// -----------------------------------------------------------------------------

interface MasterSynthesisOutput {
  recommendations: Record<string, unknown>[];
  trade_timeline: Record<string, unknown>[];
  overall_strategy: string;
  executive_summary: string;
  risk_assessment: string;
}

const MASTER_SYNTHESIS_SCHEMA = {
  type: 'object' as const,
  properties: {
    recommendations: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          symbol: { type: 'string' as const },
          action: {
            type: 'string' as const,
            enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
          },
          confidence: { type: 'number' as const },
          target_price: { type: 'number' as const },
          stop_loss: { type: 'number' as const },
          time_horizon: { type: 'string' as const },
          rationale: { type: 'string' as const },
        },
        required: ['symbol', 'action', 'confidence', 'rationale'],
      },
    },
    trade_timeline: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          timing: {
            type: 'string' as const,
            enum: ['Immediate', 'This Week', 'This Month', 'Watch'],
          },
          action: {
            type: 'string' as const,
            enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
          },
          symbol: { type: 'string' as const },
          position_size_percent: { type: 'number' as const },
          rationale: { type: 'string' as const },
        },
        required: ['timing', 'action', 'symbol', 'rationale'],
      },
    },
    overall_strategy: { type: 'string' as const },
    executive_summary: { type: 'string' as const },
    risk_assessment: { type: 'string' as const },
  },
  required: [
    'recommendations',
    'trade_timeline',
    'overall_strategy',
    'executive_summary',
    'risk_assessment',
  ],
};
