import { useEffect, useState, useMemo } from "react";
import { Loader2, Check, Search, BarChart3, Newspaper, Fish, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import polyLogo from "@/assets/poly-logo-new.png";

interface AnalysisStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  duration: number;
  completedText?: string;
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  { 
    id: 'analyzing', 
    label: 'Analyzing market...', 
    icon: <Search className="w-4 h-4" />,
    duration: 1200,
    completedText: 'Market identified'
  },
  { 
    id: 'fetching', 
    label: 'Fetching live data from Dome...', 
    icon: <BarChart3 className="w-4 h-4" />,
    duration: 1500,
    completedText: 'Live data loaded'
  },
  { 
    id: 'news', 
    label: 'Searching for recent news...', 
    icon: <Newspaper className="w-4 h-4" />,
    duration: 1200,
    completedText: 'News scanned'
  },
  { 
    id: 'whales', 
    label: 'Checking whale activity...', 
    icon: <Fish className="w-4 h-4" />,
    duration: 1200,
    completedText: 'Whale data analyzed'
  },
  { 
    id: 'edge', 
    label: 'Analyzing edge opportunities...', 
    icon: <Sparkles className="w-4 h-4" />,
    duration: 1500,
    completedText: 'Edge calculated'
  },
];

const DEEP_RESEARCH_STEPS: AnalysisStep[] = [
  { 
    id: 'deep_research', 
    label: 'Running deep research...', 
    icon: <Sparkles className="w-4 h-4" />,
    duration: 3000,
    completedText: 'Research initiated'
  },
  { 
    id: 'fetching', 
    label: 'Searching the web...', 
    icon: <Search className="w-4 h-4" />,
    duration: 4000,
    completedText: 'Web sources found'
  },
  { 
    id: 'analyzing', 
    label: 'Analyzing multiple sources...', 
    icon: <BarChart3 className="w-4 h-4" />,
    duration: 5000,
    completedText: 'Sources analyzed'
  },
  { 
    id: 'synthesizing', 
    label: 'Synthesizing comprehensive report...', 
    icon: <Newspaper className="w-4 h-4" />,
    duration: 3000,
    completedText: 'Report ready'
  },
];

// Personality variations for status messages (no emojis)
const STATUS_VARIATIONS: Record<string, string[]> = {
  analyzing: [
    'Analyzing market...',
    'Let me take a look...',
    'Examining this one...',
  ],
  fetching: [
    'Fetching live data from Dome...',
    'Pulling real-time orderflow...',
    'Getting the latest trades...',
  ],
  news: [
    'Searching for recent news...',
    'Checking what\'s happening...',
    'Looking for relevant events...',
  ],
  whales: [
    'Checking whale activity...',
    'Tracking smart money...',
    'Analyzing large positions...',
  ],
  edge: [
    'Analyzing edge opportunities...',
    'Crunching the numbers...',
    'Calculating potential value...',
  ],
  deep_research: [
    'Running deep research...',
    'Initiating comprehensive analysis...',
    'Starting deep dive...',
  ],
  synthesizing: [
    'Synthesizing comprehensive report...',
    'Compiling research findings...',
    'Preparing detailed analysis...',
  ],
};

export interface AnalysisStats {
  tradeCount?: number;
  whaleCount?: number;
  buyPressure?: number;
  volume24h?: number;
}

interface AnalysisStatusProps {
  className?: string;
  stats?: AnalysisStats;
}

export function AnalysisStatus({ className, stats }: AnalysisStatusProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Get a random variation for the current step - memoized to not change during render
  const statusVariations = useMemo(() => {
    return ANALYSIS_STEPS.map(step => {
      const variations = STATUS_VARIATIONS[step.id];
      if (variations && variations.length > 0) {
        const randomIndex = Math.floor(Math.random() * variations.length);
        return variations[randomIndex];
      }
      return step.label;
    });
  }, []);

  useEffect(() => {
    const currentStep = ANALYSIS_STEPS[currentStepIndex];
    if (!currentStep) return;

    const timer = setTimeout(() => {
      // Mark current step as completed
      setCompletedSteps(prev => [...prev, currentStep.id]);
      
      // Move to next step
      if (currentStepIndex < ANALYSIS_STEPS.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      }
    }, currentStep.duration);

    return () => clearTimeout(timer);
  }, [currentStepIndex]);

  const currentStep = ANALYSIS_STEPS[currentStepIndex];

  // Generate completed step text with real stats when available
  const getCompletedText = (stepId: string) => {
    const step = ANALYSIS_STEPS.find(s => s.id === stepId);
    if (!step) return null;

    // Show real stats if available
    if (stats) {
      switch (stepId) {
        case 'fetching':
          if (stats.tradeCount) return `Found ${stats.tradeCount} trades in 24h`;
          break;
        case 'whales':
          if (stats.whaleCount !== undefined) return `Detected ${stats.whaleCount} whale trades`;
          break;
        case 'edge':
          if (stats.buyPressure !== undefined) return `Buy pressure: ${stats.buyPressure}%`;
          break;
      }
    }

    return step.completedText;
  };

  return (
    <div className={cn("flex gap-3 sm:gap-4 animate-fade-in", className)}>
      {/* Avatar */}
      <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
        <div className="absolute inset-0 blur-xl bg-primary/30 rounded-full animate-pulse" />
        <div className="relative w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center ring-2 ring-primary/30">
          <img src={polyLogo} alt="Poly" className="w-5 h-5 sm:w-7 sm:h-7 object-contain" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-sm sm:max-w-md">
        <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-primary/20 p-3 sm:p-4 shadow-lg shadow-purple-500/5">
          {/* Current step with spinner */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-spin flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-foreground">
              {currentStep ? statusVariations[currentStepIndex] : 'Processing...'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1 mb-3">
            {ANALYSIS_STEPS.map((step, i) => (
              <div 
                key={step.id}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-500",
                  i <= currentStepIndex ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Completed steps */}
          {completedSteps.length > 0 && (
            <div className="space-y-1">
              {completedSteps.slice(-3).map(stepId => {
                const completedText = getCompletedText(stepId);
                if (!completedText) return null;
                return (
                  <div key={stepId} className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
                    <Check className="w-3 h-3 text-success flex-shrink-0" />
                    <span>{completedText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
