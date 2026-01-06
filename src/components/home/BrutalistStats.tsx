import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  users: number;
  chats: number;
  trades: number;
}

export const BrutalistStats = () => {
  const [stats, setStats] = useState<Stats>({
    users: 1990,
    chats: 4740,
    trades: 2847,
  });

  const fetchStats = useCallback(async () => {
    try {
      // Get user count from profiles
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get chat count - multiply by 30 as requested
      const { count: chatCount } = await supabase
        .from("chat_logs")
        .select("*", { count: "exact", head: true });

      // Get trade count from whale_trades
      const { count: tradeCount } = await supabase
        .from("whale_trades")
        .select("*", { count: "exact", head: true });

      setStats({
        users: userCount || 0,
        chats: (chatCount || 0) * 30, // 30x multiplier for AI analyses
        trades: tradeCount || 0,
      });
    } catch (e) {
      // Use fallback
      setStats({ users: 1990, chats: 4740, trades: 2847 });
    }
  }, []);

  useEffect(() => {
    fetchStats();
    
    // Refresh every 30 seconds for real-time feel
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const statItems = [
    { value: stats.users.toLocaleString(), label: "traders", size: "large" },
    { value: stats.chats.toLocaleString(), label: "AI analyses", size: "medium" },
    { value: stats.trades.toLocaleString(), label: "trades tracked", size: "medium" },
  ];

  return (
    <section className="relative px-6 md:px-12 lg:px-20 py-24 md:py-32 border-y border-border/30">
      {/* Background texture */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-6xl mx-auto relative">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
            // the numbers
          </span>
        </motion.div>

        {/* Brutalist stats - left aligned, raw */}
        <div className="flex flex-col md:flex-row md:items-end gap-12 md:gap-20">
          {statItems.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="flex flex-col"
            >
              <span
                className={`
                  font-mono font-bold tracking-tight text-foreground
                  ${stat.size === "large" ? "text-6xl md:text-8xl" : "text-4xl md:text-6xl"}
                `}
              >
                {stat.value}
              </span>
              <span className="font-mono text-sm text-muted-foreground mt-2">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 h-px bg-gradient-to-r from-primary/50 via-primary to-primary/50 origin-left max-w-xs"
        />
      </div>
    </section>
  );
};
