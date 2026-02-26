// =============================================================================
// Stock Advisors - News & Research Agent
// =============================================================================
// News intelligence agent that processes the news landscape, ranks stories by
// market-moving potential, tracks analyst actions, detects SEC filings, monitors
// narrative shifts, and provides a forward-looking event calendar. Functions as
// the "morning briefing" for the agent team.
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
import newsSystemPrompt from '../prompts/system-prompts/news-research.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const NEWS_RESEARCH_CAPABILITY: AgentCapability = {
  id: AgentId.NEWS_RESEARCH,
  name: 'News & Research',
  description:
    'Processes the news landscape to rank stories by market-moving potential, ' +
    'track analyst actions, detect SEC filings, monitor narrative shifts, and ' +
    'provide a forward-looking event calendar for portfolio-relevant catalysts.',
  personality: AGENT_PERSONALITIES[AgentId.NEWS_RESEARCH],
  requiredData: [
    DataRequirement.NEWS_SENTIMENT,
    DataRequirement.QUOTE,
    DataRequirement.DAILY_SERIES,
  ],
  systemPromptPath: 'news-research.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const NEWS_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_news_report',
  description:
    'Submit the complete Bloomberg Intelligence news and research report with structured alert data.',
  input_schema: {
    type: 'object',
    required: [
      'executive_summary',
      'confidence',
      'breaking_alerts',
      'news_digest',
      'sec_filings',
      'analyst_actions',
      'narrative_shifts',
      'events_calendar',
      'recommendations',
      'warnings',
    ],
    properties: {
      executive_summary: {
        type: 'string',
        description: 'A 3-4 sentence intelligence briefing on the current news landscape and key takeaways.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the news analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      breaking_alerts: {
        type: 'array',
        description: 'Most urgent, market-moving news items ranked by signal strength.',
        items: {
          type: 'object',
          properties: {
            headline: {
              type: 'string',
              description: 'Alert headline or summary.',
            },
            source: {
              type: 'string',
              description: 'News source or publication.',
            },
            symbols: {
              type: 'array',
              items: { type: 'string' },
              description: 'Ticker symbols affected by this news.',
            },
            signal_strength: {
              type: 'number',
              description: 'Market-moving potential on 1-10 scale.',
              minimum: 1,
              maximum: 10,
            },
            impact_assessment: {
              type: 'string',
              description: 'Expected impact on the affected stocks.',
            },
            action_required: {
              type: 'boolean',
              description: 'Whether immediate portfolio action is recommended.',
            },
          },
        },
      },
      news_digest: {
        type: 'array',
        description: 'Curated news digest organized by symbol.',
        items: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Ticker symbol this digest entry covers.',
            },
            stories: {
              type: 'array',
              description: 'News stories for this symbol.',
              items: {
                type: 'object',
                properties: {
                  headline: { type: 'string', description: 'Story headline.' },
                  source: { type: 'string', description: 'Publication source.' },
                  sentiment: {
                    type: 'string',
                    enum: ['positive', 'negative', 'neutral'],
                    description: 'Sentiment of the story.',
                  },
                  relevance: {
                    type: 'string',
                    enum: ['direct', 'sector', 'macro'],
                    description: 'How the story relates to the symbol.',
                  },
                },
              },
            },
          },
        },
      },
      sec_filings: {
        type: 'array',
        description: 'Recent SEC filings detected for the stocks under analysis.',
        items: {
          type: 'object',
          properties: {
            filing_type: {
              type: 'string',
              description: 'Filing type (10-K, 10-Q, 8-K, 13-F, Form 4, S-1, etc.).',
            },
            symbol: {
              type: 'string',
              description: 'Company ticker symbol.',
            },
            summary: {
              type: 'string',
              description: 'Summary of the key content in the filing.',
            },
            significance: {
              type: 'string',
              enum: ['high', 'moderate', 'low', 'routine'],
              description: 'Significance of the filing.',
            },
          },
        },
      },
      analyst_actions: {
        type: 'array',
        description: 'Recent analyst rating changes and target price adjustments.',
        items: {
          type: 'object',
          properties: {
            firm: {
              type: 'string',
              description: 'Analyst firm name.',
            },
            analyst: {
              type: 'string',
              description: 'Analyst name if available.',
            },
            action_type: {
              type: 'string',
              description: 'Type of action (upgrade, downgrade, initiation, target_change, reiteration).',
            },
            symbol: {
              type: 'string',
              description: 'Affected stock symbol.',
            },
            previous_rating: {
              type: 'string',
              description: 'Previous rating if applicable.',
            },
            new_rating: {
              type: 'string',
              description: 'New rating if applicable.',
            },
            previous_target: {
              type: 'number',
              description: 'Previous price target.',
            },
            new_target: {
              type: 'number',
              description: 'New price target.',
            },
            rationale: {
              type: 'string',
              description: 'Key rationale from the analyst note.',
            },
          },
        },
      },
      narrative_shifts: {
        type: 'array',
        description: 'Detected or emerging narrative shifts for stocks under analysis.',
        items: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Stock symbol experiencing the narrative shift.',
            },
            from_narrative: {
              type: 'string',
              description: 'The prior dominant market narrative.',
            },
            to_narrative: {
              type: 'string',
              description: 'The emerging or new narrative.',
            },
            catalyst: {
              type: 'string',
              description: 'What triggered the narrative shift.',
            },
            lifecycle_stage: {
              type: 'string',
              enum: ['emerging', 'building', 'consensus', 'late_stage', 'reversing'],
              description: 'Where the new narrative is in its lifecycle.',
            },
            confidence: {
              type: 'number',
              description: 'Confidence that the shift is real vs temporary (0-100).',
              minimum: 0,
              maximum: 100,
            },
          },
        },
      },
      events_calendar: {
        type: 'array',
        description: 'Forward-looking calendar of events that could move the stocks under analysis.',
        items: {
          type: 'object',
          properties: {
            event: {
              type: 'string',
              description: 'Event description.',
            },
            date: {
              type: 'string',
              description: 'Expected date or timeframe.',
            },
            symbols: {
              type: 'array',
              items: { type: 'string' },
              description: 'Symbols most affected.',
            },
            expected_impact: {
              type: 'string',
              enum: ['high', 'moderate', 'low'],
              description: 'Expected magnitude of market impact.',
            },
          },
        },
      },
      recommendations: {
        type: 'array',
        description: 'News-driven investment recommendations.',
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
        description: 'Data quality warnings, speculation vs fact caveats, and information gaps.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// News Research Agent
// -----------------------------------------------------------------------------

export class NewsResearch extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(NEWS_RESEARCH_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): NewsResearch {
    return new NewsResearch(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return newsSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [NEWS_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## News Intelligence Report Request`);
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

      // News sentiment (primary data source for this agent)
      const newsSentiment = this.getDataForSymbol(stockData, symbol, DataRequirement.NEWS_SENTIMENT);
      if (newsSentiment) {
        sections.push('### News & Sentiment Data');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(newsSentiment, 7000));
        sections.push('```');
        sections.push('');
      }

      // Quote for price context
      const quoteData = this.getDataForSymbol(stockData, symbol, DataRequirement.QUOTE);
      if (quoteData) {
        sections.push('### Real-Time Quote');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(quoteData, 3000));
        sections.push('```');
        sections.push('');
      }

      // Daily series for price context
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
      'Using the data above, produce a comprehensive news intelligence report. ' +
      'Rank all news by signal strength, provide a curated digest organized by symbol, ' +
      'flag SEC filings, catalog analyst actions, detect narrative shifts, and compile ' +
      'a forward-looking event calendar. Separate signal from noise. ' +
      'Submit your report using the submit_news_report tool.'
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
    const recs = (parsed.recommendations as NewsRecommendation[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    const recommendations: Recommendation[] = recs.map((rec) => ({
      symbol: rec.symbol ?? 'UNKNOWN',
      action: this.normalizeAction(rec.action),
      confidence: rec.confidence ?? 50,
      targetPrice: rec.target_price,
      stopLoss: rec.stop_loss,
      timeHorizon: rec.time_horizon ?? '1-4 weeks',
      rationale: rec.rationale ?? 'News-driven recommendation.',
    }));

    return {
      agentId: AgentId.NEWS_RESEARCH,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 60,
      summary:
        (parsed.executive_summary as string) ??
        'News intelligence report complete.',
      structured: {
        breakingAlerts: parsed.breaking_alerts ?? [],
        newsDigest: parsed.news_digest ?? [],
        secFilings: parsed.sec_filings ?? [],
        analystActions: parsed.analyst_actions ?? [],
        narrativeShifts: parsed.narrative_shifts ?? [],
        eventsCalendar: parsed.events_calendar ?? [],
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

interface NewsRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}
