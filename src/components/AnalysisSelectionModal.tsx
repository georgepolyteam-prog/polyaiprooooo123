import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface MarketContext {
  eventTitle: string;
  outcomeQuestion: string;
  currentOdds: number;
  volume: number;
  url: string;
  slug: string;
  eventSlug: string;
  image?: string;
}

interface AnalysisSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketContext: MarketContext | null;
  onSelect: (type: 'quick' | 'deep') => void;
}

export function AnalysisSelectionModal({
  open,
  onOpenChange,
  marketContext,
  onSelect,
}: AnalysisSelectionModalProps) {
  if (!marketContext) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent elevated className="sm:max-w-md p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50 overflow-hidden">
        {/* Header with market preview */}
        <div className="relative p-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold text-foreground pr-8">
            {marketContext.outcomeQuestion || marketContext.eventTitle}
          </DialogTitle>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">
              Current odds: <span className="text-foreground font-medium">{Math.round(marketContext.currentOdds * 100)}%</span>
            </span>
          </div>
        </div>

        {/* Quick Analysis Card */}
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4">Get AI insights on this market</p>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('quick')}
            className="relative group w-full p-5 rounded-xl text-left transition-all duration-200 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-3 shadow-lg shadow-primary/20">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">AI Analysis</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fast AI insights on odds, volume & trading edge
              </p>
            </div>
          </motion.button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
