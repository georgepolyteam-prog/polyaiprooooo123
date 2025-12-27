import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, 
  Target, 
  TrendingUp, 
  Wallet, 
  Eye, 
  Zap, 
  BarChart3, 
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface WalletHowItWorksProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  {
    icon: Eye,
    title: "Track Any Wallet",
    description: "Enter any Polymarket wallet address to see their complete trading history, performance metrics, and active positions.",
    gradient: "from-poly-purple to-poly-cyan",
    tip: "Tip: Find wallets from the leaderboard or live trades"
  },
  {
    icon: BarChart3,
    title: "Analyze Performance",
    description: "View detailed PnL charts, win rates, volume metrics, and trading patterns. Understand their strategy at a glance.",
    gradient: "from-poly-cyan to-success",
    tip: "Tip: Check the buy/sell ratio to understand their bias"
  },
  {
    icon: TrendingUp,
    title: "See Hot Markets",
    description: "Discover which markets they trade most actively. High volume = high conviction. Follow the smart money.",
    gradient: "from-success to-poly-pink",
    tip: "Tip: Markets they trade repeatedly often have edge"
  },
  {
    icon: Target,
    title: "Track for Updates",
    description: "Add wallets to your tracked list to filter them in Live Trades. Get instant visibility when they make moves.",
    gradient: "from-poly-pink to-poly-purple",
    tip: "Tip: Track whales to see their trades in real-time"
  }
];

const features = [
  { label: "24H/7D/30D Data", icon: Zap },
  { label: "PnL Tracking", icon: TrendingUp },
  { label: "Hot Markets", icon: Sparkles },
  { label: "Trade History", icon: BarChart3 },
];

function HowItWorksContent({ onClose }: { onClose: () => void }) {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="relative">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-poly-purple/5 via-transparent to-poly-cyan/5 rounded-2xl" />
      
      <div className="relative space-y-6 p-1">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-poly-purple/20 to-poly-cyan/20 border border-poly-purple/30">
            <Sparkles className="w-4 h-4 text-poly-cyan" />
            <span className="text-sm font-medium">Wallet Analytics</span>
          </div>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Deep dive into any trader's performance and strategy
          </p>
        </div>

        {/* Step Cards */}
        <div className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = activeStep === i;
            
            return (
              <motion.button
                key={i}
                onClick={() => setActiveStep(i)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all duration-300",
                  isActive 
                    ? "bg-gradient-to-r from-poly-purple/10 to-poly-cyan/10 border-poly-purple/50 shadow-lg shadow-poly-purple/10"
                    : "bg-muted/20 border-border/30 hover:border-poly-purple/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl transition-all",
                    isActive 
                      ? `bg-gradient-to-br ${step.gradient} text-white shadow-lg`
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full",
                        isActive 
                          ? "bg-poly-purple/20 text-poly-purple"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {i + 1}
                      </span>
                      <h3 className="font-semibold">{step.title}</h3>
                    </div>
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="text-sm text-muted-foreground mt-2">
                            {step.description}
                          </p>
                          <p className="text-xs text-poly-cyan mt-2 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {step.tip}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <ArrowRight className={cn(
                    "w-4 h-4 transition-transform",
                    isActive ? "rotate-90 text-poly-cyan" : "text-muted-foreground"
                  )} />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border/30"
              >
                <Icon className="w-4 h-4 text-poly-cyan" />
                <span className="text-xs font-medium">{feature.label}</span>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <Button 
          onClick={onClose}
          className="w-full bg-gradient-to-r from-poly-purple to-poly-cyan text-white hover:opacity-90"
        >
          Got it!
        </Button>
      </div>
    </div>
  );
}

export function WalletHowItWorks({ open, onOpenChange }: WalletHowItWorksProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border/30 pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-poly-cyan" />
              How It Works
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto">
            <HowItWorksContent onClose={() => onOpenChange(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-border/50 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-poly-cyan" />
            How It Works
          </DialogTitle>
        </DialogHeader>
        <HowItWorksContent onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
