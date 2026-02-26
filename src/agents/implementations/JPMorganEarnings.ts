// =============================================================================
// Stock Advisors - JPMorgan Earnings Analyzer Agent
// =============================================================================
// Analyzes earnings history, consensus estimates, key metrics, segment
// breakdowns, management guidance, options-implied moves, and post-earnings
// reactions to deliver actionable earnings strategy recommendations.
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
import jpmorganSystemPrompt from '../prompts/system-prompts/jpmorgan-earnings.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const JPMORGAN_EARNINGS_CAPABILITY: AgentCapability = {
  id: AgentId.JPMORGAN_EARNINGS,
  name: 'JPMorgan Earnings Analyzer',
  description:
    'Analyzes earnings history, consensus estimates, key metrics Wall Street watches, ' +
    'segment breakdowns, management guidance, options-implied moves, historical ' +
    'post-earnings reactions, and delivers buy/sell/wait earnings strategy.',
  personality: AGENT_PERSONALITIES[AgentId.JPMORGAN_EARNINGS],
  requiredData: [
    DataRequirement.EARNINGS,
    DataRequirement.INCOME_STATEMENT,
    DataRequirement.QUOTE,
    DataRequirement.DAILY_SERIES,
  ],
  systemPromptPath: 'jpmorgan-earnings.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.3,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const EARNINGS_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_earnings_analysis',
  description:
    'Submit the complete JPMorgan earnings analysis with structured data for each stock analyzed.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'analyses',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description:
          'A 3-4 sentence earnings strategy summary with the headline recommended play.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the earnings analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      analyses: {
        type: 'array',
        description: 'Earnings analyses for each stock.',
        items: {
          type: 'object',
          required: ['symbol', 'earnings_history', 'recommended_play', 'action', 'confidence'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action based on earnings analysis',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in this specific analysis (0-100)',
            },
            earnings_history: {
              type: 'array',
              description: 'Last 4+ quarters of earnings results',
              items: {
                type: 'object',
                properties: {
                  quarter: { type: 'string', description: 'Quarter label (e.g., "Q3 2024")' },
                  reported_eps: { type: 'number', description: 'Actual reported EPS' },
                  estimated_eps: { type: 'number', description: 'Consensus EPS estimate' },
                  surprise_pct: { type: 'number', description: 'Surprise as decimal (positive = beat)' },
                  revenue_reported: { type: 'number', description: 'Reported revenue in millions' },
                  revenue_estimated: { type: 'number', description: 'Consensus revenue estimate in millions' },
                  stock_reaction_pct: { type: 'number', description: 'Stock price reaction on earnings day as decimal' },
                  beat_or_miss: { type: 'string', enum: ['beat', 'miss', 'inline'] },
                },
              },
            },
            consensus_estimates: {
              type: 'object',
              description: 'Current consensus estimates for upcoming quarter and full year',
              properties: {
                current_quarter: {
                  type: 'object',
                  properties: {
                    eps_estimate: { type: 'number' },
                    eps_high: { type: 'number' },
                    eps_low: { type: 'number' },
                    revenue_estimate: { type: 'number', description: 'In millions' },
                  },
                },
                full_year: {
                  type: 'object',
                  properties: {
                    eps_estimate: { type: 'number' },
                    revenue_estimate: { type: 'number', description: 'In millions' },
                  },
                },
                revision_trend: {
                  type: 'string',
                  enum: ['upward', 'stable', 'downward'],
                  description: 'Direction of estimate revisions over last 90 days',
                },
                revisions_up: { type: 'number', description: 'Number of upward revisions' },
                revisions_down: { type: 'number', description: 'Number of downward revisions' },
              },
            },
            key_metrics: {
              type: 'array',
              description: 'Key metrics Wall Street watches for this company',
              items: {
                type: 'object',
                properties: {
                  metric_name: { type: 'string', description: 'Name of the metric' },
                  expected_value: { type: 'string', description: 'What the street expects' },
                  importance: { type: 'string', enum: ['Critical', 'High', 'Medium'] },
                  why_it_matters: { type: 'string', description: 'Why this metric is important' },
                },
              },
            },
            segment_breakdown: {
              type: 'array',
              description: 'Revenue and margin by business segment',
              items: {
                type: 'object',
                properties: {
                  segment_name: { type: 'string' },
                  revenue_pct: { type: 'number', description: 'Revenue contribution as decimal' },
                  growth_trend: { type: 'string', enum: ['accelerating', 'stable', 'decelerating'] },
                  margin_trend: { type: 'string', enum: ['expanding', 'stable', 'contracting'] },
                  swing_factor: { type: 'boolean', description: 'Is this the key swing segment?' },
                },
              },
            },
            guidance_summary: {
              type: 'object',
              description: 'Management guidance analysis',
              properties: {
                last_guidance_eps_range: { type: 'string', description: 'EPS guidance range' },
                last_guidance_revenue_range: { type: 'string', description: 'Revenue guidance range' },
                guidance_style: {
                  type: 'string',
                  enum: ['conservative_beater', 'accurate', 'aggressive'],
                  description: 'Management guidance style historically',
                },
                key_initiatives: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Strategic initiatives flagged by management',
                },
                reading_between_lines: { type: 'string', description: 'Analyst interpretation of guidance tone' },
              },
            },
            options_implied_move: {
              type: 'object',
              description: 'Options market earnings expectations',
              properties: {
                implied_move_pct: { type: 'number', description: 'Options-implied earnings move as decimal' },
                historical_avg_move_pct: { type: 'number', description: 'Historical average earnings move as decimal' },
                is_overpriced: { type: 'boolean', description: 'Are options pricing more volatility than typical?' },
                opportunity: { type: 'string', description: 'Description of vol opportunity if any' },
              },
            },
            historical_reactions: {
              type: 'array',
              description: 'Historical post-earnings price reactions',
              items: {
                type: 'object',
                properties: {
                  quarter: { type: 'string' },
                  day_of_move_pct: { type: 'number', description: 'Earnings day move as decimal' },
                  week_after_move_pct: { type: 'number', description: 'One week after as decimal' },
                  faded: { type: 'boolean', description: 'Did the initial move reverse?' },
                },
              },
            },
            bull_case: {
              type: 'object',
              description: 'Bull case earnings scenario',
              properties: {
                description: { type: 'string', description: 'What has to go right' },
                key_metrics_needed: { type: 'array', items: { type: 'string' } },
                upside_target: { type: 'number', description: 'Bull case price target' },
                probability: { type: 'number', description: 'Probability (0-1)' },
              },
            },
            bear_case: {
              type: 'object',
              description: 'Bear case earnings scenario',
              properties: {
                description: { type: 'string', description: 'What could go wrong' },
                risk_factors: { type: 'array', items: { type: 'string' } },
                downside_target: { type: 'number', description: 'Bear case price target' },
                probability: { type: 'number', description: 'Probability (0-1)' },
              },
            },
            recommended_play: {
              type: 'string',
              enum: ['Buy Before Earnings', 'Sell Before Earnings', 'Wait for Post-Earnings Reaction'],
              description: 'The recommended earnings trade',
            },
            trade_details: {
              type: 'object',
              description: 'Specific trade details for the recommended play',
              properties: {
                entry_price: { type: 'number' },
                stop_loss: { type: 'number' },
                target_price: { type: 'number' },
                position_size_suggestion: { type: 'string' },
                options_alternative: { type: 'string', description: 'Options strategy alternative' },
              },
            },
            time_horizon: { type: 'string', description: 'Recommended time horizon for the trade' },
            rationale: { type: 'string', description: 'Detailed rationale for the recommendation' },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Risk warnings, data quality caveats, or important disclaimers.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// JPMorgan Earnings Agent
// -----------------------------------------------------------------------------

export class JPMorganEarnings extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(JPMORGAN_EARNINGS_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): JPMorganEarnings {
    return new JPMorganEarnings(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return jpmorganSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [EARNINGS_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Earnings Analysis Request`);
    sections.push(`**Symbols**: ${input.symbols.join(', ')}`);

    if (input.query) {
      sections.push(`**User Query**: ${input.query}`);
    }

    if (input.preferences) {
      sections.push(`**Preferences**:`);
      if (input.preferences.riskTolerance) {
        sections.push(`- Risk Tolerance: ${input.preferences.riskTolerance}`);
      }
      if (input.preferences.timeHorizon) {
        sections.push(`- Time Horizon: ${input.preferences.timeHorizon}`);
      }
    }

    sections.push('');
    sections.push('---');
    sections.push('');

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

      sections.push(`## ${symbol} - Earnings Data`);
      sections.push('');

      // Quote data
      const quoteData = this.getDataForSymbol(stockData, symbol, DataRequirement.QUOTE);
      if (quoteData) {
        sections.push('### Real-Time Quote');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(quoteData, 3000));
        sections.push('```');
        sections.push('');
      }

      // Earnings data
      const earnings = this.getDataForSymbol(stockData, symbol, DataRequirement.EARNINGS);
      if (earnings) {
        sections.push('### Earnings History & Estimates');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(earnings, 6000));
        sections.push('```');
        sections.push('');
      }

      // Income Statement
      const incomeStatement = this.getDataForSymbol(stockData, symbol, DataRequirement.INCOME_STATEMENT);
      if (incomeStatement) {
        sections.push('### Income Statement (Quarterly & Annual)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(incomeStatement, 6000));
        sections.push('```');
        sections.push('');
      }

      // Daily series for price reaction analysis
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
      'Using the data above, deliver a comprehensive earnings analysis for each symbol. ' +
      'Cover the beat/miss history, consensus estimates, key metrics, segment breakdown, ' +
      'guidance summary, options-implied move, historical reactions, bull/bear cases, ' +
      'and your recommended play. ' +
      'Submit your findings using the submit_earnings_analysis tool.'
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
    const analyses = (parsed.analyses as EarningsAnalysis[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    const recommendations: Recommendation[] = analyses.map((analysis) => ({
      symbol: analysis.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(analysis.action),
      confidence: analysis.confidence ?? 50,
      targetPrice: analysis.trade_details?.target_price,
      stopLoss: analysis.trade_details?.stop_loss,
      timeHorizon: analysis.time_horizon ?? '1-4 weeks',
      rationale: analysis.rationale ?? `Recommended play: ${analysis.recommended_play ?? 'N/A'}`,
    }));

    return {
      agentId: AgentId.JPMORGAN_EARNINGS,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'Earnings analysis complete.',
      structured: {
        analyses,
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

interface EarningsAnalysis {
  symbol: string;
  action: string;
  confidence: number;
  earnings_history?: Array<{
    quarter?: string;
    reported_eps?: number;
    estimated_eps?: number;
    surprise_pct?: number;
    revenue_reported?: number;
    revenue_estimated?: number;
    stock_reaction_pct?: number;
    beat_or_miss?: string;
  }>;
  consensus_estimates?: Record<string, unknown>;
  key_metrics?: Array<{
    metric_name?: string;
    expected_value?: string;
    importance?: string;
    why_it_matters?: string;
  }>;
  segment_breakdown?: Array<{
    segment_name?: string;
    revenue_pct?: number;
    growth_trend?: string;
    margin_trend?: string;
    swing_factor?: boolean;
  }>;
  guidance_summary?: Record<string, unknown>;
  options_implied_move?: Record<string, unknown>;
  historical_reactions?: Array<{
    quarter?: string;
    day_of_move_pct?: number;
    week_after_move_pct?: number;
    faded?: boolean;
  }>;
  bull_case?: Record<string, unknown>;
  bear_case?: Record<string, unknown>;
  recommended_play?: string;
  trade_details?: {
    entry_price?: number;
    stop_loss?: number;
    target_price?: number;
    position_size_suggestion?: string;
    options_alternative?: string;
  };
  time_horizon?: string;
  rationale?: string;
}
