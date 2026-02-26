// =============================================================================
// Stock Advisors - Bain Competitive Analysis Agent
// =============================================================================
// Conducts comprehensive competitive strategy analysis using Porter's Five
// Forces, VRIO framework, economic moat assessment, unit economics analysis,
// management quality evaluation, market position mapping, competitive threat
// identification, and value chain analysis.
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
import bainSystemPrompt from '../prompts/system-prompts/bain-competitive.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const BAIN_COMPETITIVE_CAPABILITY: AgentCapability = {
  id: AgentId.BAIN_COMPETITIVE,
  name: 'Bain Competitive Analysis',
  description:
    'Conducts comprehensive competitive strategy analysis using Porter\'s Five Forces, ' +
    'VRIO framework, economic moat assessment, unit economics analysis, management ' +
    'quality evaluation, market position mapping, competitive threats, and value chain analysis.',
  personality: AGENT_PERSONALITIES[AgentId.BAIN_COMPETITIVE],
  requiredData: [
    DataRequirement.FUNDAMENTALS,
    DataRequirement.INCOME_STATEMENT,
    DataRequirement.BALANCE_SHEET,
    DataRequirement.QUOTE,
  ],
  systemPromptPath: 'bain-competitive.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const COMPETITIVE_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_competitive_analysis',
  description:
    'Submit the complete Bain competitive strategy analysis with structured data for each stock analyzed.',
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
          'A 3-4 sentence competitive analysis summary with the headline strategic assessment.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the competitive analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      analyses: {
        type: 'array',
        description: 'Competitive analyses for each stock.',
        items: {
          type: 'object',
          required: ['symbol', 'porters_five_forces', 'moat_assessment', 'action', 'confidence'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action based on competitive analysis',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in this specific analysis (0-100)',
            },
            porters_five_forces: {
              type: 'object',
              description: 'Porter\'s Five Forces analysis',
              properties: {
                threat_of_new_entrants: {
                  type: 'object',
                  properties: {
                    rating: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                    key_barriers: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Key barriers to entry identified',
                    },
                    rationale: { type: 'string' },
                  },
                },
                supplier_power: {
                  type: 'object',
                  properties: {
                    rating: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                    rationale: { type: 'string' },
                  },
                },
                buyer_power: {
                  type: 'object',
                  properties: {
                    rating: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                    rationale: { type: 'string' },
                  },
                },
                threat_of_substitutes: {
                  type: 'object',
                  properties: {
                    rating: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                    key_substitutes: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Direct and indirect substitutes identified',
                    },
                    rationale: { type: 'string' },
                  },
                },
                competitive_rivalry: {
                  type: 'object',
                  properties: {
                    rating: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                    rationale: { type: 'string' },
                  },
                },
                overall_industry_attractiveness: {
                  type: 'string',
                  description: 'Synthesis of five forces into industry attractiveness assessment',
                },
              },
            },
            vrio_analysis: {
              type: 'object',
              description: 'VRIO framework assessment',
              properties: {
                valuable: {
                  type: 'object',
                  properties: {
                    assessment: { type: 'boolean', description: 'Whether resources are valuable' },
                    key_resources: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Specific value-creating assets identified',
                    },
                  },
                },
                rare: {
                  type: 'object',
                  properties: {
                    assessment: { type: 'boolean', description: 'Whether resources are rare' },
                    rationale: { type: 'string' },
                  },
                },
                inimitable: {
                  type: 'object',
                  properties: {
                    assessment: { type: 'boolean', description: 'Whether resources are difficult to imitate' },
                    barriers_to_imitation: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Specific barriers to imitation',
                    },
                  },
                },
                organized: {
                  type: 'object',
                  properties: {
                    assessment: { type: 'boolean', description: 'Whether company is organized to capture value' },
                    rationale: { type: 'string' },
                  },
                },
                verdict: {
                  type: 'string',
                  enum: ['Competitive Disadvantage', 'Competitive Parity', 'Temporary Advantage', 'Sustained Competitive Advantage'],
                  description: 'Overall VRIO classification',
                },
              },
            },
            moat_assessment: {
              type: 'object',
              description: 'Economic moat assessment',
              properties: {
                classification: {
                  type: 'string',
                  enum: ['Wide', 'Narrow', 'None'],
                  description: 'Moat width classification',
                },
                moat_sources: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      source: {
                        type: 'string',
                        enum: ['network_effects', 'switching_costs', 'intangible_assets', 'cost_advantages', 'efficient_scale'],
                      },
                      strength: { type: 'string', enum: ['None', 'Weak', 'Moderate', 'Strong'] },
                      evidence: { type: 'string', description: 'Specific evidence supporting assessment' },
                    },
                  },
                  description: 'Assessment of each moat source',
                },
                moat_trend: {
                  type: 'string',
                  enum: ['widening', 'stable', 'eroding'],
                  description: 'Direction of moat strength over time',
                },
                roic_vs_wacc: { type: 'string', description: 'ROIC vs cost of capital comparison' },
                primary_moat_threat: { type: 'string', description: 'Most likely threat to the moat' },
                erosion_timeline: { type: 'string', description: 'Estimated timeline for moat erosion if applicable' },
              },
            },
            unit_economics: {
              type: 'object',
              description: 'Unit economics analysis',
              properties: {
                gross_margin: { type: 'number', description: 'Gross margin as decimal' },
                contribution_margin: { type: 'number', description: 'Contribution margin as decimal' },
                ltv_cac_ratio: { type: 'number', description: 'LTV to CAC ratio if applicable' },
                unit_economics_trend: {
                  type: 'string',
                  enum: ['improving', 'stable', 'deteriorating'],
                  description: 'Trend in unit economics over time',
                },
                scale_advantages: { type: 'boolean', description: 'Whether company has achieved scale advantages' },
                growth_accretive: { type: 'boolean', description: 'Whether growth improves unit economics' },
                assessment: { type: 'string', description: 'Overall unit economics assessment' },
              },
            },
            management_quality_score: {
              type: 'number',
              description: 'Management quality score from 1 to 100',
              minimum: 1,
              maximum: 100,
            },
            management_assessment: {
              type: 'object',
              description: 'Detailed management quality breakdown',
              properties: {
                strategic_clarity: { type: 'number', description: 'Score 1-100 for strategic clarity' },
                capital_allocation: { type: 'number', description: 'Score 1-100 for capital allocation' },
                execution_consistency: { type: 'number', description: 'Score 1-100 for execution consistency' },
                insider_alignment: { type: 'number', description: 'Score 1-100 for insider ownership alignment' },
                governance_concerns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Any governance red flags',
                },
                key_strengths: { type: 'string', description: 'Management\'s primary strengths' },
                key_weaknesses: { type: 'string', description: 'Management\'s primary weaknesses' },
              },
            },
            market_position: {
              type: 'object',
              description: 'Market position and share analysis',
              properties: {
                estimated_market_share: { type: 'number', description: 'Estimated market share as decimal' },
                share_trend: {
                  type: 'string',
                  enum: ['growing', 'stable', 'declining'],
                  description: 'Market share trajectory',
                },
                top_competitors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      market_share: { type: 'number', description: 'Estimated share as decimal' },
                      positioning: { type: 'string', enum: ['leader', 'challenger', 'niche'] },
                    },
                  },
                  description: 'Top 3-5 competitors with positioning',
                },
                competitive_positioning: { type: 'string', description: 'Price vs differentiation positioning' },
                tam_growth: { type: 'string', description: 'TAM growth trajectory assessment' },
              },
            },
            competitive_threats: {
              type: 'array',
              description: 'Top competitive threats over next 3-5 years',
              items: {
                type: 'object',
                properties: {
                  threat: { type: 'string', description: 'Description of the competitive threat' },
                  category: {
                    type: 'string',
                    enum: ['technology', 'regulatory', 'new_entrant', 'substitute', 'business_model'],
                  },
                  severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
                  timeline: { type: 'string', description: 'When this threat could materialize' },
                  company_preparedness: {
                    type: 'string',
                    enum: ['well_prepared', 'somewhat_prepared', 'unprepared'],
                  },
                },
              },
            },
            value_chain_analysis: {
              type: 'object',
              description: 'Value chain position and power analysis',
              properties: {
                position_in_chain: { type: 'string', description: 'Where the company sits in the value chain' },
                margin_power_location: { type: 'string', description: 'Where margin power resides in the chain' },
                company_controls_margin: { type: 'boolean', description: 'Whether company occupies high-margin positions' },
                vertical_integration: { type: 'string', description: 'Assessment of vertical integration level' },
                upstream_power: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
                downstream_power: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
                value_chain_shifts: { type: 'string', description: 'Any shifts in progress that could alter dynamics' },
              },
            },
            target_price: { type: 'number', description: 'Target price based on competitive positioning' },
            stop_loss: { type: 'number', description: 'Suggested stop-loss price' },
            time_horizon: { type: 'string', description: 'Recommended time horizon' },
            rationale: { type: 'string', description: 'Detailed competitive rationale for the recommendation' },
          },
        },
      },
      recommendations: {
        type: 'array',
        description: 'Actionable competitive-based investment recommendations.',
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
        description: 'Competitive analysis caveats, data limitations, or disclaimers.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Bain Competitive Agent
// -----------------------------------------------------------------------------

export class BainCompetitive extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(BAIN_COMPETITIVE_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): BainCompetitive {
    return new BainCompetitive(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return bainSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [COMPETITIVE_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Competitive Analysis Request`);
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

      sections.push(`## ${symbol} - Company Data`);
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
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the data above, conduct a comprehensive competitive strategy analysis for each symbol. ' +
      'Apply Porter\'s Five Forces, VRIO framework, economic moat assessment, unit economics analysis, ' +
      'management quality evaluation, market position mapping, competitive threat identification, ' +
      'and value chain analysis. ' +
      'Submit your findings using the submit_competitive_analysis tool.'
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
    const analyses = (parsed.analyses as CompetitiveAnalysis[]) ?? [];
    const parsedRecs = (parsed.recommendations as ParsedCompetitiveRecommendation[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    // Prefer the explicit recommendations array; fall back to analyses
    const recommendations: Recommendation[] = parsedRecs.length > 0
      ? parsedRecs.map((rec) => ({
          symbol: rec.symbol ?? 'UNKNOWN',
          action: this.normalizeAction(rec.action),
          confidence: rec.confidence ?? 50,
          targetPrice: rec.target_price,
          stopLoss: rec.stop_loss,
          timeHorizon: rec.time_horizon ?? '6-12 months',
          rationale: rec.rationale ?? 'Competitive analysis recommendation.',
        }))
      : analyses.map((analysis) => ({
          symbol: analysis.symbol ?? 'UNKNOWN',
          action: this.normalizeAction(analysis.action),
          confidence: analysis.confidence ?? 50,
          targetPrice: analysis.target_price,
          stopLoss: analysis.stop_loss,
          timeHorizon: analysis.time_horizon ?? '6-12 months',
          rationale: analysis.rationale ?? 'Competitive analysis complete.',
        }));

    return {
      agentId: AgentId.BAIN_COMPETITIVE,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 70,
      summary: (parsed.executive_summary as string) ?? 'Competitive analysis complete.',
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

interface CompetitiveAnalysis {
  symbol: string;
  action: string;
  confidence: number;
  porters_five_forces?: {
    threat_of_new_entrants?: { rating?: string; key_barriers?: string[]; rationale?: string };
    supplier_power?: { rating?: string; rationale?: string };
    buyer_power?: { rating?: string; rationale?: string };
    threat_of_substitutes?: { rating?: string; key_substitutes?: string[]; rationale?: string };
    competitive_rivalry?: { rating?: string; rationale?: string };
    overall_industry_attractiveness?: string;
  };
  vrio_analysis?: {
    valuable?: { assessment?: boolean; key_resources?: string[] };
    rare?: { assessment?: boolean; rationale?: string };
    inimitable?: { assessment?: boolean; barriers_to_imitation?: string[] };
    organized?: { assessment?: boolean; rationale?: string };
    verdict?: string;
  };
  moat_assessment?: {
    classification?: string;
    moat_sources?: Array<{ source?: string; strength?: string; evidence?: string }>;
    moat_trend?: string;
    roic_vs_wacc?: string;
    primary_moat_threat?: string;
    erosion_timeline?: string;
  };
  unit_economics?: {
    gross_margin?: number;
    contribution_margin?: number;
    ltv_cac_ratio?: number;
    unit_economics_trend?: string;
    scale_advantages?: boolean;
    growth_accretive?: boolean;
    assessment?: string;
  };
  management_quality_score?: number;
  management_assessment?: {
    strategic_clarity?: number;
    capital_allocation?: number;
    execution_consistency?: number;
    insider_alignment?: number;
    governance_concerns?: string[];
    key_strengths?: string;
    key_weaknesses?: string;
  };
  market_position?: {
    estimated_market_share?: number;
    share_trend?: string;
    top_competitors?: Array<{ name?: string; market_share?: number; positioning?: string }>;
    competitive_positioning?: string;
    tam_growth?: string;
  };
  competitive_threats?: Array<{
    threat?: string;
    category?: string;
    severity?: string;
    timeline?: string;
    company_preparedness?: string;
  }>;
  value_chain_analysis?: {
    position_in_chain?: string;
    margin_power_location?: string;
    company_controls_margin?: boolean;
    vertical_integration?: string;
    upstream_power?: string;
    downstream_power?: string;
    value_chain_shifts?: string;
  };
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}

interface ParsedCompetitiveRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}
