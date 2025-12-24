import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Fish, Filter, BarChart3, Users, Download, 
  X, ChevronLeft, ChevronRight, Volume2, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_STORAGE_KEY = "poly-live-trades-tour-completed";

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip: string;
  color: string;
}

const tourSteps: TourStep[] = [
  {
    icon: <Activity className="w-8 h-8" />,
    title: "Live Trade Feed",
    description: "Watch every Polymarket trade happen in real-time. Trades stream directly from the blockchain as they're executed.",
    tip: "Click any trade to see full details including wallet address and transaction hash.",
    color: "from-emerald-500 to-cyan-500",
  },
  {
    icon: <Fish className="w-8 h-8" />,
    title: "Whale Alerts",
    description: "Trades over $1,000 are flagged as whales. Mega whales ($10k+) get special highlighting and pulse animations.",
    tip: "Enable sound alerts to get notified when whales make moves!",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: <Filter className="w-8 h-8" />,
    title: "Smart Filters",
    description: "Filter by buy/sell, minimum volume, specific markets, YES/NO tokens, and more. Find exactly what you're looking for.",
    tip: "Use 'Whales Only' to focus on the big money moves.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: <BarChart3 className="w-8 h-8" />,
    title: "Market Heatmap",
    description: "See which markets are getting the most action. The heatmap shows volume concentration across active markets.",
    tip: "Hot markets often signal breaking news or major events.",
    color: "from-rose-500 to-red-500",
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Top Traders",
    description: "Track the wallets making the biggest moves. See their total volume, trade count, and buy/sell ratio.",
    tip: "Click a wallet to view their full trading profile.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: <Download className="w-8 h-8" />,
    title: "Export & Analyze",
    description: "Download filtered trades as CSV for your own analysis. Pause the feed to examine specific trades without missing new ones.",
    tip: "Paused trades queue up and resume when you're ready.",
    color: "from-teal-500 to-emerald-500",
  },
];

interface LiveTradesTourProps {
  onComplete?: () => void;
}

export function LiveTradesTour({ onComplete }: LiveTradesTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!hasCompletedTour) {
      // Small delay to let the page load first
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setIsOpen(false);
    onComplete?.();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "Escape") completeTour();
    if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
    if (e.key === "ArrowLeft") handlePrev();
  }, [isOpen, completeTour, handleNext, handlePrev]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const step = tourSteps[currentStep];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={completeTour}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Progress Bar */}
            <div className="h-1 bg-muted">
              <motion.div
                className={`h-full bg-gradient-to-r ${step.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Close Button */}
            <button
              onClick={completeTour}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="p-6 pt-8">
              {/* Icon */}
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white mx-auto mb-6 shadow-lg`}
              >
                {step.icon}
              </motion.div>

              {/* Title */}
              <motion.h2
                key={`title-${currentStep}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-center mb-3 text-foreground"
              >
                {step.title}
              </motion.h2>

              {/* Description */}
              <motion.p
                key={`desc-${currentStep}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center text-muted-foreground mb-4 leading-relaxed"
              >
                {step.description}
              </motion.p>

              {/* Tip Box */}
              <motion.div
                key={`tip-${currentStep}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-muted/50 rounded-lg p-3 flex items-start gap-2"
              >
                <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">{step.tip}</p>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
              {/* Step Counter */}
              <div className="flex items-center gap-1.5">
                {tourSteps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentStep 
                        ? `w-6 bg-gradient-to-r ${step.color}` 
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrev}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </Button>
                )}
                
                <Button
                  size="sm"
                  onClick={handleNext}
                  className={`gap-1 bg-gradient-to-r ${step.color} text-white hover:opacity-90`}
                >
                  {currentStep === tourSteps.length - 1 ? (
                    "Get Started"
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Skip Link */}
            <div className="pb-4 text-center">
              <button
                onClick={completeTour}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour (Esc)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
