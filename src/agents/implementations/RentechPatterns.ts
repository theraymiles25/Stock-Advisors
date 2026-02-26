// =============================================================================
// Stock Advisors - Renaissance Technologies Pattern Finder Agent
// =============================================================================
// Quantitative pattern detection agent that identifies statistically significant
// seasonal patterns, day-of-week effects, macro correlations, insider activity,
// institutional ownership trends, short interest dynamics, unusual options
// activity, and earnings price behavior patterns.
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
import rentechSystemPrompt from '../prompts/system-prompts/rentech-patterns.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const RENTECH_CAPABILITY: AgentCapability = {
  id: AgentId.RENTECH_PATTERNS,
  name: 'Renaissance Technologies Pattern Finder',
  description:
    'Identifies statistically significant patterns including seasonal effects, ' +
    'day-of-week biases, macro correlations, insider activity, institutional ownership ' +
    'trends, short interest dynamics, unusual options flow, and earnings price behavior.',
  personality: AGENT_PERSONALITIES[AgentId.RENTECH_PATTERNS],
  requiredData: [
    DataRequirement.DAILY_SERIES,
    DataRequirement.INTRADAY,
    DataRequirement.TECHNICAL_RSI,
    DataRequirement.TECHNICAL_MACD,
    DataRequirement.TECHNICAL_SMA,
  ],
  systemPromptPath: 'rentech-patterns.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const PATTERN_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_pattern_analysis',
  description:
    'Submit the complete Renaissance Technologies quantitative pattern analysis report with structured data for each stock.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'seasonal_patterns',
      'day_of_week_patterns',
      'macro_correlations',
      'insider_activity',
      'institutional_ownership',
      'short_interest',
      'unusual_options',
      'earnings_patterns',
      'sector_rotation_signals',
      'statistical_edges',
      'recommendations',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description:
          'A 2-4 sentence summary of the most significant patterns discovered and their exploitability.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the pattern analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      seasonal_patterns: {
        type: 'object',
        description: 'Seasonal and calendar-based return patterns.',
        properties: {
          monthly_returns: {
            type: 'array',
            description: 'Average return by calendar month.',
            items: {
              type: 'object',
              properties: {
                month: { type: 'string', description: 'Month name' },
                avg_return: { type: 'number', description: 'Average return as decimal' },
                win_rate: { type: 'number', description: 'Percentage of positive months' },
                sample_size: { type: 'number', description: 'Number of observations' },
                std_dev: { type: 'number', description: 'Standard deviation of returns' },
              },
            },
          },
          best_months: {
            type: 'array',
            items: { type: 'string' },
            description: 'Top performing months historically.',
          },
          worst_months: {
            type: 'array',
            items: { type: 'string' },
            description: 'Worst performing months historically.',
          },
        },
      },
      day_of_week_patterns: {
        type: 'array',
        description: 'Performance patterns by day of week.',
        items: {
          type: 'object',
          properties: {
            day: { type: 'string', description: 'Day of week' },
            avg_return: { type: 'number', description: 'Average daily return' },
            win_rate: { type: 'number', description: 'Percentage of positive days' },
            avg_volume_ratio: { type: 'number', description: 'Volume relative to average' },
            significance: { type: 'string', description: 'Statistical significance level' },
          },
        },
      },
      macro_correlations: {
        type: 'array',
        description: 'Correlation to macro events and indicators.',
        items: {
          type: 'object',
          properties: {
            event: { type: 'string', description: 'Macro event or indicator name' },
            correlation: { type: 'number', description: 'Correlation coefficient' },
            avg_return_around_event: { type: 'number', description: 'Average return in event window' },
            lead_lag: { type: 'string', description: 'Whether stock leads or lags the event' },
            significance: { type: 'string', description: 'Statistical significance' },
          },
        },
      },
      insider_activity: {
        type: 'object',
        description: 'Insider buying and selling pattern analysis.',
        properties: {
          recent_buys: { type: 'number', description: 'Number of insider buys in recent period' },
          recent_sells: { type: 'number', description: 'Number of insider sells in recent period' },
          net_direction: {
            type: 'string',
            enum: ['net_buying', 'net_selling', 'neutral', 'no_activity'],
            description: 'Net insider direction',
          },
          cluster_detected: { type: 'boolean', description: 'Whether cluster buying/selling detected' },
          signal_strength: { type: 'string', description: 'Strength of the insider signal' },
        },
      },
      institutional_ownership: {
        type: 'object',
        description: 'Institutional ownership trend analysis.',
        properties: {
          percent: { type: 'number', description: 'Institutional ownership percentage' },
          trend: {
            type: 'string',
            enum: ['accumulating', 'distributing', 'stable', 'unknown'],
            description: 'Direction of institutional ownership change',
          },
          major_holders: {
            type: 'array',
            items: { type: 'string' },
            description: 'Notable institutional holders or recent position changes',
          },
        },
      },
      short_interest: {
        type: 'object',
        description: 'Short interest and squeeze potential analysis.',
        properties: {
          ratio: { type: 'number', description: 'Short interest as percentage of float' },
          days_to_cover: { type: 'number', description: 'Days to cover at average volume' },
          squeeze_potential: {
            type: 'string',
            enum: ['high', 'moderate', 'low', 'negligible'],
            description: 'Assessment of short squeeze probability',
          },
          trend: { type: 'string', description: 'Short interest trend direction' },
        },
      },
      unusual_options: {
        type: 'array',
        description: 'Unusual options activity detected.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Type of unusual activity (sweep, block, etc.)' },
            direction: { type: 'string', description: 'Bullish or bearish implication' },
            magnitude: { type: 'string', description: 'Size relative to normal activity' },
            expiration: { type: 'string', description: 'Target expiration if known' },
            significance: { type: 'string', description: 'Market significance assessment' },
          },
        },
      },
      earnings_patterns: {
        type: 'array',
        description: 'Price behavior patterns around earnings announcements.',
        items: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Pattern name (pre-earnings drift, post-earnings drift, etc.)' },
            avg_move: { type: 'number', description: 'Average price move as decimal' },
            direction_bias: { type: 'string', description: 'Directional tendency' },
            consistency: { type: 'number', description: 'How often the pattern repeats (0-1)' },
            sample_size: { type: 'number', description: 'Number of earnings events analyzed' },
          },
        },
      },
      sector_rotation_signals: {
        type: 'array',
        description: 'Sector rotation and relative performance signals.',
        items: {
          type: 'object',
          properties: {
            signal: { type: 'string', description: 'Description of the rotation signal' },
            direction: { type: 'string', description: 'Into or out of the sector' },
            strength: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
            timeframe: { type: 'string', description: 'Relevant timeframe for the signal' },
          },
        },
      },
      statistical_edges: {
        type: 'array',
        description: 'Summary of all quantifiable statistical edges found.',
        items: {
          type: 'object',
          properties: {
            edge_name: { type: 'string', description: 'Name of the statistical edge' },
            expected_return: { type: 'number', description: 'Expected return from exploiting this edge' },
            win_rate: { type: 'number', description: 'Historical win rate' },
            sample_size: { type: 'number', description: 'Number of observations' },
            p_value: { type: 'number', description: 'Statistical significance p-value' },
            edge_status: {
              type: 'string',
              enum: ['strengthening', 'stable', 'decaying', 'unconfirmed'],
              description: 'Whether the edge is growing or shrinking',
            },
            tradeable: { type: 'boolean', description: 'Whether the edge is practically tradeable' },
          },
        },
      },
      recommendations: {
        type: 'array',
        description: 'Trading recommendations based on pattern analysis.',
        items: {
          type: 'object',
          required: ['symbol', 'action', 'confidence', 'rationale', 'time_horizon'],
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
        description: 'Data quality warnings, statistical caveats, or risk factors.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Renaissance Technologies Pattern Finder Agent
// -----------------------------------------------------------------------------

export class RentechPatterns extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(RENTECH_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): RentechPatterns {
    return new RentechPatterns(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return rentechSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [PATTERN_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Quantitative Pattern Analysis Request`);
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

      // Daily series
      const dailySeries = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.DAILY_SERIES
      );
      if (dailySeries) {
        sections.push('### Daily Price Series');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(dailySeries, 6000));
        sections.push('```');
        sections.push('');
      }

      // Intraday data
      const intradayData = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.INTRADAY
      );
      if (intradayData) {
        sections.push('### Intraday Data');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(intradayData, 4000));
        sections.push('```');
        sections.push('');
      }

      // RSI
      const rsiData = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.TECHNICAL_RSI
      );
      if (rsiData) {
        sections.push('### RSI Indicator');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(rsiData, 3000));
        sections.push('```');
        sections.push('');
      }

      // MACD
      const macdData = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.TECHNICAL_MACD
      );
      if (macdData) {
        sections.push('### MACD Indicator');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(macdData, 3000));
        sections.push('```');
        sections.push('');
      }

      // SMA
      const smaData = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.TECHNICAL_SMA
      );
      if (smaData) {
        sections.push('### Simple Moving Average');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(smaData, 3000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the data above, identify all statistically significant patterns. ' +
        'Analyze seasonal effects, day-of-week biases, macro correlations, insider activity, ' +
        'institutional ownership trends, short interest dynamics, unusual options activity, ' +
        'and earnings price behavior. Quantify every edge with sample sizes and significance levels. ' +
        'Submit your findings using the submit_pattern_analysis tool.'
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
    const recs = (parsed.recommendations as ParsedRecommendation[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    const recommendations: Recommendation[] = recs.map((rec) => ({
      symbol: rec.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(rec.action),
      confidence: rec.confidence ?? 50,
      targetPrice: rec.target_price,
      stopLoss: rec.stop_loss,
      timeHorizon: rec.time_horizon ?? '1-3 months',
      rationale: rec.rationale ?? 'No rationale provided.',
    }));

    return {
      agentId: AgentId.RENTECH_PATTERNS,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 60,
      summary:
        (parsed.executive_summary as string) ?? 'Pattern analysis complete.',
      structured: {
        seasonalPatterns: parsed.seasonal_patterns ?? null,
        dayOfWeekPatterns: parsed.day_of_week_patterns ?? [],
        macroCorrelations: parsed.macro_correlations ?? [],
        insiderActivity: parsed.insider_activity ?? null,
        institutionalOwnership: parsed.institutional_ownership ?? null,
        shortInterest: parsed.short_interest ?? null,
        unusualOptions: parsed.unusual_options ?? [],
        earningsPatterns: parsed.earnings_patterns ?? [],
        sectorRotationSignals: parsed.sector_rotation_signals ?? [],
        statisticalEdges: parsed.statistical_edges ?? [],
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
      'STRONG_BUY',
      'BUY',
      'HOLD',
      'SELL',
      'STRONG_SELL',
    ];
    return valid.includes(upper as RecommendationAction)
      ? (upper as RecommendationAction)
      : 'HOLD';
  }
}

// -----------------------------------------------------------------------------
// Internal Types
// -----------------------------------------------------------------------------

interface ParsedRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}
