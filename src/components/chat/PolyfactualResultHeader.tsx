import React from "react";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import polymarketLogo from "@/assets/polymarket-logo.png";
import { Sparkles, Zap } from "lucide-react";

export const PolyfactualResultHeader = () => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117] border border-emerald-500/30 shadow-xl shadow-emerald-500/10">
      {/* Background gradient animation */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-emerald-500/5 animate-pulse" />
      
      {/* Gradient border glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-emerald-500/20 blur-xl opacity-50" />
      
      <div className="relative p-5">
        {/* Main header content */}
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Polyfactual branding */}
          <div className="flex items-center gap-4">
            {/* Large Polyfactual logo with gradient background */}
            <div className="relative">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <img 
                  src={polyfactualLogo} 
                  alt="Polyfactual" 
                  className="w-10 h-10 object-contain brightness-110"
                />
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-xl bg-emerald-500/30 animate-ping opacity-20" />
            </div>
            
            {/* Title and subtitle */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">
                  Polyfactual
                </h3>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-emerald-400">
                Deep Research Results
              </p>
            </div>
          </div>
          
          {/* Right side - Badges */}
          <div className="flex flex-col items-end gap-2">
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400">Live Research</span>
            </div>
            
            {/* Backed by Polymarket badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] text-gray-400">Backed by</span>
              <img 
                src={polymarketLogo} 
                alt="Polymarket" 
                className="h-3.5 object-contain"
              />
            </div>
          </div>
        </div>
        
        {/* Bottom info bar */}
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Real-time analysis
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Verified sources
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              AI-powered insights
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
