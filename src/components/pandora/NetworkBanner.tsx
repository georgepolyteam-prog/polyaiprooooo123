import { motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useSwitchChain } from 'wagmi';
import { sonic } from '@/config/sonic';
import { cn } from '@/lib/utils';

interface NetworkBannerProps {
  isWrongNetwork: boolean;
}

export function NetworkBanner({ isWrongNetwork }: NetworkBannerProps) {
  const { switchChain, isPending } = useSwitchChain();

  if (!isWrongNetwork) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 mb-8"
    >
      <div className={cn(
        "rounded-2xl p-4 sm:p-6",
        "bg-amber-500/10 border border-amber-500/20",
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-amber-200">Wrong Network</p>
            <p className="text-sm text-amber-200/70">
              Please switch to Sonic network to trade on Pandora markets
            </p>
          </div>
        </div>
        <button
          onClick={() => switchChain?.({ chainId: sonic.id })}
          disabled={isPending}
          className={cn(
            "px-6 py-3 rounded-xl font-medium transition-all duration-200",
            "bg-amber-500 text-amber-950",
            "hover:bg-amber-400 active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-2 whitespace-nowrap"
          )}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Switching...
            </>
          ) : (
            'Switch to Sonic'
          )}
        </button>
      </div>
    </motion.div>
  );
}
