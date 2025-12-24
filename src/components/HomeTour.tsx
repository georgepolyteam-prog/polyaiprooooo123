import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X, ChevronRight, ChevronLeft, BarChart3, Target, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right";
  icon: React.ComponentType<{ className?: string }>;
}

const tourSteps: TourStep[] = [
  {
    target: ".chat-input",
    title: "Welcome to Poly",
    content: "Paste any Polymarket URL or ask a question to get instant AI analysis with real-time market data.",
    placement: "top",
    icon: Sparkles,
  },
  {
    target: ".example-markets",
    title: "Try Example Markets",
    content: "Click any of these live markets to see Poly in action - we'll analyze whale activity, orderflow, and find edges.",
    placement: "top",
    icon: Target,
  },
  {
    target: ".dashboard-link",
    title: "Dashboard",
    content: "For deep analysis, use the Dashboard. Get comprehensive data: live orderbook, whale tracking, and price charts.",
    placement: "bottom",
    icon: BarChart3,
  },
];

// Simple debounce utility
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export const HomeTour = () => {
  const [isActive, setIsActive] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const isMobile = useRef(window.innerWidth < 768);

  const step = tourSteps[currentStep];
  const Icon = step?.icon;

  const updateTargetPosition = useCallback(() => {
    if (!step) return;
    const element = document.querySelector(step.target);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
    }
  }, [step]);

  // Debounced version for scroll/resize
  const debouncedUpdatePosition = useMemo(
    () => debounce(updateTargetPosition, 100),
    [updateTargetPosition]
  );

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("poly-home-tour-completed");
    if (!hasSeenTour) {
      // Reduced from 1000ms to 300ms for faster startup
      const timer = setTimeout(() => {
        setIsActive(true);
        updateTargetPosition();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [updateTargetPosition]);

  useEffect(() => {
    if (!isActive) return;
    updateTargetPosition();
    
    // Use debounced handlers for better performance
    window.addEventListener("resize", debouncedUpdatePosition);
    window.addEventListener("scroll", debouncedUpdatePosition, { passive: true });
    
    return () => {
      window.removeEventListener("resize", debouncedUpdatePosition);
      window.removeEventListener("scroll", debouncedUpdatePosition);
    };
  }, [isActive, currentStep, updateTargetPosition, debouncedUpdatePosition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      if (e.key === "Escape") closeTour();
      if (e.key === "ArrowRight" || e.key === "Enter") nextStep();
      if (e.key === "ArrowLeft" && currentStep > 0) prevStep();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, currentStep]);

  const closeTour = () => {
    // Fade out animation before hiding
    setIsExiting(true);
    setTimeout(() => {
      setIsActive(false);
      setIsExiting(false);
      localStorage.setItem("poly-home-tour-completed", "true");
    }, 200);
  };

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      closeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!isActive || !targetRect) return null;

  const getTooltipPosition = () => {
    const padding = 16;
    const tooltipWidth = isMobile.current ? Math.min(320, window.innerWidth - 32) : 340;
    const tooltipHeight = 220;

    let top = 0;
    let left = 0;

    switch (step.placement) {
      case "top":
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - padding;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + padding;
        break;
    }

    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    return { top, left };
  };

  const tooltipPos = getTooltipPosition();
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <div className={cn(
      "transition-opacity duration-200",
      isExiting ? "opacity-0" : "opacity-100"
    )}>
      {/* Simple dark overlay - no heavy blur or gradients on mobile */}
      <div 
        className="fixed inset-0 z-[9998] pointer-events-none bg-black/80"
      />

      {/* Spotlight border - no animate-pulse on mobile for performance */}
      <div
        className={cn(
          "fixed z-[9999] pointer-events-none rounded-xl border-2 border-primary",
          "md:animate-pulse" // Only pulse on desktop
        )}
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          boxShadow: "0 0 0 4px hsl(var(--primary) / 0.2), 0 0 40px 8px hsl(var(--primary) / 0.3)",
        }}
      />

      {/* Click catcher */}
      <div 
        className="fixed inset-0 z-[9999]"
        onClick={closeTour}
      />

      {/* Tooltip - no backdrop-blur on mobile */}
      <div
        className="fixed z-[10000] w-[min(340px,calc(100vw-32px))] animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(
          "relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
          "md:bg-card/95 md:backdrop-blur-xl" // Only blur on desktop
        )}>
          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 gradient-bg" />

          {/* Close button */}
          <button
            onClick={closeTour}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 pt-7">
            {/* Icon and Title */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {step.title}
              </h3>
            </div>

            {/* Content */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {step.content}
            </p>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mb-4">
              {tourSteps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === currentStep 
                      ? "w-6 bg-primary" 
                      : i < currentStep 
                        ? "w-1.5 bg-primary/50" 
                        : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={closeTour}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="flex items-center gap-1 px-5 py-2 text-sm font-semibold gradient-bg text-white rounded-lg hover:opacity-90 transition-all shadow-sm"
                >
                  {isLastStep ? "Get Started" : "Next"}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow pointing to element */}
        <div
          className={cn(
            "absolute w-3 h-3 bg-card border border-border rotate-45 md:bg-card/95",
            step.placement === "top" && "bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0",
            step.placement === "bottom" && "top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0",
            step.placement === "left" && "right-[-6px] top-1/2 -translate-y-1/2 border-t-0 border-r-0",
            step.placement === "right" && "left-[-6px] top-1/2 -translate-y-1/2 border-b-0 border-l-0"
          )}
        />
      </div>
    </div>
  );
};
