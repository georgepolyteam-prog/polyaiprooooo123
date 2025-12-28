import { useState, useEffect } from "react";
import { X, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BANNER_DISMISSED_KEY = 'security_banner_dismissed_v1';

export const SecurityBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500 text-black overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Shield className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">
                <span className="font-bold">Security Update:</span>{' '}
                We've reset all accounts as a precaution. Please create a new account – your data was not compromised.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-amber-600/20 rounded-full transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
