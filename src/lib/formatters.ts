// =============================================================================
// Stock Advisors - Utility Formatters
// =============================================================================
// Pure functions for formatting numbers, dates, and values for display
// throughout the application UI.
// =============================================================================

// -----------------------------------------------------------------------------
// Currency
// -----------------------------------------------------------------------------

/**
 * Format a number as US currency.
 * Examples: 1234.5 -> "$1,234.50", -89.1 -> "-$89.10"
 */
export function formatCurrency(value: number): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}

// -----------------------------------------------------------------------------
// Percent
// -----------------------------------------------------------------------------

/** Return value from formatPercent including a color hint for the UI */
export interface PercentResult {
  /** Formatted string like "+12.34%" or "-5.67%" */
  text: string;
  /** Suggested color: 'green' for positive, 'red' for negative, 'neutral' for zero */
  color: 'green' | 'red' | 'neutral';
}

/**
 * Format a decimal value as a percentage with sign prefix and color hint.
 * The input is treated as a raw percentage value (e.g., 12.34 means 12.34%).
 *
 * Examples:
 *   12.34  -> { text: "+12.34%", color: "green" }
 *   -5.67  -> { text: "-5.67%", color: "red" }
 *   0      -> { text: "0.00%",  color: "neutral" }
 */
export function formatPercent(value: number): PercentResult {
  const sign = value > 0 ? '+' : '';
  const text = `${sign}${value.toFixed(2)}%`;

  let color: 'green' | 'red' | 'neutral';
  if (value > 0) {
    color = 'green';
  } else if (value < 0) {
    color = 'red';
  } else {
    color = 'neutral';
  }

  return { text, color };
}

// -----------------------------------------------------------------------------
// Large Numbers
// -----------------------------------------------------------------------------

/**
 * Format a large number with abbreviation suffixes.
 * Examples:
 *   1_200_000_000  -> "1.2B"
 *   450_000_000    -> "450M"
 *   12_500         -> "12.5K"
 *   999            -> "999"
 *   -3_400_000     -> "-3.4M"
 */
export function formatLargeNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000_000) {
    return `${sign}${(abs / 1_000_000_000_000).toFixed(1).replace(/\.0$/, '')}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }

  return `${sign}${abs}`;
}

// -----------------------------------------------------------------------------
// Dates & Times
// -----------------------------------------------------------------------------

/**
 * Format a Date object as a short human-readable date.
 * Example: new Date('2026-02-25') -> "Feb 25, 2026"
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a Date object as a short human-readable time.
 * Example: new Date('2026-02-25T14:30:00') -> "2:30 PM"
 */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

// -----------------------------------------------------------------------------
// Confidence Labels
// -----------------------------------------------------------------------------

/** Confidence level label */
export type ConfidenceLabel = 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';

/**
 * Convert a numeric confidence score (0-100) to a human-readable label.
 *
 * Thresholds:
 *   >= 80  -> "Very High"
 *   >= 65  -> "High"
 *   >= 45  -> "Medium"
 *   >= 25  -> "Low"
 *   < 25   -> "Very Low"
 */
export function formatConfidence(value: number): ConfidenceLabel {
  if (value >= 80) return 'Very High';
  if (value >= 65) return 'High';
  if (value >= 45) return 'Medium';
  if (value >= 25) return 'Low';
  return 'Very Low';
}
