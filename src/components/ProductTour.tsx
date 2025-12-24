import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right";
}

const tourSteps: TourStep[] = [
  {
    target: ".video-demo-container",
    title: "Watch Poly in Action",
    content: "See how Poly analyzes markets in real-time. This demo shows AI-powered edge detection on live Polymarket events.",
    placement: "bottom",
  },
  {
    target: ".chat-input-container",
    title: "Ask Poly Anything",
    content: "Type any question about Polymarket events or paste a market URL for instant AI analysis.",
    placement: "top",
  },
  {
    target: ".detail-mode-toggle",
    title: "Quick vs Deep Analysis",
    content: "Toggle between fast summaries and comprehensive deep-dive analysis with full reasoning.",
    placement: "top",
  },
  {
    target: ".suggestions-container",
    title: "Try These Examples",
    content: "Click any suggestion to see Poly's analysis capabilities. Great starting points for new users.",
    placement: "top",
  },
  {
    target: ".stats-container",
    title: "Performance Metrics",
    content: "Track Poly's accuracy and the markets being analyzed across the platform.",
    placement: "top",
  },
];

export const ProductTour = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const step = tourSteps[currentStep];

  const updateTargetPosition = useCallback(() => {
    if (!step) return;
    const element = document.querySelector(step.target);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
    }
  }, [step]);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("poly-tour-completed");
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setIsActive(true);
        updateTargetPosition();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [updateTargetPosition]);

  useEffect(() => {
    if (!isActive) return;
    updateTargetPosition();
    
    // Update position on resize/scroll without moving the page
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition, { passive: true });
    
    return () => {
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition);
    };
  }, [isActive, currentStep, updateTargetPosition]);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isActive) {
        closeTour();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  const closeTour = () => {
    setIsActive(false);
    if (dontShowAgain || currentStep === tourSteps.length - 1) {
      localStorage.setItem("poly-tour-completed", "true");
    }
  };

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      closeTour();
      localStorage.setItem("poly-tour-completed", "true");
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
    const tooltipWidth = 320;
    const tooltipHeight = 200;

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

    // Keep tooltip in viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    return { top, left };
  };

  const tooltipPos = getTooltipPosition();
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div 
        className="fixed inset-0 z-[9998] pointer-events-none"
        onClick={closeTour}
        style={{
          background: `radial-gradient(
            ellipse ${targetRect.width + 32}px ${targetRect.height + 32}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px,
            transparent 0%,
            transparent 70%,
            rgba(0, 0, 0, 0.85) 100%
          )`,
        }}
      />

      {/* Spotlight border with pulse */}
      <div
        className="fixed z-[9999] pointer-events-none rounded-xl border-2 border-primary/60 animate-pulse"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          boxShadow: "0 0 0 4px hsl(var(--primary) / 0.2), 0 0 40px 8px hsl(var(--primary) / 0.3)",
        }}
      />

      {/* Click catcher for "click outside to close" */}
      <div 
        className="fixed inset-0 z-[9999]"
        onClick={closeTour}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[10000] w-80 animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-card/95 backdrop-blur-xl border border-border/30 rounded-2xl shadow-2xl overflow-hidden">
          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />

          {/* Close button */}
          <button
            onClick={closeTour}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 pt-7">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-medium text-muted-foreground">
                {currentStep + 1} of {tourSteps.length}
              </span>
              <div className="flex gap-1">
                {tourSteps.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      i === currentStep ? "bg-primary" : i < currentStep ? "bg-primary/50" : "bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <h3 className="text-base font-semibold text-foreground mb-2">
              {step.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {step.content}
            </p>

            {/* Don't show again checkbox (last step) */}
            {isLastStep && (
              <label className="flex items-center gap-2 mb-4 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary/50"
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  Don't show this again
                </span>
              </label>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={closeTour}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  {isLastStep ? "Get Started" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow pointing to element */}
        <div
          className={cn(
            "absolute w-3 h-3 bg-card/95 border border-border/30 rotate-45",
            step.placement === "top" && "bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0",
            step.placement === "bottom" && "top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0",
            step.placement === "left" && "right-[-6px] top-1/2 -translate-y-1/2 border-t-0 border-r-0",
            step.placement === "right" && "left-[-6px] top-1/2 -translate-y-1/2 border-b-0 border-l-0"
          )}
        />
      </div>
    </>
  );
};
