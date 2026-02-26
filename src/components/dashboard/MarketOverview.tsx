// =============================================================================
// Stock Advisors - Market Overview Component
// =============================================================================
// A horizontal ticker/summary bar showing key market info. Displays market
// data pills for each symbol with price, change amount, and change percentage.
// =============================================================================

import { TrendingUp, TrendingDown } from 'lucide-react';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface MarketOverviewProps {
  quotes: Record<string, { price: number; change: number; changePercent: number }>;
}

// -----------------------------------------------------------------------------
// Market Pill
// -----------------------------------------------------------------------------

function MarketPill({
  symbol,
  price,
  change,
  changePercent,
}: {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}) {
  const isPositive = change >= 0;
  const changeColor = isPositive
    ? 'text-[var(--color-sa-green)]'
    : 'text-[var(--color-sa-red)]';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const sign = isPositive ? '+' : '';

  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--color-sa-border)]
                 bg-[var(--color-sa-bg-secondary)] px-3 py-2"
    >
      <span className="text-[12px] font-semibold text-[var(--color-sa-text-primary)]">
        {symbol}
      </span>
      <span className="text-[12px] tabular-nums text-[var(--color-sa-text-secondary)]">
        ${price.toFixed(2)}
      </span>
      <div className={`flex items-center gap-0.5 ${changeColor}`}>
        <TrendIcon size={12} />
        <span className="text-[11px] tabular-nums">
          {sign}{change.toFixed(2)}
        </span>
        <span className="text-[11px] tabular-nums">
          ({sign}{changePercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Market Overview
// -----------------------------------------------------------------------------

export default function MarketOverview({ quotes }: MarketOverviewProps) {
  const symbols = Object.keys(quotes);

  if (symbols.length === 0) {
    return (
      <div
        className="flex items-center rounded-lg border border-[var(--color-sa-border)]
                   bg-[var(--color-sa-bg-secondary)] px-4 py-3"
      >
        <p className="text-[12px] text-[var(--color-sa-text-dim)]">
          Add symbols to your watchlist to see market data
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {symbols.map((symbol) => {
        const quote = quotes[symbol];
        return (
          <MarketPill
            key={symbol}
            symbol={symbol}
            price={quote.price}
            change={quote.change}
            changePercent={quote.changePercent}
          />
        );
      })}
    </div>
  );
}
