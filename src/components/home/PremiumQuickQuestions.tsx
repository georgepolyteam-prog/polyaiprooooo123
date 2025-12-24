import { Lock, Sparkles } from "lucide-react";

interface PremiumQuickQuestionsProps {
  questions: string[];
  isAuthenticated: boolean;
  isProcessing: boolean;
  onQuestionClick: (question: string) => void;
}

export const PremiumQuickQuestions = ({
  questions,
  isAuthenticated,
  isProcessing,
  onQuestionClick,
}: PremiumQuickQuestionsProps) => {
  return (
    <div className="animate-fade-in" style={{ animationDelay: '500ms' }}>
      <div className="flex items-center justify-center gap-2 mb-4 sm:mb-6">
        <div className="h-px flex-1 max-w-12 sm:max-w-20 bg-gradient-to-r from-transparent to-border" />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Start</p>
        </div>
        <div className="h-px flex-1 max-w-12 sm:max-w-20 bg-gradient-to-l from-transparent to-border" />
      </div>
      
      {/* Horizontal scroll on mobile, wrap on desktop */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-4 px-1 -mx-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center sm:overflow-visible scrollbar-hide">
        {questions.map((question, i) => (
          <button
            key={i}
            onClick={() => onQuestionClick(question)}
            disabled={isProcessing}
            className={`group px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 flex-shrink-0 first:ml-4 sm:first:ml-0 active:scale-95 ${
              isAuthenticated 
                ? 'glass-card-hover border border-border/50 text-foreground hover:border-primary/50 hover:text-primary hover:shadow-glow' 
                : 'bg-muted/30 border border-border/30 text-muted-foreground cursor-not-allowed'
            }`}
          >
            <span className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
              {!isAuthenticated && <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              {question}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
