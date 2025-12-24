import { Link } from "react-router-dom";
import { Wallet, Sparkles, Mail, Zap } from "lucide-react";
import { ConnectWallet } from "./ConnectWallet";
import { usePolyPrice } from "@/hooks/usePolyPrice";
import { motion } from "framer-motion";

export const AuthGateInline = () => {
  const { data: priceData, isLoading: priceLoading } = usePolyPrice(30000);

  const formatPrice = (price: number) => {
    if (price < 0.0001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    return price.toFixed(4);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {/* Animated gradient border */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 rounded-2xl opacity-50 blur-sm animate-pulse" />
      <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 rounded-2xl opacity-75" style={{ backgroundSize: '200% 200%', animation: 'gradient-shift 3s ease infinite' }} />
      
      {/* Main container */}
      <div className="relative backdrop-blur-xl bg-[#0f0a1f]/95 rounded-2xl p-5 border border-white/10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Connect to chat with Poly</h3>
              <p className="text-gray-500 text-xs">Unlock AI market analysis</p>
            </div>
          </div>
          
          {/* FREE badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-semibold">FREE BETA</span>
          </div>
        </div>

        {/* Auth options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Wallet option */}
          <div className="group relative">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm" />
            <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300" />
            <div className="relative bg-white/5 group-hover:bg-white/10 border border-white/10 group-hover:border-white/30 rounded-xl p-3 transition-all duration-300 ring-1 ring-transparent group-hover:ring-white/20 focus-within:ring-2 focus-within:ring-white/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/50 flex items-center justify-center transition-all duration-300">
                  <Wallet className="w-4 h-4 text-purple-400 group-hover:text-white transition-colors duration-300" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Wallet</p>
                  <p className="text-gray-500 group-hover:text-white/80 text-[10px] transition-colors duration-300">Recommended</p>
                </div>
              </div>
              <ConnectWallet />
            </div>
          </div>

          {/* Email option */}
          <Link
            to="/auth"
            className="group relative block focus:outline-none"
          >
            <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500 to-pink-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm" />
            <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500 to-pink-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300" />
            <div className="relative bg-white/5 group-hover:bg-white/10 border border-white/10 group-hover:border-white/30 rounded-xl p-3 h-full transition-all duration-300 ring-1 ring-transparent group-hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-white/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 group-hover:bg-cyan-500/50 flex items-center justify-center transition-all duration-300">
                  <Mail className="w-4 h-4 text-cyan-400 group-hover:text-white transition-colors duration-300" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Email</p>
                  <p className="text-gray-500 group-hover:text-white/80 text-[10px] transition-colors duration-300">Sign up / Login</p>
                </div>
              </div>
              <div className="w-full py-2 bg-white/5 group-hover:bg-white/15 rounded-lg text-center text-xs font-medium text-gray-300 group-hover:text-white transition-all duration-300">
                Continue with email
              </div>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">$POLY</span>
            <span className="text-white font-mono">
              {priceLoading ? '...' : `$${formatPrice(priceData?.price || 0)}`}
            </span>
            {!priceLoading && priceData?.priceChange24h && (
              <span className={`${priceData.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {priceData.priceChange24h >= 0 ? '+' : ''}{priceData.priceChange24h.toFixed(1)}%
              </span>
            )}
          </div>
          <Link to="/about" className="text-purple-400 hover:text-purple-300 transition-colors">
            Learn about $POLY →
          </Link>
        </div>
      </div>

      {/* CSS for gradient animation */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </motion.div>
  );
};
