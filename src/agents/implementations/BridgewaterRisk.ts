// =============================================================================
// Stock Advisors - Bridgewater Risk Assessment Agent
// =============================================================================
// Conducts multi-dimensional risk analysis including correlation analysis,
// sector concentration risk, stress testing, tail risk scenarios, hedging
// strategies, position sizing, and rebalancing recommendations using
// Bridgewater's principles-driven approach.
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
import bridgewaterSystemPrompt from '../prompts/system-prompts/bridgewater-risk.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const BRIDGEWATER_RISK_CAPABILITY: AgentCapability = {
  id: AgentId.BRIDGEWATER_RISK,
  name: 'Bridgewater Risk Assessment',
  description:
    'Conducts multi-dimensional risk analysis including correlation analysis, ' +
    'sector concentration risk, geographic/currency exposure, interest rate sensitivity, ' +
    'recession stress tests, tail risk scenarios, hedging strategies, position sizing, ' +
    'and rebalancing recommendations.',
  personality: AGENT_PERSONALITIES[AgentId.BRIDGEWATER_RISK],
  requiredData: [
    DataRequirement.DAILY_SERIES,
    DataRequirement.WEEKLY_SERIES,
    DataRequirement.SECTOR_PERFORMANCE,
    DataRequirement.QUOTE,
  ],
  systemPromptPath: 'bridgewater-risk.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.3,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const RISK_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_risk_assessment',
  description:
    'Submit the complete Bridgewater risk assessment with structured data for each stock analyzed.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'overall_risk_rating',
      'assessments',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description:
          'A 3-4 sentence risk assessment summary in Bridgewater\'s radically transparent style.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the risk analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      overall_risk_rating: {
        type: 'number',
        description: 'Overall portfolio risk rating from 1 (lowest) to 10 (highest).',
        minimum: 1,
        maximum: 10,
      },
      assessments: {
        type: 'array',
        description: 'Risk assessments for each stock analyzed.',
        items: {
          type: 'object',
          required: ['symbol', 'risk_scores', 'action', 'confidence'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action based on risk assessment',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in this specific assessment (0-100)',
            },
            risk_scores: {
              type: 'object',
              description: 'Individual risk dimension scores (1-10)',
              properties: {
                market_risk: { type: 'number', minimum: 1, maximum: 10 },
                correlation_risk: { type: 'number', minimum: 1, maximum: 10 },
                concentration_risk: { type: 'number', minimum: 1, maximum: 10 },
                currency_risk: { type: 'number', minimum: 1, maximum: 10 },
                interest_rate_risk: { type: 'number', minimum: 1, maximum: 10 },
                recession_risk: { type: 'number', minimum: 1, maximum: 10 },
                liquidity_risk: { type: 'number', minimum: 1, maximum: 10 },
                tail_risk: { type: 'number', minimum: 1, maximum: 10 },
                overall: { type: 'number', minimum: 1, maximum: 10 },
              },
            },
            correlation_matrix: {
              type: 'object',
              description: 'Correlations with major benchmarks and asset classes',
              properties: {
                sp500: { type: 'number', description: 'Correlation with S&P 500' },
                nasdaq: { type: 'number', description: 'Correlation with Nasdaq' },
                treasuries: { type: 'number', description: 'Correlation with 10Y Treasuries' },
                gold: { type: 'number', description: 'Correlation with Gold' },
                usd: { type: 'number', description: 'Correlation with USD Index' },
                oil: { type: 'number', description: 'Correlation with Crude Oil' },
              },
            },
            concentration_risks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Type of concentration (sector, geographic, factor, etc.)' },
                  description: { type: 'string', description: 'Description of the concentration risk' },
                  severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
                },
              },
              description: 'Identified concentration risks',
            },
            stress_test_results: {
              type: 'object',
              description: 'Results of stress testing under various scenarios',
              properties: {
                moderate_recession: {
                  type: 'object',
                  properties: {
                    price_impact_pct: { type: 'number', description: 'Estimated price impact as decimal' },
                    earnings_decline_pct: { type: 'number', description: 'Estimated earnings decline as decimal' },
                    survival_assessment: { type: 'string', description: 'Can the company survive this scenario' },
                  },
                },
                severe_recession: {
                  type: 'object',
                  properties: {
                    price_impact_pct: { type: 'number', description: 'Estimated price impact as decimal' },
                    earnings_decline_pct: { type: 'number', description: 'Estimated earnings decline as decimal' },
                    survival_assessment: { type: 'string', description: 'Can the company survive this scenario' },
                  },
                },
                rate_shock_up_100bps: {
                  type: 'object',
                  properties: {
                    price_impact_pct: { type: 'number' },
                    mechanism: { type: 'string', description: 'How rate increase impacts the company' },
                  },
                },
                rate_shock_down_100bps: {
                  type: 'object',
                  properties: {
                    price_impact_pct: { type: 'number' },
                    mechanism: { type: 'string', description: 'How rate decrease impacts the company' },
                  },
                },
                usd_10pct_strengthening: {
                  type: 'object',
                  properties: {
                    earnings_impact_pct: { type: 'number' },
                    revenue_exposure_pct: { type: 'number', description: 'International revenue as % of total' },
                  },
                },
              },
            },
            tail_risks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  scenario: { type: 'string', description: 'Description of the tail risk scenario' },
                  trigger: { type: 'string', description: 'What would trigger this scenario' },
                  probability: { type: 'number', description: 'Estimated probability (0-1)' },
                  price_impact_pct: { type: 'number', description: 'Estimated price impact as decimal' },
                  historical_analogue: { type: 'string', description: 'Historical parallel' },
                },
              },
              description: 'Tail risk scenarios with probabilities and impacts',
            },
            hedging_recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  strategy: { type: 'string', description: 'Name/type of hedging strategy' },
                  description: { type: 'string', description: 'Detailed description of the hedge' },
                  estimated_cost: { type: 'string', description: 'Approximate cost of the hedge' },
                  risk_reduction: { type: 'string', description: 'How much risk is reduced' },
                  hedge_ratio: { type: 'number', description: 'Recommended hedge ratio' },
                },
              },
              description: 'Recommended hedging strategies',
            },
            position_sizing: {
              type: 'object',
              description: 'Recommended position sizes for different risk tolerances',
              properties: {
                conservative: { type: 'number', description: 'Conservative position size as % of portfolio' },
                moderate: { type: 'number', description: 'Moderate position size as % of portfolio' },
                aggressive: { type: 'number', description: 'Aggressive position size as % of portfolio' },
                rationale: { type: 'string', description: 'Rationale for sizing recommendation' },
              },
            },
            rebalancing_suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  trigger: { type: 'string', description: 'What triggers the rebalancing action' },
                  action: { type: 'string', description: 'What to do when triggered' },
                  frequency: { type: 'string', description: 'How often to check' },
                },
              },
              description: 'Rebalancing triggers and suggestions',
            },
            time_horizon: { type: 'string', description: 'Recommended time horizon' },
            rationale: { type: 'string', description: 'Detailed risk rationale' },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Risk warnings, data limitations, or important caveats.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Bridgewater Risk Agent
// -----------------------------------------------------------------------------

export class BridgewaterRisk extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(BRIDGEWATER_RISK_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): BridgewaterRisk {
    return new BridgewaterRisk(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return bridgewaterSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [RISK_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Risk Assessment Request`);
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
      if (input.preferences.maxPositionSize) {
        sections.push(`- Max Position Size: ${input.preferences.maxPositionSize}%`);
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

      sections.push(`## ${symbol} - Market Data`);
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

      // Daily series
      const dailySeries = this.getDataForSymbol(stockData, symbol, DataRequirement.DAILY_SERIES);
      if (dailySeries) {
        sections.push('### Daily Price Series');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(dailySeries, 5000));
        sections.push('```');
        sections.push('');
      }

      // Weekly series
      const weeklySeries = this.getDataForSymbol(stockData, symbol, DataRequirement.WEEKLY_SERIES);
      if (weeklySeries) {
        sections.push('### Weekly Price Series');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(weeklySeries, 4000));
        sections.push('```');
        sections.push('');
      }
    }

    // Sector performance (shared)
    const firstSymbol = input.symbols[0];
    if (firstSymbol) {
      const sectorPerf = this.getDataForSymbol(stockData, firstSymbol, DataRequirement.SECTOR_PERFORMANCE);
      if (sectorPerf) {
        sections.push('## Sector Performance Data');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(sectorPerf, 3000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the market data above, conduct a comprehensive risk assessment for each symbol. ' +
      'Analyze correlations, concentration risks, stress test scenarios, tail risks, ' +
      'hedging strategies, position sizing, and rebalancing triggers. ' +
      'Submit your findings using the submit_risk_assessment tool.'
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
    const assessments = (parsed.assessments as RiskAssessment[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    const recommendations: Recommendation[] = assessments.map((assessment) => ({
      symbol: assessment.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(assessment.action),
      confidence: assessment.confidence ?? 50,
      timeHorizon: assessment.time_horizon ?? '3-6 months',
      rationale: assessment.rationale ?? 'Risk assessment complete.',
    }));

    return {
      agentId: AgentId.BRIDGEWATER_RISK,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'Risk assessment complete.',
      structured: {
        overall_risk_rating: parsed.overall_risk_rating,
        assessments,
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

interface RiskAssessment {
  symbol: string;
  action: string;
  confidence: number;
  risk_scores?: {
    market_risk?: number;
    correlation_risk?: number;
    concentration_risk?: number;
    currency_risk?: number;
    interest_rate_risk?: number;
    recession_risk?: number;
    liquidity_risk?: number;
    tail_risk?: number;
    overall?: number;
  };
  correlation_matrix?: Record<string, number>;
  concentration_risks?: Array<{ type?: string; description?: string; severity?: string }>;
  stress_test_results?: Record<string, unknown>;
  tail_risks?: Array<{
    scenario?: string;
    trigger?: string;
    probability?: number;
    price_impact_pct?: number;
    historical_analogue?: string;
  }>;
  hedging_recommendations?: Array<{
    strategy?: string;
    description?: string;
    estimated_cost?: string;
    risk_reduction?: string;
    hedge_ratio?: number;
  }>;
  position_sizing?: {
    conservative?: number;
    moderate?: number;
    aggressive?: number;
    rationale?: string;
  };
  rebalancing_suggestions?: Array<{
    trigger?: string;
    action?: string;
    frequency?: string;
  }>;
  time_horizon?: string;
  rationale?: string;
}
