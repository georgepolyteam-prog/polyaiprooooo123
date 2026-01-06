import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Sparkles, Clock, BarChart3, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KalshiMarket } from "@/hooks/useDflowApi";
import dflowLogo from "@/assets/dflow-logo.png";
import solanaLogo from "@/assets/solana-logo.png";

interface KalshiFeaturedMarketProps {
  market: KalshiMarket;
  onTrade: () => void;
  onAIAnalysis: () => void;
}

export function KalshiFeaturedMarket({ market, onTrade, onAIAnalysis }: KalshiFeaturedMarketProps) {
  const formatCloseTime = (closeTime?: string) => {
    if (!closeTime) return null;
    const date = new Date(closeTime);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Closed";
    if (diffDays === 0) return "Closes today";
    if (diffDays === 1) return "Closes tomorrow";
    if (diffDays < 7) return `${diffDays} days left`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatVolume = (vol?: number) => {
    if (!vol) return "$0";
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="relative max-w-2xl mx-auto"
    >
      {/* Card */}
      <div className="relative bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 overflow-hidden shadow-xl">
        {/* Inner content */}
        <div className="relative p-5 sm:p-6">
          {/* Header badges */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-emerald-500"
              />
              <span className="text-[10px] font-mono font-semibold text-emerald-500 uppercase tracking-wider">Featured</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/40 border border-border/40">
              <img src={dflowLogo} alt="DFlow" className="w-3.5 h-3.5 rounded" />
              <span className="text-[10px] font-mono text-muted-foreground">DFlow</span>
              <div className="w-px h-2.5 bg-border/50" />
              <img src={solanaLogo} alt="Solana" className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Market title */}
          <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight mb-5">
            {market.title || market.ticker}
          </h2>

          {/* Price display */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onTrade}
              className="relative group p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/50 transition-all"
            >
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-mono font-semibold text-emerald-500/80">YES</span>
                </div>
                <div className="text-3xl font-bold font-mono text-emerald-500">
                  {market.yesPrice}
                  <span className="text-lg">¢</span>
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onTrade}
              className="relative group p-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:border-red-500/50 transition-all"
            >
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-mono font-semibold text-red-500/80">NO</span>
                </div>
                <div className="text-3xl font-bold font-mono text-red-500">
                  {market.noPrice}
                  <span className="text-lg">¢</span>
                </div>
              </div>
            </motion.button>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between px-1 mb-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">{formatVolume(market.volume)} vol</span>
            </div>
            {formatCloseTime(market.closeTime) && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-mono">{formatCloseTime(market.closeTime)}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onAIAnalysis}
              className="relative group overflow-hidden h-10 rounded-xl bg-primary/10 border border-primary/30 hover:border-primary/50 transition-all"
            >
              <div className="relative flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary">Ask AI</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onTrade}
              className="relative group overflow-hidden h-10 rounded-xl bg-primary text-primary-foreground font-semibold transition-all"
            >
              <div className="relative flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs">Trade Now</span>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}