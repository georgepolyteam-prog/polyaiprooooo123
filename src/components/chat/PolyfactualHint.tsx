import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface PolyfactualHintProps {
  children: React.ReactNode;
  show: boolean;
  onDismiss: () => void;
}

export const PolyfactualHint = ({ children, show, onDismiss }: PolyfactualHintProps) => {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    setVisible(show);
  }, [show]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) return;
    
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 8000);

    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss();
  };

  return (
    <div className="relative">
      {children}
      
      <AnimatePresence>
        {visible && (
          <>
            {/* Pulsing ring around the toggle */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -inset-1 rounded-xl pointer-events-none z-10"
            >
              <div className="absolute inset-0 rounded-xl animate-pulse bg-accent/20 border-2 border-accent/50" />
              <div className="absolute inset-0 rounded-xl animate-ping bg-accent/10" style={{ animationDuration: '2s' }} />
            </motion.div>

            {/* Floating tooltip */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap"
            >
              <div 
                onClick={handleDismiss}
                className="bg-accent text-accent-foreground px-3 py-2 rounded-lg shadow-lg cursor-pointer hover:bg-accent/90 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  <span>Try Deep Research!</span>
                </div>
                {/* Arrow pointing down */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
                  <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-accent" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
