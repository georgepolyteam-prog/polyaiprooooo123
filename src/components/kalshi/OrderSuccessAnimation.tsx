import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Sparkles, ExternalLink, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface OrderSuccessAnimationProps {
  isVisible: boolean;
  side: 'YES' | 'NO';
  shares: string;
  amount: string;
  txSignature?: string;
  onComplete?: () => void;
}

// Confetti particle component
function ConfettiParticle({ delay, side }: { delay: number; side: 'YES' | 'NO' }) {
  const colors = side === 'YES' 
    ? ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
    : ['#ef4444', '#f87171', '#fca5a5', '#fecaca'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const startX = Math.random() * 100;
  const rotation = Math.random() * 720 - 360;
  
  return (
    <motion.div
      initial={{ 
        x: `${startX}%`, 
        y: '50%', 
        opacity: 1, 
        scale: 0,
        rotate: 0 
      }}
      animate={{ 
        x: `${startX + (Math.random() * 60 - 30)}%`, 
        y: `${Math.random() * 150 - 50}%`, 
        opacity: 0,
        scale: 1,
        rotate: rotation
      }}
      transition={{ 
        duration: 1.5 + Math.random() * 0.5, 
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
      className="absolute w-2 h-2 rounded-sm"
      style={{ backgroundColor: color }}
    />
  );
}

export function OrderSuccessAnimation({ 
  isVisible, 
  side, 
  shares, 
  amount, 
  txSignature,
  onComplete 
}: OrderSuccessAnimationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [countedShares, setCountedShares] = useState(0);
  
  useEffect(() => {
    if (isVisible) {
      setShowConfetti(true);
      
      // Animate share count
      const targetShares = parseFloat(shares) || 0;
      const duration = 1000;
      const steps = 30;
      const increment = targetShares / steps;
      let current = 0;
      
      const interval = setInterval(() => {
        current += increment;
        if (current >= targetShares) {
          setCountedShares(targetShares);
          clearInterval(interval);
        } else {
          setCountedShares(current);
        }
      }, duration / steps);
      
      // Auto close after animation
      const timer = setTimeout(() => {
        onComplete?.();
      }, 3500);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [isVisible, shares, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-xl rounded-lg overflow-hidden"
        >
          {/* Confetti */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(40)].map((_, i) => (
                <ConfettiParticle key={i} delay={i * 0.02} side={side} />
              ))}
            </div>
          )}
          
          {/* Glow rings */}
          <motion.div
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className={cn(
              "absolute w-32 h-32 rounded-full",
              side === 'YES' ? 'bg-emerald-500/30' : 'bg-red-500/30'
            )}
          />
          <motion.div
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 1.2, delay: 0.1, ease: 'easeOut' }}
            className={cn(
              "absolute w-32 h-32 rounded-full",
              side === 'YES' ? 'bg-emerald-400/40' : 'bg-red-400/40'
            )}
          />
          
          {/* Content */}
          <div className="relative text-center px-6">
            {/* Success icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: 'spring', 
                stiffness: 200, 
                damping: 15,
                delay: 0.1 
              }}
              className="mb-6"
            >
              <div className={cn(
                "w-20 h-20 mx-auto rounded-full flex items-center justify-center",
                side === 'YES' 
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/50' 
                  : 'bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/50'
              )}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
                >
                  <CheckCircle className="w-10 h-10 text-white" />
                </motion.div>
              </div>
            </motion.div>
            
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-2"
            >
              <h3 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
                <PartyPopper className="w-6 h-6" />
                Order Filled!
                <PartyPopper className="w-6 h-6 scale-x-[-1]" />
              </h3>
            </motion.div>
            
            {/* Details */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3 mb-6"
            >
              <div className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-bold",
                side === 'YES' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/20 text-red-400'
              )}>
                <Sparkles className="w-5 h-5" />
                <span>{countedShares.toFixed(2)} {side} Shares</span>
              </div>
              
              <p className="text-muted-foreground">
                for <span className="font-semibold text-foreground">${amount}</span>
              </p>
            </motion.div>
            
            {/* Transaction link */}
            {txSignature && (
              <motion.a
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-medium transition-colors",
                  side === 'YES' 
                    ? 'text-emerald-400 hover:text-emerald-300' 
                    : 'text-red-400 hover:text-red-300'
                )}
              >
                <ExternalLink className="w-4 h-4" />
                View on Solscan
              </motion.a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
