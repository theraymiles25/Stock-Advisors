// =============================================================================
// Workflow Engine - Pre-defined Agent Collaboration Templates
// =============================================================================
// Defines standard multi-agent workflows that users can trigger. Each workflow
// specifies which agents run, in what order, and how data flows between them.
// =============================================================================

import { AgentId, PipelineStep } from '../base/types';

// -----------------------------------------------------------------------------
// Workflow Definitions
// -----------------------------------------------------------------------------

export type WorkflowId =
  | 'full_analysis'
  | 'should_i_buy'
  | 'earnings_play'
  | 'dividend_income'
  | 'sector_deep_dive'
  | 'valuation_check'
  | 'day_trade'
  | 'news_check'
  | 'performance_review';

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  description: string;
  /** Pipeline steps grouped by phase (agents in the same phase run in parallel) */
  steps: PipelineStep[];
  /** Estimated time in seconds */
  estimatedTimeSeconds: number;
  /** Whether this workflow requires all agents to succeed */
  requireAll: boolean;
}

const DEFAULT_TIMEOUT = 120_000; // 2 minutes per agent

// -----------------------------------------------------------------------------
// Full Analysis Pipeline (all 15 agents in 5 tiers)
// -----------------------------------------------------------------------------

const FULL_ANALYSIS: WorkflowDefinition = {
  id: 'full_analysis',
  name: 'Full Analysis',
  description: 'Run all 15 agents in a tiered pipeline for comprehensive stock analysis',
  estimatedTimeSeconds: 180,
  requireAll: false,
  steps: [
    // Tier 1: Independent analysis, no dependencies
    { agentId: AgentId.GOLDMAN_SCREENER, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.CITADEL_TECHNICAL, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.MCKINSEY_MACRO, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.SENTINEL_SENTIMENT, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.NEWS_RESEARCH, phase: 1, dependsOn: [], optional: true, timeoutMs: DEFAULT_TIMEOUT },

    // Tier 2: Enriched analysis using Tier 1 context
    { agentId: AgentId.MORGAN_STANLEY_DCF, phase: 2, dependsOn: [AgentId.GOLDMAN_SCREENER], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.JPMORGAN_EARNINGS, phase: 2, dependsOn: [AgentId.CITADEL_TECHNICAL], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.BAIN_COMPETITIVE, phase: 2, dependsOn: [AgentId.MCKINSEY_MACRO], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.RENTECH_PATTERNS, phase: 2, dependsOn: [AgentId.SENTINEL_SENTIMENT], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.SUSQUEHANNA_OPTIONS, phase: 2, dependsOn: [AgentId.CITADEL_TECHNICAL], optional: true, timeoutMs: DEFAULT_TIMEOUT },

    // Tier 3: Portfolio-level synthesis using all prior context
    { agentId: AgentId.BRIDGEWATER_RISK, phase: 3, dependsOn: [AgentId.CITADEL_TECHNICAL, AgentId.MORGAN_STANLEY_DCF], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.HARVARD_DIVIDEND, phase: 3, dependsOn: [AgentId.MORGAN_STANLEY_DCF, AgentId.GOLDMAN_SCREENER], optional: true, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.BLACKROCK_PORTFOLIO, phase: 3, dependsOn: [AgentId.GOLDMAN_SCREENER, AgentId.BRIDGEWATER_RISK], optional: true, timeoutMs: DEFAULT_TIMEOUT },

    // Tier 4: Master synthesis
    { agentId: AgentId.MASTER_ORCHESTRATOR, phase: 4, dependsOn: [], optional: false, timeoutMs: 180_000 },

    // Tier 5: Short-term trading opportunities from all analysis
    { agentId: AgentId.SHORT_TERM_TRADER, phase: 5, dependsOn: [AgentId.MASTER_ORCHESTRATOR], optional: true, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

// -----------------------------------------------------------------------------
// Targeted Workflows
// -----------------------------------------------------------------------------

const SHOULD_I_BUY: WorkflowDefinition = {
  id: 'should_i_buy',
  name: 'Should I Buy?',
  description: 'Quick buy/sell assessment combining screening, technicals, and risk',
  estimatedTimeSeconds: 45,
  requireAll: true,
  steps: [
    { agentId: AgentId.GOLDMAN_SCREENER, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.CITADEL_TECHNICAL, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.BRIDGEWATER_RISK, phase: 2, dependsOn: [AgentId.CITADEL_TECHNICAL], optional: false, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

const EARNINGS_PLAY: WorkflowDefinition = {
  id: 'earnings_play',
  name: 'Earnings Play',
  description: 'Pre-earnings analysis with sentiment, technicals, and options strategy',
  estimatedTimeSeconds: 60,
  requireAll: false,
  steps: [
    { agentId: AgentId.JPMORGAN_EARNINGS, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.CITADEL_TECHNICAL, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.SENTINEL_SENTIMENT, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.SUSQUEHANNA_OPTIONS, phase: 2, dependsOn: [AgentId.CITADEL_TECHNICAL], optional: false, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

const DIVIDEND_INCOME: WorkflowDefinition = {
  id: 'dividend_income',
  name: 'Dividend Income',
  description: 'Build a dividend income portfolio with risk assessment',
  estimatedTimeSeconds: 45,
  requireAll: true,
  steps: [
    { agentId: AgentId.HARVARD_DIVIDEND, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.BRIDGEWATER_RISK, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.BLACKROCK_PORTFOLIO, phase: 2, dependsOn: [AgentId.HARVARD_DIVIDEND, AgentId.BRIDGEWATER_RISK], optional: false, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

const SECTOR_DEEP_DIVE: WorkflowDefinition = {
  id: 'sector_deep_dive',
  name: 'Sector Deep Dive',
  description: 'Comprehensive sector analysis with competitive landscape and macro context',
  estimatedTimeSeconds: 45,
  requireAll: true,
  steps: [
    { agentId: AgentId.BAIN_COMPETITIVE, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.MCKINSEY_MACRO, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.GOLDMAN_SCREENER, phase: 2, dependsOn: [AgentId.BAIN_COMPETITIVE], optional: false, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

const VALUATION_CHECK: WorkflowDefinition = {
  id: 'valuation_check',
  name: 'Valuation Check',
  description: 'Deep valuation analysis with DCF, screening, and pattern recognition',
  estimatedTimeSeconds: 45,
  requireAll: true,
  steps: [
    { agentId: AgentId.MORGAN_STANLEY_DCF, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.GOLDMAN_SCREENER, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.RENTECH_PATTERNS, phase: 2, dependsOn: [AgentId.GOLDMAN_SCREENER], optional: false, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

const DAY_TRADE: WorkflowDefinition = {
  id: 'day_trade',
  name: 'Day Trade Setup',
  description: 'Find short-term trading opportunities with technical and sentiment signals',
  estimatedTimeSeconds: 60,
  requireAll: false,
  steps: [
    { agentId: AgentId.CITADEL_TECHNICAL, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.SENTINEL_SENTIMENT, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.SUSQUEHANNA_OPTIONS, phase: 2, dependsOn: [AgentId.CITADEL_TECHNICAL], optional: true, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.SHORT_TERM_TRADER, phase: 3, dependsOn: [AgentId.CITADEL_TECHNICAL, AgentId.SENTINEL_SENTIMENT], optional: false, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

const NEWS_CHECK: WorkflowDefinition = {
  id: 'news_check',
  name: "What's in the News?",
  description: 'Breaking news analysis with sentiment scoring',
  estimatedTimeSeconds: 30,
  requireAll: true,
  steps: [
    { agentId: AgentId.NEWS_RESEARCH, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
    { agentId: AgentId.SENTINEL_SENTIMENT, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

const PERFORMANCE_REVIEW: WorkflowDefinition = {
  id: 'performance_review',
  name: 'Performance Review',
  description: 'Analyze agent track records and portfolio performance',
  estimatedTimeSeconds: 30,
  requireAll: true,
  steps: [
    { agentId: AgentId.PERFORMANCE_ANALYST, phase: 1, dependsOn: [], optional: false, timeoutMs: DEFAULT_TIMEOUT },
  ],
};

// -----------------------------------------------------------------------------
// Workflow Registry
// -----------------------------------------------------------------------------

export const WORKFLOWS: Record<WorkflowId, WorkflowDefinition> = {
  full_analysis: FULL_ANALYSIS,
  should_i_buy: SHOULD_I_BUY,
  earnings_play: EARNINGS_PLAY,
  dividend_income: DIVIDEND_INCOME,
  sector_deep_dive: SECTOR_DEEP_DIVE,
  valuation_check: VALUATION_CHECK,
  day_trade: DAY_TRADE,
  news_check: NEWS_CHECK,
  performance_review: PERFORMANCE_REVIEW,
};

export const WORKFLOW_LIST = Object.values(WORKFLOWS);

/**
 * Get the phases for a workflow, sorted by phase number.
 * Returns an array of arrays — each inner array is a set of steps that run in parallel.
 */
export function getWorkflowPhases(workflowId: WorkflowId): PipelineStep[][] {
  const workflow = WORKFLOWS[workflowId];
  if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`);

  const phaseMap = new Map<number, PipelineStep[]>();

  for (const step of workflow.steps) {
    const existing = phaseMap.get(step.phase) ?? [];
    existing.push(step);
    phaseMap.set(step.phase, existing);
  }

  return Array.from(phaseMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, steps]) => steps);
}

/**
 * Get all unique agent IDs required for a workflow.
 */
export function getWorkflowAgentIds(workflowId: WorkflowId): AgentId[] {
  const workflow = WORKFLOWS[workflowId];
  if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`);
  return workflow.steps.map((s) => s.agentId);
}

/**
 * Get all unique DataRequirements needed across all agents in a workflow.
 * Used to pre-fetch all necessary market data in a single batch.
 */
export function getWorkflowDataRequirements(
  workflowId: WorkflowId,
  agentCapabilities: Map<AgentId, { requiredData: string[] }>
): string[] {
  const agentIds = getWorkflowAgentIds(workflowId);
  const allReqs = new Set<string>();

  for (const id of agentIds) {
    const cap = agentCapabilities.get(id);
    if (cap) {
      for (const req of cap.requiredData) {
        allReqs.add(req);
      }
    }
  }

  return Array.from(allReqs);
}
