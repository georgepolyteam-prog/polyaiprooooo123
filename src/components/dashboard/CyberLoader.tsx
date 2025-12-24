import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Server, LineChart, Activity, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStep {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const loadingSteps: LoadingStep[] = [
  { id: 'connect', label: 'Connecting to Dome API', icon: <Server className="w-5 h-5" /> },
  { id: 'market', label: 'Fetching market data', icon: <Database className="w-5 h-5" /> },
  { id: 'orderbook', label: 'Loading order book', icon: <Activity className="w-5 h-5" /> },
  { id: 'trades', label: 'Analyzing recent trades', icon: <LineChart className="w-5 h-5" /> },
  { id: 'prepare', label: 'Preparing dashboard', icon: <CheckCircle2 className="w-5 h-5" /> },
];

export function CyberLoader() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate progressive loading
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < loadingSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 800);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 8;
      });
    }, 200);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="relative min-h-[60vh] flex items-center justify-center">
      {/* Epic particles background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(25)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              background: i % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))',
              boxShadow: i % 2 === 0 ? '0 0 10px hsl(var(--primary))' : '0 0 10px hsl(var(--secondary))',
            }}
            animate={{
              y: [0, -500],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 8 + Math.random() * 8,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Main loader container */}
      <motion.div 
        className="relative z-10 w-full max-w-md mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Epic Glass card */}
        <div className="loading-container-epic rounded-2xl p-8 relative overflow-hidden">
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none" 
            style={{
              background: 'linear-gradient(90deg, hsl(var(--primary) / 0.5), hsl(var(--secondary) / 0.5), hsl(var(--accent) / 0.5), hsl(var(--primary) / 0.5))',
              backgroundSize: '300% 100%',
              animation: 'gradient-shift 4s linear infinite',
              padding: '1px',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />
          
          {/* Holographic shine */}
          <div className="absolute inset-0 holographic pointer-events-none" />

          {/* Epic Pulsing Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <motion.div 
                className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-20 h-20 rounded-full bg-background/90 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Sparkles className="w-10 h-10 text-primary" />
                  </motion.div>
                </div>
              </motion.div>
              {/* Epic Glow rings */}
              <motion.div 
                className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-secondary blur-xl"
                animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div 
                className="absolute inset-[-12px] rounded-full border-2 border-primary/40"
                animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div 
                className="absolute inset-[-24px] rounded-full border border-secondary/30"
                animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              />
            </div>
          </div>

          {/* Epic Loading steps */}
          <div className="space-y-3 mb-8">
            {loadingSteps.map((step, index) => (
              <motion.div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all duration-500",
                  index < currentStep && "bg-emerald-500/10 border border-emerald-500/20",
                  index === currentStep && "bg-primary/10 border border-primary/30",
                  index > currentStep && "border border-transparent opacity-40"
                )}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: index > currentStep ? 0.4 : 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className={cn(
                  "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-500",
                  index < currentStep && "bg-emerald-500/20 text-emerald-400",
                  index === currentStep && "bg-primary/20 text-primary",
                  index > currentStep && "bg-muted/20 text-muted-foreground"
                )}>
                  {index < currentStep ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : index === currentStep ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    step.icon
                  )}
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  index < currentStep && "text-emerald-400",
                  index === currentStep && "text-primary",
                  index > currentStep && "text-muted-foreground"
                )}>{step.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Epic Progress bar */}
          <div className="relative">
            <div className="h-2.5 bg-muted/20 rounded-full overflow-hidden border border-border/30">
              <motion.div 
                className="h-full rounded-full relative overflow-hidden"
                style={{ 
                  width: `${Math.min(progress, 100)}%`,
                  background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--accent)))'
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.3 }}
              >
                {/* Epic Shimmer effect */}
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.div>
            </div>
            <div className="flex justify-between mt-3 text-xs">
              <span className="text-muted-foreground">Loading market data...</span>
              <span className="font-mono text-primary font-medium">{Math.round(Math.min(progress, 100))}%</span>
            </div>
          </div>
        </div>

        {/* Epic Ambient glow beneath card */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-t from-primary/30 via-secondary/15 to-transparent blur-3xl -z-10" />
      </motion.div>
    </div>
  );
}
