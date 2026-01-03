import { memo } from 'react';
import { Sparkles, Stars, Zap } from 'lucide-react';
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
        "ai-btn-premium relative group overflow-hidden w-full",
        "flex items-center justify-center gap-2",
        compact ? "h-9 px-3" : "h-12 px-5",
        "rounded-xl font-semibold",
        // Premium gradient background
        "bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600",
        // Animated border glow
        "ring-2 ring-violet-500/50",
        // Text
        "text-white",
        // Transitions
        "transition-all duration-300",
        // Hover effects
        "hover:ring-violet-400/80 hover:shadow-xl hover:shadow-violet-500/30",
        "hover:scale-[1.02] active:scale-[0.98]"
      )}
    >
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-white/20 to-violet-500/0 opacity-0 group-hover:opacity-100 animate-shimmer-slow" />
      
      {/* Shimmer sweep */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      
      {/* Glow pulse */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 rounded-xl animate-pulse ring-2 ring-violet-300/50" />
      </div>
      
      {/* Sparkle particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1 left-1/4 w-1.5 h-1.5 rounded-full bg-white opacity-0 group-hover:opacity-100 group-hover:animate-float-up" style={{ animationDelay: '0ms' }} />
        <div className="absolute top-2 right-1/3 w-1 h-1 rounded-full bg-fuchsia-300 opacity-0 group-hover:opacity-100 group-hover:animate-float-up" style={{ animationDelay: '100ms' }} />
        <div className="absolute bottom-2 left-1/3 w-1 h-1 rounded-full bg-purple-300 opacity-0 group-hover:opacity-100 group-hover:animate-float-up" style={{ animationDelay: '200ms' }} />
        <div className="absolute top-1/2 right-1/4 w-0.5 h-0.5 rounded-full bg-white opacity-0 group-hover:opacity-100 group-hover:animate-float-up" style={{ animationDelay: '300ms' }} />
      </div>
      
      {/* Icon with animation */}
      <div className="relative z-10 flex items-center justify-center">
        <Sparkles className={cn(
          "transition-all duration-500",
          compact ? "w-4 h-4" : "w-5 h-5",
          "group-hover:rotate-12 group-hover:scale-110",
          "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
        )} />
        {/* Extra sparkle on hover */}
        <Stars className={cn(
          "absolute opacity-0 group-hover:opacity-100 transition-all duration-300",
          compact ? "w-3 h-3 -top-1 -right-1" : "w-4 h-4 -top-1.5 -right-1.5",
          "text-yellow-300 animate-pulse"
        )} />
      </div>
      
      {/* Text with gradient */}
      <span className={cn(
        "relative z-10 font-bold tracking-wide",
        compact ? "text-xs" : "text-sm"
      )}>
        {compact ? 'AI' : 'AI Analysis'}
      </span>
      
      {/* Zap icon for extra flair */}
      {!compact && (
        <Zap className="relative z-10 w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-yellow-300 fill-yellow-300" />
      )}
    </button>
  );
}

export const KalshiAIButton = memo(KalshiAIButtonComponent);
