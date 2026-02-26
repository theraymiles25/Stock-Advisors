// =============================================================================
// Stock Advisors - Susquehanna Options Strategy Agent
// =============================================================================
// Analyzes implied volatility surfaces, options flow, put/call skew, and term
// structure to construct probability-weighted options strategies with defined
// risk/reward profiles. Monitors unusual activity as leading indicators of
// informed positioning.
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
import susquehannaSystemPrompt from '../prompts/system-prompts/susquehanna-options.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const SUSQUEHANNA_OPTIONS_CAPABILITY: AgentCapability = {
  id: AgentId.SUSQUEHANNA_OPTIONS,
  name: 'Susquehanna Options Strategy',
  description:
    'Analyzes implied volatility surfaces, options flow, put/call skew, and term ' +
    'structure to construct probability-weighted options strategies with defined ' +
    'risk/reward profiles. Monitors unusual activity as leading indicators of ' +
    'informed positioning.',
  personality: AGENT_PERSONALITIES[AgentId.SUSQUEHANNA_OPTIONS],
  requiredData: [
    DataRequirement.DAILY_SERIES,
    DataRequirement.TECHNICAL_RSI,
    DataRequirement.TECHNICAL_BBANDS,
    DataRequirement.QUOTE,
    DataRequirement.FUNDAMENTALS,
  ],
  systemPromptPath: 'susquehanna-options.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const OPTIONS_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_options_analysis',
  description:
    'Submit the complete Susquehanna options analysis with volatility assessment, flow analysis, and strategy recommendations.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'volatility_analysis',
      'options_flow',
      'strategy_recommendations',
      'position_sizing',
      'risk_assessment',
      'recommendations',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description:
          'A 3-4 sentence institutional-grade executive summary with the headline options strategy verdict.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the options analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      volatility_analysis: {
        type: 'object',
        description: 'Comprehensive volatility assessment across multiple dimensions.',
        properties: {
          historical_vol: {
            type: 'object',
            description: 'Historical volatility measured across multiple windows.',
            properties: {
              vol_10d: { type: 'number', description: '10-day historical volatility' },
              vol_20d: { type: 'number', description: '20-day historical volatility' },
              vol_60d: { type: 'number', description: '60-day historical volatility' },
              vol_252d: { type: 'number', description: '252-day (annual) historical volatility' },
            },
          },
          iv_estimate: {
            type: 'number',
            description: 'Estimated implied volatility based on available data.',
          },
          iv_rank: {
            type: 'number',
            description: 'IV rank (0-100) - where current IV sits relative to 52-week range.',
            minimum: 0,
            maximum: 100,
          },
          iv_percentile: {
            type: 'number',
            description: 'IV percentile (0-100) - percentage of days IV was below current level.',
            minimum: 0,
            maximum: 100,
          },
          vol_term_structure: {
            type: 'string',
            description: 'Assessment of volatility term structure (contango, backwardation, flat).',
          },
          skew_assessment: {
            type: 'string',
            description: 'Assessment of put/call skew and what it implies.',
          },
          regime: {
            type: 'string',
            enum: ['low_vol', 'normal', 'elevated', 'high_vol', 'crisis'],
            description: 'Current volatility regime classification.',
          },
        },
      },
      options_flow: {
        type: 'object',
        description: 'Options flow analysis and unusual activity detection.',
        properties: {
          put_call_ratio: {
            type: 'number',
            description: 'Estimated put/call ratio based on available indicators.',
          },
          unusual_activity: {
            type: 'array',
            description: 'Notable unusual options activity detected.',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string', description: 'Description of the unusual activity.' },
                signal: { type: 'string', description: 'What this activity signals (bullish/bearish/neutral).' },
                confidence: { type: 'number', description: 'Confidence in signal interpretation (0-100).' },
              },
            },
          },
        },
      },
      strategy_recommendations: {
        type: 'array',
        description: 'Recommended options strategies for each analyzed symbol.',
        items: {
          type: 'object',
          required: ['strategy_name', 'type', 'legs', 'rationale'],
          properties: {
            strategy_name: {
              type: 'string',
              description: 'Name of the options strategy (e.g., Iron Condor, Bull Call Spread).',
            },
            type: {
              type: 'string',
              enum: ['directional_bullish', 'directional_bearish', 'neutral', 'volatility_long', 'volatility_short', 'income'],
              description: 'Strategy type classification.',
            },
            legs: {
              type: 'array',
              description: 'Individual option legs of the strategy.',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['BUY', 'SELL'], description: 'Buy or sell.' },
                  option_type: { type: 'string', enum: ['CALL', 'PUT'], description: 'Call or put.' },
                  strike: { type: 'number', description: 'Strike price.' },
                  expiration: { type: 'string', description: 'Target expiration date or DTE.' },
                  quantity: { type: 'number', description: 'Number of contracts.' },
                },
              },
            },
            max_profit: { type: 'string', description: 'Maximum profit potential (dollar amount or "unlimited").' },
            max_loss: { type: 'string', description: 'Maximum loss potential (dollar amount or "unlimited").' },
            breakeven_prices: {
              type: 'array',
              items: { type: 'number' },
              description: 'Breakeven price(s) at expiration.',
            },
            probability_of_profit: {
              type: 'number',
              description: 'Estimated probability of profit (0-100).',
            },
            greeks: {
              type: 'object',
              description: 'Net position Greeks.',
              properties: {
                delta: { type: 'number', description: 'Net delta exposure.' },
                gamma: { type: 'number', description: 'Net gamma exposure.' },
                theta: { type: 'number', description: 'Net theta (daily time decay).' },
                vega: { type: 'number', description: 'Net vega (IV sensitivity).' },
              },
            },
            rationale: { type: 'string', description: 'Why this strategy fits the current market conditions.' },
            adjustment_plan: { type: 'string', description: 'How to adjust the position if the trade moves against you.' },
          },
        },
      },
      position_sizing: {
        type: 'string',
        description: 'Position sizing guidance based on portfolio risk tolerance.',
      },
      risk_assessment: {
        type: 'string',
        description: 'Overall risk assessment for the recommended strategies.',
      },
      recommendations: {
        type: 'array',
        description: 'Summary recommendations in standard format.',
        items: {
          type: 'object',
          required: ['symbol', 'action', 'confidence', 'time_horizon', 'rationale'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol.' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action based on options analysis.',
            },
            confidence: { type: 'number', description: 'Confidence in this recommendation (0-100).' },
            target_price: { type: 'number', description: 'Target price if applicable.' },
            stop_loss: { type: 'number', description: 'Suggested stop-loss price.' },
            time_horizon: { type: 'string', description: 'Recommended time horizon.' },
            rationale: { type: 'string', description: 'Detailed rationale for the recommendation.' },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Risk warnings, data limitations, or important disclaimers.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Susquehanna Options Agent
// -----------------------------------------------------------------------------

export class SusquehannaOptions extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(SUSQUEHANNA_OPTIONS_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): SusquehannaOptions {
    return new SusquehannaOptions(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return susquehannaSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [OPTIONS_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Options Strategy Analysis Request`);
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

      // Fundamentals
      const fundamentals = this.getDataForSymbol(stockData, symbol, DataRequirement.FUNDAMENTALS);
      if (fundamentals) {
        sections.push('### Company Fundamentals');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(fundamentals, 4000));
        sections.push('```');
        sections.push('');
      }

      // Daily Series
      const dailySeries = this.getDataForSymbol(stockData, symbol, DataRequirement.DAILY_SERIES);
      if (dailySeries) {
        sections.push('### Daily Price Series (for Historical Volatility Calculation)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(dailySeries, 6000));
        sections.push('```');
        sections.push('');
      }

      // RSI
      const rsiData = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_RSI);
      if (rsiData) {
        sections.push('### RSI Indicator');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(rsiData, 3000));
        sections.push('```');
        sections.push('');
      }

      // Bollinger Bands
      const bbandsData = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_BBANDS);
      if (bbandsData) {
        sections.push('### Bollinger Bands');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(bbandsData, 3000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the market data above, perform a comprehensive options analysis for each symbol. ' +
      'Calculate historical volatility across multiple windows, estimate implied volatility levels, ' +
      'assess the volatility regime, analyze options flow signals, and recommend specific options ' +
      'strategies with defined risk/reward profiles. Include position Greeks, breakeven levels, ' +
      'probability of profit estimates, and adjustment plans. ' +
      'Submit your findings using the submit_options_analysis tool.'
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
    const recs = (parsed.recommendations as OptionsRecommendation[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    const recommendations: Recommendation[] = recs.map((rec) => ({
      symbol: rec.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(rec.action),
      confidence: rec.confidence ?? 50,
      targetPrice: rec.target_price,
      stopLoss: rec.stop_loss,
      timeHorizon: rec.time_horizon ?? '30-60 days',
      rationale: rec.rationale ?? 'Options strategy analysis complete.',
    }));

    return {
      agentId: AgentId.SUSQUEHANNA_OPTIONS,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'Options strategy analysis complete.',
      structured: {
        volatilityAnalysis: parsed.volatility_analysis,
        optionsFlow: parsed.options_flow,
        strategyRecommendations: parsed.strategy_recommendations,
        positionSizing: parsed.position_sizing,
        riskAssessment: parsed.risk_assessment,
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

interface OptionsRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}
