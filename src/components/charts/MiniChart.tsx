// =============================================================================
// Stock Advisors - Mini Sparkline Chart
// =============================================================================
// A tiny area chart designed for embedding in table rows and compact cards.
// Powered by TradingView Lightweight Charts with all chrome disabled so
// only the line + gradient fill is visible. Auto-detects trend direction to
// pick green (up) or red (down) colouring.
// =============================================================================

import { useRef, useEffect, useCallback } from 'react';
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type AreaData,
  type Time,
} from 'lightweight-charts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MiniChartProps {
  /** Simple close price series */
  data: Array<{ time: string; value: number }>;
  /** Width in pixels (default 120) */
  width?: number;
  /** Height in pixels (default 40) */
  height?: number;
  /** Line color (default: auto green/red based on trend) */
  color?: string;
}

// -----------------------------------------------------------------------------
// Theme Constants
// -----------------------------------------------------------------------------

const UP_COLOR = '#00DC82';
const DOWN_COLOR = '#FF4757';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function MiniChart({
  data,
  width = 120,
  height = 40,
  color,
}: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const buildChart = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Tear down previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Determine trend colour
    const lineColor =
      color ??
      (data.length >= 2 && data[data.length - 1].value >= data[0].value
        ? UP_COLOR
        : DOWN_COLOR);

    // Create a minimal chart - no axes, no grid, no crosshair
    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'transparent',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;

    // Area series with gradient fill
    const areaSeries: ISeriesApi<'Area'> = chart.addAreaSeries({
      lineColor,
      lineWidth: 1,
      topColor: lineColor + '40', // ~25% opacity
      bottomColor: lineColor + '05', // ~2% opacity
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    const areaData: AreaData[] = data.map((d) => ({
      time: d.time as Time,
      value: d.value,
    }));
    areaSeries.setData(areaData);

    chart.timeScale().fitContent();
  }, [data, width, height, color]);

  useEffect(() => {
    buildChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  // ---- Empty state ----
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width, height }}
      >
        <span className="text-xs text-[var(--color-sa-text-dim)]">--</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="inline-block overflow-hidden"
      style={{ width, height }}
    />
  );
}
