import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { 
  ChevronDown, ChevronUp, Wallet, ArrowDown, ArrowUp, 
  RefreshCw, Shield, Copy, CheckCircle2, ExternalLink, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { useSafeWallet } from "@/hooks/useSafeWallet";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { DepositDialog } from "./DepositDialog";
import { WithdrawDialog } from "./WithdrawDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SafeWalletManager() {
  const { address, isConnected } = useAccount();
  const { safeAddress, isDeployed, deploySafe, isDeploying, checkDeployment } = useSafeWallet();
  
  // EOA balance
  const { balance: eoaBalance, refetch: refetchEoa, isLoadingBalance: isLoadingEoa } = useUSDCBalance();
  
  // Safe balance
  const { 
    balance: safeBalance, 
    refetch: refetchSafe, 
    isLoadingBalance: isLoadingSafe 
  } = useUSDCBalance({ targetAddress: safeAddress || undefined });
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedEoa, setCopiedEoa] = useState(false);
  const [copiedSafe, setCopiedSafe] = useState(false);

  // Total balance
  const totalBalance = eoaBalance + safeBalance;

  // Auto-refresh balances every 10 seconds
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      refetchEoa();
      if (safeAddress) {
        refetchSafe();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isConnected, safeAddress, refetchEoa, refetchSafe]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchEoa(),
        safeAddress ? refetchSafe() : Promise.resolve(),
        checkDeployment(),
      ]);
      toast.success("Balances refreshed");
    } catch (e) {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchEoa, refetchSafe, checkDeployment, safeAddress]);

  const handleCopyAddress = async (addr: string, type: "eoa" | "safe") => {
    try {
      await navigator.clipboard.writeText(addr);
      if (type === "eoa") {
        setCopiedEoa(true);
        setTimeout(() => setCopiedEoa(false), 2000);
      } else {
        setCopiedSafe(true);
        setTimeout(() => setCopiedSafe(false), 2000);
      }
      toast.success("Address copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDepositSuccess = useCallback(() => {
    // Refresh balances immediately after deposit
    setTimeout(() => {
      refetchEoa();
      refetchSafe();
    }, 2000);
  }, [refetchEoa, refetchSafe]);

  const handleWithdrawSuccess = useCallback(() => {
    // Refresh balances immediately after withdrawal
    setTimeout(() => {
      refetchEoa();
      refetchSafe();
    }, 2000);
  }, [refetchEoa, refetchSafe]);

  if (!isConnected || !address) {
    return null;
  }

  const isLoading = isLoadingEoa || isLoadingSafe;

  return (
    <>
      <GlassCard className="mb-6">
        {/* Header - Always visible */}
        <button
          className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Safe Wallet Manager</h3>
              <p className="text-sm text-muted-foreground">
                Total: ${totalBalance.toFixed(2)} USDC
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
            {/* Wallet addresses */}
            <div className="grid gap-3 md:grid-cols-2">
              {/* EOA Wallet */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Browser Wallet (EOA)</span>
                  </div>
                  <button
                    onClick={() => handleCopyAddress(address, "eoa")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedEoa ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground font-mono truncate flex-1">
                    {address}
                  </code>
                  <a
                    href={`https://polygonscan.com/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-xl font-bold text-foreground">
                  ${eoaBalance.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USDC</span>
                </div>
              </div>

              {/* Safe Wallet */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Safe Wallet</span>
                    {isDeployed ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-medium">
                        DEPLOYED
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-medium">
                        NOT DEPLOYED
                      </span>
                    )}
                  </div>
                  {safeAddress && (
                    <button
                      onClick={() => handleCopyAddress(safeAddress, "safe")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedSafe ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                {safeAddress && (
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground font-mono truncate flex-1">
                      {safeAddress}
                    </code>
                    <a
                      href={`https://polygonscan.com/address/${safeAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                <div className="text-xl font-bold text-foreground">
                  ${safeBalance.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USDC</span>
                </div>
              </div>
            </div>

            {/* Total balance */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Total Balance</div>
                  <div className="text-2xl font-bold text-foreground">
                    ${totalBalance.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USDC</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {!isDeployed ? (
                <Button
                  onClick={deploySafe}
                  disabled={isDeploying}
                  className="flex-1 min-w-[150px] gap-2"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Deploy Safe Wallet
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setDepositOpen(true)}
                    disabled={eoaBalance <= 0}
                    className="flex-1 min-w-[150px] gap-2"
                    variant="outline"
                  >
                    <ArrowDown className="w-4 h-4 text-emerald-400" />
                    Deposit to Safe
                  </Button>
                  <Button
                    onClick={() => setWithdrawOpen(true)}
                    disabled={safeBalance <= 0}
                    className="flex-1 min-w-[150px] gap-2"
                    variant="outline"
                  >
                    <ArrowUp className="w-4 h-4 text-primary" />
                    Withdraw from Safe
                  </Button>
                </>
              )}
            </div>

            {/* Info text */}
            <p className="text-xs text-muted-foreground text-center">
              Your Safe wallet enables gasless trading on Polymarket. Deposit USDC to start trading.
            </p>
          </div>
        )}
      </GlassCard>

      {/* Dialogs */}
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        safeAddress={safeAddress || ""}
        eoaBalance={eoaBalance}
        onSuccess={handleDepositSuccess}
      />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        safeBalance={safeBalance}
        isDeployed={isDeployed}
        onSuccess={handleWithdrawSuccess}
      />
    </>
  );
}
