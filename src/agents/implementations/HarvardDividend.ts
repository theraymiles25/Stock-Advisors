// =============================================================================
// Stock Advisors - Harvard Endowment Dividend Strategy Agent
// =============================================================================
// Evaluates dividend sustainability, growth potential, and total return
// characteristics with yield analysis, payout ratio sustainability, dividend
// growth rate tracking, free cash flow coverage, dividend safety scoring,
// Aristocrat/King status, and total return projections over 10+ year horizons.
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
import harvardSystemPrompt from '../prompts/system-prompts/harvard-dividend.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const HARVARD_DIVIDEND_CAPABILITY: AgentCapability = {
  id: AgentId.HARVARD_DIVIDEND,
  name: 'Harvard Endowment Dividend Strategy',
  description:
    'Evaluates dividend sustainability, growth potential, and total return ' +
    'characteristics with yield analysis, payout ratio sustainability, dividend ' +
    'growth rate tracking, free cash flow coverage, dividend safety scoring (1-100), ' +
    'Aristocrat/King status assessment, and total return projections.',
  personality: AGENT_PERSONALITIES[AgentId.HARVARD_DIVIDEND],
  requiredData: [
    DataRequirement.FUNDAMENTALS,
    DataRequirement.INCOME_STATEMENT,
    DataRequirement.CASH_FLOW,
    DataRequirement.QUOTE,
    DataRequirement.DAILY_SERIES,
  ],
  systemPromptPath: 'harvard-dividend.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const DIVIDEND_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_dividend_analysis',
  description:
    'Submit the complete Harvard Endowment dividend analysis with structured data for each stock analyzed.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'analyses',
      'recommendations',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description:
          'A 3-4 sentence endowment-grade dividend analysis summary with the headline income verdict.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the dividend analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      analyses: {
        type: 'array',
        description: 'Dividend analyses for each stock.',
        items: {
          type: 'object',
          required: ['symbol', 'yield_analysis', 'dividend_safety_score', 'action', 'confidence'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action based on dividend analysis',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in this specific analysis (0-100)',
            },
            yield_analysis: {
              type: 'object',
              description: 'Comprehensive dividend yield analysis',
              properties: {
                forward_yield_pct: { type: 'number', description: 'Forward dividend yield as percentage' },
                trailing_yield_pct: { type: 'number', description: 'Trailing twelve-month yield as percentage' },
                five_year_yield_range: {
                  type: 'object',
                  properties: {
                    low: { type: 'number', description: 'Lowest yield in 5-year range' },
                    high: { type: 'number', description: 'Highest yield in 5-year range' },
                    current_percentile: { type: 'number', description: 'Where current yield sits in range (0-100)' },
                  },
                },
                vs_sector_median: { type: 'string', description: 'Above/below sector median and by how much' },
                vs_sp500_avg: { type: 'string', description: 'Above/below S&P 500 average and by how much' },
                yield_trap_risk: {
                  type: 'string',
                  enum: ['low', 'moderate', 'high'],
                  description: 'Risk that high yield reflects price decline rather than value',
                },
                projected_yield_on_cost_5yr: { type: 'number', description: 'Projected yield on cost in 5 years' },
                projected_yield_on_cost_10yr: { type: 'number', description: 'Projected yield on cost in 10 years' },
              },
            },
            payout_ratio: {
              type: 'object',
              description: 'Payout ratio sustainability analysis',
              properties: {
                earnings_payout_ratio: { type: 'number', description: 'Payout ratio from earnings as decimal' },
                fcf_payout_ratio: { type: 'number', description: 'Payout ratio from FCF as decimal' },
                five_year_trend: {
                  type: 'string',
                  enum: ['declining', 'stable', 'rising'],
                  description: 'Payout ratio trend over 5 years',
                },
                sustainability_assessment: {
                  type: 'string',
                  enum: ['Conservative', 'Moderate', 'Elevated', 'Stressed'],
                  description: 'Overall sustainability classification',
                },
                margin_of_safety: { type: 'number', description: 'How much earnings could decline before dividend at risk (as decimal)' },
                exceeded_fcf: { type: 'boolean', description: 'Whether dividends exceeded FCF in any recent year' },
              },
            },
            dividend_growth_rate: {
              type: 'object',
              description: 'Dividend growth rate analysis',
              properties: {
                cagr_3yr: { type: 'number', description: '3-year dividend CAGR as decimal' },
                cagr_5yr: { type: 'number', description: '5-year dividend CAGR as decimal' },
                cagr_10yr: { type: 'number', description: '10-year dividend CAGR as decimal (if available)' },
                growth_trend: {
                  type: 'string',
                  enum: ['accelerating', 'stable', 'decelerating'],
                  description: 'Direction of growth rate trajectory',
                },
                vs_earnings_growth: { type: 'string', description: 'How dividend growth compares to earnings growth' },
                forward_growth_estimate: { type: 'number', description: 'Projected annual dividend growth rate as decimal' },
                consecutive_increase_years: { type: 'number', description: 'Years of consecutive dividend increases' },
              },
            },
            free_cash_flow_coverage: {
              type: 'object',
              description: 'FCF dividend coverage analysis',
              properties: {
                coverage_ratio: { type: 'number', description: 'FCF / Total Dividends Paid ratio' },
                coverage_assessment: {
                  type: 'string',
                  enum: ['strong', 'adequate', 'concerning', 'insufficient'],
                  description: 'Coverage quality: >2.0x strong, 1.5-2.0x adequate, <1.5x concerning',
                },
                five_year_trend: {
                  type: 'string',
                  enum: ['improving', 'stable', 'deteriorating'],
                  description: 'Coverage ratio trend over 5 years',
                },
                fcf_quality: { type: 'string', description: 'Assessment of FCF quality (recurring vs one-time)' },
                can_fund_growth: { type: 'boolean', description: 'Whether FCF supports both dividend growth and operations' },
              },
            },
            dividend_safety_score: {
              type: 'number',
              description: 'Composite dividend safety score from 1 (extremely unsafe) to 100 (fortress safe)',
              minimum: 1,
              maximum: 100,
            },
            safety_score_breakdown: {
              type: 'object',
              description: 'Breakdown of the safety score by component',
              properties: {
                payout_ratio_score: { type: 'number', description: 'Score from payout ratio (0-25)' },
                fcf_coverage_score: { type: 'number', description: 'Score from FCF coverage (0-25)' },
                balance_sheet_score: { type: 'number', description: 'Score from balance sheet strength (0-20)' },
                earnings_stability_score: { type: 'number', description: 'Score from earnings stability (0-15)' },
                track_record_score: { type: 'number', description: 'Score from dividend track record (0-15)' },
                weakest_factor: { type: 'string', description: 'The weakest factor in the safety assessment' },
                red_flags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Any immediate red flags identified',
                },
              },
            },
            dividend_aristocrat_status: {
              type: 'object',
              description: 'Dividend Aristocrat / King status assessment',
              properties: {
                classification: {
                  type: 'string',
                  enum: ['Dividend King', 'Dividend Aristocrat', 'Dividend Achiever', 'Rising Dividend', 'New Dividend', 'Non-Dividend'],
                  description: 'Dividend streak classification',
                },
                consecutive_years: { type: 'number', description: 'Years of consecutive increases' },
                years_to_aristocrat: { type: 'number', description: 'Years remaining to reach Aristocrat status (0 if already)' },
                streak_likelihood: {
                  type: 'string',
                  enum: ['very_likely', 'likely', 'uncertain', 'at_risk'],
                  description: 'Likelihood the streak continues',
                },
                past_cuts: { type: 'boolean', description: 'Whether the company has cut dividends in its history' },
              },
            },
            total_return_projection: {
              type: 'object',
              description: 'Total return projection combining income and appreciation',
              properties: {
                five_year_total_return_pct: { type: 'number', description: 'Projected 5-year total return as decimal' },
                ten_year_total_return_pct: { type: 'number', description: 'Projected 10-year total return as decimal' },
                income_component_pct: { type: 'number', description: 'Income contribution to total return as decimal' },
                capital_component_pct: { type: 'number', description: 'Capital appreciation contribution as decimal' },
                vs_market_index: { type: 'string', description: 'How projected return compares to broad market' },
                vs_bond_alternative: { type: 'string', description: 'How projected return compares to bond yields' },
                tax_efficiency: {
                  type: 'string',
                  enum: ['qualified', 'ordinary', 'mixed'],
                  description: 'Tax treatment of the dividend',
                },
                breakeven_price_decline: { type: 'number', description: 'Maximum price decline for positive 5-year total return (as decimal)' },
              },
            },
            target_price: { type: 'number', description: 'Target price based on dividend valuation' },
            stop_loss: { type: 'number', description: 'Suggested stop-loss price' },
            time_horizon: { type: 'string', description: 'Recommended time horizon' },
            rationale: { type: 'string', description: 'Detailed rationale for the recommendation' },
          },
        },
      },
      recommendations: {
        type: 'array',
        description: 'Actionable dividend-based investment recommendations.',
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
        description: 'Dividend strategy caveats, yield trap warnings, or important disclaimers.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Harvard Dividend Agent
// -----------------------------------------------------------------------------

export class HarvardDividend extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(HARVARD_DIVIDEND_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): HarvardDividend {
    return new HarvardDividend(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return harvardSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [DIVIDEND_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Dividend Analysis Request`);
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
      if (input.preferences.incomeFocused !== undefined) {
        sections.push(`- Income Focused: ${input.preferences.incomeFocused ? 'Yes' : 'No'}`);
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
        sections.push(this.formatDataForPrompt(incomeStatement, 5000));
        sections.push('```');
        sections.push('');
      }

      // Cash Flow
      const cashFlow = this.getDataForSymbol(stockData, symbol, DataRequirement.CASH_FLOW);
      if (cashFlow) {
        sections.push('### Cash Flow Statement');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(cashFlow, 5000));
        sections.push('```');
        sections.push('');
      }

      // Daily series
      const dailySeries = this.getDataForSymbol(stockData, symbol, DataRequirement.DAILY_SERIES);
      if (dailySeries) {
        sections.push('### Daily Price Series (Recent)');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(dailySeries, 3000));
        sections.push('```');
        sections.push('');
      }
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the financial data above, produce a comprehensive dividend analysis for each symbol. ' +
      'Evaluate yield analysis, payout ratio sustainability, dividend growth rate, ' +
      'free cash flow coverage, dividend safety score (1-100), Aristocrat/King status, ' +
      'and total return projections. ' +
      'Submit your findings using the submit_dividend_analysis tool.'
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
    const analyses = (parsed.analyses as DividendAnalysis[]) ?? [];
    const parsedRecs = (parsed.recommendations as ParsedDividendRecommendation[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    // Prefer the explicit recommendations array; fall back to analyses
    const recommendations: Recommendation[] = parsedRecs.length > 0
      ? parsedRecs.map((rec) => ({
          symbol: rec.symbol ?? 'UNKNOWN',
          action: this.normalizeAction(rec.action),
          confidence: rec.confidence ?? 50,
          targetPrice: rec.target_price,
          stopLoss: rec.stop_loss,
          timeHorizon: rec.time_horizon ?? '10+ years',
          rationale: rec.rationale ?? 'Dividend income recommendation.',
        }))
      : analyses.map((analysis) => ({
          symbol: analysis.symbol ?? 'UNKNOWN',
          action: this.normalizeAction(analysis.action),
          confidence: analysis.confidence ?? 50,
          targetPrice: analysis.target_price,
          stopLoss: analysis.stop_loss,
          timeHorizon: analysis.time_horizon ?? '10+ years',
          rationale: analysis.rationale ?? 'Dividend analysis complete.',
        }));

    return {
      agentId: AgentId.HARVARD_DIVIDEND,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'Dividend analysis complete.',
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

interface DividendAnalysis {
  symbol: string;
  action: string;
  confidence: number;
  yield_analysis?: {
    forward_yield_pct?: number;
    trailing_yield_pct?: number;
    five_year_yield_range?: { low?: number; high?: number; current_percentile?: number };
    vs_sector_median?: string;
    vs_sp500_avg?: string;
    yield_trap_risk?: string;
    projected_yield_on_cost_5yr?: number;
    projected_yield_on_cost_10yr?: number;
  };
  payout_ratio?: {
    earnings_payout_ratio?: number;
    fcf_payout_ratio?: number;
    five_year_trend?: string;
    sustainability_assessment?: string;
    margin_of_safety?: number;
    exceeded_fcf?: boolean;
  };
  dividend_growth_rate?: {
    cagr_3yr?: number;
    cagr_5yr?: number;
    cagr_10yr?: number;
    growth_trend?: string;
    vs_earnings_growth?: string;
    forward_growth_estimate?: number;
    consecutive_increase_years?: number;
  };
  free_cash_flow_coverage?: {
    coverage_ratio?: number;
    coverage_assessment?: string;
    five_year_trend?: string;
    fcf_quality?: string;
    can_fund_growth?: boolean;
  };
  dividend_safety_score?: number;
  safety_score_breakdown?: {
    payout_ratio_score?: number;
    fcf_coverage_score?: number;
    balance_sheet_score?: number;
    earnings_stability_score?: number;
    track_record_score?: number;
    weakest_factor?: string;
    red_flags?: string[];
  };
  dividend_aristocrat_status?: {
    classification?: string;
    consecutive_years?: number;
    years_to_aristocrat?: number;
    streak_likelihood?: string;
    past_cuts?: boolean;
  };
  total_return_projection?: {
    five_year_total_return_pct?: number;
    ten_year_total_return_pct?: number;
    income_component_pct?: number;
    capital_component_pct?: number;
    vs_market_index?: string;
    vs_bond_alternative?: string;
    tax_efficiency?: string;
    breakeven_price_decline?: number;
  };
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}

interface ParsedDividendRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}
