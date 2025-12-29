import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Loader2, XCircle, Wallet, X, ExternalLink, RefreshCw, Zap } from 'lucide-react';
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

// Animated particles for success state
function SuccessParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            opacity: 0, 
            scale: 0,
            x: '50%',
            y: '50%'
          }}
          animate={{ 
            opacity: [0, 1, 0],
            scale: [0, 1, 0.5],
            x: `${50 + (Math.random() - 0.5) * 100}%`,
            y: `${50 + (Math.random() - 0.5) * 100}%`,
          }}
          transition={{ 
            duration: 1.5,
            delay: i * 0.05,
            ease: 'easeOut'
          }}
          className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-green-300"
        />
      ))}
    </div>
  );
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
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-auto"
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
              "relative w-full max-w-sm rounded-2xl border bg-card/95 backdrop-blur-xl p-6 shadow-2xl overflow-hidden",
              isCompleted && "border-emerald-500/50",
              isError && "border-red-500/50",
              !isCompleted && !isError && "border-primary/30"
            )}
          >
            {/* Success particles */}
            {isCompleted && <SuccessParticles />}
            
            {/* Animated glow effect */}
            <motion.div 
              className={cn(
                "absolute inset-0 rounded-2xl blur-xl transition-colors duration-500",
                isCompleted && "bg-emerald-500",
                isError && "bg-red-500",
                !isCompleted && !isError && "bg-primary"
              )}
              initial={{ opacity: 0.1 }}
              animate={{ 
                opacity: isCompleted ? [0.2, 0.4, 0.2] : 0.2,
              }}
              transition={{ 
                duration: 2, 
                repeat: isCompleted ? Infinity : 0,
                ease: 'easeInOut'
              }}
            />
            
            <div className="relative space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                    className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/40"
                  >
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, type: 'spring' }}
                    >
                      <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
                    </motion.div>
                    
                    {/* Pulse ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-emerald-400"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-emerald-400"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                    />
                  </motion.div>
                ) : isError ? (
                  <motion.div 
                    className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <XCircle className="w-10 h-10 text-red-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto relative"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="w-10 h-10 text-primary" />
                    </motion.div>
                  </motion.div>
                )}
                
                <motion.h3 
                  className="font-semibold text-lg text-foreground mt-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: isCompleted ? 0.4 : 0 }}
                >
                  {isCompleted ? 'Deposit Successful' : isError ? 'Deposit Failed' : 'Processing Deposit'}
                </motion.h3>
              </div>
              
              {/* Success content */}
              {isCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="text-center space-y-4"
                >
                  <motion.div 
                    className="flex items-center justify-center gap-3"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6, type: 'spring', damping: 10 }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{ duration: 0.5, delay: 0.8 }}
                    >
                      <Zap className="w-8 h-8 text-emerald-400" />
                    </motion.div>
                    <span className="text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                      +{creditsAdded.toLocaleString()}
                    </span>
                  </motion.div>
                  <p className="text-muted-foreground">credits added to your account</p>
                  
                  {signature && (
                    <motion.a
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      href={`https://solscan.io/tx/${signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      View on Solscan
                      <ExternalLink className="w-3 h-3" />
                    </motion.a>
                  )}
                  
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                  >
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDismiss?.();
                      }}
                      className="w-full h-12 rounded-xl mt-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/25 pointer-events-auto"
                    >
                      Done
                    </Button>
                  </motion.div>
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
                    <div className="flex flex-col gap-2 pointer-events-auto">
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRetry?.();
                        }}
                        className="w-full gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onManualFallback?.();
                        }}
                        className="w-full gap-2 text-muted-foreground"
                      >
                        Use Manual Transfer Instead
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDismiss?.();
                        }}
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
