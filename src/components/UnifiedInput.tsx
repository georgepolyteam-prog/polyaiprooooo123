import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface UnifiedInputProps {
  onSubmit: (message: string, isVoice: boolean, audioBlob?: Blob) => void;
  disabled?: boolean;
  deepResearch?: boolean;
  onToggleDeepResearch?: () => void;
}

export const UnifiedInput = React.forwardRef<HTMLDivElement, UnifiedInputProps>(({ 
  onSubmit, 
  disabled,
  deepResearch = false,
  onToggleDeepResearch
}, ref) => {
  const [textInput, setTextInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleTextSubmit = () => {
    if (textInput.trim() && !disabled) {
      onSubmit(textInput.trim(), false);
      setTextInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  return (
    <div ref={ref} className="flex items-center gap-3 backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-purple-500/50 focus-within:border-purple-500 rounded-2xl shadow-2xl transition-all duration-300 p-2">
      {/* Deep Research Toggle */}
      {onToggleDeepResearch && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleDeepResearch}
              className={cn(
                "p-3 rounded-xl transition-all duration-300 shrink-0",
                deepResearch
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25"
                  : "bg-white/10 text-gray-400 hover:text-white hover:bg-white/20"
              )}
            >
              <Sparkles className={cn("w-5 h-5", deepResearch && "animate-pulse")} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-medium">{deepResearch ? "Deep Research ON" : "Deep Research OFF"}</p>
            <p className="text-xs text-muted-foreground">Comprehensive web research for any market</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      <input
        ref={inputRef}
        type="text"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={deepResearch ? "Deep research mode - ask anything..." : "Paste a market URL or ask anything..."}
        disabled={disabled}
        className="flex-1 px-4 py-3 bg-transparent border-none outline-none text-white placeholder:text-gray-500"
        autoFocus
      />
      <button
        onClick={handleTextSubmit}
        disabled={disabled || !textInput.trim()}
        className={cn(
          "p-4 rounded-xl transition-all duration-300",
          textInput.trim() && !disabled
            ? "bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white shadow-lg shadow-purple-500/25 hover:scale-105"
            : "bg-white/10 text-gray-500 cursor-not-allowed"
        )}
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
});

UnifiedInput.displayName = 'UnifiedInput';
