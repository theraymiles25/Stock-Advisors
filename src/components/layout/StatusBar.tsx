// =============================================================================
// Stock Advisors - Bottom Status Bar
// =============================================================================
// A 28px status bar fixed to the bottom of the window. Displays market status
// (open/closed based on US market hours), Alpha Vantage API call budget, and
// cumulative token usage / cost for the current session.
// =============================================================================

import { useMemo } from 'react';

// -----------------------------------------------------------------------------
// Market Hours Helper
// -----------------------------------------------------------------------------

/**
 * Determines whether US stock markets (NYSE/NASDAQ) are currently open.
 * Market hours: Mon-Fri, 9:30 AM - 4:00 PM Eastern Time.
 * Does not account for US holidays -- that would require a holiday calendar.
 */
function isMarketOpen(): boolean {
  const now = new Date();

  // Convert to Eastern Time by formatting with that timezone
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);

  const weekday = etParts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = parseInt(etParts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(etParts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  // Weekend check
  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const timeInMinutes = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM ET
  const marketClose = 16 * 60; // 4:00 PM ET

  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface StatusBarProps {
  /** Number of Alpha Vantage API calls remaining (placeholder) */
  avCallsRemaining?: number;
  /** Total tokens consumed in this session */
  totalTokens?: number;
  /** Total estimated cost in USD for this session */
  totalCost?: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function StatusBar({
  avCallsRemaining = 25,
  totalTokens = 0,
  totalCost = 0,
}: StatusBarProps) {
  const marketOpen = useMemo(() => isMarketOpen(), []);

  return (
    <footer
      className="flex h-7 shrink-0 items-center justify-between border-t
                 border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]/60
                 px-4 text-[11px] font-medium select-none"
    >
      {/* Left: Market status */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-[6px] w-[6px] rounded-full ${
            marketOpen ? 'bg-[var(--color-sa-green)]' : 'bg-[var(--color-sa-red)]'
          }`}
        />
        <span className="text-[var(--color-sa-text-muted)]">
          {marketOpen ? 'Market Open' : 'Market Closed'}
        </span>
      </div>

      {/* Center: AV API budget */}
      <div className="text-[var(--color-sa-text-dim)]">
        AV Calls: {avCallsRemaining} remaining
      </div>

      {/* Right: Token usage & cost */}
      <div className="flex items-center gap-3 text-[var(--color-sa-text-dim)]">
        <span>
          Tokens: {totalTokens.toLocaleString()}
        </span>
        <span>
          Cost: ${totalCost.toFixed(2)}
        </span>
      </div>
    </footer>
  );
}
