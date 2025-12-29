import { motion } from 'framer-motion';
import { Zap, ClipboardList, ArrowLeft, Sparkles, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

interface DepositMethodSelectorProps {
  depositAmount: number;
  expectedCredits: number;
  isWalletConnected: boolean;
  onSelectQuick: () => void;
  onSelectManual: () => void;
  onBack: () => void;
}

export function DepositMethodSelector({
  depositAmount,
  expectedCredits,
  isWalletConnected,
  onSelectQuick,
  onSelectManual,
  onBack
}: DepositMethodSelectorProps) {
  const { setVisible } = useWalletModal();

  const handleConnectWallet = () => {
    // Open the standard wallet modal (same as WalletMultiButton)
    setVisible(true);
  };
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      {/* Amount summary */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/30">
        <span className="text-sm text-muted-foreground">Depositing</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">{depositAmount}</span>
          <span className="text-sm text-muted-foreground">POLY</span>
          <span className="text-muted-foreground">→</span>
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-bold text-primary">{expectedCredits}</span>
          <span className="text-sm text-muted-foreground">credits</span>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
          Choose Deposit Method
        </label>
        
        <div className="grid gap-3">
          {/* Quick Deposit Option - Show connect button if not connected */}
          {isWalletConnected ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onSelectQuick}
              className={cn(
                "relative p-4 rounded-xl border text-left transition-all group",
                "bg-gradient-to-br from-primary/10 to-primary/5",
                "border-primary/30 hover:border-primary/50 cursor-pointer"
              )}
            >
              {/* Recommended badge */}
              <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
                Recommended
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Quick Deposit</span>
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    One-click with wallet signature. Instant credits.
                  </p>
                </div>
              </div>
            </motion.button>
          ) : (
            <div className={cn(
              "relative p-4 rounded-xl border text-left transition-all",
              "bg-gradient-to-br from-primary/10 to-primary/5",
              "border-primary/30"
            )}>
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Quick Deposit</span>
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Connect your Solana wallet to use this option
                  </p>
                </div>
              </div>
              
              {/* Connect wallet button */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <Button
                  onClick={handleConnectWallet}
                  className="w-full h-9 text-xs bg-primary/20 text-primary hover:bg-primary/30 border-0"
                >
                  <Wallet className="w-3.5 h-3.5 mr-2" />
                  Connect Wallet
                </Button>
              </div>
            </div>
          )}

          {/* Manual Transfer Option */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onSelectManual}
            className={cn(
              "p-4 rounded-xl border text-left transition-all",
              "bg-muted/30 border-border/50 hover:border-border cursor-pointer"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-muted border border-border/50">
                <ClipboardList className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground">Manual Transfer</span>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Copy address, send from any wallet, then verify
                </p>
              </div>
            </div>
          </motion.button>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={onBack}
        className="w-full h-11 rounded-xl"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Amount
      </Button>
    </motion.div>
  );
}
