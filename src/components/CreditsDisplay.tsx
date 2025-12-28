import { useState, useEffect } from "react";
import { Zap, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCredits } from "@/hooks/useCredits";
import { DepositCreditsDialog } from "@/components/credits/DepositCreditsDialog";
import { useAuth } from "@/hooks/useAuth";

interface CreditsDisplayProps {
  className?: string;
}

export const CreditsDisplay = ({ className }: CreditsDisplayProps) => {
  const { user } = useAuth();
  const { credits, totalSpent, isLoading, refetch } = useCredits();
  const [isOpen, setIsOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const isLow = credits <= 10;
  const isEmpty = credits === 0;

  // Listen for open-credits-dialog event (triggered when user runs out of credits)
  useEffect(() => {
    const handleOpenDialog = () => {
      setIsDepositOpen(true);
    };

    window.addEventListener("open-credits-dialog", handleOpenDialog);
    return () => window.removeEventListener("open-credits-dialog", handleOpenDialog);
  }, []);

  if (!user) {
    return null;
  }

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
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>{credits} credits</span>
          </>
        )}
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
              <div className="text-5xl font-semibold text-foreground tabular-nums">
                {isLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : credits}
              </div>
              <div className="text-sm text-muted-foreground mt-1">credits remaining</div>

              <Progress
                value={Math.min((credits / 1000) * 100, 100)}
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
                <div className="text-2xl font-semibold text-foreground">{totalSpent}</div>
                <div className="text-xs text-muted-foreground mt-1">Total used</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <div className="text-2xl font-semibold text-foreground">1</div>
                <div className="text-xs text-muted-foreground mt-1">Per analysis</div>
              </div>
            </div>

            {/* Info */}
            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-4">
              <p>Each AI analysis costs 1 credit. Deposit POLY tokens to get more credits.</p>
            </div>

            {/* Get More Credits */}
            <Button 
              className="w-full gap-2" 
              variant={isEmpty ? "default" : "outline"}
              onClick={() => {
                setIsOpen(false);
                setIsDepositOpen(true);
              }}
            >
              <span>Get More Credits</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
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

// Legacy export for backwards compatibility
export { useCredits } from "@/hooks/useCredits";