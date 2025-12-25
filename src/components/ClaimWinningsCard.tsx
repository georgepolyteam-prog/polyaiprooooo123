import { useState, useEffect } from 'react';
import { useWaitForTransactionReceipt } from 'wagmi';
import { Wallet, Loader2, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, ExternalLink, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/dashboard/GlassCard';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { useClaimWinnings, ClaimablePosition } from '@/hooks/useClaimWinnings';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ClaimWinningsCardProps {
  position: ClaimablePosition;
  onClaimSuccess?: () => void;
}

export function ClaimWinningsCard({ position, onClaimSuccess }: ClaimWinningsCardProps) {
  const { claimWinnings, getClaimState, updateClaimState, isWritePending } = useClaimWinnings();
  const claimState = getClaimState(position.conditionId);
  
  // Watch for transaction confirmation
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: claimState.hash,
  });

  // Update state when transaction confirms
  useEffect(() => {
    if (isSuccess && claimState.status === 'confirming') {
      updateClaimState(position.conditionId, { status: 'success' });
      toast.success(`Successfully claimed ${position.claimableUsdc.toFixed(2)} USDC!`);
      onClaimSuccess?.();
    }
  }, [isSuccess, claimState.status, position.conditionId, position.claimableUsdc, updateClaimState, onClaimSuccess]);

  const handleClaim = async () => {
    await claimWinnings(position);
  };

  const isPending = claimState.status === 'pending' || isWritePending;
  const isConfirmingTx = claimState.status === 'confirming' || isConfirming;
  const isClaimSuccess = claimState.status === 'success';
  const isError = claimState.status === 'error';

  const polymarketUrl = `https://polymarket.com/event/${position.eventSlug}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <GlassCard 
        cyber 
        glow 
        className={cn(
          "p-4 transition-all duration-300",
          isClaimSuccess && "border-emerald-500/50 bg-emerald-500/5"
        )}
      >
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            {/* Outcome Badge */}
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center border font-bold text-sm shrink-0",
              position.outcome === 'YES'
                ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-400/10 text-emerald-400 border-emerald-500/50'
                : 'bg-gradient-to-br from-rose-500/30 to-rose-400/10 text-rose-400 border-rose-500/50'
            )}>
              {position.outcome === 'YES' ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>

            {/* Market Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  ✅ Resolved: {position.outcome}
                </Badge>
              </div>
              <a 
                href={polymarketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary transition-colors line-clamp-2 flex items-center gap-1"
              >
                {position.title}
                <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
              </a>
            </div>
          </div>

          {/* Position Details */}
          <div className="grid grid-cols-2 gap-4 py-3 px-4 rounded-lg bg-muted/30 border border-border/30">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Position</p>
              <p className="text-lg font-bold text-foreground">
                {position.winningShares.toFixed(2)} {position.outcome} shares
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Claimable</p>
              <p className="text-lg font-bold text-[#BFFF0A]">
                $<AnimatedNumber value={position.claimableUsdc} format={(n) => n.toFixed(2)} /> USDC
              </p>
            </div>
          </div>

          {/* Claim Button / Status */}
          <AnimatePresence mode="wait">
            {isClaimSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Claimed ${position.claimableUsdc.toFixed(2)} USDC</span>
              </motion.div>
            ) : isError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">{claimState.error || 'Claim failed'}</span>
                </div>
                <Button
                  onClick={handleClaim}
                  className="w-full bg-[#BFFF0A] hover:bg-[#BFFF0A]/90 text-black font-semibold py-3 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </motion.div>
            ) : (
              <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  onClick={handleClaim}
                  disabled={isPending || isConfirmingTx}
                  className={cn(
                    "w-full font-semibold py-3 rounded-lg transition-all duration-200",
                    isPending || isConfirmingTx
                      ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                      : "bg-[#BFFF0A] hover:bg-[#BFFF0A]/90 text-black hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(191,255,10,0.3)]"
                  )}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirming in wallet...
                    </>
                  ) : isConfirmingTx ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      Claim ${position.claimableUsdc.toFixed(2)} USDC
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transaction Link */}
          {claimState.hash && (
            <a
              href={`https://polygonscan.com/tx/${claimState.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              View transaction on Polygonscan
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// Summary component for total claimable
interface ClaimableWinningsSummaryProps {
  positions: ClaimablePosition[];
  onClaimAll?: () => void;
  isClaimingAll?: boolean;
}

export function ClaimableWinningsSummary({ positions, onClaimAll, isClaimingAll }: ClaimableWinningsSummaryProps) {
  const totalClaimable = positions.reduce((sum, p) => sum + p.claimableUsdc, 0);
  const marketCount = positions.length;

  if (marketCount === 0) return null;

  return (
    <GlassCard cyber glow className="p-6 border-[#BFFF0A]/30 bg-gradient-to-br from-[#BFFF0A]/5 to-transparent">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#BFFF0A]/20 to-[#BFFF0A]/5 flex items-center justify-center">
            <Gift className="w-7 h-7 text-[#BFFF0A]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Claimable Winnings</p>
            <p className="text-3xl font-bold text-[#BFFF0A]">
              $<AnimatedNumber value={totalClaimable} format={(n) => n.toFixed(2)} /> USDC
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              From {marketCount} resolved market{marketCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {marketCount > 1 && onClaimAll && (
          <Button
            onClick={onClaimAll}
            disabled={isClaimingAll}
            className="bg-[#BFFF0A] hover:bg-[#BFFF0A]/90 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(191,255,10,0.3)]"
          >
            {isClaimingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Claiming...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4 mr-2" />
                Claim All
              </>
            )}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
