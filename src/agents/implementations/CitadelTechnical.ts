// =============================================================================
// Stock Advisors - Citadel Technical Analysis Agent
// =============================================================================
// Combines classical technical analysis with quantitative methods: multi-
// timeframe trend analysis, support/resistance identification, moving average
// analysis, RSI/MACD/Bollinger readings, volume analysis, chart pattern
// recognition, Fibonacci levels, and complete trade plans with R:R ratios.
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
import citadelSystemPrompt from '../prompts/system-prompts/citadel-technical.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const CITADEL_TECHNICAL_CAPABILITY: AgentCapability = {
  id: AgentId.CITADEL_TECHNICAL,
  name: 'Citadel Technical Analysis',
  description:
    'Combines classical technical analysis with quantitative methods for multi-timeframe ' +
    'trend analysis, support/resistance levels, moving average analysis, RSI/MACD/Bollinger ' +
    'readings, volume analysis, chart patterns, Fibonacci levels, and trade plans with R:R ratios.',
  personality: AGENT_PERSONALITIES[AgentId.CITADEL_TECHNICAL],
  requiredData: [
    DataRequirement.DAILY_SERIES,
    DataRequirement.INTRADAY,
    DataRequirement.TECHNICAL_RSI,
    DataRequirement.TECHNICAL_MACD,
    DataRequirement.TECHNICAL_BBANDS,
    DataRequirement.TECHNICAL_SMA,
    DataRequirement.TECHNICAL_EMA,
    DataRequirement.QUOTE,
  ],
  systemPromptPath: 'citadel-technical.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const TECHNICAL_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_technical_analysis',
  description:
    'Submit the complete Citadel technical analysis with structured data for each stock analyzed.',
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
          'A 3-4 sentence technical analysis summary with the headline signal and trade direction.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the technical analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      analyses: {
        type: 'array',
        description: 'Technical analyses for each stock.',
        items: {
          type: 'object',
          required: ['symbol', 'trend', 'trade_plan', 'confidence_rating', 'action'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action based on technical analysis',
            },
            trend: {
              type: 'object',
              description: 'Multi-timeframe trend analysis',
              properties: {
                daily: {
                  type: 'string',
                  enum: ['bullish', 'bearish', 'neutral'],
                  description: 'Daily trend direction',
                },
                weekly: {
                  type: 'string',
                  enum: ['bullish', 'bearish', 'neutral'],
                  description: 'Weekly trend direction',
                },
                monthly: {
                  type: 'string',
                  enum: ['bullish', 'bearish', 'neutral'],
                  description: 'Monthly trend direction',
                },
                alignment: {
                  type: 'string',
                  enum: ['aligned_bullish', 'aligned_bearish', 'mixed', 'transitioning'],
                  description: 'Whether trends align across timeframes',
                },
                regime: {
                  type: 'string',
                  enum: ['trending_up', 'trending_down', 'range_bound', 'transitioning'],
                  description: 'Current trend regime classification',
                },
              },
            },
            support_levels: {
              type: 'array',
              description: 'Key support levels below current price',
              items: {
                type: 'object',
                properties: {
                  price: { type: 'number', description: 'Support price level' },
                  method: { type: 'string', description: 'How this level was identified' },
                  strength: { type: 'string', enum: ['weak', 'moderate', 'strong'] },
                  distance_pct: { type: 'number', description: 'Distance from current price as decimal' },
                },
              },
            },
            resistance_levels: {
              type: 'array',
              description: 'Key resistance levels above current price',
              items: {
                type: 'object',
                properties: {
                  price: { type: 'number', description: 'Resistance price level' },
                  method: { type: 'string', description: 'How this level was identified' },
                  strength: { type: 'string', enum: ['weak', 'moderate', 'strong'] },
                  distance_pct: { type: 'number', description: 'Distance from current price as decimal' },
                },
              },
            },
            moving_averages: {
              type: 'object',
              description: 'Moving average analysis',
              properties: {
                sma_50: {
                  type: 'object',
                  properties: {
                    value: { type: 'number' },
                    slope: { type: 'string', enum: ['rising', 'flat', 'falling'] },
                    price_position: { type: 'string', enum: ['above', 'below', 'at'] },
                  },
                },
                sma_100: {
                  type: 'object',
                  properties: {
                    value: { type: 'number' },
                    slope: { type: 'string', enum: ['rising', 'flat', 'falling'] },
                    price_position: { type: 'string', enum: ['above', 'below', 'at'] },
                  },
                },
                sma_200: {
                  type: 'object',
                  properties: {
                    value: { type: 'number' },
                    slope: { type: 'string', enum: ['rising', 'flat', 'falling'] },
                    price_position: { type: 'string', enum: ['above', 'below', 'at'] },
                    distance_pct: { type: 'number', description: 'Price distance from 200 SMA as decimal' },
                  },
                },
                golden_death_cross: {
                  type: 'string',
                  description: 'Golden Cross, Death Cross, or None status',
                },
                ribbon_status: {
                  type: 'string',
                  enum: ['fanning_bullish', 'fanning_bearish', 'converging', 'flat'],
                  description: 'MA ribbon analysis',
                },
              },
            },
            indicators: {
              type: 'object',
              description: 'Technical indicator readings',
              properties: {
                rsi: {
                  type: 'object',
                  properties: {
                    value: { type: 'number', description: 'Current RSI(14) reading' },
                    status: { type: 'string', enum: ['overbought', 'neutral', 'oversold'] },
                    divergence: { type: 'string', enum: ['bullish_divergence', 'bearish_divergence', 'none'] },
                    trend: { type: 'string', enum: ['rising', 'flat', 'falling'] },
                  },
                },
                macd: {
                  type: 'object',
                  properties: {
                    macd_line: { type: 'number' },
                    signal_line: { type: 'number' },
                    histogram: { type: 'number' },
                    crossover: { type: 'string', enum: ['bullish_crossover', 'bearish_crossover', 'none'] },
                    histogram_momentum: { type: 'string', enum: ['expanding', 'contracting'] },
                    divergence: { type: 'string', enum: ['bullish_divergence', 'bearish_divergence', 'none'] },
                  },
                },
                bollinger: {
                  type: 'object',
                  properties: {
                    upper_band: { type: 'number' },
                    middle_band: { type: 'number' },
                    lower_band: { type: 'number' },
                    band_width: { type: 'number', description: 'Band width as decimal' },
                    price_position: { type: 'string', enum: ['above_upper', 'upper_half', 'lower_half', 'below_lower'] },
                    squeeze: { type: 'boolean', description: 'Is a Bollinger squeeze active?' },
                  },
                },
              },
            },
            volume_analysis: {
              type: 'object',
              description: 'Volume analysis',
              properties: {
                avg_volume: { type: 'number', description: 'Average daily volume' },
                recent_volume: { type: 'number', description: 'Most recent volume' },
                volume_trend: { type: 'string', enum: ['above_average', 'average', 'below_average'] },
                confirmation: { type: 'boolean', description: 'Does volume confirm the price trend?' },
                notable_signals: { type: 'string', description: 'Any notable volume signals' },
              },
            },
            chart_patterns: {
              type: 'array',
              description: 'Active chart patterns identified',
              items: {
                type: 'object',
                properties: {
                  pattern_name: { type: 'string', description: 'Name of the chart pattern' },
                  type: { type: 'string', enum: ['continuation', 'reversal', 'breakout'] },
                  status: { type: 'string', enum: ['confirmed', 'forming', 'speculative'] },
                  target_price: { type: 'number', description: 'Measured move target' },
                  reliability: { type: 'string', enum: ['high', 'medium', 'low'] },
                  breakout_zone: { type: 'string', description: 'Price zone where breakout/breakdown occurs' },
                },
              },
            },
            fibonacci_levels: {
              type: 'array',
              description: 'Key Fibonacci levels',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'string', description: 'Fibonacci level (e.g., "38.2%", "61.8%")' },
                  price: { type: 'number', description: 'Price at this Fib level' },
                  type: { type: 'string', enum: ['retracement', 'extension'] },
                  acting_as: { type: 'string', enum: ['support', 'resistance', 'none'] },
                  confluence: { type: 'boolean', description: 'Does it confluence with other levels?' },
                },
              },
            },
            trade_plan: {
              type: 'object',
              description: 'Complete trade plan with entry, stops, and targets',
              properties: {
                direction: { type: 'string', enum: ['long', 'short', 'no_trade'] },
                entry: { type: 'number', description: 'Entry price' },
                entry_trigger: { type: 'string', description: 'What triggers entry' },
                stop_loss: { type: 'number', description: 'Stop-loss price' },
                stop_rationale: { type: 'string', description: 'Why this stop level' },
                targets: {
                  type: 'array',
                  description: 'Price targets',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string', description: 'Target label (T1, T2, T3)' },
                      price: { type: 'number' },
                      method: { type: 'string', description: 'How target was derived' },
                    },
                  },
                },
                risk_reward_ratio: { type: 'number', description: 'Risk:Reward ratio for primary target' },
                position_sizing: { type: 'string', description: 'Position sizing guidance' },
                trailing_stop: { type: 'string', description: 'Trailing stop rules' },
                invalidation: { type: 'string', description: 'What invalidates the trade thesis' },
              },
            },
            confidence_rating: {
              type: 'number',
              description: 'Overall confidence in the technical setup (0-100)',
              minimum: 0,
              maximum: 100,
            },
            time_horizon: { type: 'string', description: 'Timeframe for the analysis' },
            rationale: { type: 'string', description: 'Detailed technical rationale' },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Technical caveats, data quality issues, or important disclaimers.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Citadel Technical Agent
// -----------------------------------------------------------------------------

export class CitadelTechnical extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(CITADEL_TECHNICAL_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): CitadelTechnical {
    return new CitadelTechnical(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return citadelSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [TECHNICAL_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Technical Analysis Request`);
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

      sections.push(`## ${symbol} - Technical Data`);
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
        sections.push('### Daily OHLCV Series');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(dailySeries, 6000));
        sections.push('```');
        sections.push('');
      }

      // Intraday
      const intraday = this.getDataForSymbol(stockData, symbol, DataRequirement.INTRADAY);
      if (intraday) {
        sections.push('### Intraday Series');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(intraday, 4000));
        sections.push('```');
        sections.push('');
      }

      // RSI
      const rsi = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_RSI);
      if (rsi) {
        sections.push('### RSI (14-Period)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(rsi, 3000));
        sections.push('```');
        sections.push('');
      }

      // MACD
      const macd = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_MACD);
      if (macd) {
        sections.push('### MACD (12, 26, 9)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(macd, 3000));
        sections.push('```');
        sections.push('');
      }

      // Bollinger Bands
      const bbands = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_BBANDS);
      if (bbands) {
        sections.push('### Bollinger Bands (20, 2)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(bbands, 3000));
        sections.push('```');
        sections.push('');
      }

      // SMA
      const sma = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_SMA);
      if (sma) {
        sections.push('### Simple Moving Averages');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(sma, 3000));
        sections.push('```');
        sections.push('');
      }

      // EMA
      const ema = this.getDataForSymbol(stockData, symbol, DataRequirement.TECHNICAL_EMA);
      if (ema) {
        sections.push('### Exponential Moving Averages');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(ema, 3000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the technical data above, deliver a comprehensive technical analysis for each symbol. ' +
      'Analyze multi-timeframe trends, support/resistance levels, moving averages, ' +
      'RSI/MACD/Bollinger indicators, volume, chart patterns, Fibonacci levels, ' +
      'and provide a complete trade plan with entry, stop-loss, targets, and R:R ratio. ' +
      'Submit your findings using the submit_technical_analysis tool.'
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
    const analyses = (parsed.analyses as TechnicalAnalysis[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    const recommendations: Recommendation[] = analyses.map((analysis) => ({
      symbol: analysis.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(analysis.action),
      confidence: analysis.confidence_rating ?? 50,
      targetPrice: analysis.trade_plan?.targets?.[0]?.price,
      stopLoss: analysis.trade_plan?.stop_loss,
      timeHorizon: analysis.time_horizon ?? '1-4 weeks',
      rationale: analysis.rationale ?? 'Technical analysis complete.',
    }));

    return {
      agentId: AgentId.CITADEL_TECHNICAL,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'Technical analysis complete.',
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

interface TechnicalAnalysis {
  symbol: string;
  action: string;
  trend?: {
    daily?: string;
    weekly?: string;
    monthly?: string;
    alignment?: string;
    regime?: string;
  };
  support_levels?: Array<{
    price?: number;
    method?: string;
    strength?: string;
    distance_pct?: number;
  }>;
  resistance_levels?: Array<{
    price?: number;
    method?: string;
    strength?: string;
    distance_pct?: number;
  }>;
  moving_averages?: Record<string, unknown>;
  indicators?: {
    rsi?: { value?: number; status?: string; divergence?: string; trend?: string };
    macd?: Record<string, unknown>;
    bollinger?: Record<string, unknown>;
  };
  volume_analysis?: Record<string, unknown>;
  chart_patterns?: Array<{
    pattern_name?: string;
    type?: string;
    status?: string;
    target_price?: number;
    reliability?: string;
    breakout_zone?: string;
  }>;
  fibonacci_levels?: Array<{
    level?: string;
    price?: number;
    type?: string;
    acting_as?: string;
    confluence?: boolean;
  }>;
  trade_plan?: {
    direction?: string;
    entry?: number;
    entry_trigger?: string;
    stop_loss?: number;
    stop_rationale?: string;
    targets?: Array<{ label?: string; price?: number; method?: string }>;
    risk_reward_ratio?: number;
    position_sizing?: string;
    trailing_stop?: string;
    invalidation?: string;
  };
  confidence_rating?: number;
  time_horizon?: string;
  rationale?: string;
}
