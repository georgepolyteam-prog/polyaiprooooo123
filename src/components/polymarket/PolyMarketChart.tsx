import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createChart, ColorType, IChartApi, Time } from "lightweight-charts";
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

  const [timeframe, setTimeframe] = useState<Timeframe>("7D");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: number } | null>(null);

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

    series.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    // ResizeObserver for dynamic sizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (!chartContainerRef.current || !chartRef.current) return;
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        chartRef.current.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, loading, error]);

  // Handle right-click on chart for context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!chartRef.current || !onCreateAlert) return;
    
    const rect = chartContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Get price at click position using the chart's coordinate conversion
    const y = e.clientY - rect.top;
    
    // Use the chart's time scale and price scale for accurate conversion
    try {
      // Get the series and use coordinateToPrice for accurate price
      const series = chartRef.current.priceScale('right');
      
      // Calculate price based on visible price range from candles
      if (candles.length > 0) {
        const visibleData = candles.slice(-50); // Use recent candles for price range
        const minPrice = Math.min(...visibleData.map(c => c.low));
        const maxPrice = Math.max(...visibleData.map(c => c.high));
        const padding = (maxPrice - minPrice) * 0.05;
        const effectiveMin = Math.max(0, minPrice - padding);
        const effectiveMax = Math.min(1, maxPrice + padding);
        
        // Convert y position to price
        const chartHeight = rect.height;
        const priceRatio = y / chartHeight;
        const price = effectiveMax - priceRatio * (effectiveMax - effectiveMin);
        
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          price: Math.max(0.01, Math.min(0.99, price)),
        });
      }
    } catch (err) {
      console.error('[Chart] Context menu price calculation failed:', err);
    }
  }, [onCreateAlert, candles]);

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

        {/* Timeframe selector */}
        <div className="flex items-center rounded-md bg-muted/30 border border-border/40 p-0.5">
          {(["1D", "7D", "30D"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3 py-1 rounded text-[10px] font-bold tracking-wide transition-all",
                timeframe === tf
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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

        {/* Alert lines - positioned using chart's actual price range */}
        {alerts.length > 0 && candles.length > 0 && chartRef.current && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {alerts.map((alert) => {
              // Calculate position based on visible price range
              const visibleData = candles.slice(-50);
              const minPrice = Math.min(...visibleData.map(c => c.low));
              const maxPrice = Math.max(...visibleData.map(c => c.high));
              const padding = (maxPrice - minPrice) * 0.05;
              const effectiveMin = Math.max(0, minPrice - padding);
              const effectiveMax = Math.min(1, maxPrice + padding);
              
              const alertPriceDecimal = alert.targetPrice / 100;
              const pct = ((effectiveMax - alertPriceDecimal) / (effectiveMax - effectiveMin)) * 100;
              
              // Hide if out of visible range
              if (pct < 0 || pct > 100) return null;
              
              return (
                <div
                  key={alert.id}
                  className="absolute left-0 right-0 border-t border-dashed border-yellow-500/70 z-10"
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
