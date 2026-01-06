import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface MarketData {
  title: string;
  price: number;
  change?: number;
}

export const LivePulseStrip = () => {
  const [markets, setMarkets] = useState<MarketData[]>([
    { title: "Trump 2028", price: 23, change: 2.1 },
    { title: "BTC $150k 2025", price: 8, change: -1.2 },
    { title: "Fed Rate Cut March", price: 67, change: 5.3 },
    { title: "Apple $250 EOY", price: 41, change: 0.8 },
    { title: "Recession 2025", price: 19, change: -3.1 },
    { title: "ETH Flips BTC", price: 4, change: 0.2 },
  ]);

  const [traderCount, setTraderCount] = useState(847);

  useEffect(() => {
    // Fetch real market data
    const fetchMarkets = async () => {
      try {
        const { data } = await supabase
          .from("market_cache")
          .select("title, current_odds")
          .order("volume_24h", { ascending: false })
          .limit(6);

        if (data && data.length > 0) {
          setMarkets(
            data.map((m) => ({
              title: m.title.length > 25 ? m.title.slice(0, 25) + "…" : m.title,
              price: Math.round(m.current_odds * 100),
              change: Math.random() * 6 - 3, // Mock change for now
            }))
          );
        }
      } catch (e) {
        // Use fallback data
      }
    };

    fetchMarkets();

    // Simulate live trader count updates
    const interval = setInterval(() => {
      setTraderCount((prev) => prev + Math.floor(Math.random() * 10 - 5));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Duplicate for seamless scroll
  const items = [...markets, ...markets];

  return (
    <div className="relative w-full border-y border-border/50 bg-muted/30 overflow-hidden">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />

      <motion.div
        className="flex items-center gap-8 py-3 px-4"
        animate={{ x: [0, "-50%"] }}
        transition={{
          x: {
            duration: 30,
            repeat: Infinity,
            ease: "linear",
          },
        }}
      >
        {items.map((market, i) => (
          <div
            key={i}
            className="flex items-center gap-3 whitespace-nowrap font-mono text-xs"
          >
            <span className="text-muted-foreground">{market.title}</span>
            <span className="text-foreground font-medium">{market.price}¢</span>
            {market.change !== undefined && (
              <span
                className={
                  market.change >= 0 ? "text-emerald-500" : "text-red-500"
                }
              >
                {market.change >= 0 ? "+" : ""}
                {market.change.toFixed(1)}%
              </span>
            )}
            <span className="text-border">│</span>
          </div>
        ))}

        {/* Live traders count */}
        <div className="flex items-center gap-2 whitespace-nowrap font-mono text-xs">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-emerald-500">{traderCount} traders live</span>
        </div>
      </motion.div>
    </div>
  );
};
