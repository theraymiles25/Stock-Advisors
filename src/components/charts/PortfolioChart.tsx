// =============================================================================
// Stock Advisors - Portfolio Chart (Allocation Pie / Equity Curve)
// =============================================================================
// Dual-mode chart for portfolio views. In "allocation" mode it renders a
// Recharts PieChart showing holdings by value. In "equity" mode it renders an
// AreaChart of the equity curve over time. Both modes use a dark theme that
// matches the application palette and are fully responsive via
// ResponsiveContainer.
// =============================================================================

import {
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as AreaTooltip,
  ReferenceLine,
} from 'recharts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface Holding {
  symbol: string;
  value: number;
  color?: string;
}

interface EquityPoint {
  date: string;
  value: number;
}

interface PortfolioChartProps {
  mode: 'allocation' | 'equity';
  /** For allocation mode: pie chart data */
  holdings?: Holding[];
  /** For equity mode: equity curve over time */
  equityCurve?: EquityPoint[];
  /** Height in pixels (default 300) */
  height?: number;
}

// -----------------------------------------------------------------------------
// Theme & Defaults
// -----------------------------------------------------------------------------

const TEXT_COLOR = '#8A94A6';
const TOOLTIP_BG = '#141A2E';
const TOOLTIP_BORDER = '#1A2035';
const GRID_COLOR = '#1A2035';
const ACCENT_COLOR = '#3B82F6';
const AREA_GRADIENT_TOP = 'rgba(59, 130, 246, 0.35)';
const AREA_GRADIENT_BOTTOM = 'rgba(59, 130, 246, 0.02)';
const REFERENCE_COLOR = '#8A94A6';

/** Fallback palette for holdings that don't provide a color */
const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#00DC82', // green
  '#F59E0B', // amber
  '#A855F7', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#EF4444', // red
  '#6366F1', // indigo
  '#84CC16', // lime
  '#F97316', // orange
];

// -----------------------------------------------------------------------------
// Custom Tooltip – Allocation
// -----------------------------------------------------------------------------

interface AllocationPayloadEntry {
  name: string;
  value: number;
  payload: { symbol: string; value: number; fill: string };
}

function AllocationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: AllocationPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-lg"
      style={{
        background: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
        color: TEXT_COLOR,
      }}
    >
      <p className="font-medium text-[var(--color-sa-text-primary)]">
        {entry.payload.symbol}
      </p>
      <p>
        ${entry.payload.value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Custom Tooltip – Equity
// -----------------------------------------------------------------------------

interface EquityPayloadEntry {
  value: number;
  payload: { date: string; value: number };
}

function EquityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: EquityPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-lg"
      style={{
        background: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
        color: TEXT_COLOR,
      }}
    >
      <p className="font-medium text-[var(--color-sa-text-primary)]">
        {entry.payload.date}
      </p>
      <p>
        ${entry.payload.value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Custom Pie Label
// -----------------------------------------------------------------------------

interface LabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  symbol: string;
  percent: number;
}

const RADIAN = Math.PI / 180;

function renderPieLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  symbol,
  percent,
}: LabelProps) {
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Hide labels for tiny slices
  if (percent < 0.03) return null;

  return (
    <text
      x={x}
      y={y}
      fill={TEXT_COLOR}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
    >
      {symbol} {(percent * 100).toFixed(1)}%
    </text>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function AllocationChart({
  holdings,
  height,
}: {
  holdings: Holding[];
  height: number;
}) {
  const total = holdings.reduce((sum, h) => sum + h.value, 0);

  const pieData = holdings.map((h, idx) => ({
    symbol: h.symbol,
    value: h.value,
    fill: h.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius="45%"
          outerRadius="70%"
          dataKey="value"
          nameKey="symbol"
          stroke="none"
          label={(props: Record<string, unknown>) =>
            renderPieLabel({
              ...(props as Omit<LabelProps, 'symbol' | 'percent'>),
              symbol: props.symbol as string,
              percent: (props.value as number) / total,
            })
          }
          labelLine={false}
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <PieTooltip content={<AllocationTooltip /> as any} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function EquityCurveChart({
  equityCurve,
  height,
}: {
  equityCurve: EquityPoint[];
  height: number;
}) {
  const startingValue = equityCurve[0]?.value ?? 0;
  const gradientId = 'equityGradient';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={equityCurve}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AREA_GRADIENT_TOP} stopOpacity={1} />
            <stop
              offset="100%"
              stopColor={AREA_GRADIENT_BOTTOM}
              stopOpacity={1}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_COLOR}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: TEXT_COLOR, fontSize: 11 }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: TEXT_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toLocaleString()}`
          }
          width={60}
        />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <AreaTooltip content={<EquityTooltip /> as any} />
        <ReferenceLine
          y={startingValue}
          stroke={REFERENCE_COLOR}
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={ACCENT_COLOR}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: ACCENT_COLOR }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function PortfolioChart({
  mode,
  holdings = [],
  equityCurve = [],
  height = 300,
}: PortfolioChartProps) {
  // ---- Empty states ----
  if (mode === 'allocation' && holdings.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]"
        style={{ height }}
      >
        <span className="text-sm text-[var(--color-sa-text-muted)]">
          No holdings data available
        </span>
      </div>
    );
  }

  if (mode === 'equity' && equityCurve.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]"
        style={{ height }}
      >
        <span className="text-sm text-[var(--color-sa-text-muted)]">
          No equity curve data available
        </span>
      </div>
    );
  }

  // ---- Render ----
  return (
    <div className="w-full" style={{ height }}>
      {mode === 'allocation' ? (
        <AllocationChart holdings={holdings} height={height} />
      ) : (
        <EquityCurveChart equityCurve={equityCurve} height={height} />
      )}
    </div>
  );
}
