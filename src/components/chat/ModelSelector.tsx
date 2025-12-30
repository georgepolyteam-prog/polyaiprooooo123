import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import polyLogo from "@/assets/poly-logo-new.png";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import irysLogo from "@/assets/irys-logo.png";

export type ChatMode = 'regular' | 'polyfactual' | 'historical';

interface ModelSelectorProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

const modes = [
  {
    id: 'regular' as const,
    name: 'AI',
    description: 'Standard AI assistant',
    color: 'gray',
    borderColor: 'border-border/50',
    bgColor: 'bg-muted/50',
    textColor: 'text-muted-foreground',
    activeTextColor: 'text-foreground',
    glowColor: '',
  },
  {
    id: 'polyfactual' as const,
    name: 'Polyfactual',
    description: 'Deep research with sources',
    color: 'emerald',
    borderColor: 'border-emerald-500/50',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    activeTextColor: 'text-emerald-400',
    glowColor: 'shadow-emerald-500/20',
  },
  {
    id: 'historical' as const,
    name: 'Historical',
    description: '51K blockchain markets',
    color: 'blue',
    borderColor: 'border-blue-500/50',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    activeTextColor: 'text-blue-400',
    glowColor: 'shadow-blue-500/20',
  },
];

const ModeIcon = ({ mode, className }: { mode: ChatMode; className?: string }) => {
  if (mode === 'regular') {
    return <img src={polyLogo} alt="" className={cn("w-4 h-4 object-contain", className)} />;
  }
  if (mode === 'polyfactual') {
    return <img src={polyfactualLogo} alt="" className={cn("w-4 h-4 object-contain", className)} />;
  }
  return <img src={irysLogo} alt="" className={cn("w-4 h-4 object-contain", className)} />;
};

export const ModelSelector = ({ mode, onModeChange, disabled }: ModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentMode = modes.find(m => m.id === mode) || modes[0];

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (selectedMode: ChatMode) => {
    onModeChange(selectedMode);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300",
          "border bg-[#161b22] hover:bg-[#1c2128]",
          mode === 'regular' 
            ? "border-white/10 hover:border-white/20" 
            : mode === 'polyfactual'
              ? "border-emerald-500/50 shadow-lg shadow-emerald-500/20"
              : "border-blue-500/50 shadow-lg shadow-blue-500/20",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Mode Icon */}
        <div className={cn(
          "flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-300",
          mode === 'regular' 
            ? "bg-[#21262d]" 
            : mode === 'polyfactual'
              ? "bg-gradient-to-br from-emerald-600 to-cyan-600"
              : "bg-gradient-to-br from-blue-600 to-indigo-600"
        )}>
          <ModeIcon 
            mode={mode} 
            className={cn(
              mode === 'regular' ? "text-gray-400" : "text-white brightness-110"
            )} 
          />
        </div>
        
        {/* Mode Name - hidden on mobile */}
        <span className={cn(
          "hidden sm:block text-sm font-medium transition-colors duration-300",
          mode === 'regular' ? "text-gray-400" : currentMode.activeTextColor
        )}>
          {currentMode.name}
        </span>
        
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform duration-200",
          mode === 'regular' ? "text-gray-500" : currentMode.textColor,
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Mobile: Bottom sheet backdrop */}
          {isMobile && (
            <div 
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
          )}
          
          <div className={cn(
            "z-50 bg-[#0d1117] border border-white/10 overflow-hidden",
            isMobile 
              ? "fixed bottom-0 left-0 right-0 rounded-t-2xl animate-in slide-in-from-bottom duration-300"
              : "absolute bottom-full left-0 mb-2 min-w-[260px] rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
          )}>
            {/* Mobile handle */}
            {isMobile && (
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
            )}
            
            <div className={cn("p-2", isMobile && "pb-8")}>
              {modes.map((m) => {
                const isSelected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(m.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                      "hover:bg-white/5",
                      isSelected && m.bgColor
                    )}
                  >
                    {/* Icon container */}
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300",
                      m.id === 'regular' 
                        ? "bg-[#21262d]" 
                        : m.id === 'polyfactual'
                          ? "bg-gradient-to-br from-emerald-600 to-cyan-600"
                          : "bg-gradient-to-br from-blue-600 to-indigo-600"
                    )}>
                      <ModeIcon 
                        mode={m.id} 
                        className={cn(
                          "w-5 h-5",
                          m.id === 'regular' ? "text-gray-400" : "text-white brightness-110"
                        )} 
                      />
                    </div>
                    
                    {/* Text */}
                    <div className="flex-1 text-left">
                      <div className={cn(
                        "text-sm font-medium",
                        isSelected ? m.activeTextColor : "text-white"
                      )}>
                        {m.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {m.description}
                      </div>
                    </div>
                    
                    {/* Checkmark */}
                    {isSelected && (
                      <Check className={cn("w-5 h-5", m.textColor)} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
