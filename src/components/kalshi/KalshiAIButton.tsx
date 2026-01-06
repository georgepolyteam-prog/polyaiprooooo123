import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KalshiAIButtonProps {
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
}

function KalshiAIButtonComponent({ onClick, compact = false }: KalshiAIButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative group overflow-hidden w-full",
        "flex items-center justify-center gap-2",
        compact ? "h-8 px-3" : "h-10 px-4",
        "rounded-xl font-semibold",
        // Primary color gradient
        "bg-gradient-to-r from-primary/90 to-primary",
        // Border
        "border border-primary/50",
        // Text
        "text-primary-foreground",
        // Transitions
        "transition-all duration-200",
        // Hover effects
        "hover:border-primary hover:shadow-md hover:shadow-primary/20",
        "active:scale-[0.98]"
      )}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Icon */}
      <Sparkles className={cn(
        "relative z-10 transition-transform duration-200",
        compact ? "w-3.5 h-3.5" : "w-4 h-4",
        "group-hover:scale-110"
      )} />
      
      {/* Text */}
      <span className={cn(
        "relative z-10 font-semibold",
        compact ? "text-[10px]" : "text-xs"
      )}>
        {compact ? 'AI' : 'AI Analysis'}
      </span>
    </button>
  );
}

export const KalshiAIButton = memo(KalshiAIButtonComponent);