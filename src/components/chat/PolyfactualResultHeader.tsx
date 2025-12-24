import React from "react";
import polyfactualLogo from "@/assets/polyfactual-logo.png";

export const PolyfactualResultHeader = () => {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] border border-cyan-500/20">
      <div className="flex items-center gap-3">
        {/* Polyfactual logo */}
        <div className="w-8 h-8 rounded-lg overflow-hidden ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/20">
          <img 
            src={polyfactualLogo} 
            alt="Polyfactual" 
            className="w-full h-full object-contain"
          />
        </div>
        
        {/* Title */}
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            Deep Research Results
          </h3>
          <p className="text-xs text-muted-foreground">
            Powered by <span className="text-cyan-400 font-medium">Polyfactual</span>
          </p>
        </div>
      </div>
      
      {/* Live indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-xs font-medium text-cyan-400">Live Research</span>
      </div>
    </div>
  );
};
