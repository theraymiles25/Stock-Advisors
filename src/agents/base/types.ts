// =============================================================================
// Stock Advisors Agent Platform - Core Type System
// =============================================================================
// All core types, enums, and interfaces for the multi-agent stock analysis
// platform. Every agent, pipeline, and orchestration component references
// these shared definitions.
// =============================================================================

// -----------------------------------------------------------------------------
// Agent Identity
// -----------------------------------------------------------------------------

/**
 * Unique identifier for each specialized analysis agent and the master
 * orchestrator that synthesizes their outputs.
 */
export enum AgentId {
  GOLDMAN_SCREENER = 'goldman_screener',
  MORGAN_STANLEY_DCF = 'morgan_stanley_dcf',
  BRIDGEWATER_RISK = 'bridgewater_risk',
  JPMORGAN_EARNINGS = 'jpmorgan_earnings',
  BLACKROCK_PORTFOLIO = 'blackrock_portfolio',
  CITADEL_TECHNICAL = 'citadel_technical',
  HARVARD_DIVIDEND = 'harvard_dividend',
  BAIN_COMPETITIVE = 'bain_competitive',
  RENTECH_PATTERNS = 'rentech_patterns',
  MCKINSEY_MACRO = 'mckinsey_macro',
  SENTINEL_SENTIMENT = 'sentinel_sentiment',
  SUSQUEHANNA_OPTIONS = 'susquehanna_options',
  PERFORMANCE_ANALYST = 'performance_analyst',
  SHORT_TERM_TRADER = 'short_term_trader',
  NEWS_RESEARCH = 'news_research',
  MASTER_ORCHESTRATOR = 'master_orchestrator',
}

/** Array of all agent IDs excluding the master orchestrator */
export const SPECIALIST_AGENT_IDS = Object.values(AgentId).filter(
  (id) => id !== AgentId.MASTER_ORCHESTRATOR
) as AgentId[];

// -----------------------------------------------------------------------------
// Agent Lifecycle Status
// -----------------------------------------------------------------------------

/**
 * Tracks the current execution state of an agent. Used by the UI to
 * display progress indicators and by the pipeline to manage concurrency.
 */
export enum AgentStatus {
  /** Agent is registered but not currently processing */
  IDLE = 'idle',
  /** Agent is building its prompt and preparing the API call */
  THINKING = 'thinking',
  /** Agent is receiving a streaming response from the LLM */
  STREAMING = 'streaming',
  /** Agent has finished and produced output */
  COMPLETE = 'complete',
  /** Agent encountered a fatal error during execution */
  ERROR = 'error',
}

// -----------------------------------------------------------------------------
// Data Requirements
// -----------------------------------------------------------------------------

/**
 * Enumerates every type of market data an agent might need. The data layer
 * uses these to fetch and cache the right API endpoints before an agent runs.
 */
export enum DataRequirement {
  /** Real-time or latest closing quote */
  QUOTE = 'quote',
  /** Daily OHLCV time series (typically 100+ trading days) */
  DAILY_SERIES = 'daily_series',
  /** Weekly OHLCV time series */
  WEEKLY_SERIES = 'weekly_series',
  /** Intraday time series (1-minute or 5-minute intervals) */
  INTRADAY = 'intraday',
  /** Company overview, sector, market cap, PE, etc. */
  FUNDAMENTALS = 'fundamentals',
  /** Quarterly and annual income statements */
  INCOME_STATEMENT = 'income_statement',
  /** Quarterly and annual balance sheets */
  BALANCE_SHEET = 'balance_sheet',
  /** Quarterly and annual cash flow statements */
  CASH_FLOW = 'cash_flow',
  /** Earnings history and upcoming estimates */
  EARNINGS = 'earnings',
  /** Relative Strength Index indicator data */
  TECHNICAL_RSI = 'technical_rsi',
  /** MACD indicator data */
  TECHNICAL_MACD = 'technical_macd',
  /** Bollinger Bands indicator data */
  TECHNICAL_BBANDS = 'technical_bbands',
  /** Simple Moving Average indicator data */
  TECHNICAL_SMA = 'technical_sma',
  /** Exponential Moving Average indicator data */
  TECHNICAL_EMA = 'technical_ema',
  /** News articles and their associated sentiment scores */
  NEWS_SENTIMENT = 'news_sentiment',
  /** Performance data across market sectors */
  SECTOR_PERFORMANCE = 'sector_performance',
}

// -----------------------------------------------------------------------------
// Agent Personality & Capability
// -----------------------------------------------------------------------------

/**
 * Defines the persona an agent adopts when generating analysis. This shapes
 * the tone, language, and presentation style of every response.
 */
export interface AgentPersonality {
  /** The Wall Street firm or institution the agent represents */
  firmName: string;
  /** The fictional analyst's full name */
  agentName: string;
  /** Professional title (e.g., "Sr. Equity Strategist") */
  title: string;
  /** Overall communication tone descriptor */
  tone: string;
  /** Distinctive behavioral traits that surface in analysis */
  quirks: string[];
  /** Signature phrases the agent uses naturally */
  catchphrases: string[];
  /** Hex color used for the agent's avatar in the UI */
  avatarColor: string;
  /** Lucide-react icon name for the agent's avatar */
  avatarIcon: string;
}

/**
 * Full specification of what an agent can do, how it's configured, and
 * what data it needs to operate.
 */
export interface AgentCapability {
  /** Unique agent identifier */
  id: AgentId;
  /** Human-readable agent name */
  name: string;
  /** What this agent specializes in */
  description: string;
  /** The agent's persona configuration */
  personality: AgentPersonality;
  /** Market data endpoints this agent needs before it can run */
  requiredData: DataRequirement[];
  /** Path to the agent's system prompt template file */
  systemPromptPath: string;
  /** Claude model to use (e.g., "claude-sonnet-4-20250514") */
  model: string;
  /** Maximum tokens for the response */
  maxTokens: number;
  /** Sampling temperature (0.0 = deterministic, 1.0 = creative) */
  temperature: number;
}

// -----------------------------------------------------------------------------
// Agent I/O
// -----------------------------------------------------------------------------

/** User preferences that influence agent behavior */
export interface AnalysisPreferences {
  /** User's risk tolerance level */
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  /** Preferred investment time horizon */
  timeHorizon?: 'short' | 'medium' | 'long';
  /** Whether to prioritize dividend income */
  incomeFocused?: boolean;
  /** Sectors to exclude from recommendations */
  excludedSectors?: string[];
  /** Maximum position size as a portfolio percentage */
  maxPositionSize?: number;
}

/**
 * Standard input passed to every agent. Agents may use all or some of these
 * fields depending on their specialty.
 */
export interface AgentInput {
  /** One or more stock ticker symbols to analyze */
  symbols: string[];
  /** Optional natural-language query from the user */
  query?: string;
  /** Additional context such as portfolio holdings or prior analysis */
  context?: Record<string, unknown>;
  /** User-specified analysis preferences */
  preferences?: AnalysisPreferences;
}

/**
 * Token usage statistics returned after an agent completes.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Cost in USD based on the model's pricing */
  estimatedCost: number;
}

/**
 * Standard output produced by every agent after execution completes.
 */
export interface AgentOutput {
  /** Which agent produced this output */
  agentId: AgentId;
  /** ISO timestamp of when the analysis was completed */
  timestamp: string;
  /** Final execution status */
  status: AgentStatus.COMPLETE | AgentStatus.ERROR;
  /** Agent's self-assessed confidence in its analysis (0-100) */
  confidence: number;
  /** Human-readable summary of the analysis */
  summary: string;
  /** Structured data specific to each agent's domain */
  structured: Record<string, unknown>;
  /** Actionable recommendations */
  recommendations: Recommendation[];
  /** Risk warnings or caveats */
  warnings: string[];
  /** Which data requirements were actually consumed */
  dataUsed: DataRequirement[];
  /** LLM token usage for this agent's execution */
  tokenUsage: TokenUsage;
  /** Error message if status is ERROR */
  error?: string;
}

// -----------------------------------------------------------------------------
// Recommendations
// -----------------------------------------------------------------------------

/** The five-level rating scale used across all agents */
export type RecommendationAction =
  | 'STRONG_BUY'
  | 'BUY'
  | 'HOLD'
  | 'SELL'
  | 'STRONG_SELL';

/**
 * A concrete, actionable trade recommendation produced by an agent.
 */
export interface Recommendation {
  /** Ticker symbol this recommendation applies to */
  symbol: string;
  /** The recommended action */
  action: RecommendationAction;
  /** Confidence level for this specific recommendation (0-100) */
  confidence: number;
  /** Projected price target, if applicable */
  targetPrice?: number;
  /** Suggested stop-loss price, if applicable */
  stopLoss?: number;
  /** How long the agent expects this thesis to play out */
  timeHorizon: string;
  /** The reasoning behind this recommendation */
  rationale: string;
}

// -----------------------------------------------------------------------------
// Pipeline Orchestration
// -----------------------------------------------------------------------------

/**
 * A single step in the analysis pipeline. Steps can run in parallel
 * (same phase number) or sequentially (incrementing phase numbers).
 */
export interface PipelineStep {
  /** Which agent runs in this step */
  agentId: AgentId;
  /** Phase number for execution ordering (lower = earlier) */
  phase: number;
  /** Other agent IDs that must complete before this step can start */
  dependsOn: AgentId[];
  /** Whether this step is optional (pipeline continues if it fails) */
  optional: boolean;
  /** Maximum time in milliseconds before this step is killed */
  timeoutMs: number;
}

/**
 * Result of a single pipeline step after execution.
 */
export interface PipelineResult {
  /** The step that was executed */
  step: PipelineStep;
  /** The agent's output, or null if the step failed */
  output: AgentOutput | null;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
  /** Whether this step completed successfully */
  success: boolean;
  /** Error details if the step failed */
  error?: string;
}

// -----------------------------------------------------------------------------
// Master Orchestrator Output
// -----------------------------------------------------------------------------

/**
 * A single entry in the recommended trade timeline.
 */
export interface TimelineEntry {
  /** When to execute (e.g., "Immediately", "Within 1 week", "On next earnings dip") */
  timing: string;
  /** What action to take */
  action: RecommendationAction;
  /** Which symbol */
  symbol: string;
  /** Suggested position size as portfolio percentage */
  positionSize: number;
  /** Brief rationale for this specific timing */
  rationale: string;
}

/**
 * Ordered sequence of recommended trades with timing guidance.
 */
export interface TradeTimeline {
  /** Ordered list of trade entries */
  entries: TimelineEntry[];
  /** Overall strategy description for the timeline */
  strategy: string;
}

/**
 * Documents disagreements between agents on a particular symbol.
 */
export interface ConflictReport {
  /** The symbol where agents disagree */
  symbol: string;
  /** Agents on the bullish side */
  bullishAgents: AgentId[];
  /** Agents on the bearish side */
  bearishAgents: AgentId[];
  /** Agents that are neutral */
  neutralAgents: AgentId[];
  /** How the master resolved the conflict */
  resolution: string;
  /** How significant the disagreement is (0-100) */
  severityScore: number;
}

/**
 * The master orchestrator's final, synthesized recommendation for a symbol.
 */
export interface FinalRecommendation {
  /** Ticker symbol */
  symbol: string;
  /** Consensus action across all agents */
  action: RecommendationAction;
  /** Weighted confidence score (0-100) */
  confidence: number;
  /** Synthesized target price */
  targetPrice?: number;
  /** Synthesized stop-loss */
  stopLoss?: number;
  /** Expected time horizon */
  timeHorizon: string;
  /** Master's synthesized rationale */
  rationale: string;
  /** How many agents contributed to this recommendation */
  agentConsensusCount: number;
  /** Breakdown of which agents recommended what */
  agentBreakdown: Array<{
    agentId: AgentId;
    action: RecommendationAction;
    confidence: number;
    weight: number;
  }>;
}

/**
 * The complete output of the master orchestrator after synthesizing
 * all specialist agent analyses into a unified investment thesis.
 */
export interface MasterOutput {
  /** ISO timestamp of the synthesis */
  timestamp: string;
  /** Individual pipeline step results */
  pipelineResults: PipelineResult[];
  /** Final synthesized recommendations per symbol */
  finalRecommendations: FinalRecommendation[];
  /** Recommended trade execution timeline */
  tradeTimeline: TradeTimeline;
  /** Inter-agent conflict reports */
  conflicts: ConflictReport[];
  /** Executive summary for the user */
  executiveSummary: string;
  /** Overall risk assessment */
  riskAssessment: string;
  /** Aggregate token usage across all agents */
  totalTokenUsage: TokenUsage;
  /** Total wall-clock time for the full pipeline in milliseconds */
  totalDurationMs: number;
}

// -----------------------------------------------------------------------------
// Stock Data Bundle
// -----------------------------------------------------------------------------

/**
 * A bundle of market data keyed by DataRequirement. The data layer populates
 * this before passing it to agents. Each value is the raw API response
 * (typed as `unknown` since shape varies by data source).
 */
export type StockDataBundle = Partial<Record<DataRequirement, unknown>>;

/**
 * Stock data organized by symbol. Top-level key is the ticker symbol,
 * value is that symbol's data bundle.
 */
export type StockDataMap = Record<string, StockDataBundle>;

// -----------------------------------------------------------------------------
// Event Bus Types
// -----------------------------------------------------------------------------

/**
 * All event types emitted through the agent event bus.
 */
export enum AgentEvent {
  /** An agent's status changed */
  AGENT_STATUS_CHANGED = 'agent:status_changed',
  /** An agent finished execution (success or error) */
  AGENT_COMPLETE = 'agent:complete',
  /** An agent emitted a streaming text chunk */
  AGENT_STREAM_CHUNK = 'agent:stream_chunk',
  /** Pipeline progress updated (e.g., "3 of 15 agents complete") */
  PIPELINE_PROGRESS = 'pipeline:progress',
  /** The entire pipeline finished */
  PIPELINE_COMPLETE = 'pipeline:complete',
  /** A data fetch started or completed */
  DATA_FETCH = 'data:fetch',
  /** An error occurred anywhere in the system */
  ERROR = 'error',
}

/** Payload for AGENT_STATUS_CHANGED events */
export interface AgentStatusPayload {
  agentId: AgentId;
  previousStatus: AgentStatus;
  currentStatus: AgentStatus;
  timestamp: string;
}

/** Payload for AGENT_COMPLETE events */
export interface AgentCompletePayload {
  agentId: AgentId;
  output: AgentOutput;
  durationMs: number;
}

/** Payload for AGENT_STREAM_CHUNK events */
export interface AgentStreamChunkPayload {
  agentId: AgentId;
  chunk: string;
  /** Accumulated text so far */
  accumulated: string;
}

/** Payload for PIPELINE_PROGRESS events */
export interface PipelineProgressPayload {
  completedCount: number;
  totalCount: number;
  currentPhase: number;
  activeAgents: AgentId[];
  completedAgents: AgentId[];
}

/** Payload for PIPELINE_COMPLETE events */
export interface PipelineCompletePayload {
  masterOutput: MasterOutput;
  durationMs: number;
}

/** Payload for DATA_FETCH events */
export interface DataFetchPayload {
  requirement: DataRequirement;
  symbol: string;
  status: 'started' | 'complete' | 'error';
  error?: string;
}

/** Payload for ERROR events */
export interface ErrorPayload {
  source: string;
  message: string;
  error?: Error;
  agentId?: AgentId;
}

/** Maps event types to their payload types for full type safety */
export interface AgentEventMap {
  [AgentEvent.AGENT_STATUS_CHANGED]: AgentStatusPayload;
  [AgentEvent.AGENT_COMPLETE]: AgentCompletePayload;
  [AgentEvent.AGENT_STREAM_CHUNK]: AgentStreamChunkPayload;
  [AgentEvent.PIPELINE_PROGRESS]: PipelineProgressPayload;
  [AgentEvent.PIPELINE_COMPLETE]: PipelineCompletePayload;
  [AgentEvent.DATA_FETCH]: DataFetchPayload;
  [AgentEvent.ERROR]: ErrorPayload;
}
