// =============================================================================
// Stock Advisors - Analysis Pipeline Page
// =============================================================================
// Full analysis pipeline page where users enter stock symbols, select a workflow
// template, and run multi-agent analysis. Shows real-time pipeline progress with
// agents grouped by tier/phase, and displays synthesized results on completion.
// =============================================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Loader2,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Brain,
  BarChart3,
  ArrowRight,
  Info,
} from 'lucide-react';
import { AgentId, AgentStatus } from '../agents/base/types';
import { AGENT_PERSONALITIES } from '../agents/prompts/personalities';
import { useAgentStore } from '../stores/useAgentStore';
import AgentAvatar from '../components/agents/AgentAvatar';
import {
  WORKFLOWS,
  WORKFLOW_LIST,
  getWorkflowPhases,
  type WorkflowId,
} from '../agents/orchestrator/WorkflowEngine';
import { formatCurrency, formatConfidence } from '../lib/formatters';

// -----------------------------------------------------------------------------
// Status Helpers
// -----------------------------------------------------------------------------

const STATUS_CONFIG: Record<AgentStatus, { label: string; colorClass: string; icon: React.ReactNode }> = {
  [AgentStatus.IDLE]: {
    label: 'Idle',
    colorClass: 'text-[var(--color-sa-text-dim)]',
    icon: <Clock size={12} className="text-[var(--color-sa-text-dim)]" />,
  },
  [AgentStatus.THINKING]: {
    label: 'Thinking',
    colorClass: 'text-[var(--color-sa-amber)]',
    icon: <Brain size={12} className="text-[var(--color-sa-amber)]" />,
  },
  [AgentStatus.STREAMING]: {
    label: 'Analyzing',
    colorClass: 'text-[var(--color-sa-accent)]',
    icon: <Loader2 size={12} className="text-[var(--color-sa-accent)] animate-spin" />,
  },
  [AgentStatus.COMPLETE]: {
    label: 'Complete',
    colorClass: 'text-[var(--color-sa-green)]',
    icon: <CheckCircle2 size={12} className="text-[var(--color-sa-green)]" />,
  },
  [AgentStatus.ERROR]: {
    label: 'Error',
    colorClass: 'text-[var(--color-sa-red)]',
    icon: <XCircle size={12} className="text-[var(--color-sa-red)]" />,
  },
};

// -----------------------------------------------------------------------------
// Pipeline Agent Card
// -----------------------------------------------------------------------------

function PipelineAgentCard({ agentId }: { agentId: AgentId }) {
  const navigate = useNavigate();
  const personality = AGENT_PERSONALITIES[agentId];
  const status = useAgentStore((s) => s.agentStatuses[agentId]);
  const config = STATUS_CONFIG[status];

  return (
    <button
      onClick={() => navigate(`/agent/${agentId}`)}
      className="flex items-center gap-3 rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]
                 px-3 py-2.5 text-left transition-all duration-150
                 hover:border-[var(--color-sa-border-hover)] hover:bg-[var(--color-sa-bg-hover)]"
    >
      <AgentAvatar
        avatarColor={personality.avatarColor}
        avatarIcon={personality.avatarIcon}
        size="sm"
        status={status !== AgentStatus.IDLE ? status : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-[var(--color-sa-text-primary)]">
          {personality.agentName}
        </p>
        <p className="truncate text-[10px] text-[var(--color-sa-text-muted)]">
          {personality.firmName}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {config.icon}
        <span className={`text-[10px] font-medium ${config.colorClass}`}>
          {config.label}
        </span>
      </div>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Progress Bar
// -----------------------------------------------------------------------------

function PipelineProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-[var(--color-sa-bg-tertiary)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-sa-accent)] transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[12px] font-medium text-[var(--color-sa-text-secondary)] tabular-nums whitespace-nowrap">
        {completed} of {total} agents complete
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Results Section
// -----------------------------------------------------------------------------

interface MockRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  targetPrice: number | null;
  stopLoss: number | null;
  timeHorizon: string;
}

function ResultsSection({
  summary,
  recommendations,
  warnings,
}: {
  summary: string;
  recommendations: MockRecommendation[];
  warnings: string[];
}) {
  const actionColor = (action: string) => {
    if (action.includes('BUY')) return 'text-[var(--color-sa-green)]';
    if (action.includes('SELL')) return 'text-[var(--color-sa-red)]';
    return 'text-[var(--color-sa-amber)]';
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={14} className="text-[var(--color-sa-accent)]" />
          <h3 className="text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
            Executive Summary
          </h3>
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--color-sa-text-secondary)]">
          {summary}
        </p>
      </div>

      {/* Recommendations Table */}
      {recommendations.length > 0 && (
        <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-sa-border)]">
            <h3 className="text-[13px] font-semibold text-[var(--color-sa-text-primary)]">
              Final Recommendations
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-sa-border)]">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">Symbol</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">Action</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">Confidence</th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">Target</th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">Stop-Loss</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">Horizon</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--color-sa-border)] last:border-b-0 hover:bg-[var(--color-sa-bg-hover)] transition-colors"
                  >
                    <td className="px-5 py-2.5 text-[13px] font-semibold text-[var(--color-sa-text-primary)]">{rec.symbol}</td>
                    <td className={`px-5 py-2.5 text-[12px] font-semibold ${actionColor(rec.action)}`}>
                      {rec.action.replace('_', ' ')}
                    </td>
                    <td className="px-5 py-2.5 text-[12px] text-[var(--color-sa-text-secondary)]">
                      {rec.confidence}% ({formatConfidence(rec.confidence)})
                    </td>
                    <td className="px-5 py-2.5 text-right text-[12px] text-[var(--color-sa-text-secondary)]">
                      {rec.targetPrice ? formatCurrency(rec.targetPrice) : '--'}
                    </td>
                    <td className="px-5 py-2.5 text-right text-[12px] text-[var(--color-sa-text-secondary)]">
                      {rec.stopLoss ? formatCurrency(rec.stopLoss) : '--'}
                    </td>
                    <td className="px-5 py-2.5 text-[12px] text-[var(--color-sa-text-muted)]">{rec.timeHorizon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-[var(--color-sa-amber)]/30 bg-[var(--color-sa-amber-dim)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-[var(--color-sa-amber)]" />
            <h3 className="text-[13px] font-semibold text-[var(--color-sa-amber)]">
              Warnings
            </h3>
          </div>
          <ul className="space-y-1.5">
            {warnings.map((warning, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-[var(--color-sa-amber)]/80">
                <span className="mr-1">&bull;</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Analysis Page
// -----------------------------------------------------------------------------

export default function AnalysisPage() {
  const [symbols, setSymbols] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowId>('full_analysis');
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const agentStatuses = useAgentStore((s) => s.agentStatuses);
  const pipelineProgress = useAgentStore((s) => s.pipelineProgress);

  const workflow = WORKFLOWS[selectedWorkflow];
  const phases = useMemo(() => getWorkflowPhases(selectedWorkflow), [selectedWorkflow]);

  // Count completed agents from the store
  const completedCount = pipelineProgress?.completed.length ?? 0;
  const totalCount = pipelineProgress?.total ?? workflow.steps.length;

  // Check if all agents for this workflow are complete (for demo purposes, check the store)
  const allWorkflowAgentsComplete = workflow.steps.every(
    (step) => agentStatuses[step.agentId] === AgentStatus.COMPLETE
  );

  const handleRunAnalysis = () => {
    if (!symbols.trim()) return;
    setIsRunning(true);
    setShowResults(false);

    // The UI structure is the important part here.
    // In production, this would call the orchestrator. For now, show the pipeline view.
    // After a brief delay, show "not yet connected" state
    setTimeout(() => {
      setIsRunning(false);
      // If the orchestrator isn't actually running, we'll just show the pipeline idle state
    }, 500);
  };

  const parsedSymbols = symbols
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-[var(--color-sa-text-primary)]">
            Analysis Pipeline
          </h1>
          <p className="mt-1 text-[14px] text-[var(--color-sa-text-secondary)]">
            Run multi-agent stock analysis with configurable workflows
          </p>
        </div>

        {/* Input Section */}
        <div className="mb-8 rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Symbol Input */}
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                Stock Symbols
              </label>
              <input
                type="text"
                value={symbols}
                onChange={(e) => setSymbols(e.target.value)}
                placeholder="AAPL, MSFT, GOOGL"
                className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)]
                           px-3 py-2.5 text-[13px] text-[var(--color-sa-text-primary)]
                           placeholder:text-[var(--color-sa-text-dim)]
                           focus:border-[var(--color-sa-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-sa-accent)]
                           transition-colors"
              />
              <p className="mt-1 text-[11px] text-[var(--color-sa-text-muted)]">
                Enter one or more symbols, separated by commas
              </p>
            </div>

            {/* Workflow Selector */}
            <div className="sm:w-64">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
                Workflow
              </label>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex w-full items-center justify-between rounded-lg border border-[var(--color-sa-border)]
                             bg-[var(--color-sa-bg-primary)] px-3 py-2.5 text-left text-[13px]
                             text-[var(--color-sa-text-primary)] transition-colors
                             hover:border-[var(--color-sa-border-hover)]
                             focus:border-[var(--color-sa-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-sa-accent)]"
                >
                  <span>{workflow.name}</span>
                  <ChevronDown size={14} className="text-[var(--color-sa-text-dim)]" />
                </button>
                {dropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] py-1 shadow-lg">
                    {WORKFLOW_LIST.map((wf) => (
                      <button
                        key={wf.id}
                        onClick={() => {
                          setSelectedWorkflow(wf.id);
                          setDropdownOpen(false);
                        }}
                        className={`flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-[var(--color-sa-bg-hover)]
                          ${wf.id === selectedWorkflow ? 'bg-[var(--color-sa-accent-dim)]' : ''}`}
                      >
                        <span className="text-[12px] font-medium text-[var(--color-sa-text-primary)]">
                          {wf.name}
                        </span>
                        <span className="text-[10px] text-[var(--color-sa-text-muted)]">
                          {wf.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunAnalysis}
              disabled={!symbols.trim() || isRunning}
              className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-sa-accent)]
                         px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-150
                         hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed
                         sm:w-auto"
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              {isRunning ? 'Running...' : 'Run Analysis'}
            </button>
          </div>

          {/* Workflow Info */}
          <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--color-sa-text-muted)]">
            <span>{workflow.steps.length} agents</span>
            <span className="text-[var(--color-sa-text-dim)]">&middot;</span>
            <span>{phases.length} phases</span>
            <span className="text-[var(--color-sa-text-dim)]">&middot;</span>
            <span>~{workflow.estimatedTimeSeconds}s estimated</span>
          </div>
        </div>

        {/* Symbols Preview */}
        {parsedSymbols.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {parsedSymbols.map((sym) => (
              <span
                key={sym}
                className="inline-flex items-center rounded-md bg-[var(--color-sa-accent-dim)] px-2.5 py-1
                           text-[12px] font-semibold text-[var(--color-sa-accent)]"
              >
                {sym}
              </span>
            ))}
          </div>
        )}

        {/* Pipeline Progress */}
        {(isRunning || pipelineProgress) && (
          <div className="mb-6">
            <PipelineProgressBar completed={completedCount} total={totalCount} />
          </div>
        )}

        {/* Pipeline Phase View */}
        <div className="mb-8 space-y-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
            Agent Pipeline
          </h2>
          {phases.map((phaseSteps, phaseIndex) => (
            <div key={phaseIndex}>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-sa-accent-dim)] text-[10px] font-bold text-[var(--color-sa-accent)]">
                  {phaseIndex + 1}
                </span>
                <span className="text-[12px] font-medium text-[var(--color-sa-text-secondary)]">
                  Phase {phaseIndex + 1}
                </span>
                <span className="text-[10px] text-[var(--color-sa-text-muted)]">
                  ({phaseSteps.length} agent{phaseSteps.length !== 1 ? 's' : ''} in parallel)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {phaseSteps.map((step) => (
                  <PipelineAgentCard key={step.agentId} agentId={step.agentId} />
                ))}
              </div>
              {phaseIndex < phases.length - 1 && (
                <div className="mt-4 flex justify-center">
                  <ArrowRight size={16} className="rotate-90 text-[var(--color-sa-text-dim)]" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Not Connected Notice */}
        {!pipelineProgress && !allWorkflowAgentsComplete && (
          <div className="mb-8 rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-sa-accent-dim)]">
                <Info size={16} className="text-[var(--color-sa-accent)]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--color-sa-text-primary)]">
                  Orchestrator not yet connected
                </p>
                <p className="mt-1 text-[12px] text-[var(--color-sa-text-muted)]">
                  The analysis pipeline UI is ready. When the orchestrator engine is running, agents will
                  update in real-time as they process your analysis request. Configure your API keys
                  in Settings to enable live execution.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section (shown when pipeline completes) */}
        {(showResults || allWorkflowAgentsComplete) && (
          <div className="mb-8">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
              Analysis Results
            </h2>
            <ResultsSection
              summary="The analysis pipeline has completed. Individual agent results are available on each agent's detail page. Navigate to any agent card above to see their full analysis output."
              recommendations={[]}
              warnings={[]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
