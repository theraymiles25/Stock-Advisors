// =============================================================================
// Stock Advisors - Stock Ticker Component
// =============================================================================
// A horizontally scrolling stock ticker tape with continuous CSS animation.
// Each item shows symbol, price, and change percentage with green/red coloring.
// The animation pauses on hover for readability.
// =============================================================================

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface StockTickerProps {
  quotes: Array<{
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
  }>;
}

// -----------------------------------------------------------------------------
// Ticker Item
// -----------------------------------------------------------------------------

function TickerItem({
  symbol,
  price,
  changePercent,
}: {
  symbol: string;
  price: number;
  changePercent: number;
}) {
  const isPositive = changePercent >= 0;
  const changeColor = isPositive
    ? 'text-[var(--color-sa-green)]'
    : 'text-[var(--color-sa-red)]';
  const sign = isPositive ? '+' : '';

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 px-4">
      <span className="text-[12px] font-semibold text-[var(--color-sa-text-primary)]">
        {symbol}
      </span>
      <span className="text-[12px] tabular-nums text-[var(--color-sa-text-secondary)]">
        ${price.toFixed(2)}
      </span>
      <span className={`text-[11px] tabular-nums ${changeColor}`}>
        {sign}{changePercent.toFixed(2)}%
      </span>
    </span>
  );
}

// -----------------------------------------------------------------------------
// Stock Ticker
// -----------------------------------------------------------------------------

export default function StockTicker({ quotes }: StockTickerProps) {
  if (quotes.length === 0) return null;

  // Duplicate the items to create a seamless loop
  const items = [...quotes, ...quotes];

  return (
    <div
      className="group relative overflow-hidden border-y border-[var(--color-sa-border)]
                 bg-[var(--color-sa-bg-secondary)] py-2"
    >
      <div className="flex animate-[ticker_30s_linear_infinite] group-hover:[animation-play-state:paused]">
        {items.map((quote, i) => (
          <TickerItem
            key={`${quote.symbol}-${i}`}
            symbol={quote.symbol}
            price={quote.price}
            changePercent={quote.changePercent}
          />
        ))}
      </div>
    </div>
  );
}
