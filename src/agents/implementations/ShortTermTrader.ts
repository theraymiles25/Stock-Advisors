// =============================================================================
// Stock Advisors - Short-Term Trader Agent
// =============================================================================
// Tactical trading agent that synthesizes all other agents' analysis with
// real-time market data to identify immediate 1-5 day trading opportunities.
// Produces specific trade plans with exact entry, stop-loss, and profit target
// levels. Sizes positions based on conviction and volatility.
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
import shortTermSystemPrompt from '../prompts/system-prompts/short-term-trader.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const SHORT_TERM_TRADER_CAPABILITY: AgentCapability = {
  id: AgentId.SHORT_TERM_TRADER,
  name: 'Short-Term Trader',
  description:
    'Tactical trading agent that consumes all other agents\' analysis and identifies ' +
    'immediate 1-5 day trading opportunities with exact entry, stop-loss, and profit ' +
    'targets. Combines technical setups with catalyst timing.',
  personality: AGENT_PERSONALITIES[AgentId.SHORT_TERM_TRADER],
  requiredData: [
    DataRequirement.DAILY_SERIES,
    DataRequirement.INTRADAY,
    DataRequirement.TECHNICAL_RSI,
    DataRequirement.TECHNICAL_MACD,
    DataRequirement.TECHNICAL_SMA,
    DataRequirement.TECHNICAL_EMA,
    DataRequirement.QUOTE,
  ],
  systemPromptPath: 'short-term-trader.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const TRADE_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_trade_plans',
  description:
    'Submit the complete Point72 short-term trade plans with specific entry, stop, and target levels.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'market_conditions',
      'trade_plans',
      'risk_management',
      'recommendations',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description: 'A 3-4 sentence summary of the trading environment and top opportunities.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the trade plans (0-100).',
        minimum: 0,
        maximum: 100,
      },
      market_conditions: {
        type: 'object',
        description: 'Current market environment assessment.',
        properties: {
          environment: {
            type: 'string',
            description: 'Overall market environment description (e.g., "risk-on", "risk-off", "transitional").',
          },
          volatility_regime: {
            type: 'string',
            enum: ['low', 'normal', 'elevated', 'high', 'extreme'],
            description: 'Current volatility environment.',
          },
          key_events: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key upcoming events that could impact trades.',
          },
          breadth: {
            type: 'string',
            description: 'Market breadth assessment (e.g., "broad participation", "narrow leadership").',
          },
          strategy_bias: {
            type: 'string',
            enum: ['momentum', 'mean_reversion', 'breakout', 'defensive', 'no_trade'],
            description: 'Which strategy type is favored by current conditions.',
          },
        },
      },
      trade_plans: {
        type: 'array',
        description: 'Specific trade plans with complete specifications.',
        items: {
          type: 'object',
          required: [
            'symbol',
            'direction',
            'entry_price',
            'stop_loss',
            'target_1',
            'conviction',
            'risk_reward_ratio',
          ],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol.' },
            direction: {
              type: 'string',
              enum: ['LONG', 'SHORT'],
              description: 'Trade direction.',
            },
            entry_price: {
              type: 'number',
              description: 'Specific entry price (limit order).',
            },
            stop_loss: {
              type: 'number',
              description: 'Stop-loss price. Non-negotiable.',
            },
            target_1: {
              type: 'number',
              description: 'First profit target (partial exit).',
            },
            target_2: {
              type: 'number',
              description: 'Second profit target (majority exit).',
            },
            target_3: {
              type: 'number',
              description: 'Stretch target (remaining with trailing stop).',
            },
            position_size_pct: {
              type: 'number',
              description: 'Position size as percentage of portfolio (typically 2-5%).',
              minimum: 0.5,
              maximum: 10,
            },
            expected_hold_period: {
              type: 'string',
              description: 'Expected hold period (e.g., "2-4 hours", "1-3 days").',
            },
            risk_reward_ratio: {
              type: 'number',
              description: 'Risk/reward ratio (e.g., 2.5 means 2.5:1 reward to risk).',
            },
            catalyst: {
              type: 'string',
              description: 'The specific catalyst or setup triggering this trade.',
            },
            supporting_agents: {
              type: 'array',
              items: { type: 'string' },
              description: 'Which specialist agents support this trade direction.',
            },
            key_levels: {
              type: 'object',
              description: 'Key technical levels for the trade.',
              properties: {
                support: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Key support levels.',
                },
                resistance: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Key resistance levels.',
                },
              },
            },
            conviction: {
              type: 'number',
              description: 'Conviction level for this trade (1-10 scale).',
              minimum: 1,
              maximum: 10,
            },
          },
        },
      },
      risk_management: {
        type: 'object',
        description: 'Overall risk management guidelines for the trade set.',
        properties: {
          max_risk_per_trade: {
            type: 'string',
            description: 'Maximum risk per individual trade as portfolio percentage.',
          },
          max_concurrent_positions: {
            type: 'number',
            description: 'Maximum number of open positions at once.',
          },
          correlation_check: {
            type: 'string',
            description: 'Assessment of correlation across recommended trades.',
          },
          market_stop_conditions: {
            type: 'string',
            description: 'Conditions under which all positions should be flattened.',
          },
        },
      },
      recommendations: {
        type: 'array',
        description: 'High-level recommendations in standard format.',
        items: {
          type: 'object',
          required: ['symbol', 'action', 'confidence', 'time_horizon', 'rationale'],
          properties: {
            symbol: { type: 'string' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
            },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            target_price: { type: 'number' },
            stop_loss: { type: 'number' },
            time_horizon: { type: 'string' },
            rationale: { type: 'string' },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Risk warnings, market condition caveats, and data limitations.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Short-Term Trader Agent
// -----------------------------------------------------------------------------

export class ShortTermTrader extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(SHORT_TERM_TRADER_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): ShortTermTrader {
    return new ShortTermTrader(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return shortTermSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [TRADE_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Short-Term Trade Plan Generation Request`);
    sections.push(`**Symbols**: ${input.symbols.join(', ')}`);

    if (input.query) {
      sections.push(`**User Query**: ${input.query}`);
    }

    if (input.preferences) {
      sections.push(`**Preferences**:`);
      if (input.preferences.riskTolerance) {
        sections.push(`- Risk Tolerance: ${input.preferences.riskTolerance}`);
      }
      if (input.preferences.maxPositionSize) {
        sections.push(
          `- Max Position Size: ${input.preferences.maxPositionSize}%`
        );
      }
      if (input.preferences.timeHorizon) {
        sections.push(`- Time Horizon: ${input.preferences.timeHorizon}`);
      }
    }

    sections.push('');
    sections.push('---');
    sections.push('');

    // Other agents' analysis (passed via context)
    if (input.context && Object.keys(input.context).length > 0) {
      sections.push('## Other Agents\' Analysis (Synthesis Input)');
      sections.push('');
      sections.push(
        'The following context contains analysis from other specialist agents. ' +
        'Use these to validate or challenge your technical setups:'
      );
      sections.push('```json');
      sections.push(this.formatDataForPrompt(input.context, 6000));
      sections.push('```');
      sections.push('');
    } else {
      sections.push('## Other Agents\' Analysis');
      sections.push('');
      sections.push(
        '**NOTE**: No other agent outputs were provided. Generate trade plans ' +
        'based solely on the technical and price data below.'
      );
      sections.push('');
    }

    sections.push('---');
    sections.push('');

    // Market data for each symbol
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

      // Quote
      const quoteData = this.getDataForSymbol(stockData, symbol, DataRequirement.QUOTE);
      if (quoteData) {
        sections.push('### Real-Time Quote');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(quoteData, 3000));
        sections.push('```');
        sections.push('');
      }

      // Intraday
      const intradayData = this.getDataForSymbol(stockData, symbol, DataRequirement.INTRADAY);
      if (intradayData) {
        sections.push('### Intraday Data');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(intradayData, 4000));
        sections.push('```');
        sections.push('');
      }

      // Daily series
      const dailySeries = this.getDataForSymbol(stockData, symbol, DataRequirement.DAILY_SERIES);
      if (dailySeries) {
        sections.push('### Daily Price Series');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(dailySeries, 4000));
        sections.push('```');
        sections.push('');
      }

      // RSI
      const rsiData = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_RSI);
      if (rsiData) {
        sections.push('### RSI Indicator');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(rsiData, 2000));
        sections.push('```');
        sections.push('');
      }

      // MACD
      const macdData = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_MACD);
      if (macdData) {
        sections.push('### MACD Indicator');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(macdData, 2000));
        sections.push('```');
        sections.push('');
      }

      // SMA
      const smaData = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_SMA);
      if (smaData) {
        sections.push('### Simple Moving Average');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(smaData, 2000));
        sections.push('```');
        sections.push('');
      }

      // EMA
      const emaData = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_EMA);
      if (emaData) {
        sections.push('### Exponential Moving Average');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(emaData, 2000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using all the data above, identify the highest-conviction short-term trading ' +
      'opportunities (1-5 day hold period). Every trade MUST have a specific entry price, ' +
      'stop-loss, and at least one profit target. Risk/reward must be at least 2:1. ' +
      'If no compelling setups exist, say so clearly. ' +
      'Submit your trade plans using the submit_trade_plans tool.'
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
    const tradePlans = (parsed.trade_plans as ParsedTradePlan[]) ?? [];
    const recs = (parsed.recommendations as ParsedRecommendation[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    // Prefer explicit recommendations if provided, otherwise map from trade plans
    let recommendations: Recommendation[];
    if (recs.length > 0) {
      recommendations = recs.map((rec) => ({
        symbol: rec.symbol ?? 'UNKNOWN',
        action: this.normalizeAction(rec.action),
        confidence: rec.confidence ?? 50,
        targetPrice: rec.target_price,
        stopLoss: rec.stop_loss,
        timeHorizon: rec.time_horizon ?? '1-5 days',
        rationale: rec.rationale ?? 'Short-term trade opportunity.',
      }));
    } else {
      recommendations = tradePlans.map((trade) => ({
        symbol: trade.symbol ?? 'UNKNOWN',
        action: this.normalizeAction(
          trade.direction === 'LONG'
            ? (trade.conviction && trade.conviction >= 8 ? 'STRONG_BUY' : 'BUY')
            : (trade.conviction && trade.conviction >= 8 ? 'STRONG_SELL' : 'SELL')
        ),
        confidence: trade.conviction ? trade.conviction * 10 : 50,
        targetPrice: trade.target_2 ?? trade.target_1,
        stopLoss: trade.stop_loss,
        timeHorizon: trade.expected_hold_period ?? '1-5 days',
        rationale:
          trade.catalyst ??
          `${trade.direction} trade at ${trade.entry_price} with ${trade.risk_reward_ratio}:1 R/R`,
      }));
    }

    return {
      agentId: AgentId.SHORT_TERM_TRADER,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 55,
      summary:
        (parsed.executive_summary as string) ??
        'Short-term trade analysis complete.',
      structured: {
        marketConditions: parsed.market_conditions ?? null,
        tradePlans: parsed.trade_plans ?? [],
        riskManagement: parsed.risk_management ?? null,
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

interface ParsedTradePlan {
  symbol: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  target_1: number;
  target_2?: number;
  target_3?: number;
  position_size_pct?: number;
  expected_hold_period?: string;
  risk_reward_ratio?: number;
  catalyst?: string;
  supporting_agents?: string[];
  key_levels?: {
    support?: number[];
    resistance?: number[];
  };
  conviction?: number;
}

interface ParsedRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}
