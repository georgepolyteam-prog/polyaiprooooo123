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
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="h-px flex-1 max-w-20 bg-gradient-to-r from-transparent to-border" />
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Start</p>
        </div>
        <div className="h-px flex-1 max-w-20 bg-gradient-to-l from-transparent to-border" />
      </div>
      
      <div className="flex flex-wrap justify-center gap-3">
        {questions.map((question, i) => (
          <button
            key={i}
            onClick={() => onQuestionClick(question)}
            disabled={isProcessing}
            className={`group px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
              isAuthenticated 
                ? 'glass-card-hover border border-border/50 text-foreground hover:border-primary/50 hover:text-primary hover:shadow-glow' 
                : 'bg-muted/30 border border-border/30 text-muted-foreground cursor-not-allowed'
            }`}
          >
            <span className="flex items-center gap-2">
              {!isAuthenticated && <Lock className="w-3.5 h-3.5" />}
              {question}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
