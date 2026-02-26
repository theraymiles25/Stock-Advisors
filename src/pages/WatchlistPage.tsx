// =============================================================================
// Stock Advisors - Watchlist Page
// =============================================================================
// Watchlist management page where users can add stock symbols to monitor,
// remove them, or trigger analysis for individual symbols. The watchlist is
// persisted to localStorage via useState + useEffect.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  X,
  Eye,
  Play,
  Star,
  ArrowRight,
  Search,
} from 'lucide-react';

// -----------------------------------------------------------------------------
// localStorage Persistence
// -----------------------------------------------------------------------------

const WATCHLIST_STORAGE_KEY = 'stock-advisors-watchlist';

function loadWatchlist(): string[] {
  try {
    const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore parse errors; return empty list
  }
  return [];
}

function saveWatchlist(symbols: string[]) {
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // Ignore storage errors
  }
}

// -----------------------------------------------------------------------------
// Empty State
// -----------------------------------------------------------------------------

function EmptyWatchlist() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-sa-accent-dim)] mb-4">
        <Eye size={28} className="text-[var(--color-sa-accent)]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--color-sa-text-primary)]">
        Your watchlist is empty
      </h3>
      <p className="mt-1.5 max-w-sm text-[13px] text-[var(--color-sa-text-muted)]">
        Add symbols to monitor stocks you are interested in. Run analysis on any watched
        symbol with a single click.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Watchlist Row
// -----------------------------------------------------------------------------

interface WatchlistRowProps {
  symbol: string;
  onAnalyze: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function WatchlistRow({ symbol, onAnalyze, onRemove }: WatchlistRowProps) {
  return (
    <div
      className="flex items-center justify-between border-b border-[var(--color-sa-border)] last:border-b-0
                 px-5 py-3 transition-colors hover:bg-[var(--color-sa-bg-hover)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-sa-accent-dim)]">
          <Star size={14} className="text-[var(--color-sa-accent)]" />
        </div>
        <div>
          <span className="text-[14px] font-semibold text-[var(--color-sa-text-primary)]">
            {symbol}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onAnalyze(symbol)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-sa-border)]
                     bg-[var(--color-sa-bg-primary)] px-3 py-1.5 text-[12px] font-medium
                     text-[var(--color-sa-text-primary)] transition-all duration-150
                     hover:border-[var(--color-sa-accent)] hover:text-[var(--color-sa-accent)]"
        >
          <Play size={11} />
          Analyze
        </button>
        <button
          onClick={() => onRemove(symbol)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-sa-border)]
                     bg-[var(--color-sa-bg-primary)] text-[var(--color-sa-text-dim)] transition-all duration-150
                     hover:border-[var(--color-sa-red)] hover:text-[var(--color-sa-red)]"
          title={`Remove ${symbol}`}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Watchlist Page
// -----------------------------------------------------------------------------

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Persist to localStorage whenever the watchlist changes
  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  const addSymbol = useCallback(() => {
    const symbol = inputValue.trim().toUpperCase();

    if (!symbol) {
      setError(null);
      return;
    }

    // Basic validation: only allow letters and dots (for BRK.B style symbols)
    if (!/^[A-Z.]{1,10}$/.test(symbol)) {
      setError('Enter a valid stock symbol (letters only, up to 10 characters)');
      return;
    }

    if (watchlist.includes(symbol)) {
      setError(`${symbol} is already on your watchlist`);
      return;
    }

    setWatchlist((prev) => [...prev, symbol]);
    setInputValue('');
    setError(null);
  }, [inputValue, watchlist]);

  const removeSymbol = useCallback((symbol: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
  }, []);

  const handleAnalyze = useCallback(
    (symbol: string) => {
      // Navigate to analysis page with the symbol pre-filled
      // The analysis page will pick up the symbol from URL or we navigate there
      navigate('/analysis');
    },
    [navigate]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSymbol();
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-[var(--color-sa-text-primary)]">
            Watchlist
          </h1>
          <p className="mt-1 text-[14px] text-[var(--color-sa-text-secondary)]">
            Monitor stocks and run analysis on demand
          </p>
        </div>

        {/* Add Symbol Input */}
        <div className="mb-6 rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-sa-text-dim)]"
              />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter stock symbol (e.g. AAPL)"
                className="w-full rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-primary)]
                           py-2.5 pl-9 pr-3 text-[13px] text-[var(--color-sa-text-primary)]
                           placeholder:text-[var(--color-sa-text-dim)]
                           focus:border-[var(--color-sa-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-sa-accent)]
                           transition-colors"
              />
            </div>
            <button
              onClick={addSymbol}
              disabled={!inputValue.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-sa-accent)]
                         px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-150
                         hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          {error && (
            <p className="mt-2 text-[12px] text-[var(--color-sa-red)]">
              {error}
            </p>
          )}
        </div>

        {/* Watchlist Count */}
        {watchlist.length > 0 && (
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sa-text-dim)]">
              {watchlist.length} Symbol{watchlist.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => navigate('/analysis')}
              className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-sa-accent)] hover:underline"
            >
              Analyze all
              <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Watchlist Items or Empty State */}
        <div className="rounded-xl border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)] overflow-hidden">
          {watchlist.length > 0 ? (
            watchlist.map((symbol) => (
              <WatchlistRow
                key={symbol}
                symbol={symbol}
                onAnalyze={handleAnalyze}
                onRemove={removeSymbol}
              />
            ))
          ) : (
            <EmptyWatchlist />
          )}
        </div>
      </div>
    </div>
  );
}
