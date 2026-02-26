// =============================================================================
// Stock Advisors - BlackRock Portfolio Builder Agent
// =============================================================================
// Designs institutional-quality portfolio allocations with specific ETF/fund
// recommendations, core vs satellite positions, expected return/drawdown
// estimates, rebalancing schedules, tax efficiency strategies, DCA plans,
// benchmark selection, and investment policy statements.
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
import blackrockSystemPrompt from '../prompts/system-prompts/blackrock-portfolio.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const BLACKROCK_PORTFOLIO_CAPABILITY: AgentCapability = {
  id: AgentId.BLACKROCK_PORTFOLIO,
  name: 'BlackRock Portfolio Builder',
  description:
    'Designs institutional-quality portfolio allocations with specific ETF recommendations, ' +
    'core vs satellite structure, expected returns and drawdown analysis, rebalancing rules, ' +
    'tax efficiency strategy, DCA plans, and investment policy statements.',
  personality: AGENT_PERSONALITIES[AgentId.BLACKROCK_PORTFOLIO],
  requiredData: [
    DataRequirement.QUOTE,
    DataRequirement.DAILY_SERIES,
    DataRequirement.FUNDAMENTALS,
    DataRequirement.SECTOR_PERFORMANCE,
  ],
  systemPromptPath: 'blackrock-portfolio.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.3,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const PORTFOLIO_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_portfolio_strategy',
  description:
    'Submit the complete BlackRock portfolio construction strategy with structured allocation data.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'portfolio',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description:
          'A 3-4 sentence portfolio strategy summary with the headline allocation and rationale.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the portfolio strategy (0-100).',
        minimum: 0,
        maximum: 100,
      },
      portfolio: {
        type: 'object',
        description: 'The complete portfolio construction.',
        required: ['allocation', 'expected_metrics', 'rebalancing_rules'],
        properties: {
          allocation: {
            type: 'array',
            description: 'Complete portfolio allocation with ETF recommendations.',
            items: {
              type: 'object',
              properties: {
                asset_class: { type: 'string', description: 'Asset class or sub-class name' },
                percentage: { type: 'number', description: 'Allocation percentage (0-100)' },
                etf_ticker: { type: 'string', description: 'Recommended ETF ticker symbol' },
                etf_name: { type: 'string', description: 'Full ETF name' },
                expense_ratio: { type: 'number', description: 'Expense ratio as decimal (e.g., 0.0003 for 3bps)' },
                role: {
                  type: 'string',
                  enum: ['core', 'satellite'],
                  description: 'Whether this is a core or satellite position',
                },
                rationale: { type: 'string', description: 'Why this specific ETF and allocation' },
                alternative_ticker: { type: 'string', description: 'Alternative ETF for tax-lot purposes' },
              },
            },
          },
          expected_metrics: {
            type: 'object',
            description: 'Expected portfolio risk and return metrics.',
            properties: {
              expected_return_low: { type: 'number', description: 'Low end of expected annualized return as decimal' },
              expected_return_high: { type: 'number', description: 'High end of expected annualized return as decimal' },
              expected_volatility: { type: 'number', description: 'Expected annualized volatility as decimal' },
              max_drawdown_normal: { type: 'number', description: 'Max drawdown under normal conditions as decimal' },
              max_drawdown_stress: { type: 'number', description: 'Max drawdown under stress as decimal' },
              sharpe_ratio: { type: 'number', description: 'Expected Sharpe ratio' },
              vs_60_40_return: { type: 'string', description: 'Comparison to 60/40 benchmark' },
              vs_60_40_risk: { type: 'string', description: 'Risk comparison to 60/40 benchmark' },
            },
          },
          rebalancing_rules: {
            type: 'object',
            description: 'Rebalancing policy and rules.',
            properties: {
              approach: {
                type: 'string',
                enum: ['calendar', 'threshold', 'hybrid'],
                description: 'Rebalancing approach',
              },
              frequency: { type: 'string', description: 'How often to rebalance' },
              threshold_pct: { type: 'number', description: 'Rebalancing band as decimal' },
              estimated_annual_trades: { type: 'number', description: 'Expected number of trades per year' },
              tax_loss_harvesting: { type: 'boolean', description: 'Whether to incorporate TLH' },
            },
          },
          tax_strategy: {
            type: 'object',
            description: 'Tax efficiency recommendations.',
            properties: {
              taxable_account_holdings: {
                type: 'array',
                items: { type: 'string' },
                description: 'ETFs best suited for taxable accounts',
              },
              tax_advantaged_holdings: {
                type: 'array',
                items: { type: 'string' },
                description: 'ETFs best suited for tax-advantaged accounts (IRA/401k)',
              },
              tlh_pairs: {
                type: 'array',
                description: 'Tax-loss harvesting pairs',
                items: {
                  type: 'object',
                  properties: {
                    primary: { type: 'string' },
                    substitute: { type: 'string' },
                  },
                },
              },
              notes: { type: 'string', description: 'Additional tax considerations' },
            },
          },
          dca_plan: {
            type: 'object',
            description: 'Dollar-cost averaging implementation plan.',
            properties: {
              approach: {
                type: 'string',
                enum: ['lump_sum', 'dca', 'hybrid'],
                description: 'Recommended approach',
              },
              timeline_months: { type: 'number', description: 'DCA timeline in months' },
              frequency: { type: 'string', description: 'DCA frequency' },
              rationale: { type: 'string', description: 'Why this approach in current market' },
              acceleration_trigger: { type: 'string', description: 'When to accelerate deployment' },
            },
          },
          benchmark: {
            type: 'object',
            description: 'Selected benchmark for performance measurement.',
            properties: {
              name: { type: 'string', description: 'Benchmark name' },
              ticker: { type: 'string', description: 'Benchmark ETF/index ticker' },
              rationale: { type: 'string', description: 'Why this benchmark is appropriate' },
              historical_return: { type: 'number', description: 'Historical annualized return as decimal' },
              historical_volatility: { type: 'number', description: 'Historical annualized volatility as decimal' },
            },
          },
          policy_statement: {
            type: 'object',
            description: 'Investment Policy Statement summary.',
            properties: {
              objective: { type: 'string', description: 'Investment objective' },
              risk_tolerance: { type: 'string', description: 'Risk tolerance level' },
              time_horizon: { type: 'string', description: 'Investment time horizon' },
              constraints: { type: 'array', items: { type: 'string' }, description: 'Investment constraints' },
              review_frequency: { type: 'string', description: 'How often to review the IPS' },
            },
          },
        },
      },
      stock_specific_recommendations: {
        type: 'array',
        description: 'Recommendations for each requested stock within the portfolio context.',
        items: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
            },
            confidence: { type: 'number' },
            portfolio_role: { type: 'string', description: 'Role in the portfolio (core/satellite/exclude)' },
            suggested_weight: { type: 'number', description: 'Suggested portfolio weight as decimal' },
            rationale: { type: 'string' },
            time_horizon: { type: 'string' },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Portfolio construction caveats, data limitations, or disclaimers.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// BlackRock Portfolio Agent
// -----------------------------------------------------------------------------

export class BlackRockPortfolio extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(BLACKROCK_PORTFOLIO_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): BlackRockPortfolio {
    return new BlackRockPortfolio(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return blackrockSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [PORTFOLIO_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Portfolio Construction Request`);
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

      // Fundamentals
      const fundamentals = this.getDataForSymbol(stockData, symbol, DataRequirement.FUNDAMENTALS);
      if (fundamentals) {
        sections.push('### Company Fundamentals');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(fundamentals, 5000));
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
      'Using the data above, design a complete portfolio allocation strategy. ' +
      'Include specific ETF recommendations with tickers, core vs satellite designation, ' +
      'expected return/drawdown metrics, rebalancing rules, tax strategy, DCA plan, ' +
      'benchmark selection, and an investment policy statement. ' +
      'Also provide specific recommendations for each requested symbol within the portfolio context. ' +
      'Submit your findings using the submit_portfolio_strategy tool.'
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
    const stockRecs = (parsed.stock_specific_recommendations as StockRec[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    const recommendations: Recommendation[] = stockRecs.map((rec) => ({
      symbol: rec.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(rec.action),
      confidence: rec.confidence ?? 50,
      timeHorizon: rec.time_horizon ?? '12+ months',
      rationale: rec.rationale ?? 'Portfolio allocation recommendation.',
    }));

    return {
      agentId: AgentId.BLACKROCK_PORTFOLIO,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'Portfolio strategy complete.',
      structured: {
        portfolio: parsed.portfolio,
        stock_specific_recommendations: stockRecs,
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

interface StockRec {
  symbol: string;
  action: string;
  confidence: number;
  portfolio_role?: string;
  suggested_weight?: number;
  rationale?: string;
  time_horizon?: string;
}
