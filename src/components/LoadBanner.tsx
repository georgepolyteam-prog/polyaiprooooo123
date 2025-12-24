import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Clock, X, Zap, Users, CheckCircle, Server } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadBannerProps {
  isVisible: boolean;
  queuePosition?: number;
  estimatedWait?: number; // in seconds
  countdown?: number; // live countdown
  isQueued?: boolean;
  cascadeAttempts?: string[];
  onDismiss?: () => void;
}

export const LoadBanner = ({ 
  isVisible, 
  queuePosition, 
  estimatedWait, 
  countdown,
  isQueued = false,
  cascadeAttempts,
  onDismiss 
}: LoadBannerProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [animatedPosition, setAnimatedPosition] = useState(queuePosition || 0);

  useEffect(() => {
    if (!isVisible) setDismissed(false);
  }, [isVisible]);

  // Animate position changes
  useEffect(() => {
    if (queuePosition !== undefined) {
      setAnimatedPosition(queuePosition);
    }
  }, [queuePosition]);

  if (!isVisible || dismissed) return null;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const isAlmostReady = (queuePosition || 0) <= 2;
  const isNext = (queuePosition || 0) === 1;
  const displayCountdown = countdown ?? estimatedWait;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
      <div className={cn(
        "backdrop-blur-sm border-b transition-colors duration-500",
        isNext 
          ? "bg-success/90 border-success/30" 
          : isAlmostReady 
            ? "bg-primary/90 border-primary/30"
            : "bg-warning/90 border-warning/30"
      )}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center relative",
                isNext 
                  ? "bg-success-foreground/10" 
                  : isAlmostReady 
                    ? "bg-primary-foreground/10"
                    : "bg-warning-foreground/10"
              )}>
                {isNext ? (
                  <CheckCircle className={cn(
                    "w-5 h-5 animate-pulse",
                    isNext ? "text-success-foreground" : "text-warning-foreground"
                  )} />
                ) : isQueued ? (
                  <Users className={cn(
                    "w-5 h-5",
                    isAlmostReady ? "text-primary-foreground" : "text-warning-foreground"
                  )} />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning-foreground" />
                )}
                
                {/* Pulsing ring animation */}
                {isQueued && !isNext && (
                  <div className="absolute inset-0 rounded-full border-2 border-current animate-ping opacity-30" />
                )}
              </div>
              
              <div>
                <div className={cn(
                  "text-sm font-semibold",
                  isNext 
                    ? "text-success-foreground" 
                    : isAlmostReady 
                      ? "text-primary-foreground"
                      : "text-warning-foreground"
                )}>
                  {isNext 
                    ? "🎉 You're Next!" 
                    : isQueued 
                      ? "In Queue - Almost There!" 
                      : "Experiencing High Demand"}
                </div>
                <div className={cn(
                  "text-xs",
                  isNext 
                    ? "text-success-foreground/80" 
                    : isAlmostReady 
                      ? "text-primary-foreground/80"
                      : "text-warning-foreground/80"
                )}>
                  {isNext 
                    ? "Processing your request now..." 
                    : cascadeAttempts 
                      ? `Tried ${cascadeAttempts.join(' → ')} - scaling up capacity`
                      : "We're scaling up our servers to handle increased traffic"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Cascade attempt indicators */}
              {cascadeAttempts && cascadeAttempts.length > 0 && (
                <div className="hidden sm:flex items-center gap-1">
                  {cascadeAttempts.map((model, idx) => (
                    <div key={model} className="flex items-center">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        idx < cascadeAttempts.length 
                          ? "bg-warning-foreground/50" 
                          : "bg-warning-foreground/20"
                      )} />
                      {idx < cascadeAttempts.length - 1 && (
                        <div className="w-2 h-px bg-warning-foreground/30 mx-0.5" />
                      )}
                    </div>
                  ))}
                  <Server className="w-3 h-3 text-warning-foreground/60 ml-1" />
                </div>
              )}

              {/* Queue position - animated */}
              {queuePosition !== undefined && queuePosition > 0 && (
                <div className={cn(
                  "text-center px-4 py-1 rounded-lg transition-all duration-300",
                  isNext 
                    ? "bg-success-foreground/10" 
                    : isAlmostReady 
                      ? "bg-primary-foreground/10"
                      : "bg-warning-foreground/10"
                )}>
                  <div className={cn(
                    "text-xs",
                    isNext 
                      ? "text-success-foreground/70" 
                      : isAlmostReady 
                        ? "text-primary-foreground/70"
                        : "text-warning-foreground/70"
                  )}>Queue Position</div>
                  <div className={cn(
                    "text-2xl font-bold tabular-nums transition-all duration-500",
                    isNext 
                      ? "text-success-foreground scale-110" 
                      : isAlmostReady 
                        ? "text-primary-foreground"
                        : "text-warning-foreground"
                  )}>
                    #{animatedPosition}
                  </div>
                </div>
              )}

              {/* Countdown timer - live */}
              {displayCountdown !== undefined && displayCountdown > 0 && (
                <div className={cn(
                  "flex items-center gap-2 px-4 py-1 rounded-lg",
                  isAlmostReady 
                    ? "bg-primary-foreground/10"
                    : "bg-warning-foreground/10"
                )}>
                  <Clock className={cn(
                    "w-4 h-4 animate-pulse",
                    isAlmostReady ? "text-primary-foreground" : "text-warning-foreground"
                  )} />
                  <div>
                    <div className={cn(
                      "text-xs",
                      isAlmostReady 
                        ? "text-primary-foreground/70"
                        : "text-warning-foreground/70"
                    )}>ETA</div>
                    <div className={cn(
                      "text-lg font-semibold tabular-nums",
                      isAlmostReady 
                        ? "text-primary-foreground"
                        : "text-warning-foreground"
                    )}>
                      {formatTime(displayCountdown)}
                    </div>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {queuePosition !== undefined && queuePosition > 0 && (
                <div className="hidden md:block w-24">
                  <div className="h-2 bg-warning-foreground/20 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isNext 
                          ? "bg-success-foreground" 
                          : isAlmostReady 
                            ? "bg-primary-foreground"
                            : "bg-warning-foreground"
                      )}
                      style={{ 
                        width: `${Math.max(10, 100 - (queuePosition * 10))}%` 
                      }}
                    />
                  </div>
                </div>
              )}

              {onDismiss && (
                <button 
                  onClick={() => {
                    setDismissed(true);
                    onDismiss();
                  }}
                  className={cn(
                    "p-1 rounded-full transition-colors",
                    isNext 
                      ? "hover:bg-success-foreground/10" 
                      : "hover:bg-warning-foreground/10"
                  )}
                >
                  <X className={cn(
                    "w-4 h-4",
                    isNext ? "text-success-foreground" : "text-warning-foreground"
                  )} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook to manage load state
export const useLoadState = () => {
  const [loadState, setLoadState] = useState({
    isHighLoad: false,
    queuePosition: undefined as number | undefined,
    estimatedWait: undefined as number | undefined,
  });

  const setHighLoad = (isHighLoad: boolean, queuePosition?: number, estimatedWait?: number) => {
    setLoadState({ isHighLoad, queuePosition, estimatedWait });
  };

  return { ...loadState, setHighLoad };
};
