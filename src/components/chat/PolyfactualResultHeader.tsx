import React from "react";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import { Sparkles } from "lucide-react";

export const PolyfactualResultHeader = () => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117] border border-primary/30 shadow-xl shadow-primary/10">
      {/* Background gradient animation */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
      
      {/* Gradient border glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 blur-xl opacity-50" />
      
      <div className="relative p-4 sm:p-5">
        {/* Main header content */}
        <div className="flex items-center gap-4">
          {/* Polyfactual branding */}
          <div className="relative">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
              <img 
                src={polyfactualLogo} 
                alt="Polyfactual" 
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain brightness-110"
              />
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-xl bg-primary/30 animate-ping opacity-20" />
          </div>
          
          {/* Title and subtitle */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">
                Polyfactual
              </h3>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-primary">
              Deep Research Results
            </p>
          </div>
        </div>
        
        {/* Bottom info bar - hidden on mobile */}
        <div className="hidden sm:flex mt-4 pt-4 border-t border-white/5 items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Real-time analysis
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
            Verified sources
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
            AI-powered insights
          </span>
        </div>
      </div>
    </div>
  );
};
