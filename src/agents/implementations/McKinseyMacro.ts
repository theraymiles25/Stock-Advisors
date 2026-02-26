// =============================================================================
// Stock Advisors - McKinsey Global Institute Macro Economic Impact Agent
// =============================================================================
// Macroeconomic analysis agent that assesses interest rate impacts, inflation
// trends, GDP forecasts, currency effects, employment data, Fed policy outlook,
// global risk factors, and sector rotation recommendations based on the current
// economic cycle phase.
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
import mckinseySystemPrompt from '../prompts/system-prompts/mckinsey-macro.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const MCKINSEY_CAPABILITY: AgentCapability = {
  id: AgentId.MCKINSEY_MACRO,
  name: 'McKinsey Macro Economic Impact',
  description:
    'Assesses macroeconomic forces including interest rates, inflation, GDP, ' +
    'currency, employment, Fed policy, and global risks to provide sector rotation ' +
    'recommendations and portfolio adjustments based on the economic cycle.',
  personality: AGENT_PERSONALITIES[AgentId.MCKINSEY_MACRO],
  requiredData: [
    DataRequirement.SECTOR_PERFORMANCE,
    DataRequirement.DAILY_SERIES,
    DataRequirement.NEWS_SENTIMENT,
    DataRequirement.QUOTE,
  ],
  systemPromptPath: 'mckinsey-macro.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.3,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const MACRO_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_macro_assessment',
  description:
    'Submit the complete McKinsey macroeconomic impact assessment with structured data on all macro factors.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'macro_regime',
      'interest_rates',
      'inflation',
      'gdp',
      'currency',
      'employment',
      'fed_policy',
      'global_risks',
      'sector_rotation',
      'portfolio_adjustments',
      'macro_timeline',
      'recommendations',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description: 'A 2-4 sentence summary of the macro environment and its implications for the portfolio.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the macro assessment (0-100).',
        minimum: 0,
        maximum: 100,
      },
      macro_regime: {
        type: 'object',
        description: 'Current macroeconomic regime classification.',
        properties: {
          current_phase: {
            type: 'string',
            enum: ['early_expansion', 'mid_expansion', 'late_expansion', 'slowdown', 'recession', 'recovery'],
            description: 'Current phase of the economic cycle.',
          },
          direction: {
            type: 'string',
            enum: ['improving', 'stable', 'deteriorating'],
            description: 'Direction of macro conditions.',
          },
          confidence: { type: 'number', description: 'Confidence in regime classification (0-100)' },
        },
      },
      interest_rates: {
        type: 'object',
        description: 'Interest rate environment analysis.',
        properties: {
          current: { type: 'string', description: 'Current rate environment description' },
          outlook: { type: 'string', description: 'Rate outlook for next 6-12 months' },
          impact_assessment: {
            type: 'string',
            description: 'Impact on growth vs value stocks and rate-sensitive sectors',
          },
        },
      },
      inflation: {
        type: 'object',
        description: 'Inflation trend analysis.',
        properties: {
          trend: {
            type: 'string',
            enum: ['accelerating', 'peaking', 'decelerating', 'anchored'],
            description: 'Inflation trajectory.',
          },
          benefiting_sectors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sectors that benefit from current inflation environment.',
          },
          suffering_sectors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sectors that suffer from current inflation environment.',
          },
        },
      },
      gdp: {
        type: 'object',
        description: 'GDP growth and corporate earnings impact.',
        properties: {
          forecast: { type: 'string', description: 'GDP growth forecast summary' },
          earnings_impact: { type: 'string', description: 'Impact on corporate earnings growth' },
        },
      },
      currency: {
        type: 'object',
        description: 'US dollar strength and currency impact.',
        properties: {
          usd_strength: {
            type: 'string',
            enum: ['strong', 'strengthening', 'neutral', 'weakening', 'weak'],
            description: 'Current USD strength assessment.',
          },
          international_impact: {
            type: 'string',
            description: 'Impact on companies with international revenue.',
          },
        },
      },
      employment: {
        type: 'object',
        description: 'Employment and consumer spending analysis.',
        properties: {
          trend: {
            type: 'string',
            enum: ['tight', 'loosening', 'deteriorating', 'stable'],
            description: 'Labor market conditions.',
          },
          consumer_spending_outlook: {
            type: 'string',
            description: 'Outlook for consumer spending.',
          },
        },
      },
      fed_policy: {
        type: 'object',
        description: 'Federal Reserve policy outlook.',
        properties: {
          next_moves: {
            type: 'array',
            items: { type: 'string' },
            description: 'Expected Fed actions over the next 6-12 months.',
          },
          timeline: {
            type: 'string',
            description: 'Timeline for expected policy changes.',
          },
          market_vs_reality: {
            type: 'string',
            description: 'Gap between market pricing and likely Fed actions.',
          },
        },
      },
      global_risks: {
        type: 'array',
        description: 'Top global risk factors.',
        items: {
          type: 'object',
          properties: {
            risk: { type: 'string', description: 'Description of the risk factor' },
            probability: {
              type: 'string',
              enum: ['high', 'moderate', 'low'],
              description: 'Probability of materializing',
            },
            portfolio_impact: { type: 'string', description: 'Expected impact on the portfolio' },
          },
        },
      },
      sector_rotation: {
        type: 'object',
        description: 'Sector rotation recommendations based on economic cycle.',
        properties: {
          overweight: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sectors to overweight.',
          },
          underweight: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sectors to underweight.',
          },
          rationale: {
            type: 'string',
            description: 'Rationale for sector positioning.',
          },
        },
      },
      portfolio_adjustments: {
        type: 'array',
        description: 'Specific portfolio adjustments for each stock under analysis.',
        items: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Stock symbol' },
            adjustment: {
              type: 'string',
              enum: ['increase', 'maintain', 'decrease'],
              description: 'Recommended position adjustment',
            },
            rationale: { type: 'string', description: 'Macro-driven rationale' },
            macro_tailwinds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Macro factors supporting the stock',
            },
            macro_headwinds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Macro factors working against the stock',
            },
          },
        },
      },
      macro_timeline: {
        type: 'array',
        description: 'Forward-looking timeline of key macro events and inflection points.',
        items: {
          type: 'object',
          properties: {
            event: { type: 'string', description: 'Macro event or data release' },
            expected_date: { type: 'string', description: 'Expected date or timeframe' },
            potential_impact: { type: 'string', description: 'Potential market impact' },
            affected_symbols: {
              type: 'array',
              items: { type: 'string' },
              description: 'Symbols most affected',
            },
          },
        },
      },
      recommendations: {
        type: 'array',
        description: 'Macro-adjusted investment recommendations.',
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
        description: 'Macro risk warnings and uncertainty caveats.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// McKinsey Macro Agent
// -----------------------------------------------------------------------------

export class McKinseyMacro extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(MCKINSEY_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): McKinseyMacro {
    return new McKinseyMacro(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return mckinseySystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [MACRO_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Macroeconomic Impact Assessment Request`);
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

    // Sector performance (shared macro data)
    const firstSymbol = input.symbols[0];
    if (firstSymbol) {
      const sectorPerf = this.getDataForSymbol(
        stockData,
        firstSymbol,
        DataRequirement.SECTOR_PERFORMANCE
      );
      if (sectorPerf) {
        sections.push('## Sector Performance Data');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(sectorPerf, 4000));
        sections.push('```');
        sections.push('');
      }
    }

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
      const quoteData = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.QUOTE
      );
      if (quoteData) {
        sections.push('### Real-Time Quote');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(quoteData, 3000));
        sections.push('```');
        sections.push('');
      }

      // Daily series
      const dailySeries = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.DAILY_SERIES
      );
      if (dailySeries) {
        sections.push('### Daily Price Series (Recent)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(dailySeries, 4000));
        sections.push('```');
        sections.push('');
      }

      // News sentiment
      const newsSentiment = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.NEWS_SENTIMENT
      );
      if (newsSentiment) {
        sections.push('### News & Sentiment Data');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(newsSentiment, 4000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the data above, produce a comprehensive macroeconomic impact assessment. ' +
        'Analyze interest rates, inflation, GDP, currency, employment, Fed policy, ' +
        'and global risk factors. Provide sector rotation recommendations and specific ' +
        'portfolio adjustments for each stock. ' +
        'Submit your findings using the submit_macro_assessment tool.'
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
      timeHorizon: rec.time_horizon ?? '6-12 months',
      rationale: rec.rationale ?? 'No rationale provided.',
    }));

    return {
      agentId: AgentId.MCKINSEY_MACRO,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 65,
      summary:
        (parsed.executive_summary as string) ?? 'Macro assessment complete.',
      structured: {
        macroRegime: parsed.macro_regime ?? null,
        interestRates: parsed.interest_rates ?? null,
        inflation: parsed.inflation ?? null,
        gdp: parsed.gdp ?? null,
        currency: parsed.currency ?? null,
        employment: parsed.employment ?? null,
        fedPolicy: parsed.fed_policy ?? null,
        globalRisks: parsed.global_risks ?? [],
        sectorRotation: parsed.sector_rotation ?? null,
        portfolioAdjustments: parsed.portfolio_adjustments ?? [],
        macroTimeline: parsed.macro_timeline ?? [],
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
