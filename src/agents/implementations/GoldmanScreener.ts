// =============================================================================
// Stock Advisors - Goldman Sachs Stock Screener Agent
// =============================================================================
// Reference implementation of a specialist agent. Extends BaseAgent with
// Goldman-specific prompt construction, data formatting, and output mapping.
// Uses the Goldman Sachs personality to deliver institutional-grade equity
// screening reports.
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
import goldmanSystemPrompt from '../prompts/system-prompts/goldman-screener.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const GOLDMAN_CAPABILITY: AgentCapability = {
  id: AgentId.GOLDMAN_SCREENER,
  name: 'Goldman Sachs Stock Screener',
  description:
    'Screens stocks against institutional-grade criteria including P/E analysis, ' +
    'revenue growth, balance sheet health, dividend sustainability, competitive moats, ' +
    'and generates bull/bear price targets with entry zones.',
  personality: AGENT_PERSONALITIES[AgentId.GOLDMAN_SCREENER],
  requiredData: [
    DataRequirement.QUOTE,
    DataRequirement.FUNDAMENTALS,
    DataRequirement.INCOME_STATEMENT,
    DataRequirement.DAILY_SERIES,
    DataRequirement.SECTOR_PERFORMANCE,
  ],
  systemPromptPath: 'goldman-screener.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.3,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const SCREENING_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_screening_report',
  description:
    'Submit the complete Goldman Sachs equity screening report with structured data for each stock analyzed.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'stocks',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description:
          'A 2-4 sentence institutional-grade executive summary of the screening results.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the screening analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      stocks: {
        type: 'array',
        description: 'Array of screened stocks with detailed analysis.',
        items: {
          type: 'object',
          required: ['symbol', 'thesis', 'action', 'confidence'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            thesis: {
              type: 'string',
              description: 'One-line investment thesis',
            },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in this specific recommendation (0-100)',
            },
            pe_ratio: {
              type: 'object',
              properties: {
                ttm: { type: 'number', description: 'Trailing 12-month P/E' },
                forward: { type: 'number', description: 'Forward P/E estimate' },
                sector_avg: { type: 'number', description: 'Sector average P/E' },
                assessment: {
                  type: 'string',
                  description: 'Premium/discount assessment vs sector',
                },
              },
            },
            revenue_growth: {
              type: 'object',
              properties: {
                cagr_5yr: {
                  type: 'number',
                  description: '5-year revenue CAGR as decimal (e.g. 0.12 for 12%)',
                },
                trend: {
                  type: 'string',
                  enum: ['accelerating', 'stable', 'decelerating'],
                },
                latest_yoy: {
                  type: 'number',
                  description: 'Most recent YoY revenue growth as decimal',
                },
              },
            },
            debt_to_equity: {
              type: 'object',
              properties: {
                ratio: { type: 'number', description: 'Current D/E ratio' },
                health: {
                  type: 'string',
                  enum: ['Strong', 'Adequate', 'Concerning', 'Weak'],
                },
              },
            },
            dividend: {
              type: 'object',
              properties: {
                yield_pct: {
                  type: 'number',
                  description: 'Annual dividend yield as percentage',
                },
                payout_ratio: {
                  type: 'number',
                  description: 'Payout ratio as decimal',
                },
                sustainability: {
                  type: 'string',
                  enum: [
                    'Highly Sustainable',
                    'Sustainable',
                    'At Risk',
                    'Unsustainable',
                  ],
                },
              },
            },
            moat_rating: {
              type: 'string',
              enum: ['Weak', 'Moderate', 'Strong'],
              description: 'Competitive moat assessment',
            },
            moat_sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sources of competitive moat',
            },
            price_targets: {
              type: 'object',
              properties: {
                bull: { type: 'number', description: 'Bull case 12-month target' },
                base: { type: 'number', description: 'Base case 12-month target' },
                bear: { type: 'number', description: 'Bear case 12-month target' },
                current: { type: 'number', description: 'Current price' },
              },
            },
            risk_rating: {
              type: 'number',
              description: 'Risk score from 1 (low) to 10 (high)',
              minimum: 1,
              maximum: 10,
            },
            biggest_risk: {
              type: 'string',
              description: 'Single biggest risk factor',
            },
            entry_zones: {
              type: 'object',
              properties: {
                aggressive: {
                  type: 'number',
                  description: 'Aggressive entry price',
                },
                conservative: {
                  type: 'number',
                  description: 'Conservative entry price',
                },
                stop_loss: {
                  type: 'number',
                  description: 'Suggested stop-loss price',
                },
              },
            },
            time_horizon: {
              type: 'string',
              description: 'Recommended time horizon for this trade',
            },
            rationale: {
              type: 'string',
              description: 'Detailed rationale for the recommendation',
            },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Risk warnings, data quality caveats, or important disclaimers.',
      },
      market_context: {
        type: 'string',
        description: 'Brief note on current market conditions relevant to the screen.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Goldman Screener Agent
// -----------------------------------------------------------------------------

export class GoldmanScreener extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(GOLDMAN_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  /**
   * Static factory method for consistent instantiation.
   */
  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): GoldmanScreener {
    return new GoldmanScreener(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  /**
   * Load the Goldman-specific system prompt from the bundled markdown file.
   * The Vite `?raw` import gives us the file contents as a string at build time.
   */
  protected override loadSystemPromptTemplate(): string {
    return goldmanSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [SCREENING_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  /**
   * Build the user message by combining the user's query with all available
   * stock data formatted as context sections. Each data type is clearly
   * labeled so the LLM knows what it's working with.
   */
  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(`## Stock Screening Request`);
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
      if (input.preferences.incomeFocused) {
        sections.push(`- Income Focused: Yes`);
      }
      if (input.preferences.excludedSectors?.length) {
        sections.push(
          `- Excluded Sectors: ${input.preferences.excludedSectors.join(', ')}`
        );
      }
    }

    sections.push('');
    sections.push('---');
    sections.push('');

    // Data sections for each symbol
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

      // Fundamentals
      const fundamentals = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.FUNDAMENTALS
      );
      if (fundamentals) {
        sections.push('### Company Fundamentals');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(fundamentals, 5000));
        sections.push('```');
        sections.push('');
      }

      // Income Statement
      const incomeStatement = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.INCOME_STATEMENT
      );
      if (incomeStatement) {
        sections.push('### Income Statement (Annual)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(incomeStatement, 5000));
        sections.push('```');
        sections.push('');
      }

      // Daily price series (summary - too large to include in full)
      const dailySeries = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.DAILY_SERIES
      );
      if (dailySeries) {
        sections.push('### Daily Price Series (Recent)');
        sections.push('```json');
        // Truncate daily series to keep prompt manageable
        sections.push(this.formatDataForPrompt(dailySeries, 4000));
        sections.push('```');
        sections.push('');
      }
    }

    // Sector performance (shared across all symbols)
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
        sections.push(this.formatDataForPrompt(sectorPerf, 3000));
        sections.push('```');
        sections.push('');
      }
    }

    // Closing instruction
    sections.push('---');
    sections.push('');
    sections.push(
      'Using the data above, produce a comprehensive Goldman Sachs equity screening report. ' +
        'Analyze each symbol against all nine criteria in your framework. ' +
        'Submit your findings using the submit_screening_report tool.'
    );

    return sections.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Output Mapping
  // ---------------------------------------------------------------------------

  /**
   * Map Claude's structured tool_use response into the standard AgentOutput
   * format. Extracts recommendations from the stocks array and maps
   * Goldman-specific fields into the structured data section.
   */
  protected buildOutput(
    parsed: Record<string, unknown>,
    usage: TokenUsage
  ): AgentOutput {
    const stocks = (parsed.stocks as StockAnalysis[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    // Map each stock analysis into a Recommendation
    const recommendations: Recommendation[] = stocks.map((stock) => ({
      symbol: stock.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(stock.action),
      confidence: stock.confidence ?? 50,
      targetPrice: stock.price_targets?.base,
      stopLoss: stock.entry_zones?.stop_loss,
      timeHorizon: stock.time_horizon ?? '6-12 months',
      rationale: stock.rationale ?? stock.thesis ?? 'No rationale provided.',
    }));

    return {
      agentId: AgentId.GOLDMAN_SCREENER,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'Screening analysis complete.',
      structured: {
        stocks,
        marketContext: parsed.market_context ?? null,
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

  /**
   * Normalize a string action value to the RecommendationAction enum.
   * Handles edge cases where Claude might return slightly different casing.
   */
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

/**
 * Shape of a single stock analysis as returned by Claude's tool_use.
 * This mirrors the JSON schema defined in SCREENING_OUTPUT_TOOL.
 */
interface StockAnalysis {
  symbol: string;
  thesis: string;
  action: string;
  confidence: number;
  pe_ratio?: {
    ttm?: number;
    forward?: number;
    sector_avg?: number;
    assessment?: string;
  };
  revenue_growth?: {
    cagr_5yr?: number;
    trend?: string;
    latest_yoy?: number;
  };
  debt_to_equity?: {
    ratio?: number;
    health?: string;
  };
  dividend?: {
    yield_pct?: number;
    payout_ratio?: number;
    sustainability?: string;
  };
  moat_rating?: string;
  moat_sources?: string[];
  price_targets?: {
    bull?: number;
    base?: number;
    bear?: number;
    current?: number;
  };
  risk_rating?: number;
  biggest_risk?: string;
  entry_zones?: {
    aggressive?: number;
    conservative?: number;
    stop_loss?: number;
  };
  time_horizon?: string;
  rationale?: string;
}
