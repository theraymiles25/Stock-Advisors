// =============================================================================
// Stock Advisors - Settings Page
// =============================================================================
// Configuration page for API keys, paper trading capital, and monitoring
// preferences. All values persist to localStorage via useSettingsStore.
// =============================================================================

import { useState } from 'react';
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  DollarSign,
  Clock,
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { formatCurrency } from '../lib/formatters';

// -----------------------------------------------------------------------------
// API Key Input
// -----------------------------------------------------------------------------

interface ApiKeyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function ApiKeyInput({ label, value, onChange, placeholder }: ApiKeyInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isSet = value.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-[var(--color-sa-text-primary)]">
          {label}
        </label>
        {/* Status indicator */}
        <span className="flex items-center gap-1">
          {isSet ? (
            <>
              <Check size={12} className="text-[var(--color-sa-green)]" />
              <span className="text-[11px] text-[var(--color-sa-green)]">
                Configured
              </span>
            </>
          ) : (
            <>
              <X size={12} className="text-[var(--color-sa-red)]" />
              <span className="text-[11px] text-[var(--color-sa-red)]">
                Missing
              </span>
            </>
          )}
        </span>
      </div>

      <div
        className="flex items-center gap-2 rounded-lg bg-[var(--color-sa-bg-tertiary)] px-3 py-2
                   ring-1 ring-[var(--color-sa-border)] transition-shadow duration-150
                   focus-within:ring-[var(--color-sa-accent)]/40"
      >
        <Key size={14} className="shrink-0 text-[var(--color-sa-text-dim)]" />
        <input
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[13px] text-[var(--color-sa-text-primary)]
                     placeholder:text-[var(--color-sa-text-dim)] outline-none font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setIsVisible((v) => !v)}
          className="shrink-0 rounded p-1 text-[var(--color-sa-text-dim)]
                     hover:bg-[var(--color-sa-bg-hover)] hover:text-[var(--color-sa-text-secondary)]
                     transition-colors duration-100"
          title={isVisible ? 'Hide key' : 'Show key'}
        >
          {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Section Wrapper
// -----------------------------------------------------------------------------

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ icon, title, description, children }: SectionProps) {
  return (
    <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-[14px] font-semibold text-[var(--color-sa-text-primary)]">
            {title}
          </h3>
        </div>
        <p className="mt-1 text-[12px] text-[var(--color-sa-text-muted)]">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Polling Interval Options
// -----------------------------------------------------------------------------

const POLLING_OPTIONS = [
  { label: '5 minutes', value: 5 * 60 * 1000 },
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '30 minutes', value: 30 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
];

// -----------------------------------------------------------------------------
// Settings Page
// -----------------------------------------------------------------------------

export default function SettingsPage() {
  const anthropicApiKey = useSettingsStore((s) => s.anthropicApiKey);
  const alphaVantageKey = useSettingsStore((s) => s.alphaVantageKey);
  const paperTradingCapital = useSettingsStore((s) => s.paperTradingCapital);
  const newsPollingInterval = useSettingsStore((s) => s.newsPollingInterval);
  const setAnthropicApiKey = useSettingsStore((s) => s.setAnthropicApiKey);
  const setAlphaVantageKey = useSettingsStore((s) => s.setAlphaVantageKey);
  const setPaperTradingCapital = useSettingsStore((s) => s.setPaperTradingCapital);
  const setNewsPollingInterval = useSettingsStore((s) => s.setNewsPollingInterval);
  const isConfigured = useSettingsStore((s) => s.isConfigured);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5">
            <Settings
              size={20}
              className="text-[var(--color-sa-text-secondary)]"
              strokeWidth={1.8}
            />
            <h1 className="text-[22px] font-bold text-[var(--color-sa-text-primary)]">
              Settings
            </h1>
          </div>
          <p className="mt-1 text-[13px] text-[var(--color-sa-text-secondary)]">
            Configure API keys, trading parameters, and monitoring preferences.
          </p>
        </div>

        {/* Configuration Status Banner */}
        {!isConfigured && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-sa-amber)]/30 bg-[var(--color-sa-amber-dim)] px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-sa-amber)]/20">
              <Key size={16} className="text-[var(--color-sa-amber)]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-[var(--color-sa-amber)]">
                API keys required
              </p>
              <p className="text-[12px] text-[var(--color-sa-amber)]/70">
                Both the Anthropic and Alpha Vantage API keys must be set before
                agents can run live analysis.
              </p>
            </div>
          </div>
        )}

        {isConfigured && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-sa-green)]/30 bg-[var(--color-sa-green-dim)] px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-sa-green)]/20">
              <Check size={16} className="text-[var(--color-sa-green)]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-[var(--color-sa-green)]">
                All systems configured
              </p>
              <p className="text-[12px] text-[var(--color-sa-green)]/70">
                Both API keys are set. All 15 agents are ready for analysis.
              </p>
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-5">
          {/* API Keys */}
          <Section
            icon={<Key size={16} className="text-[var(--color-sa-accent)]" />}
            title="API Keys"
            description="Authentication keys for external services. Keys are stored locally and never transmitted to third parties."
          >
            <div className="space-y-4">
              <ApiKeyInput
                label="Anthropic API Key"
                value={anthropicApiKey}
                onChange={setAnthropicApiKey}
                placeholder="sk-ant-api03-..."
              />
              <ApiKeyInput
                label="Alpha Vantage API Key"
                value={alphaVantageKey}
                onChange={setAlphaVantageKey}
                placeholder="Your Alpha Vantage key"
              />
            </div>
          </Section>

          {/* Paper Trading */}
          <Section
            icon={
              <DollarSign
                size={16}
                className="text-[var(--color-sa-green)]"
              />
            }
            title="Paper Trading"
            description="Simulated trading configuration. Changes take effect on the next new paper trading session."
          >
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--color-sa-text-primary)]">
                Starting Capital
              </label>
              <div
                className="flex items-center gap-2 rounded-lg bg-[var(--color-sa-bg-tertiary)] px-3 py-2
                           ring-1 ring-[var(--color-sa-border)] transition-shadow duration-150
                           focus-within:ring-[var(--color-sa-accent)]/40"
              >
                <DollarSign
                  size={14}
                  className="shrink-0 text-[var(--color-sa-text-dim)]"
                />
                <input
                  type="number"
                  value={paperTradingCapital}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setPaperTradingCapital(val);
                    }
                  }}
                  min={0}
                  step={1000}
                  className="flex-1 bg-transparent text-[13px] text-[var(--color-sa-text-primary)]
                             placeholder:text-[var(--color-sa-text-dim)] outline-none font-mono"
                />
              </div>
              <p className="text-[11px] text-[var(--color-sa-text-dim)]">
                Current: {formatCurrency(paperTradingCapital)}
              </p>
            </div>
          </Section>

          {/* Monitoring */}
          <Section
            icon={
              <Clock size={16} className="text-[var(--color-sa-text-secondary)]" />
            }
            title="Monitoring"
            description="Control how frequently the platform checks for market news and updates."
          >
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--color-sa-text-primary)]">
                News Polling Interval
              </label>
              <div
                className="rounded-lg bg-[var(--color-sa-bg-tertiary)]
                           ring-1 ring-[var(--color-sa-border)] transition-shadow duration-150
                           focus-within:ring-[var(--color-sa-accent)]/40"
              >
                <select
                  value={newsPollingInterval}
                  onChange={(e) =>
                    setNewsPollingInterval(parseInt(e.target.value, 10))
                  }
                  className="w-full bg-transparent px-3 py-2.5 text-[13px]
                             text-[var(--color-sa-text-primary)] outline-none
                             appearance-none cursor-pointer"
                >
                  {POLLING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-[var(--color-sa-text-dim)]">
                More frequent polling consumes more Alpha Vantage API credits.
              </p>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-[var(--color-sa-border)] pt-4">
          <p className="text-[11px] text-[var(--color-sa-text-dim)]">
            All settings are saved automatically to your browser's local storage.
            API keys are never sent to any server other than the respective API
            endpoints (Anthropic, Alpha Vantage).
          </p>
        </div>
      </div>
    </div>
  );
}
