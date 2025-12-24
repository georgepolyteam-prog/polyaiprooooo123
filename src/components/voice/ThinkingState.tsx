import { Brain, Sparkles, Search, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import polyLogo from "@/assets/poly-logo-new.png";

interface ThinkingStateProps {
  step: string;
  isSlowResponse?: boolean;
  onDismissSlowBanner?: () => void;
}

const processingSteps = [
  { id: 'listening', label: 'Listening...', icon: Search },
  { id: 'transcribing', label: 'Processing voice...', icon: Search },
  { id: 'analyzing', label: 'Analyzing...', icon: Brain },
  { id: 'searching', label: 'Searching markets...', icon: BarChart3 },
  { id: 'generating', label: 'Crafting response...', icon: Sparkles },
  { id: 'generating_voice', label: 'Preparing voice...', icon: Sparkles },
  { id: 'speaking', label: 'Poly is speaking...', icon: Sparkles },
];

export const ThinkingState = ({ step, isSlowResponse, onDismissSlowBanner }: ThinkingStateProps) => {
  const currentStepIndex = processingSteps.findIndex(s => 
    s.id === step || step?.includes(s.id.split('_')[0])
  );
  const activeStep = currentStepIndex >= 0 ? processingSteps[currentStepIndex] : processingSteps[2];
  const StepIcon = activeStep.icon;

  return (
    <div className="flex gap-3 items-start animate-fade-in">
      {/* Avatar with neural glow */}
      <div className="relative shrink-0 w-10 h-10">
        <div className="w-10 h-10 rounded-sm overflow-hidden ring-2 ring-primary/50 shadow-lg shadow-primary/20 relative z-10 bg-background flex items-center justify-center">
          <img src={polyLogo} alt="Poly" className="w-6 h-6 object-contain" />
        </div>
        
        {/* Neural network dots - contained within avatar bounds */}
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * 2 * Math.PI;
          const radius = 22; // Keep dots at edge of avatar
          return (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 bg-primary rounded-full neural-dot z-0"
              style={{
                top: `calc(50% + ${Math.sin(angle) * radius}px - 3px)`,
                left: `calc(50% + ${Math.cos(angle) * radius}px - 3px)`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          );
        })}
        
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
      </div>

      {/* Thinking card */}
      <div className="flex-1 max-w-md">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 shadow-lg shadow-primary/10">
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-2xl thinking-glow-border" />
          
          <div className="relative p-4">
            {/* Current step */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <StepIcon className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-lg bg-primary/20 animate-ping" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{activeStep.label}</p>
                <p className="text-xs text-muted-foreground">Poly is working on your request</p>
              </div>
            </div>

            {/* Processing steps indicator */}
            <div className="flex items-center gap-1 mb-3">
              {processingSteps.slice(0, 4).map((s, i) => {
                const isActive = i === currentStepIndex;
                const isPast = i < currentStepIndex;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-all duration-500",
                      isActive ? "bg-primary animate-pulse" : 
                      isPast ? "bg-primary/60" : "bg-muted"
                    )}
                  />
                );
              })}
            </div>

            {/* Skeleton shimmer for response placeholder */}
            <div className="space-y-2">
              <div className="h-3 rounded-full bg-muted skeleton-shimmer w-full" />
              <div className="h-3 rounded-full bg-muted skeleton-shimmer w-4/5" style={{ animationDelay: '0.1s' }} />
              <div className="h-3 rounded-full bg-muted skeleton-shimmer w-3/5" style={{ animationDelay: '0.2s' }} />
            </div>

            {/* Slow response inline indicator */}
            {isSlowResponse && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                  <span className="text-muted-foreground">
                    Taking a bit longer than usual. High demand right now.
                  </span>
                  {onDismissSlowBanner && (
                    <button 
                      onClick={onDismissSlowBanner}
                      className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
