// =============================================================================
// Stock Advisors Agent Platform - Abstract Base Agent
// =============================================================================
// Every specialist agent and the master orchestrator extends this class.
// It handles the full lifecycle: input validation, system prompt construction
// with personality injection, Claude API calls (standard and streaming),
// response parsing, status management, and event emission.
// =============================================================================

import { AgentEventBus } from './AgentEventBus';
import {
  AgentCapability,
  AgentEvent,
  AgentId,
  AgentInput,
  AgentOutput,
  AgentStatus,
  DataRequirement,
  StockDataMap,
  TokenUsage,
} from './types';

// -----------------------------------------------------------------------------
// Claude Client Interface
// -----------------------------------------------------------------------------

// TODO: Replace with proper Anthropic SDK types once ClaudeClient service is built.
// The ClaudeClient service will wrap the Anthropic SDK and provide these methods.
// For now, we define a minimal interface so BaseAgent can be fully implemented.

/** Represents a single message in a Claude conversation */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Tool definition for structured output via tool_use */
export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Options passed to the Claude API */
export interface ClaudeRequestOptions {
  model: string;
  maxTokens: number;
  temperature: number;
  system: string;
  messages: ClaudeMessage[];
  tools?: ClaudeTool[];
  toolChoice?: { type: 'auto' | 'any' | 'tool'; name?: string };
}

/** Token usage returned from the API */
export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

/** A parsed tool use block from Claude's response */
export interface ClaudeToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** A text block from Claude's response */
export interface ClaudeTextBlock {
  type: 'text';
  text: string;
}

/** Full response from the Claude API */
export interface ClaudeResponse {
  id: string;
  content: Array<ClaudeTextBlock | ClaudeToolUseBlock>;
  usage: ClaudeUsage;
  stop_reason: string;
}

/** A chunk emitted during streaming */
export interface ClaudeStreamChunk {
  type: 'text_delta' | 'tool_use' | 'message_stop' | 'usage';
  text?: string;
  toolUse?: ClaudeToolUseBlock;
  usage?: ClaudeUsage;
}

/**
 * Interface for the Claude API client service. The actual implementation
 * will wrap the Anthropic SDK. BaseAgent depends only on this interface.
 */
export interface IClaudeClient {
  /** Send a message and receive the full response */
  createMessage(options: ClaudeRequestOptions): Promise<ClaudeResponse>;

  /** Send a message and receive a stream of chunks */
  createMessageStream(
    options: ClaudeRequestOptions,
    onChunk: (chunk: ClaudeStreamChunk) => void
  ): Promise<ClaudeResponse>;
}

// -----------------------------------------------------------------------------
// Cost Estimation
// -----------------------------------------------------------------------------

/**
 * Rough per-token pricing for cost estimation. These should be updated
 * when model pricing changes. Values are in USD.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-opus-4-20250514': { input: 0.015 / 1000, output: 0.075 / 1000 },
  'claude-haiku-3-20250307': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
};

/** Estimate the cost of a Claude API call based on model and token counts */
function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Find the best pricing match (model IDs may have date suffixes)
  const pricing = Object.entries(MODEL_PRICING).find(([key]) =>
    model.includes(key) || key.includes(model)
  )?.[1] ?? { input: 0.003 / 1000, output: 0.015 / 1000 }; // Default to Sonnet pricing

  return pricing.input * inputTokens + pricing.output * outputTokens;
}

// -----------------------------------------------------------------------------
// BaseAgent
// -----------------------------------------------------------------------------

/**
 * Abstract base class for all analysis agents. Provides the complete
 * execution lifecycle while delegating domain-specific logic to subclasses
 * via abstract methods.
 *
 * Subclasses must implement:
 * - `buildUserMessage(input, stockData)` - Format the user message with data
 * - `buildOutput(parsed, usage)` - Transform Claude's response into AgentOutput
 *
 * Optionally override:
 * - `getTools()` - Define tools for structured output
 * - `getToolChoice()` - Control tool selection behavior
 * - `validateInput(input)` - Add custom input validation
 * - `preprocessData(stockData)` - Transform data before prompt building
 */
export abstract class BaseAgent {
  /** This agent's full capability specification */
  public readonly capability: AgentCapability;

  /** Claude API client for making LLM calls */
  protected readonly claudeClient: IClaudeClient;

  /** Event bus for emitting status updates and results */
  protected readonly eventBus: AgentEventBus;

  /** Current execution status */
  private _status: AgentStatus = AgentStatus.IDLE;

  /** Cached system prompt (loaded once, reused across calls) */
  private cachedSystemPrompt: string | null = null;

  constructor(
    capability: AgentCapability,
    claudeClient: IClaudeClient,
    eventBus: AgentEventBus
  ) {
    this.capability = capability;
    this.claudeClient = claudeClient;
    this.eventBus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Status Management
  // ---------------------------------------------------------------------------

  /** Get the agent's current execution status */
  get status(): AgentStatus {
    return this._status;
  }

  /**
   * Update the agent's status and emit a status change event.
   * Protected so subclasses can manage status for custom workflows.
   */
  protected setStatus(newStatus: AgentStatus): void {
    const previousStatus = this._status;
    this._status = newStatus;

    this.eventBus.emitStatusChange(
      this.capability.id,
      previousStatus,
      newStatus
    );
  }

  // ---------------------------------------------------------------------------
  // Abstract Methods (subclasses must implement)
  // ---------------------------------------------------------------------------

  /**
   * Build the user message that contains the actual analysis request and data.
   * This is where agents inject stock data, format tables, and frame their
   * specific analytical question.
   *
   * @param input - The user's analysis request
   * @param stockData - Pre-fetched market data organized by symbol
   * @returns The formatted user message string
   */
  protected abstract buildUserMessage(
    input: AgentInput,
    stockData: StockDataMap
  ): string;

  /**
   * Transform Claude's parsed response into a structured AgentOutput.
   * Subclasses extract domain-specific fields from the LLM's tool_use
   * response and map them to their output format.
   *
   * @param parsed - The raw parsed data from Claude's tool_use response
   * @param usage - Token usage statistics from the API call
   * @returns A complete AgentOutput object
   */
  protected abstract buildOutput(
    parsed: Record<string, unknown>,
    usage: TokenUsage
  ): AgentOutput;

  // ---------------------------------------------------------------------------
  // Optional Overrides
  // ---------------------------------------------------------------------------

  /**
   * Define tools for structured output via Claude's tool_use feature.
   * Override this to specify the JSON schema for your agent's output format.
   * If not overridden, the agent will use plain text responses.
   */
  protected getTools(): ClaudeTool[] {
    return [];
  }

  /**
   * Control how Claude selects tools. Override to force a specific tool.
   * Default is 'auto' which lets Claude decide.
   */
  protected getToolChoice():
    | { type: 'auto' | 'any' | 'tool'; name?: string }
    | undefined {
    const tools = this.getTools();
    if (tools.length === 0) return undefined;
    // Default: force the agent to use the first tool for structured output
    return { type: 'tool', name: tools[0].name };
  }

  /**
   * Custom input validation. Override to add agent-specific checks.
   * Throw an error to reject the input.
   */
  protected validateInput(input: AgentInput): void {
    if (!input.symbols || input.symbols.length === 0) {
      throw new Error(
        `${this.capability.name} requires at least one symbol to analyze.`
      );
    }
  }

  /**
   * Optional data preprocessing step. Override to transform or augment
   * stock data before it's passed to buildUserMessage.
   */
  protected preprocessData(stockData: StockDataMap): StockDataMap {
    return stockData;
  }

  // ---------------------------------------------------------------------------
  // System Prompt Construction
  // ---------------------------------------------------------------------------

  /**
   * Build the full system prompt by combining the personality preamble
   * with the agent's specific system prompt template.
   *
   * The personality preamble establishes the agent's persona, tone,
   * and behavioral quirks. The system prompt template (loaded from file)
   * contains the domain-specific analytical instructions.
   */
  protected buildSystemPrompt(): string {
    if (this.cachedSystemPrompt) {
      return this.cachedSystemPrompt;
    }

    const { personality } = this.capability;

    // Build the personality preamble
    const personalityBlock = [
      `You are ${personality.agentName}, ${personality.title} at ${personality.firmName}.`,
      ``,
      `COMMUNICATION STYLE:`,
      `- Tone: ${personality.tone}`,
      `- You naturally incorporate these behavioral traits:`,
      ...personality.quirks.map((q) => `  * ${q}`),
      `- You occasionally use these signature phrases when appropriate:`,
      ...personality.catchphrases.map((c) => `  * "${c}"`),
      ``,
      `IMPORTANT: Stay in character throughout your analysis. Your personality`,
      `should come through naturally in how you frame insights, not as forced`,
      `affectation. Prioritize analytical rigor over showmanship.`,
    ].join('\n');

    // Load the domain-specific system prompt template
    // NOTE: In the browser environment, system prompts are loaded differently.
    // The systemPromptPath is resolved at build time via the prompt loader service.
    // For now, we use a placeholder that the prompt loader will replace.
    const domainPrompt = this.loadSystemPromptTemplate();

    const fullPrompt = `${personalityBlock}\n\n---\n\n${domainPrompt}`;
    this.cachedSystemPrompt = fullPrompt;
    return fullPrompt;
  }

  /**
   * Load the system prompt template from the configured path.
   * This is designed to be overridden by a prompt-loading service
   * that resolves the path to actual prompt content.
   *
   * Default implementation returns a generic analytical prompt.
   * In production, the prompt loader injects the real templates.
   */
  protected loadSystemPromptTemplate(): string {
    // This will be replaced by the PromptLoader service at registration time.
    // Each agent subclass can also override this directly.
    return [
      `ANALYTICAL FRAMEWORK:`,
      `Analyze the provided stock data using your specialized expertise.`,
      `Provide clear, actionable insights with confidence levels.`,
      ``,
      `OUTPUT REQUIREMENTS:`,
      `- Always include a confidence score (0-100) for your overall analysis`,
      `- Provide specific recommendations with rationale`,
      `- Flag any warnings or risk factors`,
      `- Reference specific data points to support your conclusions`,
    ].join('\n');
  }

  /**
   * Invalidate the cached system prompt. Call this if the personality
   * or prompt template changes at runtime.
   */
  protected invalidatePromptCache(): void {
    this.cachedSystemPrompt = null;
  }

  // ---------------------------------------------------------------------------
  // Track Record Injection
  // ---------------------------------------------------------------------------

  /**
   * Build a track record context section to append to the user message.
   * Queries the agent's historical recommendations for the requested symbols
   * and formats them as context so the agent can calibrate its confidence.
   *
   * Fails gracefully if the database is not available.
   */
  private async buildTrackRecordContext(symbols: string[]): Promise<string> {
    try {
      // Dynamic import to avoid circular dependencies and graceful failure
      const { getRecentRecommendations, getAgentStatsForSymbol } =
        await import('../../services/database/AgentMemory');

      const sections: string[] = [];

      // Get overall recent history for this agent
      const recent = await getRecentRecommendations(this.capability.id, 10);
      if (recent.length > 0) {
        sections.push('\n---\n');
        sections.push('## Your Track Record (for calibration)');
        sections.push(`You have ${recent.length} recent recommendations on record.`);

        // Summarize by outcome
        const resolved = recent.filter(r => r.outcome && r.outcome !== 'pending');
        const wins = resolved.filter(r => r.outcome === 'win' || r.outcome === 'target_hit');
        if (resolved.length > 0) {
          const winRate = ((wins.length / resolved.length) * 100).toFixed(1);
          sections.push(`Resolved: ${resolved.length}, Win rate: ${winRate}%`);
        }
      }

      // Get symbol-specific history
      for (const symbol of symbols) {
        const symbolHistory = await getAgentStatsForSymbol(this.capability.id, symbol);
        if (symbolHistory.length > 0) {
          sections.push(`\n### Your past calls on ${symbol}:`);
          for (const rec of symbolHistory.slice(0, 5)) {
            const outcomeStr = rec.outcome
              ? `→ ${rec.outcome}${rec.actual_return !== null ? ` (${(rec.actual_return * 100).toFixed(1)}% return)` : ''}`
              : '→ pending';
            sections.push(
              `- ${rec.recommended_at}: ${rec.recommendation} at confidence ${rec.confidence ?? 'N/A'}% ${outcomeStr}`
            );
          }
        }
      }

      if (sections.length === 0) return '';

      sections.push(
        '\nUse this track record to calibrate your confidence. If you were wrong before on similar setups, acknowledge it and adjust accordingly.'
      );

      return sections.join('\n');
    } catch {
      // Database not available — gracefully skip track record injection
      return '';
    }
  }

  // ---------------------------------------------------------------------------
  // Core Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute the full agent analysis pipeline:
   * 1. Validate input
   * 2. Set status to THINKING
   * 3. Preprocess data
   * 4. Build system prompt and user message
   * 5. Call Claude API with tool_use for structured output
   * 6. Parse response and build typed output
   * 7. Emit completion event
   *
   * @param input - The user's analysis request
   * @param stockData - Pre-fetched market data organized by symbol
   * @returns The agent's structured analysis output
   */
  async execute(
    input: AgentInput,
    stockData: StockDataMap
  ): Promise<AgentOutput> {
    const startTime = Date.now();

    try {
      // Step 1: Validate
      this.validateInput(input);

      // Step 2: Set status
      this.setStatus(AgentStatus.THINKING);

      // Step 3: Preprocess data
      const processedData = this.preprocessData(stockData);

      // Step 4: Build prompts
      const systemPrompt = this.buildSystemPrompt();
      let userMessage = this.buildUserMessage(input, processedData);

      // Step 4.5: Inject track record context (if available)
      const trackRecordContext = await this.buildTrackRecordContext(input.symbols);
      if (trackRecordContext) {
        userMessage += trackRecordContext;
      }

      // Step 5: Build API request
      const tools = this.getTools();
      const toolChoice = this.getToolChoice();

      const requestOptions: ClaudeRequestOptions = {
        model: this.capability.model,
        maxTokens: this.capability.maxTokens,
        temperature: this.capability.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        ...(tools.length > 0 && { tools }),
        ...(toolChoice && { toolChoice }),
      };

      // Step 6: Call Claude
      const response = await this.claudeClient.createMessage(requestOptions);

      // Step 7: Parse response
      const parsed = this.parseResponse(response);
      const usage = this.buildTokenUsage(response.usage);

      // Step 8: Build output
      const output = this.buildOutput(parsed, usage);

      // Step 9: Emit completion
      const durationMs = Date.now() - startTime;
      this.setStatus(AgentStatus.COMPLETE);

      this.eventBus.emit(AgentEvent.AGENT_COMPLETE, {
        agentId: this.capability.id,
        output,
        durationMs,
      });

      return output;
    } catch (error) {
      this.setStatus(AgentStatus.ERROR);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.eventBus.emitError(
        this.capability.name,
        errorMessage,
        error instanceof Error ? error : undefined,
        this.capability.id
      );

      // Return an error output rather than throwing, so the pipeline
      // can continue with other agents
      const durationMs = Date.now() - startTime;
      const errorOutput: AgentOutput = {
        agentId: this.capability.id,
        timestamp: new Date().toISOString(),
        status: AgentStatus.ERROR,
        confidence: 0,
        summary: `Analysis failed: ${errorMessage}`,
        structured: {},
        recommendations: [],
        warnings: [`Agent execution failed: ${errorMessage}`],
        dataUsed: [],
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        error: errorMessage,
      };

      this.eventBus.emit(AgentEvent.AGENT_COMPLETE, {
        agentId: this.capability.id,
        output: errorOutput,
        durationMs,
      });

      return errorOutput;
    }
  }

  /**
   * Streaming variant of execute(). Emits text chunks as they arrive
   * from the Claude API, then returns the final output when complete.
   *
   * @param input - The user's analysis request
   * @param stockData - Pre-fetched market data organized by symbol
   * @param onChunk - Callback invoked with each text chunk as it streams
   * @returns The agent's structured analysis output
   */
  async executeStreaming(
    input: AgentInput,
    stockData: StockDataMap,
    onChunk: (chunk: string, accumulated: string) => void
  ): Promise<AgentOutput> {
    const startTime = Date.now();

    try {
      // Validate and prepare
      this.validateInput(input);
      this.setStatus(AgentStatus.THINKING);

      const processedData = this.preprocessData(stockData);
      const systemPrompt = this.buildSystemPrompt();
      let userMessage = this.buildUserMessage(input, processedData);

      // Inject track record context (if available)
      const trackRecordContext = await this.buildTrackRecordContext(input.symbols);
      if (trackRecordContext) {
        userMessage += trackRecordContext;
      }

      const tools = this.getTools();
      const toolChoice = this.getToolChoice();

      const requestOptions: ClaudeRequestOptions = {
        model: this.capability.model,
        maxTokens: this.capability.maxTokens,
        temperature: this.capability.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        ...(tools.length > 0 && { tools }),
        ...(toolChoice && { toolChoice }),
      };

      // Switch to streaming status
      this.setStatus(AgentStatus.STREAMING);

      let accumulated = '';

      // Call Claude with streaming
      const response = await this.claudeClient.createMessageStream(
        requestOptions,
        (chunk: ClaudeStreamChunk) => {
          if (chunk.type === 'text_delta' && chunk.text) {
            accumulated += chunk.text;

            // Invoke the caller's chunk handler
            onChunk(chunk.text, accumulated);

            // Also emit through the event bus for other listeners
            this.eventBus.emit(AgentEvent.AGENT_STREAM_CHUNK, {
              agentId: this.capability.id,
              chunk: chunk.text,
              accumulated,
            });
          }
        }
      );

      // Parse the final response
      const parsed = this.parseResponse(response);
      const usage = this.buildTokenUsage(response.usage);
      const output = this.buildOutput(parsed, usage);

      // Complete
      const durationMs = Date.now() - startTime;
      this.setStatus(AgentStatus.COMPLETE);

      this.eventBus.emit(AgentEvent.AGENT_COMPLETE, {
        agentId: this.capability.id,
        output,
        durationMs,
      });

      return output;
    } catch (error) {
      this.setStatus(AgentStatus.ERROR);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.eventBus.emitError(
        this.capability.name,
        errorMessage,
        error instanceof Error ? error : undefined,
        this.capability.id
      );

      const durationMs = Date.now() - startTime;
      const errorOutput: AgentOutput = {
        agentId: this.capability.id,
        timestamp: new Date().toISOString(),
        status: AgentStatus.ERROR,
        confidence: 0,
        summary: `Streaming analysis failed: ${errorMessage}`,
        structured: {},
        recommendations: [],
        warnings: [`Agent streaming execution failed: ${errorMessage}`],
        dataUsed: [],
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        error: errorMessage,
      };

      this.eventBus.emit(AgentEvent.AGENT_COMPLETE, {
        agentId: this.capability.id,
        output: errorOutput,
        durationMs,
      });

      return errorOutput;
    }
  }

  // ---------------------------------------------------------------------------
  // Response Parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse Claude's response into a structured record. Extracts tool_use
   * blocks for structured output, or falls back to text content.
   */
  private parseResponse(response: ClaudeResponse): Record<string, unknown> {
    // Look for tool_use blocks first (preferred for structured output)
    const toolUseBlock = response.content.find(
      (block): block is ClaudeToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlock) {
      return toolUseBlock.input;
    }

    // Fall back to text content
    const textBlocks = response.content.filter(
      (block): block is ClaudeTextBlock => block.type === 'text'
    );

    const fullText = textBlocks.map((b) => b.text).join('\n');

    // Try to parse the text as JSON (some agents may return JSON without tool_use)
    try {
      const parsed = JSON.parse(fullText);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not JSON, return as raw text
    }

    return {
      rawText: fullText,
      stopReason: response.stop_reason,
    };
  }

  /**
   * Convert Claude's usage format to our TokenUsage type with cost estimation.
   */
  private buildTokenUsage(usage: ClaudeUsage): TokenUsage {
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = estimateCost(
      this.capability.model,
      inputTokens,
      outputTokens
    );

    return { inputTokens, outputTokens, totalTokens, estimatedCost };
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Helper to extract data for a specific symbol and requirement from
   * the stock data map. Returns undefined if not available.
   */
  protected getDataForSymbol(
    stockData: StockDataMap,
    symbol: string,
    requirement: DataRequirement
  ): unknown | undefined {
    return stockData[symbol]?.[requirement];
  }

  /**
   * Helper to check if all required data is available for a given symbol.
   */
  protected hasRequiredData(
    stockData: StockDataMap,
    symbol: string
  ): boolean {
    const bundle = stockData[symbol];
    if (!bundle) return false;

    return this.capability.requiredData.every(
      (req) => bundle[req] !== undefined
    );
  }

  /**
   * Get a list of data requirements that are missing for a symbol.
   */
  protected getMissingData(
    stockData: StockDataMap,
    symbol: string
  ): DataRequirement[] {
    const bundle = stockData[symbol];
    if (!bundle) return [...this.capability.requiredData];

    return this.capability.requiredData.filter(
      (req) => bundle[req] === undefined
    );
  }

  /**
   * Format a data value as a JSON string suitable for inclusion in a prompt.
   * Handles undefined values and large objects gracefully.
   */
  protected formatDataForPrompt(
    data: unknown,
    maxLength: number = 10000
  ): string {
    if (data === undefined || data === null) {
      return '[Data not available]';
    }

    const json = JSON.stringify(data, null, 2);
    if (json.length > maxLength) {
      return json.slice(0, maxLength) + '\n... [truncated]';
    }
    return json;
  }

  /**
   * Create a timestamp in ISO format.
   */
  protected now(): string {
    return new Date().toISOString();
  }
}
