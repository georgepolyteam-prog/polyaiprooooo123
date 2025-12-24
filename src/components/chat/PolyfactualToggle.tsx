import React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import polyfactualLogo from "@/assets/polyfactual-logo.png";

interface PolyfactualToggleProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const PolyfactualToggle = ({ enabled, onToggle, disabled }: PolyfactualToggleProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            "relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 shrink-0 overflow-hidden",
            "border",
            enabled
              ? "bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border-cyan-500/50 shadow-lg shadow-cyan-500/20"
              : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Animated glow effect when enabled */}
          {enabled && (
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 animate-pulse" />
          )}
          
          {/* Logo */}
          <div className={cn(
            "relative w-5 h-5 rounded-md overflow-hidden transition-all duration-300",
            enabled ? "ring-1 ring-cyan-400/50" : "opacity-60 grayscale"
          )}>
            <img 
              src={polyfactualLogo} 
              alt="Polyfactual" 
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* Text badge */}
          <span className={cn(
            "relative text-sm font-medium transition-all duration-300",
            enabled 
              ? "text-cyan-300" 
              : "text-gray-400"
          )}>
            Polyfactual
          </span>
          
          {/* Status indicator dot */}
          <div className={cn(
            "relative w-2 h-2 rounded-full transition-all duration-300",
            enabled 
              ? "bg-cyan-400 shadow-sm shadow-cyan-400/50 animate-pulse" 
              : "bg-gray-500"
          )} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="flex items-center gap-2 mb-1">
          <img src={polyfactualLogo} alt="" className="w-4 h-4" />
          <p className="font-semibold">{enabled ? "Polyfactual ON" : "Polyfactual OFF"}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Deep web research powered by Polyfactual AI. Get comprehensive, real-time analysis with verified sources.
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
