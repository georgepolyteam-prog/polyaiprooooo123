import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { PolyfactualToggle } from "@/components/chat/PolyfactualToggle";

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
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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

  const placeholder = isMobile 
    ? "Ask anything..." 
    : deepResearch 
      ? "Deep research mode - ask anything..." 
      : "Paste a market URL or ask anything...";

  return (
    <div 
      ref={ref} 
      className={cn(
        "relative flex items-center gap-2 sm:gap-3 p-2 rounded-2xl transition-all duration-300",
        "glass-card border-2",
        deepResearch 
          ? "border-accent/50 shadow-glow-cyan" 
          : "border-border/50 hover:border-primary/30 focus-within:border-primary/50",
        "focus-within:shadow-glow"
      )}
    >
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Polyfactual Toggle */}
      {onToggleDeepResearch && (
        <PolyfactualToggle 
          enabled={deepResearch} 
          onToggle={onToggleDeepResearch}
          disabled={disabled}
        />
      )}
      
      <input
        ref={inputRef}
        type="text"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 px-2 sm:px-4 py-2 sm:py-3 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/60 text-sm sm:text-base"
        autoFocus
      />
      
      {/* Send Button */}
      <button
        onClick={handleTextSubmit}
        disabled={disabled || !textInput.trim()}
        className={cn(
          "relative p-2.5 sm:p-3.5 rounded-xl transition-all duration-300 shrink-0",
          textInput.trim() && !disabled
            ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {textInput.trim() && !disabled && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-secondary opacity-50 blur-lg -z-10" />
        )}
        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </div>
  );
});

UnifiedInput.displayName = 'UnifiedInput';
