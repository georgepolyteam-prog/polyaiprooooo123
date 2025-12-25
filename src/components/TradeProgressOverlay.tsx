import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Loader2, XCircle, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TradeStage } from '@/hooks/useDomeRouter';

interface TradeProgressOverlayProps {
  tradeStage: TradeStage;
  tradeStageMessage: string;
  selectedSide: 'YES' | 'NO';
}

const TRADE_STEPS = [
  { id: 'network', label: 'Network Check', stages: ['switching-network'] },
  { id: 'balance', label: 'Balance Check', stages: ['checking-balance'] },
  { id: 'link', label: 'Wallet Setup', stages: ['linking-wallet', 'deploying-safe', 'setting-allowances'] },
  { id: 'sign', label: 'Sign Order', stages: ['signing-order'] },
  { id: 'submit', label: 'Submit to Market', stages: ['submitting-order'] },
];

function getStepStatus(step: typeof TRADE_STEPS[0], currentStage: TradeStage): 'pending' | 'active' | 'completed' | 'error' {
  if (currentStage === 'error') {
    // Find which step was active when error occurred
    const activeStepIndex = TRADE_STEPS.findIndex(s => s.stages.includes(currentStage));
    const thisStepIndex = TRADE_STEPS.indexOf(step);
    if (thisStepIndex < activeStepIndex) return 'completed';
    if (thisStepIndex === activeStepIndex) return 'error';
    return 'pending';
  }
  
  if (currentStage === 'completed') return 'completed';
  if (currentStage === 'idle') return 'pending';
  
  const currentStepIndex = TRADE_STEPS.findIndex(s => s.stages.includes(currentStage));
  const thisStepIndex = TRADE_STEPS.indexOf(step);
  
  if (thisStepIndex < currentStepIndex) return 'completed';
  if (thisStepIndex === currentStepIndex) return 'active';
  return 'pending';
}

export function TradeProgressOverlay({ tradeStage, tradeStageMessage, selectedSide }: TradeProgressOverlayProps) {
  const isActive = tradeStage !== 'idle';
  const isCompleted = tradeStage === 'completed';
  const isError = tradeStage === 'error';
  
  const accentColor = selectedSide === 'YES' ? 'emerald' : 'red';

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "relative w-full max-w-sm rounded-2xl border bg-card/95 backdrop-blur-xl p-6 shadow-2xl",
              isCompleted && "border-emerald-500/50",
              isError && "border-red-500/50",
              !isCompleted && !isError && (selectedSide === 'YES' ? "border-emerald-500/30" : "border-red-500/30")
            )}
          >
            {/* Animated glow effect */}
            <div className={cn(
              "absolute inset-0 rounded-2xl opacity-20 blur-xl transition-colors duration-500",
              isCompleted && "bg-emerald-500",
              isError && "bg-red-500",
              !isCompleted && !isError && (selectedSide === 'YES' ? "bg-emerald-500" : "bg-red-500")
            )} />
            
            <div className="relative space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <motion.div
                  animate={!isCompleted && !isError ? { rotate: 360 } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="inline-block"
                >
                  {isCompleted ? (
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    </div>
                  ) : isError ? (
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                      <XCircle className="w-7 h-7 text-red-400" />
                    </div>
                  ) : (
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center mx-auto",
                      selectedSide === 'YES' ? "bg-emerald-500/20" : "bg-red-500/20"
                    )}>
                      <Loader2 className={cn(
                        "w-7 h-7 animate-spin",
                        selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"
                      )} />
                    </div>
                  )}
                </motion.div>
                
                <h3 className="font-semibold text-lg text-foreground">
                  {isCompleted ? 'Order Placed!' : isError ? 'Order Failed' : 'Placing Order'}
                </h3>
              </div>
              
              {/* Steps */}
              <div className="space-y-3">
                {TRADE_STEPS.map((step, index) => {
                  const status = getStepStatus(step, tradeStage);
                  
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg transition-colors duration-300",
                        status === 'active' && (selectedSide === 'YES' ? "bg-emerald-500/10" : "bg-red-500/10"),
                        status === 'completed' && "bg-muted/30"
                      )}
                    >
                      <div className="flex-shrink-0">
                        {status === 'completed' ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 15 }}
                          >
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          </motion.div>
                        ) : status === 'active' ? (
                          <Loader2 className={cn(
                            "w-5 h-5 animate-spin",
                            selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"
                          )} />
                        ) : status === 'error' ? (
                          <XCircle className="w-5 h-5 text-red-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/40" />
                        )}
                      </div>
                      
                      <span className={cn(
                        "text-sm font-medium transition-colors",
                        status === 'completed' && "text-muted-foreground",
                        status === 'active' && "text-foreground",
                        status === 'pending' && "text-muted-foreground/50",
                        status === 'error' && "text-red-400"
                      )}>
                        {step.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
              
              {/* Current status message */}
              <motion.div
                key={tradeStageMessage}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <p className={cn(
                  "text-sm",
                  isError ? "text-red-400" : "text-muted-foreground"
                )}>
                  {tradeStageMessage}
                </p>
              </motion.div>
              
              {/* Wallet hint for signing stage */}
              <AnimatePresence>
                {tradeStage === 'signing-order' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl",
                      selectedSide === 'YES' ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"
                    )}>
                      <Wallet className={cn(
                        "w-4 h-4",
                        selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"
                      )} />
                      <span className={cn(
                        "text-xs font-medium",
                        selectedSide === 'YES' ? "text-emerald-300" : "text-red-300"
                      )}>
                        Check your wallet for the signature popup
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
