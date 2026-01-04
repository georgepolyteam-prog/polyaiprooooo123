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
      {/* Outer glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-primary/20 to-purple-500/20 rounded-3xl blur-xl opacity-60" />

      {/* Card */}
      <div className="relative bg-background/80 backdrop-blur-2xl rounded-3xl border border-border/40 overflow-hidden shadow-2xl">
        {/* Animated border gradient */}
        <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-r from-emerald-500/50 via-primary/50 to-purple-500/50 opacity-50" />

        {/* Inner content */}
        <div className="relative p-6 sm:p-8">
          {/* Header badges */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"
              />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Featured Market</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
              <img src={dflowLogo} alt="DFlow" className="w-4 h-4 rounded" />
              <span className="text-xs font-medium text-muted-foreground">DFlow</span>
              <div className="w-px h-3 bg-border/50" />
              <img src={solanaLogo} alt="Solana" className="w-4 h-4" />
            </div>
          </div>

          {/* Market title */}
          <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight mb-6">
            {market.title || market.ticker}
          </h2>

          {/* Price chart area (simplified sparkline) */}
          <div className="h-20 mb-6 relative overflow-hidden rounded-xl bg-gradient-to-b from-emerald-500/5 to-transparent border border-emerald-500/10">
            {/* Fake sparkline visualization */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="featured-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                d="M 0 60 Q 50 50 100 55 T 200 40 T 300 45 T 400 30 T 500 35 T 600 25"
                fill="none"
                stroke="rgb(16, 185, 129)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                className="drop-shadow-lg"
              />
              <motion.path
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.5, delay: 0.5 }}
                d="M 0 60 Q 50 50 100 55 T 200 40 T 300 45 T 400 30 T 500 35 T 600 25 L 600 80 L 0 80 Z"
                fill="url(#featured-gradient)"
              />
            </svg>

            {/* Floating data points */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 }}
              className="absolute right-4 top-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30"
            >
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">+{Math.floor(Math.random() * 8 + 2)}%</span>
            </motion.div>
          </div>

          {/* Big price display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onTrade}
              className="relative group p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 hover:border-emerald-400/50 transition-all"
            >
              <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400/80">YES</span>
                </div>
                <div className="text-4xl font-bold text-emerald-400">
                  {market.yesPrice}
                  <span className="text-2xl">¢</span>
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onTrade}
              className="relative group p-5 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 hover:border-red-400/50 transition-all"
            >
              <div className="absolute inset-0 bg-red-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-semibold text-red-400/80">NO</span>
                </div>
                <div className="text-4xl font-bold text-red-400">
                  {market.noPrice}
                  <span className="text-2xl">¢</span>
                </div>
              </div>
            </motion.button>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between px-1 mb-6">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm">{formatVolume(market.volume)} vol</span>
            </div>
            {formatCloseTime(market.closeTime) && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{formatCloseTime(market.closeTime)}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAIAnalysis}
              className="relative group overflow-hidden h-12 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 hover:border-purple-400/50 transition-all"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

              <div className="relative flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-300">Ask AI</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onTrade}
              className="relative group overflow-hidden h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold transition-all"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

              <div className="relative flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm">Trade Now</span>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
