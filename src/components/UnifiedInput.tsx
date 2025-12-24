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
