import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Filter, Sparkles, Zap, MousePointerClick, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tip?: string;
}

const tourSteps: TourStep[] = [
  {
    id: "markets",
    title: "Click Any Market",
    description: "Tap on a market card to instantly access live data, price charts, order book, and whale activity.",
    icon: <MousePointerClick className="w-6 h-6" />,
    tip: "Multi-outcome events let you pick which question to analyze",
  },
  {
    id: "filters",
    title: "Smart Filters",
    description: "Filter by category, volume, or time. Find trending markets, high liquidity opportunities, or markets ending soon.",
    icon: <Filter className="w-6 h-6" />,
    tip: "Try 'Trending' to see what's hot right now",
  },
  {
    id: "analyze",
    title: "AI-Powered Analysis",
    description: "Click 'Analyze' on any market for instant edge calculations, sentiment analysis, and whale tracking.",
    icon: <Sparkles className="w-6 h-6" />,
    tip: "Get expected value calculations in seconds",
  },
  {
    id: "trade",
    title: "Trade Directly",
    description: "Connect your wallet and trade directly from here. No need to switch tabs or copy-paste links.",
    icon: <Zap className="w-6 h-6" />,
    tip: "Supports both market and limit orders",
  },
];

interface MarketsTourProps {
  onComplete: () => void;
}

export function MarketsTour({ onComplete }: MarketsTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("poly-markets-tour-completed", "true");
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip();
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft" && currentStep > 0) setCurrentStep(prev => prev - 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Animated backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/95 backdrop-blur-xl"
      >
        {/* Floating gradient orbs */}
        <motion.div
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 50, 100, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[150px]"
        />
        <motion.div
          animate={{
            x: [0, -80, -40, 0],
            y: [0, 100, 50, 0],
            scale: [1, 0.8, 1.1, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/15 rounded-full blur-[120px]"
        />
      </motion.div>

      {/* Close button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 z-10 p-3 rounded-full bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main content */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-2xl"
      >
        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-gradient-to-r from-primary via-primary to-secondary"
            />
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-3 mb-10">
          {tourSteps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(idx)}
              className={cn(
                "group flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                idx === currentStep
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : idx < currentStep
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              )}
            >
              {idx < currentStep ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
              )}
              <span className="hidden sm:inline text-sm font-medium">{s.title.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Content card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-3xl bg-card border border-border/50 shadow-2xl"
          >
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary/50" />

            <div className="p-8 md:p-10">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-8 text-primary mx-auto"
              >
                {step.icon}
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4"
              >
                {step.title}
              </motion.h2>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-muted-foreground text-center max-w-lg mx-auto mb-6"
              >
                {step.description}
              </motion.p>

              {/* Tip */}
              {step.tip && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-center justify-center gap-2 text-sm text-primary bg-primary/10 rounded-xl px-4 py-3 max-w-md mx-auto"
                >
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span>{step.tip}</span>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="px-8 pb-8 md:px-10 md:pb-10">
              <div className="flex items-center justify-between gap-4">
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
                      onClick={() => setCurrentStep(prev => prev - 1)}
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    onClick={handleNext}
                    className="gap-2 px-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  >
                    {isLastStep ? "Start Exploring" : "Next"}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Step counter */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Step {currentStep + 1} of {tourSteps.length}
        </p>
      </motion.div>
    </div>
  );
}
