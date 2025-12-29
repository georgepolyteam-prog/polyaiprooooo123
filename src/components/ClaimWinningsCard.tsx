import { useState, useEffect } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import {
  Wallet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Gift,
  Clock,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { useClaimWinnings, ClaimablePosition, usePayoutStatus, verifyUsdcTransfer } from "@/hooks/useClaimWinnings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ClaimWinningsCardProps {
  position: ClaimablePosition;
  onClaimSuccess?: () => void;
}

export function ClaimWinningsCard({ position, onClaimSuccess }: ClaimWinningsCardProps) {
  const { claimWinnings, getClaimState, updateClaimState, isWritePending } = useClaimWinnings();
  const claimState = getClaimState(position.conditionId);
  const [verifiedAmount, setVerifiedAmount] = useState<number | null>(null);
  const [usdcVerified, setUsdcVerified] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForceClaimSection, setShowForceClaimSection] = useState(false);
  const [forceClaimConfirmed, setForceClaimConfirmed] = useState(false);

  // Check if payouts are settled before allowing redemption (comprehensive check)
  const {
    readyForRedemption,
    payoutsReported,
    winningOutcome,
    denominator,
    numerators,
    isLoading: isCheckingSettlement,
    refetch: refetchPayoutStatus,
  } = usePayoutStatus(position.conditionId);

  // Watch for transaction confirmation
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: claimState.hash,
  });

  // Verify USDC transfer when transaction confirms
  useEffect(() => {
    if (isSuccess && receipt && claimState.status === "confirming") {
      updateClaimState(position.conditionId, { status: "verifying" });

      // Verify USDC was actually transferred
      const usdcAmount = verifyUsdcTransfer(receipt.logs);

      if (usdcAmount !== null && usdcAmount > 0) {
        // SUCCESS - USDC transfer verified
        setVerifiedAmount(usdcAmount);
        setUsdcVerified(true);
        updateClaimState(position.conditionId, {
          status: "success",
          verifiedAmount: usdcAmount,
          usdcTransferred: true,
        });
        toast.success(`Successfully claimed $${usdcAmount.toFixed(2)} USDC!`);
        onClaimSuccess?.();
      } else {
        // FAILED - Transaction succeeded but no USDC transferred
        setVerifiedAmount(0);
        setUsdcVerified(false);
        updateClaimState(position.conditionId, {
          status: "failed",
          verifiedAmount: 0,
          usdcTransferred: false,
          error: "Transaction completed but no USDC was received. Your tokens may have been burned.",
        });
        toast.error("Claim failed - no USDC received");
      }
    }
  }, [isSuccess, receipt, claimState.status, position.conditionId, updateClaimState, onClaimSuccess]);

  const handleClaim = async (force: boolean = false) => {
    if (!readyForRedemption && !force) {
      toast.error("Payouts not settled yet. Please try again later.");
      return;
    }
    await claimWinnings(position);
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    await refetchPayoutStatus();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Payout status refreshed");
    }, 500);
  };

  const handleCopyConditionId = () => {
    navigator.clipboard.writeText(position.conditionId);
    toast.success("Condition ID copied to clipboard");
  };

  const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
  const polygonscanUrl = `https://polygonscan.com/address/${CTF_CONTRACT}#readContract`;

  const isPending = claimState.status === "pending" || isWritePending;
  const isConfirmingTx = claimState.status === "confirming" || isConfirming;
  const isVerifying = claimState.status === "verifying";
  const isClaimSuccess = claimState.status === "success";
  const isClaimFailed = claimState.status === "failed";
  const isError = claimState.status === "error";

  // Not settled: denominator is 0 OR both numerators are 0
  const isNotSettled = !isCheckingSettlement && !readyForRedemption;

  // Check if user holds the LOSING outcome (their outcome doesn't match the winning outcome)
  const userHoldsLosingOutcome =
    !isCheckingSettlement &&
    readyForRedemption &&
    winningOutcome &&
    position.outcome.toUpperCase() !== winningOutcome.toUpperCase();

  // User holds WINNING outcome - only then is it truly claimable
  const userHoldsWinningOutcome =
    !isCheckingSettlement &&
    readyForRedemption &&
    winningOutcome &&
    position.outcome.toUpperCase() === winningOutcome.toUpperCase();

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
          isClaimSuccess && "border-emerald-500/50 bg-emerald-500/5",
          isClaimFailed && "border-rose-500/50 bg-rose-500/5",
        )}
      >
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            {/* Outcome Badge */}
            <div
              className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center border font-bold text-sm shrink-0",
                position.outcome === "YES"
                  ? "bg-gradient-to-br from-emerald-500/30 to-emerald-400/10 text-emerald-400 border-emerald-500/50"
                  : "bg-gradient-to-br from-rose-500/30 to-rose-400/10 text-rose-400 border-rose-500/50",
              )}
            >
              {position.outcome === "YES" ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>

            {/* Market Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {isCheckingSettlement ? (
                  <Badge variant="secondary" className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-xs">
                    Checking resolution...
                  </Badge>
                ) : winningOutcome && readyForRedemption ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      userHoldsLosingOutcome
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                    )}
                  >
                    {userHoldsLosingOutcome ? "❌" : "✅"} Resolved: {winningOutcome}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                    ⏳ Awaiting Resolution
                  </Badge>
                )}
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
              <p className="text-xs text-muted-foreground uppercase tracking-wider">You Held</p>
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
                className="space-y-2"
              >
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <div className="text-center">
                    <span className="font-semibold block">
                      Successfully claimed ${(verifiedAmount ?? position.claimableUsdc).toFixed(2)} USDC
                    </span>
                    <span className="text-xs opacity-80">✓ USDC transfer verified on-chain</span>
                  </div>
                </div>
              </motion.div>
            ) : isClaimFailed ? (
              <motion.div
                key="failed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                <div className="flex items-start gap-3 py-3 px-4 rounded-lg bg-rose-500/10 border border-rose-500/30">
                  <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                  <div className="text-rose-400">
                    <p className="font-semibold text-sm">Claim Failed - No USDC Received</p>
                    <p className="text-xs opacity-80 mt-1">
                      Transaction completed but no USDC was transferred. Your tokens may have been burned.
                    </p>
                    <ul className="text-xs opacity-70 mt-2 space-y-1 list-disc list-inside">
                      <li>Payouts may not have been properly reported</li>
                      <li>You may have held the losing outcome</li>
                      <li>Shares may have already been redeemed</li>
                    </ul>
                  </div>
                </div>
                <a
                  href="https://t.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
                >
                  <HelpCircle className="w-4 h-4" />
                  Contact Support
                </a>
              </motion.div>
            ) : userHoldsLosingOutcome ? (
              <motion.div
                key="losing-outcome"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-2"
              >
                <div className="flex items-start gap-3 py-3 px-4 rounded-lg bg-rose-500/10 border border-rose-500/30">
                  <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                  <div className="text-rose-400">
                    <p className="font-semibold text-sm">You Didn't Win This Market</p>
                    <p className="text-xs opacity-80 mt-1">
                      The market resolved to <span className="font-bold">{winningOutcome}</span>, but you held{" "}
                      <span className="font-bold">{position.outcome}</span> shares.
                    </p>
                    <p className="text-xs opacity-70 mt-2">
                      Your {position.winningShares.toFixed(2)} {position.outcome} shares have no value as the outcome
                      was {winningOutcome}.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : isNotSettled ? (
              <motion.div
                key="not-settled"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                <div className="flex items-start gap-3 py-3 px-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-amber-400 flex-1">
                    <p className="font-semibold text-sm">⚠️ Payouts Not Settled Yet</p>
                    <p className="text-xs opacity-80 mt-1">
                      This market has resolved but payouts haven't been reported on-chain yet. Your{" "}
                      {position.winningShares.toFixed(2)} shares are safe - check back in a few hours.
                    </p>
                    <p className="text-xs opacity-60 mt-2 font-mono">
                      Status: Denominator = {denominator}, Numerators = [{numerators.join(", ")}]
                    </p>
                    <p className="text-xs text-amber-500 mt-2 font-medium">
                      ⛔ DO NOT claim yet - tokens will be burned with no USDC received
                    </p>
                  </div>
                </div>

                {/* Refresh & Verify Section */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshStatus}
                    disabled={isRefreshing}
                    className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    {isRefreshing ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Refresh Status
                  </Button>
                  <a
                    href={polygonscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Verify on Polygonscan
                  </a>
                </div>

                {/* Condition ID for manual verification */}
                <div className="py-2 px-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Condition ID (for manual verification):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground break-all flex-1">
                      {position.conditionId}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyConditionId}
                      className="shrink-0 h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Force Claim Section */}
                <Collapsible open={showForceClaimSection} onOpenChange={setShowForceClaimSection}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showForceClaimSection ? (
                        <ChevronUp className="w-3 h-3 mr-1" />
                      ) : (
                        <ChevronDown className="w-3 h-3 mr-1" />
                      )}
                      Advanced: Attempt claim anyway
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-2">
                    <div className="py-3 px-4 rounded-lg bg-rose-500/10 border border-rose-500/30">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                        <div className="text-rose-400 text-xs">
                          <p className="font-semibold">⚠️ HIGH RISK WARNING</p>
                          <p className="mt-1 opacity-90">
                            If payouts are truly not settled on-chain, your tokens will be <strong>permanently burned</strong> and you will receive <strong>$0 USDC</strong>.
                          </p>
                          <p className="mt-2 opacity-80">
                            Only proceed if you have verified on Polygonscan that payouts ARE settled and our check is incorrect.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-muted/30 border border-border/30">
                      <Checkbox
                        id={`force-claim-${position.conditionId}`}
                        checked={forceClaimConfirmed}
                        onCheckedChange={(checked) => setForceClaimConfirmed(checked === true)}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor={`force-claim-${position.conditionId}`}
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        I have verified on Polygonscan that payouts are settled and understand the risk of losing my tokens if I'm wrong.
                      </label>
                    </div>

                    <Button
                      onClick={() => handleClaim(true)}
                      disabled={!forceClaimConfirmed || isPending || isConfirmingTx}
                      className={cn(
                        "w-full font-semibold py-2 rounded-lg transition-all duration-200 text-sm",
                        !forceClaimConfirmed
                          ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                          : "bg-rose-600 hover:bg-rose-700 text-white"
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
                          Processing...
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          I understand the risk - Claim Anyway
                        </>
                      )}
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
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
                  <span className="font-semibold">{claimState.error || "Claim failed"}</span>
                </div>
                <Button
                  onClick={() => handleClaim()}
                  disabled={!readyForRedemption}
                  className="w-full bg-[#BFFF0A] hover:bg-[#BFFF0A]/90 text-black font-semibold py-3 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </motion.div>
            ) : isCheckingSettlement ? (
              <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  disabled
                  className="w-full bg-zinc-700 text-zinc-400 cursor-not-allowed font-semibold py-3 rounded-lg"
                >
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking payout status...
                </Button>
              </motion.div>
            ) : isVerifying ? (
              <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  disabled
                  className="w-full bg-zinc-700 text-zinc-400 cursor-not-allowed font-semibold py-3 rounded-lg"
                >
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying USDC transfer...
                </Button>
              </motion.div>
            ) : userHoldsWinningOutcome ? (
              <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {/* Ready indicator - only show when user actually holds the winning outcome */}
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>✓ Ready to claim - You hold the winning {winningOutcome} outcome</span>
                </div>
                <Button
                  onClick={() => handleClaim()}
                  disabled={isPending || isConfirmingTx}
                  className={cn(
                    "w-full font-semibold py-3 rounded-lg transition-all duration-200",
                    isPending || isConfirmingTx
                      ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                      : "bg-[#BFFF0A] hover:bg-[#BFFF0A]/90 text-black hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(191,255,10,0.3)]",
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
                      Processing claim...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      Claim ${position.claimableUsdc.toFixed(2)} USDC
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  onClick={() => handleClaim()}
                  disabled={isPending || isConfirmingTx || !readyForRedemption}
                  className={cn(
                    "w-full font-semibold py-3 rounded-lg transition-all duration-200",
                    isPending || isConfirmingTx || !readyForRedemption
                      ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                      : "bg-[#BFFF0A] hover:bg-[#BFFF0A]/90 text-black hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(191,255,10,0.3)]",
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
              From {marketCount} resolved market{marketCount !== 1 ? "s" : ""}
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
