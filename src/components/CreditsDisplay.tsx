import { useState, useEffect } from "react";
import { Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface CreditsDisplayProps {
  className?: string;
}

export const CreditsDisplay = ({ className }: CreditsDisplayProps) => {
  const [credits, setCredits] = useState(() => {
    const stored = localStorage.getItem("echo-credits");
    return stored ? parseInt(stored, 10) : 100;
  });
  const [usedToday, setUsedToday] = useState(() => {
    const stored = localStorage.getItem("echo-credits-used-today");
    const date = localStorage.getItem("echo-credits-date");
    const today = new Date().toDateString();
    if (date !== today) {
      localStorage.setItem("echo-credits-date", today);
      localStorage.setItem("echo-credits-used-today", "0");
      return 0;
    }
    return stored ? parseInt(stored, 10) : 0;
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleCreditUse = () => {
      setCredits((prev) => {
        const newCredits = Math.max(0, prev - 1);
        localStorage.setItem("echo-credits", String(newCredits));
        return newCredits;
      });
      setUsedToday((prev) => {
        const newUsed = prev + 1;
        localStorage.setItem("echo-credits-used-today", String(newUsed));
        return newUsed;
      });
    };

    window.addEventListener("echo-credit-used", handleCreditUse);
    return () => window.removeEventListener("echo-credit-used", handleCreditUse);
  }, []);

  const isLow = credits <= 10;
  const isEmpty = credits === 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all duration-150 cursor-pointer",
          isEmpty
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : isLow
              ? "bg-accent/10 text-accent border border-accent/20"
              : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
          className,
        )}
      >
        <Zap className="w-4 h-4" />
        <span>{credits} credits</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Your Credits
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Credit Balance */}
            <div className="text-center py-6 bg-muted/50 rounded-lg">
              <div className="text-5xl font-semibold text-foreground tabular-nums">{credits}</div>
              <div className="text-sm text-muted-foreground mt-1">credits remaining</div>

              <Progress
                value={(credits / 100) * 100}
                className={cn(
                  "h-2 mt-4 mx-auto max-w-[200px]",
                  isEmpty && "[&>div]:bg-destructive",
                  isLow && !isEmpty && "[&>div]:bg-accent",
                )}
              />
            </div>

            {/* Usage Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <div className="text-2xl font-semibold text-foreground">{usedToday}</div>
                <div className="text-xs text-muted-foreground mt-1">Used today</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <div className="text-2xl font-semibold text-foreground">1</div>
                <div className="text-xs text-muted-foreground mt-1">Per analysis</div>
              </div>
            </div>

            {/* Info */}
            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-4">
              <p>Each AI analysis costs 1 credit. You started with 100 free credits.</p>
            </div>

            {/* Get More Credits */}
            <Button className="w-full gap-2" variant={isEmpty ? "default" : "outline"} disabled>
              <span>Get More Credits</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">Coming Soon</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const useCredits = () => {
  const useCredit = () => {
    window.dispatchEvent(new CustomEvent("echo-credit-used"));
  };

  const getCredits = () => {
    const stored = localStorage.getItem("echo-credits");
    return stored ? parseInt(stored, 10) : 100;
  };

  const hasCredits = () => getCredits() > 0;

  return { useCredit, getCredits, hasCredits };
};