// =============================================================================
// Stock Advisors - Sentinel Sentiment Analysis Agent
// =============================================================================
// Open-source intelligence and sentiment analysis agent that quantifies market
// sentiment from news, social media, and analyst actions. Tracks narrative
// shifts, detects information asymmetries, and provides sentiment-based
// directional forecasts across multiple time horizons.
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
import sentinelSystemPrompt from '../prompts/system-prompts/sentinel-sentiment.md?raw';

// -----------------------------------------------------------------------------
// Capability Definition
// -----------------------------------------------------------------------------

const SENTINEL_CAPABILITY: AgentCapability = {
  id: AgentId.SENTINEL_SENTIMENT,
  name: 'Sentinel Sentiment Analysis',
  description:
    'Quantifies market sentiment from news, social media, and analyst data. ' +
    'Tracks narrative shifts, detects information asymmetries between retail ' +
    'and institutional participants, and provides sentiment-based forecasts.',
  personality: AGENT_PERSONALITIES[AgentId.SENTINEL_SENTIMENT],
  requiredData: [
    DataRequirement.NEWS_SENTIMENT,
    DataRequirement.DAILY_SERIES,
    DataRequirement.QUOTE,
  ],
  systemPromptPath: 'sentinel-sentiment.md',
  model: MODEL_DEFAULT,
  maxTokens: 4096,
  temperature: 0.2,
};

// -----------------------------------------------------------------------------
// Tool Schema for Structured Output
// -----------------------------------------------------------------------------

const SENTIMENT_OUTPUT_TOOL: ClaudeTool = {
  name: 'submit_sentiment_analysis',
  description:
    'Submit the complete Sentinel intelligence sentiment analysis with structured sentiment data for each stock.',
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
        description: 'A 3-4 sentence intelligence briefing on the current sentiment landscape.',
      },
      confidence: {
        type: 'number',
        description: 'Overall confidence in the sentiment analysis (0-100).',
        minimum: 0,
        maximum: 100,
      },
      analyses: {
        type: 'array',
        description: 'Sentiment analyses for each stock.',
        items: {
          type: 'object',
          required: ['symbol', 'overall_sentiment_score', 'action', 'confidence'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol' },
            action: {
              type: 'string',
              enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
              description: 'Recommended action based on sentiment analysis',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in this specific analysis (0-100)',
            },
            overall_sentiment_score: {
              type: 'number',
              description: 'Composite sentiment score from -100 (extreme bearish) to +100 (extreme bullish)',
              minimum: -100,
              maximum: 100,
            },
            sentiment_regime: {
              type: 'string',
              enum: ['extreme_fear', 'fear', 'slightly_bearish', 'neutral', 'slightly_bullish', 'greed', 'extreme_greed'],
              description: 'Sentiment regime classification',
            },
            sentiment_confidence: {
              type: 'number',
              description: 'Confidence in the sentiment score based on data density (0-100)',
            },
            vs_historical: { type: 'string', description: 'How current sentiment compares to historical range' },
            news_sentiment_breakdown: {
              type: 'object',
              description: 'News sentiment analysis',
              properties: {
                positive_count: { type: 'number', description: 'Number of positive articles' },
                negative_count: { type: 'number', description: 'Number of negative articles' },
                neutral_count: { type: 'number', description: 'Number of neutral articles' },
                key_themes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Dominant themes driving coverage',
                },
                most_impactful_stories: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      headline: { type: 'string' },
                      sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                      impact_score: { type: 'number', description: 'Market impact score (1-10)' },
                    },
                  },
                },
                coverage_spike: { type: 'boolean', description: 'Whether unusual surge in media coverage detected' },
                sentiment_trend: {
                  type: 'string',
                  enum: ['improving', 'stable', 'deteriorating'],
                  description: 'Direction of news sentiment over recent periods',
                },
                factual_vs_opinion_ratio: { type: 'string', description: 'Ratio of factual reporting vs editorial' },
              },
            },
            social_retail_sentiment: {
              type: 'object',
              description: 'Social media and retail investor sentiment',
              properties: {
                buzz_level: {
                  type: 'number',
                  description: 'Social media attention on 1-10 scale',
                  minimum: 1,
                  maximum: 10,
                },
                trending_topics: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Trending narratives among retail participants',
                },
                retail_institutional_divergence: {
                  type: 'object',
                  properties: {
                    detected: { type: 'boolean', description: 'Whether significant divergence exists' },
                    description: { type: 'string', description: 'Nature of the divergence' },
                    contrarian_signal: { type: 'string', description: 'Contrarian implication if any' },
                  },
                },
                mention_velocity: {
                  type: 'string',
                  enum: ['accelerating', 'stable', 'decelerating'],
                  description: 'Rate of change in social mentions',
                },
                coordinated_campaigns: { type: 'boolean', description: 'Whether coordinated campaigns or viral narratives detected' },
              },
            },
            narrative_tracking: {
              type: 'object',
              description: 'Narrative analysis and shift detection',
              properties: {
                dominant_narrative: { type: 'string', description: 'The current dominant narrative' },
                narrative_momentum: {
                  type: 'string',
                  enum: ['gaining', 'stable', 'losing'],
                  description: 'Strength and direction of narrative momentum',
                },
                shift_detected: { type: 'boolean', description: 'Whether a narrative shift is in progress' },
                new_narrative: { type: 'string', description: 'The emerging narrative if shift detected' },
                lifecycle_stage: {
                  type: 'string',
                  enum: ['emerging', 'building', 'consensus', 'late_stage', 'reversing'],
                  description: 'Where the narrative is in its lifecycle',
                },
                next_likely_shift: { type: 'string', description: 'Predicted next narrative shift' },
                propagation_speed: { type: 'string', description: 'How quickly narratives spread from informed to mainstream' },
              },
            },
            analyst_sentiment: {
              type: 'object',
              description: 'Analyst rating and consensus analysis',
              properties: {
                recent_changes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      firm: { type: 'string' },
                      action: { type: 'string', description: 'upgrade, downgrade, initiation, target change' },
                      details: { type: 'string' },
                    },
                  },
                },
                consensus_direction: {
                  type: 'string',
                  enum: ['increasingly_bullish', 'stable', 'increasingly_bearish', 'mixed'],
                  description: 'Direction of analyst consensus',
                },
                contrarian_calls: { type: 'string', description: 'Notable contrarian analyst positions' },
                quiet_period_detected: { type: 'boolean', description: 'Whether an unusual quiet period in coverage detected' },
              },
            },
            information_asymmetry_signals: {
              type: 'object',
              description: 'Information asymmetry detection between market participants',
              properties: {
                detected: { type: 'boolean', description: 'Whether significant asymmetry detected' },
                description: { type: 'string', description: 'Nature of the information gap' },
                unusual_trading_patterns: { type: 'string', description: 'Any unusual volume or options activity' },
                sentiment_price_divergence: {
                  type: 'object',
                  properties: {
                    detected: { type: 'boolean' },
                    description: { type: 'string', description: 'E.g., bullish sentiment + falling price' },
                    implication: { type: 'string', description: 'What this divergence suggests' },
                  },
                },
                smart_money_alignment: {
                  type: 'string',
                  enum: ['aligned_with_retail', 'opposed_to_retail', 'unclear'],
                  description: 'Whether smart money and retail are aligned or opposed',
                },
                insider_activity: { type: 'string', description: 'Notable insider trading that contradicts sentiment' },
              },
            },
            sentiment_based_forecasts: {
              type: 'object',
              description: 'Sentiment-driven directional forecasts',
              properties: {
                outlook_24h: {
                  type: 'object',
                  properties: {
                    direction: { type: 'string', enum: ['bullish', 'neutral', 'bearish'] },
                    confidence: { type: 'number', minimum: 0, maximum: 100 },
                    rationale: { type: 'string' },
                  },
                },
                outlook_1week: {
                  type: 'object',
                  properties: {
                    direction: { type: 'string', enum: ['bullish', 'neutral', 'bearish'] },
                    confidence: { type: 'number', minimum: 0, maximum: 100 },
                    rationale: { type: 'string' },
                  },
                },
                outlook_1month: {
                  type: 'object',
                  properties: {
                    direction: { type: 'string', enum: ['bullish', 'neutral', 'bearish'] },
                    confidence: { type: 'number', minimum: 0, maximum: 100 },
                    rationale: { type: 'string' },
                  },
                },
                extreme_sentiment_reversal: {
                  type: 'boolean',
                  description: 'Whether sentiment is extreme enough to signal a potential reversal',
                },
                upcoming_catalysts: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Upcoming events that could shock sentiment',
                },
              },
            },
            target_price: { type: 'number', description: 'Sentiment-informed target price' },
            stop_loss: { type: 'number', description: 'Suggested stop-loss price' },
            time_horizon: { type: 'string', description: 'Recommended time horizon' },
            rationale: { type: 'string', description: 'Detailed sentiment rationale' },
          },
        },
      },
      recommendations: {
        type: 'array',
        description: 'Sentiment-based investment recommendations.',
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
        description: 'Sentiment data quality warnings and contrarian risk flags.',
      },
    },
  },
};

// -----------------------------------------------------------------------------
// Sentinel Sentiment Agent
// -----------------------------------------------------------------------------

export class SentinelSentiment extends BaseAgent {
  constructor(claudeClient: IClaudeClient, eventBus: AgentEventBus) {
    super(SENTINEL_CAPABILITY, claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static create(
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ): SentinelSentiment {
    return new SentinelSentiment(claudeClient, eventBus);
  }

  // ---------------------------------------------------------------------------
  // System Prompt Override
  // ---------------------------------------------------------------------------

  protected override loadSystemPromptTemplate(): string {
    return sentinelSystemPrompt;
  }

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  protected override getTools(): ClaudeTool[] {
    return [SENTIMENT_OUTPUT_TOOL];
  }

  // ---------------------------------------------------------------------------
  // User Message Construction
  // ---------------------------------------------------------------------------

  protected buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string {
    const sections: string[] = [];

    sections.push(`## Sentiment Intelligence Analysis Request`);
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

      // News sentiment
      const newsSentiment = this.getDataForSymbol(
        stockData,
        symbol,
        DataRequirement.NEWS_SENTIMENT
      );
      if (newsSentiment) {
        sections.push('### News & Sentiment Data');
        sections.push('```json');
        sections.push(this.formatDataForPrompt(newsSentiment, 6000));
        sections.push('```');
        sections.push('');
      }

      // Daily series for price context
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
    }

    sections.push('---');
    sections.push('');
    sections.push(
      'Using the data above, produce a comprehensive sentiment intelligence report for each symbol. ' +
      'Quantify overall sentiment (-100 to +100), analyze news sentiment breakdown, ' +
      'assess social and retail sentiment, track narrative shifts, review analyst actions, ' +
      'detect information asymmetries, and provide sentiment-based directional forecasts. ' +
      'Submit your findings using the submit_sentiment_analysis tool.'
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
    const analyses = (parsed.analyses as SentimentAnalysis[]) ?? [];
    const parsedRecs = (parsed.recommendations as ParsedSentimentRecommendation[]) ?? [];
    const warnings = (parsed.warnings as string[]) ?? [];

    // Prefer the explicit recommendations array; fall back to analyses
    const recommendations: Recommendation[] = parsedRecs.length > 0
      ? parsedRecs.map((rec) => ({
          symbol: rec.symbol ?? 'UNKNOWN',
          action: this.normalizeAction(rec.action),
          confidence: rec.confidence ?? 50,
          targetPrice: rec.target_price,
          stopLoss: rec.stop_loss,
          timeHorizon: rec.time_horizon ?? '1-4 weeks',
          rationale: rec.rationale ?? 'Sentiment analysis recommendation.',
        }))
      : analyses.map((analysis) => ({
          symbol: analysis.symbol ?? 'UNKNOWN',
          action: this.normalizeAction(analysis.action),
          confidence: analysis.confidence ?? 50,
          targetPrice: analysis.target_price,
          stopLoss: analysis.stop_loss,
          timeHorizon: analysis.time_horizon ?? '1-4 weeks',
          rationale: analysis.rationale ?? 'Sentiment analysis complete.',
        }));

    return {
      agentId: AgentId.SENTINEL_SENTIMENT,
      timestamp: this.now(),
      status: AgentStatus.COMPLETE,
      confidence: (parsed.confidence as number) ?? 60,
      summary:
        (parsed.executive_summary as string) ??
        'Sentiment analysis complete.',
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

interface SentimentAnalysis {
  symbol: string;
  action: string;
  confidence: number;
  overall_sentiment_score?: number;
  sentiment_regime?: string;
  sentiment_confidence?: number;
  vs_historical?: string;
  news_sentiment_breakdown?: {
    positive_count?: number;
    negative_count?: number;
    neutral_count?: number;
    key_themes?: string[];
    most_impactful_stories?: Array<{ headline?: string; sentiment?: string; impact_score?: number }>;
    coverage_spike?: boolean;
    sentiment_trend?: string;
    factual_vs_opinion_ratio?: string;
  };
  social_retail_sentiment?: {
    buzz_level?: number;
    trending_topics?: string[];
    retail_institutional_divergence?: { detected?: boolean; description?: string; contrarian_signal?: string };
    mention_velocity?: string;
    coordinated_campaigns?: boolean;
  };
  narrative_tracking?: {
    dominant_narrative?: string;
    narrative_momentum?: string;
    shift_detected?: boolean;
    new_narrative?: string;
    lifecycle_stage?: string;
    next_likely_shift?: string;
    propagation_speed?: string;
  };
  analyst_sentiment?: {
    recent_changes?: Array<{ firm?: string; action?: string; details?: string }>;
    consensus_direction?: string;
    contrarian_calls?: string;
    quiet_period_detected?: boolean;
  };
  information_asymmetry_signals?: {
    detected?: boolean;
    description?: string;
    unusual_trading_patterns?: string;
    sentiment_price_divergence?: { detected?: boolean; description?: string; implication?: string };
    smart_money_alignment?: string;
    insider_activity?: string;
  };
  sentiment_based_forecasts?: {
    outlook_24h?: { direction?: string; confidence?: number; rationale?: string };
    outlook_1week?: { direction?: string; confidence?: number; rationale?: string };
    outlook_1month?: { direction?: string; confidence?: number; rationale?: string };
    extreme_sentiment_reversal?: boolean;
    upcoming_catalysts?: string[];
  };
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}

interface ParsedSentimentRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon?: string;
  rationale?: string;
}
