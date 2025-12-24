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
            "relative flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-300 shrink-0 overflow-hidden",
            "border",
            enabled
              ? "bg-[#0d1117] border-emerald-500/50 shadow-lg shadow-emerald-500/20"
              : "bg-[#161b22] border-white/10 hover:border-white/20 hover:bg-[#1c2128]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Animated glow effect when enabled */}
          {enabled && (
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10 animate-pulse" />
          )}
          
          {/* Logo container with dark background for visibility */}
          <div className={cn(
            "relative flex items-center justify-center w-7 h-7 rounded-lg overflow-hidden transition-all duration-300",
            enabled 
              ? "bg-gradient-to-br from-emerald-600 to-cyan-600 shadow-md shadow-emerald-500/30" 
              : "bg-[#21262d]"
          )}>
            <img 
              src={polyfactualLogo} 
              alt="Polyfactual" 
              className={cn(
                "w-5 h-5 object-contain transition-all duration-300",
                enabled ? "brightness-110" : "opacity-60"
              )}
            />
          </div>
          
          {/* Text badge */}
          <div className="relative flex flex-col items-start">
            <span className={cn(
              "text-sm font-semibold transition-all duration-300",
              enabled 
                ? "text-white" 
                : "text-gray-400"
            )}>
              Polyfactual
            </span>
            <span className={cn(
              "text-[10px] leading-tight transition-all duration-300",
              enabled 
                ? "text-emerald-400" 
                : "text-gray-500"
            )}>
              Deep Research
            </span>
          </div>
          
          {/* Status indicator */}
          <div className={cn(
            "relative w-2.5 h-2.5 rounded-full transition-all duration-300 ml-1",
            enabled 
              ? "bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" 
              : "bg-gray-600"
          )} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs bg-[#161b22] border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-600 to-cyan-600 flex items-center justify-center">
            <img src={polyfactualLogo} alt="" className="w-3.5 h-3.5" />
          </div>
          <p className="font-semibold text-white">{enabled ? "Deep Research ON" : "Deep Research OFF"}</p>
        </div>
        <p className="text-xs text-gray-400">
          Comprehensive AI research with verified sources from across the web. Get real-time analysis backed by Polymarket data.
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
