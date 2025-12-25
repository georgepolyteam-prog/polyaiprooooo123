import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Copy, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Shield, Wallet, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/dashboard/GlassCard';
import { useSafeWallet } from '@/hooks/useSafeWallet';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POLYGON_USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

export function SafeWalletPanel() {
  const { address } = useAccount();
  const { 
    safeAddress, 
    isDeployed, 
    isDeploying, 
    deploySafe,
    hasAllowances,
    isSettingAllowances,
    setAllowances,
    isWithdrawing,
    withdrawUSDC,
  } = useSafeWallet();

  // Get USDC balances for both EOA and Safe
  const { balance: eoaBalance, formattedBalance: eoaFormattedBalance, refetch: refetchEoa } = useUSDCBalance();
  const { balance: safeBalance, formattedBalance: safeFormattedBalance, refetch: refetchSafe } = useUSDCBalance({ 
    targetAddress: safeAddress || undefined 
  });

  const [copiedSafe, setCopiedSafe] = useState(false);
  const [copiedEoa, setCopiedEoa] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Withdraw modal state
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const copyToClipboard = (text: string, type: 'safe' | 'eoa') => {
    navigator.clipboard.writeText(text);
    if (type === 'safe') {
      setCopiedSafe(true);
      setTimeout(() => setCopiedSafe(false), 2000);
    } else {
      setCopiedEoa(true);
      setTimeout(() => setCopiedEoa(false), 2000);
    }
    toast.success('Address copied!');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchEoa(), refetchSafe()]);
      toast.success('Balances refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amount > safeBalance) {
      toast.error('Insufficient balance');
      return;
    }
    if (!address) {
      toast.error('Wallet not connected');
      return;
    }

    const success = await withdrawUSDC(amount, address);
    if (success) {
      setWithdrawModalOpen(false);
      setWithdrawAmount('');
      // Refresh balances after withdraw
      setTimeout(() => {
        refetchEoa();
        refetchSafe();
      }, 2000);
    }
  };

  const handleMaxWithdraw = () => {
    setWithdrawAmount(safeBalance.toString());
  };

  // If Safe is not deployed, show setup flow
  if (!isDeployed) {
    return (
      <GlassCard cyber glow className="p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Setup Safe Wallet</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Deploy a Safe smart wallet to start trading on Polymarket with better security and gas efficiency.
            </p>
          </div>

          {safeAddress && (
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-xs text-muted-foreground mb-1">Your Safe address (pre-computed)</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-sm font-mono text-foreground">
                  {safeAddress.slice(0, 10)}...{safeAddress.slice(-8)}
                </code>
                <button
                  onClick={() => copyToClipboard(safeAddress, 'safe')}
                  className="p-1 hover:bg-primary/10 rounded transition-colors"
                >
                  {copiedSafe ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          )}

          <Button
            onClick={deploySafe}
            disabled={isDeploying}
            className="w-full gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
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
        </div>
      </GlassCard>
    );
  }

  // Safe is deployed - show wallet management
  return (
    <div className="space-y-4">
      {/* Safe Wallet Card */}
      <GlassCard cyber glow className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Safe Wallet</h3>
              <p className="text-xs text-muted-foreground">Active trading wallet</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              Deployed
            </span>
          </div>
        </div>

        {/* Safe Address */}
        <div className="bg-background/50 rounded-lg p-3 border border-border/30 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Address</p>
              <code className="text-sm font-mono text-foreground">
                {safeAddress?.slice(0, 10)}...{safeAddress?.slice(-8)}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => safeAddress && copyToClipboard(safeAddress, 'safe')}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                title="Copy address"
              >
                {copiedSafe ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <a
                href={`https://polygonscan.com/address/${safeAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                title="View on PolygonScan"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-4 border border-primary/20 mb-4">
          <p className="text-xs text-muted-foreground mb-1">USDC Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">${safeFormattedBalance}</span>
            <span className="text-sm text-muted-foreground">USDC</span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
            hasAllowances 
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
              : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
          }`}>
            {hasAllowances ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Allowances Set
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                Allowances Needed
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (safeAddress) {
                copyToClipboard(safeAddress, 'safe');
                toast.info('Send USDC (Polygon) to this address to deposit');
              }
            }}
            className="gap-2 border-primary/30 hover:bg-primary/10"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Deposit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWithdrawModalOpen(true)}
            disabled={safeBalance <= 0 || isWithdrawing}
            className="gap-2 border-secondary/30 hover:bg-secondary/10"
          >
            {isWithdrawing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpFromLine className="w-4 h-4" />
            )}
            Withdraw
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2 border-border/30 hover:bg-muted/20"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Set Allowances Button (if not set) */}
        {!hasAllowances && (
          <Button
            onClick={setAllowances}
            disabled={isSettingAllowances}
            className="w-full mt-3 gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
          >
            {isSettingAllowances ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting Allowances...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Set Token Allowances
              </>
            )}
          </Button>
        )}
      </GlassCard>

      {/* EOA Wallet Card */}
      <GlassCard cyber className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-muted/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Connected Wallet (EOA)</h4>
            <p className="text-xs text-muted-foreground">Signs transactions for Safe</p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-background/50 rounded-lg p-3 border border-border/30">
          <div>
            <code className="text-sm font-mono text-muted-foreground">
              {address?.slice(0, 10)}...{address?.slice(-6)}
            </code>
            <p className="text-xs text-muted-foreground mt-1">${eoaFormattedBalance} USDC</p>
          </div>
          <button
            onClick={() => address && copyToClipboard(address, 'eoa')}
            className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
          >
            {copiedEoa ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </GlassCard>

      {/* Deposit Info */}
      <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">How to deposit</p>
            <p className="text-muted-foreground">
              Send USDC on <span className="text-primary font-medium">Polygon network</span> to your Safe address. 
              Your funds will be available for trading immediately.
            </p>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="w-5 h-5 text-secondary" />
              Withdraw USDC
            </DialogTitle>
            <DialogDescription>
              Transfer USDC from your Safe wallet back to your connected wallet (EOA).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/10 rounded-lg p-3 border border-border/30">
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-xl font-bold text-foreground">${safeFormattedBalance} USDC</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Amount to withdraw</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="flex-1"
                  step="0.01"
                  min="0"
                  max={safeBalance}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMaxWithdraw}
                  className="shrink-0"
                >
                  Max
                </Button>
              </div>
            </div>

            <div className="bg-muted/10 rounded-lg p-3 border border-border/30">
              <p className="text-xs text-muted-foreground mb-1">Destination</p>
              <code className="text-sm font-mono text-foreground">
                {address?.slice(0, 14)}...{address?.slice(-10)}
              </code>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setWithdrawModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              className="flex-1 gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="w-4 h-4" />
                  Withdraw
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
