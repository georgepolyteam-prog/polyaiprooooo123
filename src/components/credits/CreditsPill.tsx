import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/hooks/useAuth";

interface CreditsPillProps {
  className?: string;
}

export const CreditsPill = ({ className }: CreditsPillProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits, isLoading } = useCredits();
  const [displayCredits, setDisplayCredits] = useState(credits);
  const [isAnimating, setIsAnimating] = useState(false);

  const isEmpty = credits === 0;
  const isLow = credits > 0 && credits <= 10;
  const isHealthy = credits > 10;

  // Animate credit changes
  useEffect(() => {
    if (credits !== displayCredits) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayCredits(credits);
        setIsAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [credits, displayCredits]);

  if (!user) return null;

  return (
    <motion.button
      onClick={() => navigate('/credits')}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 overflow-hidden",
        "backdrop-blur-md border",
        isEmpty && "bg-destructive/10 border-destructive/40 text-destructive",
        isLow && "bg-amber-500/10 border-amber-500/40 text-amber-400",
        isHealthy && "bg-primary/10 border-primary/30 text-primary",
        className
      )}
    >
      {/* Animated gradient border effect */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full opacity-0",
          isEmpty && "bg-gradient-to-r from-destructive/20 via-destructive/40 to-destructive/20",
          isLow && "bg-gradient-to-r from-amber-500/20 via-amber-500/40 to-amber-500/20",
          isHealthy && "bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20"
        )}
        animate={isEmpty || isLow ? { opacity: [0, 0.5, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Inner glow effect */}
      <div
        className={cn(
          "absolute inset-0 rounded-full blur-sm",
          isEmpty && "bg-destructive/10",
          isLow && "bg-amber-500/10",
          isHealthy && "bg-primary/5"
        )}
      />

      <div className="relative flex items-center gap-1.5">
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <>
            {/* Lightning icon with pulse */}
            <motion.div
              animate={isEmpty ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Zap className={cn(
                "w-3.5 h-3.5",
                isEmpty && "fill-destructive",
                isLow && "fill-amber-400",
                isHealthy && "fill-primary"
              )} />
            </motion.div>

            {/* Credit count with animation */}
            <AnimatePresence mode="wait">
              <motion.span
                key={displayCredits}
                initial={{ opacity: 0, y: isAnimating ? -8 : 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="tabular-nums font-semibold"
              >
                {displayCredits}
              </motion.span>
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.button>
  );
};
