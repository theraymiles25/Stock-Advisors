// =============================================================================
// Stock Advisors - Stock Chart (Candlestick + Volume)
// =============================================================================
// Full-featured candlestick chart powered by TradingView Lightweight Charts.
// Supports OHLCV data, optional volume histogram, SMA overlays, and horizontal
// price levels (stop loss, target, etc.). Dark-themed to match the app palette.
// =============================================================================

import { useRef, useEffect, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from 'lightweight-charts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface OHLCVData {
  /** Date in YYYY-MM-DD format */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface PriceLevel {
  price: number;
  color: string;
  label: string;
}

interface StockChartProps {
  /** OHLCV data array */
  data: OHLCVData[];
  /** Optional height in pixels (default 400) */
  height?: number;
  /** Whether to show volume histogram below */
  showVolume?: boolean;
  /** Optional SMA overlay periods (e.g., [20, 50, 200]) */
  smaLines?: number[];
  /** Optional: highlight levels (e.g., stop loss, target) */
  levels?: PriceLevel[];
}

// -----------------------------------------------------------------------------
// Theme Constants
// -----------------------------------------------------------------------------

const CHART_BG = '#0A0E1A';
const CHART_TEXT = '#8A94A6';
const CHART_GRID = '#1A2035';
const UP_COLOR = '#00DC82';
const DOWN_COLOR = '#FF4757';

/** Colors for SMA lines, cycled if more periods than colors */
const SMA_COLORS = ['#F59E0B', '#3B82F6', '#A855F7', '#EC4899', '#14B8A6'];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Compute a Simple Moving Average for the given period from OHLCV close prices.
 * Returns an array of { time, value } points starting at index (period - 1).
 */
function computeSMA(
  data: OHLCVData[],
  period: number,
): Array<{ time: string; value: number }> {
  const result: Array<{ time: string; value: number }> = [];
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  result.push({ time: data[period - 1].time, value: sum / period });

  for (let i = period; i < data.length; i++) {
    sum += data[i].close - data[i - period].close;
    result.push({ time: data[i].time, value: sum / period });
  }

  return result;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function StockChart({
  data,
  height = 400,
  showVolume = false,
  smaLines = [],
  levels = [],
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // ---- Build / rebuild chart when props change ----
  const buildChart = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Tear down previous chart if it exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart instance
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: CHART_TEXT,
      },
      grid: {
        vertLines: { color: CHART_GRID },
        horzLines: { color: CHART_GRID },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: CHART_GRID,
      },
      timeScale: {
        borderColor: CHART_GRID,
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    // -- Candlestick series --
    const candleSeries: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });

    const candleData: CandlestickData[] = data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);

    // -- Price levels (horizontal lines) --
    levels.forEach((level) => {
      candleSeries.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: level.label,
      });
    });

    // -- SMA overlays --
    smaLines.forEach((period, idx) => {
      const smaData = computeSMA(data, period);
      if (smaData.length === 0) return;

      const lineColor = SMA_COLORS[idx % SMA_COLORS.length];
      const lineSeries: ISeriesApi<'Line'> = chart.addLineSeries({
        color: lineColor,
        lineWidth: 1,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: `SMA ${period}`,
      });

      const lineData: LineData[] = smaData.map((d) => ({
        time: d.time as Time,
        value: d.value,
      }));
      lineSeries.setData(lineData);
    });

    // -- Volume histogram (separate pane) --
    if (showVolume) {
      const volumeSeries: ISeriesApi<'Histogram'> = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      const volumeData: HistogramData[] = data
        .filter((d) => d.volume != null)
        .map((d) => ({
          time: d.time as Time,
          value: d.volume!,
          color: d.close >= d.open
            ? 'rgba(0, 220, 130, 0.35)'
            : 'rgba(255, 71, 87, 0.35)',
        }));
      volumeSeries.setData(volumeData);
    }

    // Fit content to visible range
    chart.timeScale().fitContent();
  }, [data, height, showVolume, smaLines, levels]);

  // ---- Effect: create chart & resize observer ----
  useEffect(() => {
    buildChart();

    const container = containerRef.current;
    if (container && chartRef.current) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width } = entry.contentRect;
          chartRef.current?.applyOptions({ width });
        }
      });
      resizeObserverRef.current.observe(container);
    }

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
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
        className="flex items-center justify-center rounded-lg border border-[var(--color-sa-border)] bg-[var(--color-sa-bg-secondary)]"
        style={{ height }}
      >
        <span className="text-sm text-[var(--color-sa-text-muted)]">
          No chart data available
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-lg"
      style={{ height }}
    />
  );
}
