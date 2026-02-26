// =============================================================================
// Stock Advisors - Performance Analyst Agent
// =============================================================================
// Performance attribution agent that evaluates the Stock Advisors agent team's
// track record. Decomposes returns into skill vs luck, detects behavioral biases,
// identifies degrading accuracy, and recommends optimal agent weighting for the
// Master Orchestrator. Uses both market data and agent performance history passed
// via the context field.
// =============================================================================

import { BaseAgent, IClaudeClient, ClaudeTool } from '../base/BaseAgent';
import { AgentEventBus } from '../base/AgentEventBus';
import {
  AgentCapability,
  AgentId,
  AgentInput,
  AgentOutput,
  AgentStatus,
  DataRequirement,
  Recommendation,
  RecommendationAction,
  StockDataMap,
  TokenUsage,
} from '../base/types';
import { AGENT_PERSONALITIES } from '../prompts/personalities';
import { MODEL_DEFAULT } from '../../lib/constants';
import performanceSystemPrompt from '../prompts/system-prompts/performance-analyst.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const PERFORMANCE_ANALYST_CAPABILITY: AgentCapability = {
  id: AgentId.PERFORMANCE_ANALYST,
  name: 'Performance Analyst',
  description:
    'Evaluates agent team performance with institutional-grade attribution analysis. ' +
    'Decomposes returns into skill vs luck, tracks behavioral biases, measures statistical ' +
    'significance of agent edges, and recommends optimal agent weighting.',
  personality: AGENT_PERSONALITIES[AgentId.PERFORMANCE_ANALYST],
  requiredData: [
    DataRequirement.DAILY_SERIES,
    DataRequirement.QUOTE,
  ],
  systemPromptPath: 'performance-analyst.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const PERFORMANCE_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_performance_review',
  description:
    'Submit the complete AQR performance attribution and agent evaluation report.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'review_type',
      'agent_rankings',
      'portfolio_performance',
      'behavioral_patterns',
      'accuracy_degradation',
      'weight_recommendations',
      'key_findings',
      'action_items',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description: 'A 3-4 sentence summary of agent team performance and key findings.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the performance evaluation (0-100).',
        minimum: 0,
        maximum: 100,
      },
      review_type: {
        type: 'string',
        description: 'Type of review performed (e.g., "initial_baseline", "periodic_review", "post_trade_audit").',
      },
      agent_rankings: {
        type: 'array',
        description: 'Performance ranking for each agent with track record data.',
        items: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Agent identifier.',
            },
            win_rate: {
              type: 'number',
              description: 'Percentage of profitable recommendations (0-100).',
            },
            avg_return: {
              type: 'number',
              description: 'Average return per recommendation (decimal, e.g., 0.05 for 5%).',
            },
            sharpe_ratio: {
              type: 'number',
              description: 'Risk-adjusted return measure.',
            },
            max_drawdown: {
              type: 'number',
              description: 'Worst peak-to-trough decline (decimal).',
            },
            total_trades: {
              type: 'number',
              description: 'Total number of recommendations evaluated.',
            },
            trend: {
              type: 'string',
              enum: ['improving', 'stable', 'degrading'],
              description: 'Performance trend direction.',
            },
            significance: {
              type: 'string',
              description: 'Statistical significance assessment of the track record.',
            },
          },
        },
      },
      portfolio_performance: {
        type: 'object',
        description: 'Aggregate portfolio-level performance metrics.',
        properties: {
          total_return: {
            type: 'number',
            description: 'Total portfolio return (decimal).',
          },
          sharpe: {
            type: 'number',
            description: 'Portfolio Sharpe ratio.',
          },
          max_drawdown: {
            type: 'number',
            description: 'Portfolio maximum drawdown (decimal).',
          },
          win_rate: {
            type: 'number',
            description: 'Portfolio win rate (0-100).',
          },
          benchmark_comparison: {
            type: 'string',
            description: 'Performance relative to S&P 500 or appropriate benchmark.',
          },
          factor_attribution: {
            type: 'string',
            description: 'Factor-based return attribution (value, momentum, quality, etc.).',
          },
        },
      },
      behavioral_patterns: {
        type: 'array',
        description: 'Detected behavioral biases across agents.',
        items: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Agent with the detected bias.',
            },
            bias_type: {
              type: 'string',
              description: 'Name of the behavioral bias (anchoring, recency, confirmation, loss_aversion, etc.).',
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Severity of the bias.',
            },
            evidence: {
              type: 'string',
              description: 'Specific evidence supporting the bias detection.',
            },
          },
        },
      },
      accuracy_degradation: {
        type: 'array',
        description: 'Alerts for agents showing declining accuracy over time.',
        items: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Agent showing degradation.',
            },
            recent_accuracy: {
              type: 'number',
              description: 'Recent accuracy metric (e.g., last 30 days win rate).',
            },
            historical_accuracy: {
              type: 'number',
              description: 'Longer-term accuracy metric for comparison.',
            },
            direction: {
              type: 'string',
              enum: ['declining', 'volatile', 'regime_dependent'],
              description: 'Nature of the degradation.',
            },
            significance: {
              type: 'string',
              description: 'Whether the degradation is statistically significant.',
            },
          },
        },
      },
      weight_recommendations: {
        type: 'array',
        description: 'Recommended agent weights for the Master Orchestrator.',
        items: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Agent identifier.',
            },
            recommended_weight: {
              type: 'number',
              description: 'Recommended weight (0.0 to 1.0).',
              minimum: 0,
              maximum: 1,
            },
            rationale: {
              type: 'string',
              description: 'Rationale for the weight assignment.',
            },
          },
        },
      },
      key_findings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Top 3-5 most important findings from the performance analysis.',
      },
      action_items: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific, actionable recommendations for improving the agent team.',
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Data quality warnings and statistical caveats.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Performance Analyst Agent
// -----------------------------------------------------------------------------

export class PerformanceAnalyst extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(PERFORMANCE_ANALYST_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): PerformanceAnalyst {
    return new PerformanceAnalyst(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return performanceSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [PERFORMANCE_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Agent Performance Evaluation Request`);
    sections.push(`**Symbols Under Analysis**: ${input.symbols.join(', ')}`);

    if (input.query) {
      sections.push(`**User Query**: ${input.query}`);
    }

    sections.push('');
    sections.push('---');
    sections.push('');

    // Agent performance context (trade history, track records, etc.)
    if (input.context && Object.keys(input.context).length > 0) {
      sections.push('## Agent Performance Data & Trade History');
      sections.push('');
      sections.push(
        'The following context contains historical agent performance data, ' +
        'trade history, and track records for evaluation:'
      );
      sections.push('```json');
      sections.push(this.formatDataForPrompt(input.context, 8000));
      sections.push('```');
      sections.push('');
    } else {
      sections.push('## Agent Performance Data');
      sections.push('');
      sections.push(
        '**NOTE**: No historical agent performance data was provided in the context. ' +
        'This is likely the first evaluation cycle or data has not yet been accumulated. ' +
        'Provide a framework for evaluating agent performance once sufficient data is available, ' +
        'and use the available market data to assess current conditions and set performance baselines.'
      );
      sections.push('');
    }

    sections.push('---');
    sections.push('');

    // Market data for current stocks
    for (const symbol of input.symbols) {
      const bundle = stockData[symbol];
      if (!bundle) {
        sections.push(`## ${symbol} - DATA NOT AVAILABLE`);
        sections.push(
          `No market data was fetched for ${symbol}. Skip this symbol or note the data gap.`
        );
        sections.push('');
        continue;
      }

      sections.push(`## ${symbol} - Current Market Data`);
      sections.push('');

      // Quote
      const quoteData = this.getDataForSymbol(stockData, symbol, DataRequirement.QUOTE);
      if (quoteData) {
        sections.push('### Real-Time Quote');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(quoteData, 3000));
        sections.push('```');
        sections.push('');
      }

      // Daily series
      const dailySeries = this.getDataForSymbol(stockData, symbol, DataRequirement.DAILY_SERIES);
      if (dailySeries) {
        sections.push('### Daily Price Series (Recent)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(dailySeries, 4000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Produce a comprehensive performance evaluation of the agent team. ' +
      'Rank agents by performance metrics, identify behavioral biases, detect ' +
      'accuracy degradation, and recommend optimal agent weights for the Master Orchestrator. ' +
      'Be brutally honest - if an agent is not adding value, say so. ' +
      'Submit your findings using the submit_performance_review tool.'
    );

    return sections.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Output Mapping
  // ---------------------------------------------------------------------------

  protected buildOutput(
    parsed: Record<string, unknown>,
    usage: TokenUsage
  ): AgentOutput {
    const warnings = (parsed.warnings as string[]) ?? [];
    const keyFindings = (parsed.key_findings as string[]) ?? [];

    // Performance analyst doesn't produce standard stock recommendations.
    // Instead, its "recommendations" are meta-level insights about agent weighting.
    // We map the key findings to recommendations for consistency with the framework.
    const recommendations: Recommendation[] = keyFindings.slice(0, 3).map((finding) => ({
      symbol: 'PORTFOLIO',
      action: this.normalizeAction('HOLD'),
      confidence: (parsed.confidence as number) ?? 50,
      timeHorizon: 'Ongoing evaluation',
      rationale: finding,
    }));

    return {
      agentId: AgentId.PERFORMANCE_ANALYST,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 50,
      summary:
        (parsed.executive_summary as string) ??
        'Performance evaluation complete.',
      structured: {
        reviewType: parsed.review_type,
        agentRankings: parsed.agent_rankings ?? [],
        portfolioPerformance: parsed.portfolio_performance ?? null,
        behavioralPatterns: parsed.behavioral_patterns ?? [],
        accuracyDegradation: parsed.accuracy_degradation ?? [],
        weightRecommendations: parsed.weight_recommendations ?? [],
        keyFindings: parsed.key_findings ?? [],
        actionItems: parsed.action_items ?? [],
      },
      recommendations,
      warnings,
      dataUsed: this.capability.requiredData,
      tokenUsage: usage,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private normalizeAction(action?: string): RecommendationAction {
    if (!action) return 'HOLD';
    const upper = action.toUpperCase().replace(/[\s-]/g, '_');
    const valid: RecommendationAction[] = [
      'STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL',
    ];
    return valid.includes(upper as RecommendationAction)
      ? (upper as RecommendationAction)
      : 'HOLD';
  }
}

// -----------------------------------------------------------------------------
// Internal Types
// -----------------------------------------------------------------------------

interface PerformanceAgentRanking {
  agent_id: string;
  win_rate?: number;
  avg_return?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  total_trades?: number;
  trend?: string;
  significance?: string;
}

interface PerformanceBehavioralPattern {
  agent_id: string;
  bias_type?: string;
  severity?: string;
  evidence?: string;
}

interface PerformanceAccuracyDegradation {
  agent_id: string;
  recent_accuracy?: number;
  historical_accuracy?: number;
  direction?: string;
  significance?: string;
}

interface PerformanceWeightRecommendation {
  agent_id: string;
  recommended_weight?: number;
  rationale?: string;
}
