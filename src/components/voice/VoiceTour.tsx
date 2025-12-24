import { useState, useEffect, useCallback } from "react";
import { X, Mic, MessageSquare, Zap, ThumbsUp, Link2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TourStep {
  target: string;
  title: string;
  content: string;
  icon: React.ReactNode;
  example?: string;
}

const tourSteps: TourStep[] = [
  {
    target: ".voice-mic-button",
    title: "Speak Naturally",
    content:
      "Tap the microphone and ask Poly anything about Polymarket markets. Poly responds with voice—like a real conversation with your personal analyst.",
    icon: <Mic className="w-5 h-5" />,
    example: '"What\'s the edge on Bitcoin hitting 100k by year end?"',
  },
  {
    target: ".voice-suggestions",
    title: "Poly's Specialties",
    content:
      "Poly excels at edge calculations, whale tracking, and real-time Polymarket market analysis. Try these prompts to see it at its best.",
    icon: <MessageSquare className="w-5 h-5" />,
    example: '"Who\'s betting big on the election right now?"',
  },
  {
    target: ".voice-url-input",
    title: "Instant Market Analysis",
    content:
      "Paste any Polymarket URL and Poly will analyze it immediately — no need to open it separately. Get edge calculations, liquidity analysis, and whale activity in seconds.",
    icon: <Link2 className="w-5 h-5" />,
    example: "Just paste and Poly analyzes automatically",
  },
  {
    target: ".voice-cancel-btn",
    title: "Full Control",
    content:
      "Interrupt Poly anytime it's speaking or processing. Tap to stop, ask something new, or cancel a request. You're always in control.",
    icon: <Volume2 className="w-5 h-5" />,
  },
  {
    target: ".voice-feedback",
    title: "Shape Poly's Future",
    content:
      "Rate responses and report issues. Your feedback is reviewed by our team to improve accuracy and add new capabilities.",
    icon: <ThumbsUp className="w-5 h-5" />,
  },
];

interface VoiceTourProps {
  onComplete: () => void;
}

export const VoiceTour = ({ onComplete }: VoiceTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem("poly-ai-voice-tour-completed", "true");
      setIsVisible(false);
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("poly-ai-voice-tour-completed", "true");
    setIsVisible(false);
    onComplete();
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip();
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handleBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Tour Card */}
      <div className="relative z-10 w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl">
          {/* Gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />
          
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-8">
            {/* Progress */}
            <div className="flex items-center gap-2 mb-6">
              {tourSteps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    i === currentStep 
                      ? "bg-primary" 
                      : i < currentStep 
                        ? "bg-primary/50" 
                        : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
              {step.icon}
            </div>

            {/* Content */}
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              {step.title}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {step.content}
            </p>

            {/* Example */}
            {step.example && (
              <div className="px-4 py-3 rounded-xl bg-muted/50 border border-border/50 mb-6">
                <p className="text-sm text-muted-foreground mb-1">Try saying:</p>
                <p className="text-sm font-medium text-foreground italic">
                  {step.example}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour
              </button>

              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="px-6"
                >
                  {isLastStep ? "Get Started" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Step counter */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          Step {currentStep + 1} of {tourSteps.length}
        </p>
      </div>
    </div>
  );
};
