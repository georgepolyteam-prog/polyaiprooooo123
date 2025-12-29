import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ChevronRight, Loader2, Sparkles, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/hooks/useCredits";
import { DepositCreditsDialog } from "@/components/credits/DepositCreditsDialog";
import { CreditsPill } from "@/components/credits/CreditsPill";
import { useAuth } from "@/hooks/useAuth";

interface CreditsDisplayProps {
  className?: string;
}

export const CreditsDisplay = ({ className }: CreditsDisplayProps) => {
  const { user } = useAuth();
  const { credits, totalSpent, isLoading, refetch } = useCredits();
  const [isOpen, setIsOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const isEmpty = credits === 0;
  const isLow = credits > 0 && credits <= 10;

  // Listen for open-credits-dialog event
  useEffect(() => {
    const handleOpenDialog = () => setIsDepositOpen(true);
    window.addEventListener("open-credits-dialog", handleOpenDialog);
    return () => window.removeEventListener("open-credits-dialog", handleOpenDialog);
  }, []);

  if (!user) return null;

  return (
    <>
      <CreditsPill onClick={() => setIsOpen(true)} className={className} />

      {/* Premium Credits Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50 overflow-hidden">
          {/* Header with gradient */}
          <div className="relative px-6 pt-6 pb-4">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <span className="font-semibold text-foreground">Your Balance</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Main Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative rounded-2xl p-6 overflow-hidden",
                "bg-gradient-to-br from-muted/80 to-muted/40",
                "border border-border/50"
              )}
            >
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                  backgroundSize: '24px 24px'
                }} />
              </div>

              {/* Glow effect based on state */}
              <div className={cn(
                "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20",
                isEmpty && "bg-destructive",
                isLow && "bg-amber-500",
                !isEmpty && !isLow && "bg-primary"
              )} />

              <div className="relative text-center">
                {/* Large credit number */}
                <div className="flex items-center justify-center gap-1">
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={credits}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={cn(
                          "text-5xl font-bold tabular-nums tracking-tight",
                          isEmpty && "text-destructive",
                          isLow && "text-amber-400",
                          !isEmpty && !isLow && "text-foreground"
                        )}
                      >
                        {credits.toLocaleString()}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mt-1 font-medium">
                  credits available
                </p>

                {/* Progress bar */}
                <div className="mt-4 h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((credits / 500) * 100, 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      isEmpty && "bg-destructive",
                      isLow && "bg-gradient-to-r from-amber-500 to-amber-400",
                      !isEmpty && !isLow && "bg-gradient-to-r from-primary to-primary/60"
                    )}
                  />
                </div>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-xl bg-muted/50 border border-border/30"
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Total Used</span>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {totalSpent.toLocaleString()}
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="p-4 rounded-xl bg-muted/50 border border-border/30"
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Per Analysis</span>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">1</span>
              </motion.div>
            </div>

            {/* Exchange Rate */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary/5 border border-primary/10"
            >
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                1 POLY = <span className="text-primary">1</span> Credit
              </span>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Button
                onClick={() => {
                  setIsOpen(false);
                  setIsDepositOpen(true);
                }}
                className={cn(
                  "w-full h-12 text-base font-semibold gap-2 rounded-xl",
                  "bg-gradient-to-r from-primary to-primary/80",
                  "hover:from-primary/90 hover:to-primary/70",
                  "shadow-lg shadow-primary/20",
                  "transition-all duration-300"
                )}
              >
                <Zap className="w-4 h-4" />
                Deposit POLY
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      <DepositCreditsDialog
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        onSuccess={refetch}
      />
    </>
  );
};

export { useCredits } from "@/hooks/useCredits";
