// =============================================================================
// Stock Advisors - Confidence Meter Component
// =============================================================================
// Horizontal bar showing a confidence level from 0-100. Color gradient shifts
// from red (0-30) through amber (30-60) to green (60-100). Available in three
// sizes with an optional numeric label.
// =============================================================================

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ConfidenceMeterProps {
  value: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// -----------------------------------------------------------------------------
// Size Config
// -----------------------------------------------------------------------------

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

// -----------------------------------------------------------------------------
// Color Logic
// -----------------------------------------------------------------------------

function getBarColor(value: number): string {
  if (value >= 60) return 'var(--color-sa-green)';
  if (value >= 30) return 'var(--color-sa-amber)';
  return 'var(--color-sa-red)';
}

// -----------------------------------------------------------------------------
// Confidence Meter
// -----------------------------------------------------------------------------

export default function ConfidenceMeter({
  value,
  size = 'md',
  showLabel = false,
}: ConfidenceMeterProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex-1 overflow-hidden rounded-full bg-[var(--color-sa-bg-elevated)] ${SIZE_CLASSES[size]}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clamped}%`,
            backgroundColor: getBarColor(clamped),
          }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] tabular-nums text-[var(--color-sa-text-secondary)]">
          {Math.round(clamped)}
        </span>
      )}
    </div>
  );
}
