// =============================================================================
// Stock Advisors - Agent Chat Interface
// =============================================================================
// Chat-style interface for interacting with a single analysis agent. Shows a
// scrollable message history with user messages and agent responses (including
// streaming text). The bottom input bar lets users type queries and submit them
// for analysis. Structured output (recommendations table) appears after the
// streaming text completes.
// =============================================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, AlertCircle, Loader2 } from 'lucide-react';
import { AgentId, AgentStatus, AgentOutput } from '../../agents/base/types';
import { AGENT_PERSONALITIES } from '../../agents/prompts/personalities';
import { useAgentStore } from '../../stores/useAgentStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import AgentAvatar from './AgentAvatar';

// -----------------------------------------------------------------------------
// Message Types
// -----------------------------------------------------------------------------

interface UserMessage {
  role: 'user';
  content: string;
  timestamp: string;
}

interface AgentMessage {
  role: 'agent';
  content: string;
  timestamp: string;
  output?: AgentOutput;
  isStreaming?: boolean;
}

type ChatMessage = UserMessage | AgentMessage;

// -----------------------------------------------------------------------------
// Status Badge
// -----------------------------------------------------------------------------

function StatusBadge({ status }: { status: AgentStatus }) {
  const config: Record<AgentStatus, { label: string; colorClass: string }> = {
    [AgentStatus.IDLE]: {
      label: 'Ready',
      colorClass: 'bg-[var(--color-sa-text-dim)]/20 text-[var(--color-sa-text-dim)]',
    },
    [AgentStatus.THINKING]: {
      label: 'Thinking',
      colorClass: 'bg-[var(--color-sa-amber-dim)] text-[var(--color-sa-amber)]',
    },
    [AgentStatus.STREAMING]: {
      label: 'Analyzing',
      colorClass: 'bg-[var(--color-sa-accent-dim)] text-[var(--color-sa-accent)]',
    },
    [AgentStatus.COMPLETE]: {
      label: 'Complete',
      colorClass: 'bg-[var(--color-sa-green-dim)] text-[var(--color-sa-green)]',
    },
    [AgentStatus.ERROR]: {
      label: 'Error',
      colorClass: 'bg-[var(--color-sa-red-dim)] text-[var(--color-sa-red)]',
    },
  };

  const cfg = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.colorClass}`}
    >
      {status === AgentStatus.THINKING && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current agent-thinking" />
      )}
      {status === AgentStatus.STREAMING && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {cfg.label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Thinking Indicator
// -----------------------------------------------------------------------------

function ThinkingIndicator({ agentName }: { agentName: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex items-center gap-2 rounded-lg bg-[var(--color-sa-bg-tertiary)] px-4 py-3">
        <div className="flex gap-1 agent-thinking">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-sa-amber)]" />
          <span
            className="inline-block h-2 w-2 rounded-full bg-[var(--color-sa-amber)]"
            style={{ animationDelay: '0.2s' }}
          />
          <span
            className="inline-block h-2 w-2 rounded-full bg-[var(--color-sa-amber)]"
            style={{ animationDelay: '0.4s' }}
          />
        </div>
        <span className="text-[13px] text-[var(--color-sa-text-secondary)]">
          {agentName} is analyzing...
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Recommendations Table
// -----------------------------------------------------------------------------

function RecommendationsTable({ output }: { output: AgentOutput }) {
  if (!output.recommendations.length) return null;

  const actionColors: Record<string, string> = {
    STRONG_BUY: 'text-[var(--color-sa-green)] bg-[var(--color-sa-green-dim)]',
    BUY: 'text-[var(--color-sa-green)] bg-[var(--color-sa-green-dim)]',
    HOLD: 'text-[var(--color-sa-amber)] bg-[var(--color-sa-amber-dim)]',
    SELL: 'text-[var(--color-sa-red)] bg-[var(--color-sa-red-dim)]',
    STRONG_SELL: 'text-[var(--color-sa-red)] bg-[var(--color-sa-red-dim)]',
  };

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-sa-border)]">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="border-b border-[var(--color-sa-border)] bg-[var(--color-sa-bg-tertiary)]">
            <th className="px-3 py-2 font-semibold text-[var(--color-sa-text-secondary)]">
              Symbol
            </th>
            <th className="px-3 py-2 font-semibold text-[var(--color-sa-text-secondary)]">
              Action
            </th>
            <th className="px-3 py-2 font-semibold text-[var(--color-sa-text-secondary)]">
              Confidence
            </th>
            <th className="px-3 py-2 font-semibold text-[var(--color-sa-text-secondary)]">
              Target
            </th>
            <th className="px-3 py-2 font-semibold text-[var(--color-sa-text-secondary)]">
              Stop Loss
            </th>
            <th className="px-3 py-2 font-semibold text-[var(--color-sa-text-secondary)] max-w-[240px]">
              Rationale
            </th>
          </tr>
        </thead>
        <tbody>
          {output.recommendations.map((rec, i) => (
            <tr
              key={`${rec.symbol}-${i}`}
              className="border-b border-[var(--color-sa-border)] last:border-b-0"
            >
              <td className="px-3 py-2 font-mono font-semibold text-[var(--color-sa-text-primary)]">
                {rec.symbol}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    actionColors[rec.action] ?? ''
                  }`}
                >
                  {rec.action.replace('_', ' ')}
                </span>
              </td>
              <td className="px-3 py-2 text-[var(--color-sa-text-secondary)]">
                {rec.confidence}%
              </td>
              <td className="px-3 py-2 font-mono text-[var(--color-sa-text-secondary)]">
                {rec.targetPrice ? `$${rec.targetPrice.toFixed(2)}` : '--'}
              </td>
              <td className="px-3 py-2 font-mono text-[var(--color-sa-text-secondary)]">
                {rec.stopLoss ? `$${rec.stopLoss.toFixed(2)}` : '--'}
              </td>
              <td className="max-w-[240px] truncate px-3 py-2 text-[var(--color-sa-text-muted)]">
                {rec.rationale}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Chat Message Bubble
// -----------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[70%] rounded-2xl rounded-br-md bg-[var(--color-sa-accent)] px-4 py-2.5">
          <p className="text-[13px] leading-relaxed text-white">
            {message.content}
          </p>
          <p className="mt-1 text-[10px] text-white/50">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    );
  }

  // Agent message
  return (
    <div className="px-4 py-2">
      <div className="max-w-[85%]">
        <div className="rounded-2xl rounded-bl-md bg-[var(--color-sa-bg-tertiary)] px-4 py-3">
          <div
            className={`text-[13px] leading-relaxed text-[var(--color-sa-text-primary)] whitespace-pre-wrap ${
              message.isStreaming ? 'stream-chunk' : ''
            }`}
          >
            {message.content}
            {message.isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--color-sa-accent)]" />
            )}
          </div>
          {message.output && <RecommendationsTable output={message.output} />}
        </div>
        <p className="mt-1 px-1 text-[10px] text-[var(--color-sa-text-dim)]">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// AgentChat Component
// -----------------------------------------------------------------------------

interface AgentChatProps {
  agentId: AgentId;
}

export default function AgentChat({ agentId }: AgentChatProps) {
  const personality = AGENT_PERSONALITIES[agentId];
  const status = useAgentStore((s) => s.agentStatuses[agentId]);
  const streamingText = useAgentStore((s) => s.streamingText[agentId] ?? '');
  const agentOutput = useAgentStore((s) => s.agentOutputs[agentId] ?? null);
  const appendStreamingText = useAgentStore((s) => s.appendStreamingText);
  const setAgentStatus = useAgentStore((s) => s.setAgentStatus);
  const setAgentOutput = useAgentStore((s) => s.setAgentOutput);
  const clearStreamingText = useAgentStore((s) => s.clearStreamingText);
  const isConfigured = useSettingsStore((s) => s.isConfigured);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change or streaming text updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, status]);

  // When agent finishes streaming, convert streaming text to a finalized message
  useEffect(() => {
    if (status === AgentStatus.COMPLETE && streamingText) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content: streamingText,
          timestamp: new Date().toISOString(),
          output: agentOutput ?? undefined,
          isStreaming: false,
        },
      ]);
      clearStreamingText(agentId);
      setIsSubmitting(false);
    }
  }, [status, streamingText, agentOutput, agentId, clearStreamingText]);

  // When agent errors, show error message
  useEffect(() => {
    if (status === AgentStatus.ERROR) {
      const errorText =
        agentOutput?.error ?? 'An error occurred during analysis.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content: `Analysis failed: ${errorText}`,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        },
      ]);
      clearStreamingText(agentId);
      setIsSubmitting(false);
    }
  }, [status, agentOutput, agentId, clearStreamingText]);

  // Handle message submission
  const handleSend = useCallback(() => {
    const query = inputValue.trim();
    if (!query || isSubmitting) return;

    // Extract stock symbols from the query (basic heuristic: uppercase 1-5 letter words)
    const symbolPattern = /\b[A-Z]{1,5}\b/g;
    const matches = query.match(symbolPattern) ?? [];
    // Filter common English words that match the pattern
    const commonWords = new Set([
      'I', 'A', 'THE', 'AND', 'OR', 'FOR', 'TO', 'IN', 'ON', 'AT', 'IS',
      'IT', 'OF', 'BY', 'AS', 'IF', 'AN', 'BE', 'DO', 'SO', 'UP', 'NO',
      'MY', 'ME', 'WE', 'HE', 'VS', 'ALL', 'TOP', 'CAN', 'HOW', 'ARE',
      'NOT', 'BUT', 'HAS', 'HAD', 'GET', 'WITH', 'WHAT',
    ]);
    const symbols = matches.filter((m) => !commonWords.has(m));

    // Add user message
    const userMsg: UserMessage = {
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSubmitting(true);

    // Set agent to thinking status (simulates the start of execution)
    setAgentStatus(agentId, AgentStatus.THINKING);

    // In production, this would call the agent's execute method through a service.
    // For now, we simulate the transition to streaming to demonstrate the UI flow.
    // The actual integration happens when the pipeline/service layer is connected.
    setTimeout(() => {
      setAgentStatus(agentId, AgentStatus.STREAMING);

      // Simulate a response for demo purposes when API is not configured
      if (!isConfigured) {
        const demoText =
          `I'd be happy to analyze ${symbols.length > 0 ? symbols.join(', ') : 'those stocks'} for you, ` +
          `but I need API keys to be configured first.\n\n` +
          `Please go to Settings and enter your Anthropic API key and Alpha Vantage API key ` +
          `to enable live analysis.\n\n` +
          `Once configured, I'll provide a full institutional-grade screening report including ` +
          `P/E analysis, revenue growth trends, balance sheet health checks, dividend sustainability, ` +
          `competitive moat ratings, bull/bear price targets, and entry zone recommendations.`;

        // Simulate streaming by appending chunks
        let charIndex = 0;
        const chunkSize = 3;
        const interval = setInterval(() => {
          if (charIndex >= demoText.length) {
            clearInterval(interval);
            setAgentStatus(agentId, AgentStatus.COMPLETE);
            return;
          }
          const chunk = demoText.slice(charIndex, charIndex + chunkSize);
          appendStreamingText(agentId, chunk);
          charIndex += chunkSize;
        }, 15);
      }
    }, 800);
  }, [
    inputValue,
    isSubmitting,
    agentId,
    isConfigured,
    setAgentStatus,
    appendStreamingText,
  ]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isBusy =
    status === AgentStatus.THINKING || status === AgentStatus.STREAMING;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] px-4 py-3">
        <AgentAvatar
          avatarColor={personality.avatarColor}
          avatarIcon={personality.avatarIcon}
          size="lg"
          status={status}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold text-[var(--color-sa-text-primary)]">
              {personality.agentName}
            </h2>
            <StatusBadge status={status} />
          </div>
          <p className="truncate text-[12px] text-[var(--color-sa-text-secondary)]">
            {personality.title} &middot; {personality.firmName}
          </p>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto bg-[var(--color-sa-bg-primary)]">
        {/* Welcome message when chat is empty */}
        {messages.length === 0 && !isBusy && (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <AgentAvatar
              avatarColor={personality.avatarColor}
              avatarIcon={personality.avatarIcon}
              size="lg"
              className="mb-4"
            />
            <h3 className="text-[16px] font-semibold text-[var(--color-sa-text-primary)]">
              {personality.agentName}
            </h3>
            <p className="mt-1 text-[13px] text-[var(--color-sa-text-secondary)]">
              {personality.title} at {personality.firmName}
            </p>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-[var(--color-sa-text-muted)]">
              Ask me to screen stocks, analyze fundamentals, or evaluate any
              ticker. Try something like{' '}
              <span className="text-[var(--color-sa-accent)]">
                "Screen AAPL MSFT GOOGL for value opportunities"
              </span>
            </p>
            {!isConfigured && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--color-sa-amber-dim)] px-3 py-2">
                <AlertCircle size={14} className="text-[var(--color-sa-amber)]" />
                <span className="text-[12px] text-[var(--color-sa-amber)]">
                  API keys not configured. Go to Settings to enable live analysis.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Thinking indicator */}
        {status === AgentStatus.THINKING && (
          <ThinkingIndicator agentName={personality.agentName} />
        )}

        {/* Live streaming text (not yet finalized into a message) */}
        {status === AgentStatus.STREAMING && streamingText && (
          <MessageBubble
            message={{
              role: 'agent',
              content: streamingText,
              timestamp: new Date().toISOString(),
              isStreaming: true,
            }}
          />
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] px-4 py-3">
        <div
          className="flex items-center gap-2 rounded-xl bg-[var(--color-sa-bg-tertiary)] px-3 py-2
                     ring-1 ring-[var(--color-sa-border)] transition-shadow duration-150
                     focus-within:ring-[var(--color-sa-accent)]/40"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isBusy
                ? `${personality.agentName} is working...`
                : `Ask ${personality.agentName} to analyze stocks...`
            }
            disabled={isBusy}
            className="flex-1 bg-transparent text-[13px] text-[var(--color-sa-text-primary)]
                       placeholder:text-[var(--color-sa-text-dim)] outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isBusy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                       bg-[var(--color-sa-accent)] text-white transition-all duration-150
                       hover:bg-[var(--color-sa-accent-hover)]
                       disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
