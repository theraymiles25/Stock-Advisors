// =============================================================================
// Stock Advisors - Claude API Client
// =============================================================================
// Wraps the Anthropic SDK to provide typed methods for creating messages
// and streaming responses. Implements the IClaudeClient interface expected
// by BaseAgent.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import type {
  IClaudeClient,
  ClaudeRequestOptions,
  ClaudeResponse,
  ClaudeStreamChunk,
  ClaudeTextBlock,
  ClaudeToolUseBlock,
} from '../../agents/base/BaseAgent';

// Re-export the types so consumers can import from this module directly
export type { ClaudeRequestOptions, ClaudeResponse } from '../../agents/base/BaseAgent';

// -----------------------------------------------------------------------------
// ClaudeClient
// -----------------------------------------------------------------------------

/**
 * Production implementation of the Claude API client. Wraps the
 * `@anthropic-ai/sdk` package and conforms to the IClaudeClient interface
 * used by BaseAgent and the pipeline orchestrator.
 *
 * Usage:
 * ```ts
 * const client = new ClaudeClient('sk-ant-...');
 * const response = await client.createMessage({
 *   model: 'claude-sonnet-4-20250514',
 *   maxTokens: 4096,
 *   temperature: 0.3,
 *   system: 'You are a stock analyst.',
 *   messages: [{ role: 'user', content: 'Analyze AAPL' }],
 * });
 * ```
 */
export class ClaudeClient implements IClaudeClient {
  private readonly client: Anthropic;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new Anthropic({
      apiKey,
      // In a Tauri/browser context, requests are proxied through the backend.
      // The dangerouslyAllowBrowser flag permits direct usage during development.
      dangerouslyAllowBrowser: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Standard (non-streaming) message creation
  // ---------------------------------------------------------------------------

  /**
   * Send a message to Claude and receive the complete response.
   * Maps our internal request options to the Anthropic SDK format.
   */
  async createMessage(options: ClaudeRequestOptions): Promise<ClaudeResponse> {
    try {
      const response = await this.client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        system: options.system,
        messages: options.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        ...(options.tools && options.tools.length > 0 && {
          tools: options.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
          })),
        }),
        ...(options.toolChoice && {
          tool_choice: this.mapToolChoice(options.toolChoice),
        }),
      });

      return this.mapResponse(response);
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Streaming message creation
  // ---------------------------------------------------------------------------

  /**
   * Send a message and stream back text deltas as they arrive. The onChunk
   * callback is invoked for each text delta, tool use block, and the final
   * usage statistics. Returns the fully assembled response when the stream
   * completes.
   */
  async createMessageStream(
    options: ClaudeRequestOptions,
    onChunk: (chunk: ClaudeStreamChunk) => void
  ): Promise<ClaudeResponse> {
    try {
      const stream = this.client.messages.stream({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        system: options.system,
        messages: options.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        ...(options.tools && options.tools.length > 0 && {
          tools: options.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
          })),
        }),
        ...(options.toolChoice && {
          tool_choice: this.mapToolChoice(options.toolChoice),
        }),
      });

      // Listen for text deltas during streaming
      stream.on('text', (text) => {
        onChunk({
          type: 'text_delta',
          text,
        });
      });

      // Wait for the full message to complete
      const finalMessage = await stream.finalMessage();

      // Emit final usage chunk
      onChunk({
        type: 'usage',
        usage: {
          input_tokens: finalMessage.usage.input_tokens,
          output_tokens: finalMessage.usage.output_tokens,
        },
      });

      // Emit message stop
      onChunk({ type: 'message_stop' });

      return this.mapResponse(finalMessage);
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration check
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the client has been initialized with an API key.
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Map our internal tool choice format to the Anthropic SDK format.
   */
  private mapToolChoice(
    choice: NonNullable<ClaudeRequestOptions['toolChoice']>
  ): Anthropic.MessageCreateParams['tool_choice'] {
    if (choice.type === 'tool' && choice.name) {
      return { type: 'tool', name: choice.name };
    }
    return { type: choice.type as 'auto' | 'any' };
  }

  /**
   * Map an Anthropic SDK response to our internal ClaudeResponse format.
   */
  private mapResponse(response: Anthropic.Message): ClaudeResponse {
    const content: Array<ClaudeTextBlock | ClaudeToolUseBlock> =
      response.content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text' as const, text: block.text };
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
        }
        // Fallback for any unknown block types
        return {
          type: 'text' as const,
          text: JSON.stringify(block),
        };
      });

    return {
      id: response.id,
      content,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      stop_reason: response.stop_reason ?? 'end_turn',
    };
  }

  /**
   * Wrap SDK errors in a more descriptive Error with context.
   */
  private wrapError(error: unknown): Error {
    if (error instanceof Anthropic.APIError) {
      const status = error.status;
      const message = error.message;

      if (status === 401) {
        return new Error(
          `Claude API authentication failed. Please check your API key. (${message})`
        );
      }
      if (status === 429) {
        return new Error(
          `Claude API rate limit exceeded. Please wait and try again. (${message})`
        );
      }
      if (status === 529) {
        return new Error(
          `Claude API is temporarily overloaded. Please retry shortly. (${message})`
        );
      }
      return new Error(`Claude API error (${status}): ${message}`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(`Unknown Claude API error: ${String(error)}`);
  }
}
