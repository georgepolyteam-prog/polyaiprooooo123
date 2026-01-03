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
        "relative group overflow-hidden",
        "flex items-center justify-center gap-2",
        compact ? "h-10 px-4" : "h-11 px-5",
        "rounded-full text-sm font-semibold",
        // Base gradient
        "bg-gradient-to-r from-violet-500/20 via-primary/20 to-fuchsia-500/20",
        // Border with gradient
        "border border-violet-500/30",
        // Text
        "text-violet-300",
        // Transitions
        "transition-all duration-500",
        // Hover effects
        "hover:border-violet-400/60 hover:text-violet-200",
        "hover:shadow-xl hover:shadow-violet-500/25",
        "hover:scale-[1.03] active:scale-[0.97]"
      )}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-primary/20 to-fuchsia-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 ring-2 ring-violet-400/30 ring-offset-2 ring-offset-transparent" />
      
      {/* Icon with animation */}
      <Sparkles className={cn(
        "relative z-10 transition-all duration-300",
        compact ? "w-4 h-4" : "w-4.5 h-4.5",
        "group-hover:rotate-12 group-hover:scale-110"
      )} />
      
      {/* Text */}
      <span className="relative z-10">
        {compact ? 'AI' : 'AI Analysis'}
      </span>
      
      {/* Floating particles on hover */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-2 w-1 h-1 rounded-full bg-violet-400 opacity-0 group-hover:opacity-100 group-hover:animate-ping" style={{ animationDelay: '0ms' }} />
        <div className="absolute top-1/3 right-3 w-0.5 h-0.5 rounded-full bg-fuchsia-400 opacity-0 group-hover:opacity-100 group-hover:animate-ping" style={{ animationDelay: '200ms' }} />
        <div className="absolute bottom-1/3 left-1/3 w-0.5 h-0.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 group-hover:animate-ping" style={{ animationDelay: '400ms' }} />
      </div>
    </button>
  );
}

export const KalshiAIButton = memo(KalshiAIButtonComponent);
