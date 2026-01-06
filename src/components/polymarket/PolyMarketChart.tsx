import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickData } from "lightweight-charts";
import { Loader2, BarChart3, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { PolyMarket } from "@/hooks/usePolymarketTerminal";
import type { PriceAlert } from "@/hooks/useAlerts";
import { ChartContextMenu } from "@/components/terminal/ChartContextMenu";

type Timeframe = "1D" | "7D" | "30D";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PolyMarketChartProps {
  market: PolyMarket;
  alerts?: PriceAlert[];
  onCreateAlert?: (price: number, direction: 'above' | 'below') => void;
}

export function PolyMarketChart({ market, alerts = [], onCreateAlert }: PolyMarketChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("7D");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: number } | null>(null);
  const [visibleRange, setVisibleRange] = useState<{ min: number; max: number } | null>(null);

  const { startTime, endTime, interval } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    if (timeframe === "1D") return { startTime: now - 24 * 60 * 60, endTime: now, interval: 1 };
    if (timeframe === "7D") return { startTime: now - 7 * 24 * 60 * 60, endTime: now, interval: 60 };
    return { startTime: now - 30 * 24 * 60 * 60, endTime: now, interval: 1440 };
  }, [timeframe]);

  useEffect(() => {
    let cancelled = false;

    async function fetchCandles() {
      setLoading(true);
      setError(null);

      try {
        // Need conditionId for candlesticks endpoint
        if (!market.conditionId) {
          console.log('[Chart] No conditionId available for market');
          setCandles([]);
          setLoading(false);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke("market-candlesticks", {
          body: {
            conditionId: market.conditionId,
            startTime,
            endTime,
            interval,
            yesTokenId: market.yesTokenId ?? undefined,
          },
        });

        if (fnError) throw fnError;

        const raw = (data?.candlesticks || []) as Candle[];
        console.log(`[Chart] Received ${raw.length} candles for ${market.slug}`);
        if (!cancelled) setCandles(raw);
      } catch (e) {
        console.error('[Chart] Error fetching candles:', e);
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load chart";
          setError(msg);
          setCandles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCandles();

    return () => {
      cancelled = true;
    };
  }, [market.conditionId, market.yesTokenId, market.slug, startTime, endTime, interval]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (loading || error) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    if (candles.length === 0) return;

    // Get actual container dimensions
    const rect = chartContainerRef.current.getBoundingClientRect();
    const chartHeight = rect.height || 300;
    const chartWidth = rect.width || chartContainerRef.current.clientWidth;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "inherit",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(63, 63, 70, 0.15)" },
        horzLines: { color: "rgba(63, 63, 70, 0.15)" },
      },
      width: chartWidth,
      height: chartHeight,
      rightPriceScale: {
        borderColor: "rgba(63, 63, 70, 0.3)",
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: "rgba(63, 63, 70, 0.3)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const normalizePrice = (v: number) => (v > 1.5 ? v / 100 : v);

    const chartData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: normalizePrice(c.open),
      high: normalizePrice(c.high),
      low: normalizePrice(c.low),
      close: normalizePrice(c.close),
    }));

    series.setData(chartData);

    chart.timeScale().fitContent();
    chartRef.current = chart;
    seriesRef.current = series;

    // Track visible price range for context-menu pricing
    const updateVisibleRange = () => {
      if (!seriesRef.current) return;
      try {
        const visibleTimeRange = chart.timeScale().getVisibleLogicalRange();
        if (!visibleTimeRange) return;

        const prices = chartData
          .filter(
            (_, i) => i >= Math.floor(visibleTimeRange.from) && i <= Math.ceil(visibleTimeRange.to)
          )
          .flatMap((c) => [c.high as number, c.low as number]);

        if (prices.length === 0) return;

        const min = Math.min(...prices);
        const max = Math.max(...prices);

        // Match the chart's scaleMargins feel, but avoid collapsing to a zero range.
        const baseRange = Math.max(max - min, 0.001);
        const padding = baseRange * 0.05;

        setVisibleRange({
          min: min - padding,
          max: max + padding,
        });
      } catch {
        // Ignore errors during range calculation
      }
    };

    // Update range on zoom/pan
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateVisibleRange);
    
    // Initial range
    updateVisibleRange();

    // ResizeObserver for dynamic sizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (!chartContainerRef.current || !chartRef.current) return;
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        chartRef.current.applyOptions({ width, height });
        updateVisibleRange();
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [candles, loading, error]);

  // Handle right-click on chart for context menu - map Y coordinate into the *visible* price range
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      if (!chartRef.current || !chartContainerRef.current || !onCreateAlert) return;

      const rect = chartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const chartHeight = rect.height;

      // Prefer the range derived from the chart's current viewport (kept in sync on pan/zoom/resize)
      // This avoids relying on candle slicing logic that can drift from what the chart is actually rendering.
      const range = visibleRange;
      if (!range || !isFinite(range.min) || !isFinite(range.max) || range.max <= range.min) {
        if (import.meta.env.DEV) {
          console.log('[Chart] Context menu: missing/invalid visibleRange', range);
        }
        return;
      }

      // Y=0 (top) -> max, Y=height (bottom) -> min
      const clickedPrice = range.max - (y / chartHeight) * (range.max - range.min);

      // Convert to cents (0-100) and clamp
      const priceInCents = Math.round(clickedPrice * 100);
      const finalPrice = Math.max(1, Math.min(99, priceInCents));

      if (import.meta.env.DEV) {
        console.log('[Chart] Context menu price', {
          y,
          chartHeight,
          range,
          clickedPrice,
          priceInCents,
          finalPrice,
        });
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        price: finalPrice,
      });
    },
    [onCreateAlert, visibleRange]
  );

  // Calculate alert line positions using series.priceToCoordinate for accurate positioning
  const getAlertLinePosition = useCallback((alertPrice: number) => {
    if (!seriesRef.current || !chartContainerRef.current) return null;
    
    try {
      const y = seriesRef.current.priceToCoordinate(alertPrice);
      if (y === null) return null;
      
      const rect = chartContainerRef.current.getBoundingClientRect();
      const pct = (y / rect.height) * 100;
      
      // Hide if out of visible area
      if (pct < 0 || pct > 100) return null;
      
      return pct;
    } catch {
      return null;
    }
  }, []);

  return (
    <section className="h-full flex flex-col">
      {/* Minimal header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">Price</span>
          <span className="text-[10px] text-muted-foreground">YES</span>
          {candles.length > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>

        {/* Professional Timeframe selector */}
        <div className="flex items-center p-0.5 rounded-lg bg-muted/40 border border-border/50">
          {(["1D", "7D", "30D"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={cn(
                "relative px-3 py-1 rounded-md text-[10px] font-bold tracking-wide transition-all duration-200",
                timeframe === tf
                  ? [
                      "bg-gradient-to-r from-primary/20 to-primary/10",
                      "text-primary shadow-sm",
                      "before:absolute before:inset-0 before:rounded-md before:ring-1 before:ring-primary/40",
                    ]
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
            <span className="text-[10px]">Loading chart...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-center px-4">
            <AlertCircle className="w-6 h-6 opacity-60" />
            <span className="text-[10px]">{error}</span>
          </div>
        ) : candles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart3 className="w-6 h-6 opacity-50" />
            <span className="text-[10px]">No chart data</span>
          </div>
        ) : (
          <div 
            ref={chartContainerRef} 
            className="h-full w-full" 
            onContextMenu={handleContextMenu}
          />
        )}

        {/* Alert lines - positioned using series.priceToCoordinate for accuracy */}
        {alerts.length > 0 && candles.length > 0 && seriesRef.current && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {alerts.map((alert) => {
              const alertPriceDecimal = alert.targetPrice / 100;
              const pct = getAlertLinePosition(alertPriceDecimal);
              
              // Hide if out of visible range
              if (pct === null) return null;
              
              return (
                <div
                  key={alert.id}
                  className="absolute left-0 right-0 border-t border-dashed border-yellow-500/70 z-10 transition-all duration-150"
                  style={{ top: `${pct}%` }}
                >
                  <span className="absolute right-2 -top-2.5 bg-yellow-500 text-black text-[9px] px-1.5 py-0.5 rounded font-bold">
                    {alert.targetPrice}¢
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && onCreateAlert && (
        <ChartContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          price={contextMenu.price}
          onClose={() => setContextMenu(null)}
          onSetAlert={onCreateAlert}
        />
      )}
    </section>
  );
}