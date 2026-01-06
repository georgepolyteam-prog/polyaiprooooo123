import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, Time } from "lightweight-charts";
import { Loader2, BarChart3, AlertCircle, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { PolyMarket } from "@/hooks/usePolymarketTerminal";

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
  compact?: boolean;
}

export function PolyMarketChart({ market, compact = false }: PolyMarketChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("7D");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: "rgba(63, 63, 70, 0.15)" },
        horzLines: { color: "rgba(63, 63, 70, 0.15)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: compact ? 220 : 300,
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

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, loading, error, compact]);

  return (
    <section className="p-5 rounded-2xl bg-gradient-to-b from-card/80 to-card/60 border border-border/50 backdrop-blur-xl shadow-xl shadow-black/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Price Chart</h2>
            <p className="text-[10px] text-muted-foreground">YES outcome price history</p>
          </div>
          {candles.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/30">
          {(["1D", "7D", "30D"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                timeframe === tf
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        "rounded-xl border border-border/30 overflow-hidden bg-background/30",
        compact ? "h-[220px]" : "h-[300px]"
      )}>
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            <span className="text-xs">Loading chart data...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-center px-6">
            <AlertCircle className="w-8 h-8 opacity-60" />
            <span className="text-xs">{error}</span>
          </div>
        ) : candles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart3 className="w-8 h-8 opacity-50" />
            <span className="text-xs">No chart data available</span>
            <span className="text-[10px] opacity-70">Price history will appear here</span>
          </div>
        ) : (
          <div ref={chartContainerRef} className="h-full w-full" />
        )}
      </div>
    </section>
  );
}
