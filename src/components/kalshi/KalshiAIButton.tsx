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
        compact ? "h-9 px-3" : "h-11 px-4",
        "rounded-xl text-sm font-semibold",
        // Premium gradient background
        "bg-gradient-to-r from-violet-600/20 via-purple-500/20 to-fuchsia-500/20",
        // Animated border
        "border border-violet-500/40",
        // Text
        "text-violet-300",
        // Transitions
        "transition-all duration-300",
        // Hover effects
        "hover:border-violet-400/70 hover:text-violet-200",
        "hover:shadow-lg hover:shadow-violet-500/20",
        "hover:scale-[1.02] active:scale-[0.98]"
      )}
    >
      {/* Animated gradient sweep */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-400/20 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {/* Pulse ring on hover */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 rounded-xl animate-pulse-slow ring-1 ring-violet-400/30" />
      </div>
      
      {/* Icon with animation */}
      <Sparkles className={cn(
        "relative z-10 transition-all duration-300",
        compact ? "w-3.5 h-3.5" : "w-4 h-4",
        "group-hover:rotate-12 group-hover:scale-110",
        "drop-shadow-[0_0_4px_rgba(139,92,246,0.5)]"
      )} />
      
      {/* Text */}
      <span className="relative z-10 font-medium">
        {compact ? 'AI' : 'AI Analysis'}
      </span>
      
      {/* Floating sparkles on hover */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-1 h-1 rounded-full bg-violet-400/80 opacity-0 group-hover:opacity-100 group-hover:animate-float-up" style={{ animationDelay: '0ms' }} />
        <div className="absolute top-1/2 right-1/4 w-0.5 h-0.5 rounded-full bg-fuchsia-400/80 opacity-0 group-hover:opacity-100 group-hover:animate-float-up" style={{ animationDelay: '150ms' }} />
        <div className="absolute bottom-1/4 left-1/3 w-0.5 h-0.5 rounded-full bg-purple-400/80 opacity-0 group-hover:opacity-100 group-hover:animate-float-up" style={{ animationDelay: '300ms' }} />
      </div>
    </button>
  );
}

export const KalshiAIButton = memo(KalshiAIButtonComponent);
