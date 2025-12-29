import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Loader2, XCircle, Wallet, ArrowRight, X, ExternalLink, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { TransferStage } from '@/hooks/usePolyTokenTransfer';

interface DepositProgressOverlayProps {
  stage: TransferStage;
  stageMessage: string;
  signature: string | null;
  creditsAdded?: number;
  onDismiss?: () => void;
  onRetry?: () => void;
  onManualFallback?: () => void;
}

const DEPOSIT_STEPS = [
  { id: 'connect', label: 'Connecting to Solana', stages: ['connecting'] },
  { id: 'balance', label: 'Checking Balance', stages: ['checking-balance'] },
  { id: 'sign', label: 'Awaiting Signature', stages: ['awaiting-signature'] },
  { id: 'confirm', label: 'Confirming Transaction', stages: ['confirming'] },
  { id: 'credits', label: 'Adding Credits', stages: ['verifying-credits'] },
];

function getStepStatus(step: typeof DEPOSIT_STEPS[0], currentStage: TransferStage): 'pending' | 'active' | 'completed' | 'error' {
  if (currentStage === 'error') {
    const currentStepIndex = DEPOSIT_STEPS.findIndex(s => s.stages.includes(currentStage));
    const thisStepIndex = DEPOSIT_STEPS.indexOf(step);
    if (thisStepIndex < currentStepIndex) return 'completed';
    return 'pending';
  }
  
  if (currentStage === 'completed') return 'completed';
  if (currentStage === 'idle') return 'pending';
  
  const currentStepIndex = DEPOSIT_STEPS.findIndex(s => s.stages.includes(currentStage));
  const thisStepIndex = DEPOSIT_STEPS.indexOf(step);
  
  if (thisStepIndex < currentStepIndex) return 'completed';
  if (thisStepIndex === currentStepIndex) return 'active';
  return 'pending';
}

export function DepositProgressOverlay({ 
  stage, 
  stageMessage, 
  signature,
  creditsAdded = 0,
  onDismiss,
  onRetry,
  onManualFallback
}: DepositProgressOverlayProps) {
  const isActive = stage !== 'idle';
  const isCompleted = stage === 'completed';
  const isError = stage === 'error';
  
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/90 backdrop-blur-md"
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
              !isCompleted && !isError && "border-primary/30"
            )}
          >
            {/* Animated glow effect */}
            <div className={cn(
              "absolute inset-0 rounded-2xl opacity-20 blur-xl transition-colors duration-500",
              isCompleted && "bg-emerald-500",
              isError && "bg-red-500",
              !isCompleted && !isError && "bg-primary"
            )} />
            
            <div className="relative space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <CheckCircle2 className="w-9 h-9 text-white" />
                    </motion.div>
                  </motion.div>
                ) : isError ? (
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                    <XCircle className="w-9 h-9 text-red-400" />
                  </div>
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto"
                  >
                    <Loader2 className="w-9 h-9 text-primary animate-spin" />
                  </motion.div>
                )}
                
                <h3 className="font-semibold text-lg text-foreground mt-4">
                  {isCompleted ? 'Deposit Successful!' : isError ? 'Deposit Failed' : 'Processing Deposit'}
                </h3>
              </div>
              
              {/* Success content */}
              {isCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-center space-y-4"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="text-4xl font-bold text-foreground">+{creditsAdded.toLocaleString()}</span>
                  </div>
                  <p className="text-muted-foreground">credits added to your account</p>
                  
                  {signature && (
                    <a
                      href={`https://solscan.io/tx/${signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      View on Solscan
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  
                  <Button
                    onClick={onDismiss}
                    className="w-full h-12 rounded-xl mt-4"
                  >
                    Done
                  </Button>
                </motion.div>
              )}
              
              {/* Steps - only show when processing */}
              {!isCompleted && !isError && (
                <div className="space-y-2.5">
                  {DEPOSIT_STEPS.map((step, index) => {
                    const status = getStepStatus(step, stage);
                    
                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-300",
                          status === 'active' && "bg-primary/10",
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
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground/40" />
                          )}
                        </div>
                        
                        <span className={cn(
                          "text-sm font-medium transition-colors",
                          status === 'completed' && "text-muted-foreground",
                          status === 'active' && "text-foreground",
                          status === 'pending' && "text-muted-foreground/50"
                        )}>
                          {step.label}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              
              {/* Current status message */}
              {!isCompleted && (
                <motion.div
                  key={stageMessage}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <p className={cn(
                    "text-sm",
                    isError ? "text-red-400" : "text-muted-foreground"
                  )}>
                    {stageMessage}
                  </p>
                </motion.div>
              )}
              
              {/* Wallet hint for signing stage */}
              <AnimatePresence>
                {stage === 'awaiting-signature' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/30">
                      <Wallet className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-primary">
                        Check your wallet for the signature popup
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Actions */}
              <AnimatePresence>
                {isError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pt-2"
                  >
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={onRetry}
                        className="w-full gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                      </Button>
                      <Button
                        variant="outline"
                        onClick={onManualFallback}
                        className="w-full gap-2 text-muted-foreground"
                      >
                        Use Manual Transfer Instead
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={onDismiss}
                        className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </Button>
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
