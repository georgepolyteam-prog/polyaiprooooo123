import { useState, useEffect } from 'react';
import { X, Users, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HighTrafficBannerProps {
  isVisible: boolean;
}

const SESSION_STORAGE_KEY = 'high_traffic_banner_dismissed';

export const HighTrafficBanner = ({ isVisible }: HighTrafficBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
  };

  const showBanner = isVisible && !isDismissed;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[60] px-4 py-2"
        >
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden rounded-b-xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md shadow-lg">
              {/* Subtle animated gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/10 to-emerald-500/5 animate-pulse" />
              
              <div className="relative flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Icon with glow */}
                  <div className="flex-shrink-0 relative">
                    <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-md" />
                    <div className="relative p-2 rounded-full bg-emerald-500/20 border border-emerald-400/30">
                      <Users className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                  
                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-emerald-100 font-medium">
                      <span className="hidden sm:inline">
                        🐝 <strong>We're buzzing!</strong> Lots of people exploring markets right now.
                      </span>
                      <span className="sm:hidden">
                        🐝 <strong>High traffic!</strong> Many users online.
                      </span>
                    </p>
                    <p className="text-xs text-emerald-300/80 mt-0.5 flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3" />
                      <span>If anything seems slow, just refresh and try again</span>
                    </p>
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg 
                             bg-emerald-500/20 border border-emerald-400/30
                             hover:bg-emerald-500/30 active:bg-emerald-500/40
                             transition-colors touch-manipulation"
                  aria-label="Dismiss banner"
                >
                  <X className="w-4 h-4 text-emerald-200" />
                  <span className="text-xs text-emerald-200 font-medium hidden sm:inline">
                    Dismiss
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
