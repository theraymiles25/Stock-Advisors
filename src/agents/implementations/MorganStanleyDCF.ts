// =============================================================================
// Stock Advisors - Morgan Stanley DCF Valuation Agent
// =============================================================================
// Builds institutional-quality discounted cash flow models with 5-year revenue
// projections, operating margin estimates, WACC calculation, terminal value
// via exit multiple and perpetuity growth, sensitivity analysis, and
// bull/base/bear scenario valuations.
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
import morganStanleySystemPrompt from '../prompts/system-prompts/morgan-stanley-dcf.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const MORGAN_STANLEY_DCF_CAPABILITY: AgentCapability = {
  id: AgentId.MORGAN_STANLEY_DCF,
  name: 'Morgan Stanley DCF Valuation',
  description:
    'Builds rigorous discounted cash flow models with 5-year revenue projections, ' +
    'operating margin estimates, free cash flow builds, WACC calculation, terminal value ' +
    'via exit multiple and perpetuity growth methods, sensitivity analysis, and ' +
    'bull/base/bear scenario valuations.',
  personality: AGENT_PERSONALITIES[AgentId.MORGAN_STANLEY_DCF],
  requiredData: [
    DataRequirement.FUNDAMENTALS,
    DataRequirement.INCOME_STATEMENT,
    DataRequirement.BALANCE_SHEET,
    DataRequirement.CASH_FLOW,
    DataRequirement.QUOTE,
  ],
  systemPromptPath: 'morgan-stanley-dcf.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const DCF_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_dcf_valuation',
  description:
    'Submit the complete Morgan Stanley DCF valuation model with structured data for each stock analyzed.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'valuations',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description:
          'A 3-4 sentence institutional-grade executive summary with the headline valuation verdict.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the DCF analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      valuations: {
        type: 'array',
        description: 'Array of DCF valuations for each stock analyzed.',
        items: {
          type: 'object',
          required: ['symbol', 'dcf_model', 'scenarios', 'verdict', 'action', 'confidence'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action based on DCF valuation',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in this specific valuation (0-100)',
            },
            dcf_model: {
              type: 'object',
              description: 'The core DCF model components',
              properties: {
                revenue_projections: {
                  type: 'array',
                  description: '5-year revenue projections',
                  items: {
                    type: 'object',
                    properties: {
                      year: { type: 'number', description: 'Fiscal year' },
                      revenue: { type: 'number', description: 'Projected revenue in millions USD' },
                      growth_rate: { type: 'number', description: 'YoY growth rate as decimal (e.g., 0.12 for 12%)' },
                    },
                  },
                },
                operating_margins: {
                  type: 'array',
                  description: '5-year operating margin projections',
                  items: {
                    type: 'object',
                    properties: {
                      year: { type: 'number', description: 'Fiscal year' },
                      margin: { type: 'number', description: 'Operating margin as decimal' },
                    },
                  },
                },
                free_cash_flows: {
                  type: 'array',
                  description: '5-year unlevered free cash flow projections',
                  items: {
                    type: 'object',
                    properties: {
                      year: { type: 'number', description: 'Fiscal year' },
                      fcf: { type: 'number', description: 'Unlevered FCF in millions USD' },
                    },
                  },
                },
                wacc: {
                  type: 'object',
                  description: 'WACC calculation components',
                  properties: {
                    cost_of_equity: { type: 'number', description: 'Cost of equity as decimal' },
                    cost_of_debt: { type: 'number', description: 'After-tax cost of debt as decimal' },
                    equity_weight: { type: 'number', description: 'Equity weight in capital structure' },
                    debt_weight: { type: 'number', description: 'Debt weight in capital structure' },
                    wacc: { type: 'number', description: 'Blended WACC as decimal' },
                    risk_free_rate: { type: 'number', description: 'Risk-free rate used' },
                    equity_risk_premium: { type: 'number', description: 'Equity risk premium used' },
                    beta: { type: 'number', description: 'Beta used in CAPM' },
                  },
                },
                terminal_value: {
                  type: 'object',
                  description: 'Terminal value calculations',
                  properties: {
                    exit_multiple_method: {
                      type: 'object',
                      properties: {
                        multiple: { type: 'number', description: 'EV/EBITDA exit multiple used' },
                        terminal_ebitda: { type: 'number', description: 'Terminal year EBITDA in millions' },
                        terminal_value: { type: 'number', description: 'Resulting terminal value in millions' },
                      },
                    },
                    perpetuity_growth_method: {
                      type: 'object',
                      properties: {
                        growth_rate: { type: 'number', description: 'Terminal growth rate as decimal' },
                        terminal_fcf: { type: 'number', description: 'Terminal year FCF in millions' },
                        terminal_value: { type: 'number', description: 'Resulting terminal value in millions' },
                      },
                    },
                    selected_terminal_value: { type: 'number', description: 'The terminal value used in the model (millions)' },
                    terminal_value_pct_of_ev: { type: 'number', description: 'Terminal value as % of enterprise value' },
                  },
                },
                enterprise_value: { type: 'number', description: 'Total enterprise value in millions' },
                equity_value: { type: 'number', description: 'Equity value in millions' },
                implied_share_price: { type: 'number', description: 'DCF-implied share price' },
                current_price: { type: 'number', description: 'Current market price' },
              },
            },
            scenarios: {
              type: 'object',
              description: 'Bull/Base/Bear scenario analysis',
              properties: {
                bull: {
                  type: 'object',
                  properties: {
                    implied_price: { type: 'number', description: 'Bull case implied price' },
                    upside_pct: { type: 'number', description: 'Upside as decimal from current price' },
                    key_assumptions: { type: 'string', description: 'What has to go right' },
                    probability: { type: 'number', description: 'Probability weight (0-1)' },
                  },
                },
                base: {
                  type: 'object',
                  properties: {
                    implied_price: { type: 'number', description: 'Base case implied price' },
                    upside_pct: { type: 'number', description: 'Upside/downside as decimal from current price' },
                    key_assumptions: { type: 'string', description: 'Most likely scenario assumptions' },
                    probability: { type: 'number', description: 'Probability weight (0-1)' },
                  },
                },
                bear: {
                  type: 'object',
                  properties: {
                    implied_price: { type: 'number', description: 'Bear case implied price' },
                    downside_pct: { type: 'number', description: 'Downside as decimal from current price' },
                    key_assumptions: { type: 'string', description: 'What could go wrong' },
                    probability: { type: 'number', description: 'Probability weight (0-1)' },
                  },
                },
                probability_weighted_price: { type: 'number', description: 'Probability-weighted expected price' },
              },
            },
            sensitivity_table: {
              type: 'object',
              description: 'Sensitivity analysis grid',
              properties: {
                wacc_range: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'WACC values across the grid (as decimals)',
                },
                growth_range: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Terminal growth rate values across the grid (as decimals)',
                },
                implied_prices: {
                  type: 'array',
                  description: 'Grid of implied prices [wacc_row][growth_col]',
                  items: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                },
              },
            },
            verdict: {
              type: 'string',
              enum: ['Undervalued', 'Fairly Valued', 'Overvalued'],
              description: 'The valuation verdict',
            },
            margin_of_safety: {
              type: 'number',
              description: 'Margin of safety as decimal (positive = undervalued, negative = overvalued)',
            },
            key_assumptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  assumption: { type: 'string', description: 'The assumption' },
                  impact: { type: 'string', description: 'Impact if wrong by 20%' },
                  is_linchpin: { type: 'boolean', description: 'Whether this is the most critical assumption' },
                },
              },
              description: 'Key assumptions that could break the model',
            },
            target_price: { type: 'number', description: 'Base case target price' },
            stop_loss: { type: 'number', description: 'Suggested stop-loss price' },
            time_horizon: { type: 'string', description: 'Recommended time horizon' },
            rationale: { type: 'string', description: 'Detailed rationale for the recommendation' },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Model risks, data quality caveats, or important disclaimers.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Morgan Stanley DCF Agent
// -----------------------------------------------------------------------------

export class MorganStanleyDCF extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(MORGAN_STANLEY_DCF_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): MorganStanleyDCF {
    return new MorganStanleyDCF(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return morganStanleySystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [DCF_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## DCF Valuation Request`);
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

      sections.push(`## ${symbol} - Financial Data`);
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

      // Income Statement
      const incomeStatement = this.getDataForSymbol(stockData, symbol, DataRequirement.INCOME_STATEMENT);
      if (incomeStatement) {
        sections.push('### Income Statement (Annual & Quarterly)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(incomeStatement, 6000));
        sections.push('```');
        sections.push('');
      }

      // Balance Sheet
      const balanceSheet = this.getDataForSymbol(stockData, symbol, DataRequirement.BALANCE_SHEET);
      if (balanceSheet) {
        sections.push('### Balance Sheet');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(balanceSheet, 6000));
        sections.push('```');
        sections.push('');
      }

      // Cash Flow
      const cashFlow = this.getDataForSymbol(stockData, symbol, DataRequirement.CASH_FLOW);
      if (cashFlow) {
        sections.push('### Cash Flow Statement');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(cashFlow, 6000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the financial data above, build a complete DCF valuation model for each symbol. ' +
      'Include 5-year revenue projections, operating margin estimates, free cash flow builds, ' +
      'WACC calculation, terminal value (both exit multiple and perpetuity growth), ' +
      'sensitivity table, bull/base/bear scenarios, and your verdict. ' +
      'Submit your findings using the submit_dcf_valuation tool.'
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
    const valuations = (parsed.valuations as DCFValuation[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    const recommendations: Recommendation[] = valuations.map((val) => ({
      symbol: val.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(val.action),
      confidence: val.confidence ?? 50,
      targetPrice: val.target_price ?? val.scenarios?.base?.implied_price,
      stopLoss: val.stop_loss,
      timeHorizon: val.time_horizon ?? '12-18 months',
      rationale: val.rationale ?? `DCF verdict: ${val.verdict ?? 'N/A'}`,
    }));

    return {
      agentId: AgentId.MORGAN_STANLEY_DCF,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'DCF valuation analysis complete.',
      structured: {
        valuations,
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

interface DCFValuation {
  symbol: string;
  action: string;
  confidence: number;
  dcf_model?: {
    revenue_projections?: Array<{ year?: number; revenue?: number; growth_rate?: number }>;
    operating_margins?: Array<{ year?: number; margin?: number }>;
    free_cash_flows?: Array<{ year?: number; fcf?: number }>;
    wacc?: {
      cost_of_equity?: number;
      cost_of_debt?: number;
      equity_weight?: number;
      debt_weight?: number;
      wacc?: number;
      risk_free_rate?: number;
      equity_risk_premium?: number;
      beta?: number;
    };
    terminal_value?: {
      exit_multiple_method?: { multiple?: number; terminal_ebitda?: number; terminal_value?: number };
      perpetuity_growth_method?: { growth_rate?: number; terminal_fcf?: number; terminal_value?: number };
      selected_terminal_value?: number;
      terminal_value_pct_of_ev?: number;
    };
    enterprise_value?: number;
    equity_value?: number;
    implied_share_price?: number;
    current_price?: number;
  };
  scenarios?: {
    bull?: { implied_price?: number; upside_pct?: number; key_assumptions?: string; probability?: number };
    base?: { implied_price?: number; upside_pct?: number; key_assumptions?: string; probability?: number };
    bear?: { implied_price?: number; downside_pct?: number; key_assumptions?: string; probability?: number };
    probability_weighted_price?: number;
  };
  sensitivity_table?: {
    wacc_range?: number[];
    growth_range?: number[];
    implied_prices?: number[][];
  };
  verdict?: string;
  margin_of_safety?: number;
  key_assumptions?: Array<{ assumption?: string; impact?: string; is_linchpin?: boolean }>;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}
