import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Mic, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  detailMode?: "advanced" | "quick";
  onToggleDetailMode?: () => void;
  showSuggestions?: boolean;
  onSuggestionClick?: (text: string) => void;
  onVoiceClick?: () => void;
  placeholder?: string;
}

export const ChatInput = ({ 
  onSend, 
  disabled = false,
  onVoiceClick,
  placeholder = "Type your question..."
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [message]);

  return (
    <div className="max-w-3xl mx-auto px-4">
      <div 
        className={cn(
          "relative flex items-end gap-2 bg-card border-2 rounded-lg px-4 py-3 transition-all duration-150",
          isFocused 
            ? "border-primary/50" 
            : "border-border hover:border-muted-foreground/30"
        )}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{ fontSize: '16px' }}
          className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground text-base leading-relaxed focus:outline-none disabled:opacity-50 min-h-[28px] max-h-40 py-0.5"
        />
        
        <div className="flex items-center gap-2 shrink-0">
          {/* Voice button - separate from input */}
          {onVoiceClick && (
            <button
              type="button"
              onClick={onVoiceClick}
              className="w-10 h-10 rounded flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
          
          {/* Send button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!message.trim() || disabled}
            className={cn(
              "w-10 h-10 rounded flex items-center justify-center transition-all duration-150",
              message.trim() && !disabled
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Disclaimer */}
      <p className="text-left text-xs text-muted-foreground mt-3">
        Poly provides data-driven analysis. <Link to="/disclaimer" className="underline hover:text-foreground transition-colors">Not financial advice</Link>. Verify before making decisions.
      </p>
    </div>
  );
};