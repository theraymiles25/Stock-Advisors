// =============================================================================
// Stock Advisors - Price Display Component
// =============================================================================
// Formatted price with optional change indicator. Displays price as currency
// with colored +/- change amount and percentage. Arrow icon indicates direction.
// =============================================================================

import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../lib/formatters';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface PriceDisplayProps {
  price: number;
  change?: number;
  changePercent?: number;
  size?: 'sm' | 'md' | 'lg';
}

// -----------------------------------------------------------------------------
// Size Config
// -----------------------------------------------------------------------------

const SIZE_CONFIG: Record<
  'sm' | 'md' | 'lg',
  { priceClass: string; changeClass: string; iconSize: number }
> = {
  sm: { priceClass: 'text-[12px]', changeClass: 'text-[10px]', iconSize: 10 },
  md: { priceClass: 'text-[14px]', changeClass: 'text-[12px]', iconSize: 12 },
  lg: { priceClass: 'text-[18px]', changeClass: 'text-[14px]', iconSize: 14 },
};

// -----------------------------------------------------------------------------
// Price Display
// -----------------------------------------------------------------------------

export default function PriceDisplay({
  price,
  change,
  changePercent,
  size = 'md',
}: PriceDisplayProps) {
  const config = SIZE_CONFIG[size];
  const hasChange = change != null;
  const isPositive = (change ?? 0) >= 0;

  const changeColor = isPositive
    ? 'text-[var(--color-sa-green)]'
    : 'text-[var(--color-sa-red)]';

  const ArrowIcon = isPositive ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-2">
      {/* Price */}
      <span
        className={`font-semibold tabular-nums text-[var(--color-sa-text-primary)] ${config.priceClass}`}
      >
        {formatCurrency(price)}
      </span>

      {/* Change */}
      {hasChange && (
        <div className={`flex items-center gap-0.5 ${changeColor}`}>
          <ArrowIcon size={config.iconSize} />
          <span className={`tabular-nums ${config.changeClass}`}>
            {isPositive ? '+' : ''}
            {change!.toFixed(2)}
          </span>
          {changePercent != null && (
            <span className={`tabular-nums ${config.changeClass}`}>
              ({formatPercent(changePercent).text})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
