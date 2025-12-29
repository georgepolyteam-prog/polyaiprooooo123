import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, Copy, Check, ExternalLink, Zap, ArrowRight, 
  ArrowLeft, Wallet, Hash, Coins, Sparkles, X, AlertCircle, Search
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";
import { usePolyTokenTransfer } from "@/hooks/usePolyTokenTransfer";
import { DepositProgressOverlay } from "./DepositProgressOverlay";
import { DepositMethodSelector } from "./DepositMethodSelector";

interface DepositCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'amount' | 'method' | 'send' | 'detecting' | 'verify' | 'success';

const QUICK_AMOUNTS = [10, 50, 100, 500];

export const DepositCreditsDialog = ({ open, onOpenChange, onSuccess }: DepositCreditsDialogProps) => {
  const { user } = useAuth();
  const { publicKey, connected } = useWallet();
  const { stage, stageMessage, signature, transfer, reset: resetTransfer, setCompleted } = usePolyTokenTransfer();
  
  const [step, setStep] = useState<Step>('amount');
  const [depositAddress, setDepositAddress] = useState('');
  const [tokenMint, setTokenMint] = useState('');
  const [creditsPerToken, setCreditsPerToken] = useState(1);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [txSignature, setTxSignature] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [showProgressOverlay, setShowProgressOverlay] = useState(false);
  const [detectAttempts, setDetectAttempts] = useState(0);
  const detectIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const depositAmount = selectedAmount || parseFloat(customAmount) || 0;
  const expectedCredits = Math.floor(depositAmount * creditsPerToken);

  // Cleanup detection polling on unmount
  useEffect(() => {
    return () => {
      if (detectIntervalRef.current) {
        clearInterval(detectIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (open) {
      setStep('amount');
      setSelectedAmount(null);
      setCustomAmount('');
      setTxSignature('');
      setWalletAddress('');
      setShowProgressOverlay(false);
      setDetectAttempts(0);
      resetTransfer();
      fetchDepositInfo();
      if (detectIntervalRef.current) {
        clearInterval(detectIntervalRef.current);
      }
    }
  }, [open]);

  // Handle quick deposit completion
  useEffect(() => {
    if (stage === 'verifying-credits' && signature) {
      verifyQuickDeposit(signature);
    }
  }, [stage, signature]);

  const fetchDepositInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-deposit', {
        body: { action: 'get-deposit-address' }
      });
      if (error) throw error;
      setDepositAddress(data.depositAddress);
      setTokenMint(data.tokenMint);
      setCreditsPerToken(data.creditsPerToken);
    } catch (err) {
      console.error('Error fetching deposit info:', err);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleQuickDeposit = async () => {
    if (!depositAddress || !tokenMint || !publicKey || !user?.id) {
      toast.error('Missing required information');
      return;
    }

    setShowProgressOverlay(true);
    const txSig = await transfer(depositAmount, depositAddress, tokenMint);
    
    if (!txSig) {
      // Error handled by the hook
      return;
    }
    
    setTxSignature(txSig);
    setWalletAddress(publicKey.toBase58());
  };

  const verifyQuickDeposit = async (txSig: string) => {
    if (!user?.id || !publicKey) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('process-deposit', {
        body: {
          action: 'verify-deposit',
          txSignature: txSig,
          userId: user.id,
          walletAddress: publicKey.toBase58(),
          amount: depositAmount
        }
      });

      if (error) throw error;

      if (data.success) {
        setCreditsAdded(data.creditsAdded);
        setCompleted();
        onSuccess?.();
      } else {
        toast.error(data.error || 'Verification failed');
      }
    } catch (err: any) {
      console.error('Quick deposit verification error:', err);
      toast.error(err.message || 'Verification failed');
    }
  };

  // Auto-detect deposit using Helius
  const startDepositDetection = useCallback(() => {
    if (!walletAddress || !user?.id) {
      toast.error('Please enter your wallet address');
      return;
    }

    setStep('detecting');
    setDetectAttempts(0);

    // Clear any existing interval
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
    }

    const checkForDeposit = async () => {
      try {
        console.log('[Deposit Detection] Checking for deposit...');
        const { data, error } = await supabase.functions.invoke('process-deposit', {
          body: {
            action: 'find-deposit',
            walletAddress: walletAddress,
            minAmount: depositAmount,
            lookbackMinutes: 30
          }
        });

        if (error) throw error;

        if (data.found && data.signature) {
          console.log('[Deposit Detection] Found deposit:', data.signature);
          
          // Stop polling
          if (detectIntervalRef.current) {
            clearInterval(detectIntervalRef.current);
          }

          setTxSignature(data.signature);

          // Now verify and credit
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('process-deposit', {
            body: {
              action: 'verify-deposit',
              txSignature: data.signature,
              userId: user.id,
              walletAddress: walletAddress,
              amount: data.amount || depositAmount
            }
          });

          if (verifyError) throw verifyError;

          if (verifyData.success) {
            setCreditsAdded(verifyData.creditsAdded);
            setStep('success');
            onSuccess?.();
          } else {
            toast.error(verifyData.error || 'Failed to credit deposit');
            setStep('verify'); // Fall back to manual verify
          }
        } else {
          setDetectAttempts(prev => prev + 1);
        }
      } catch (err) {
        console.error('[Deposit Detection] Error:', err);
        setDetectAttempts(prev => prev + 1);
      }
    };

    // Initial check
    checkForDeposit();

    // Poll every 5 seconds for up to 2 minutes (24 attempts)
    detectIntervalRef.current = setInterval(() => {
      setDetectAttempts(prev => {
        if (prev >= 24) {
          // Max attempts reached, stop and show manual verify
          if (detectIntervalRef.current) {
            clearInterval(detectIntervalRef.current);
          }
          setStep('verify');
          toast.info('Auto-detection timed out. Please verify manually.');
          return prev;
        }
        checkForDeposit();
        return prev;
      });
    }, 5000);
  }, [walletAddress, depositAmount, user?.id, onSuccess]);

  const stopDetection = useCallback(() => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
    }
    setStep('verify');
  }, []);

  const handleVerifyDeposit = async () => {
    if (!txSignature || !walletAddress || !depositAmount || !user?.id) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-deposit', {
        body: {
          action: 'verify-deposit',
          txSignature,
          userId: user.id,
          walletAddress,
          amount: depositAmount
        }
      });

      if (error) throw error;

      if (data.success) {
        setCreditsAdded(data.creditsAdded);
        setStep('success');
        onSuccess?.();
      } else if (data.status === 'pending') {
        toast.info(data.message || 'Transaction pending, try again shortly');
      } else {
        toast.error(data.error || 'Verification failed');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      toast.error(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProgressDismiss = () => {
    setShowProgressOverlay(false);
    resetTransfer();
    if (stage === 'completed' || creditsAdded > 0) {
      onOpenChange(false);
    }
  };

  const handleRetryQuickDeposit = () => {
    resetTransfer();
    handleQuickDeposit();
  };

  const handleManualFallback = () => {
    setShowProgressOverlay(false);
    resetTransfer();
    setStep('send');
  };

  const renderStep = () => {
    switch (step) {
      case 'amount':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Quick select chips */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
                Select Amount
              </label>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <motion.button
                    key={amount}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedAmount(amount);
                      setCustomAmount('');
                    }}
                    className={cn(
                      "py-3 rounded-xl text-center font-semibold transition-all",
                      "border",
                      selectedAmount === amount
                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                        : "bg-muted/50 text-foreground border-border/50 hover:border-primary/30"
                    )}
                  >
                    {amount}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Custom amount */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                Or Enter Custom Amount
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Enter POLY amount"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className="h-12 text-lg font-medium pr-16 bg-muted/30 border-border/50 focus:border-primary/50"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  POLY
                </span>
              </div>
            </div>

            {/* Credits preview */}
            {depositAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">You'll receive</span>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-xl font-bold text-primary">{expectedCredits.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">credits</span>
                  </div>
                </div>
              </motion.div>
            )}

            <Button
              onClick={() => setStep('method')}
              disabled={!depositAmount}
              className="w-full h-12 text-base font-semibold gap-2 rounded-xl"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        );

      case 'method':
        return (
          <DepositMethodSelector
            depositAmount={depositAmount}
            expectedCredits={expectedCredits}
            isWalletConnected={connected}
            onSelectQuick={handleQuickDeposit}
            onSelectManual={() => setStep('send')}
            onBack={() => setStep('amount')}
          />
        );

      case 'send':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            {/* Amount summary */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/30">
              <span className="text-sm text-muted-foreground">Sending</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{depositAmount}</span>
                <span className="text-sm text-muted-foreground">POLY</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-bold text-primary">{expectedCredits}</span>
              </div>
            </div>

            {/* Deposit address */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Wallet className="w-3 h-3" />
                Deposit Address
              </label>
              <div
                onClick={() => copyToClipboard(depositAddress, 'address')}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all",
                  "bg-muted/30 border border-border/50 hover:border-primary/30",
                  copiedField === 'address' && "border-green-500/50 bg-green-500/5"
                )}
              >
                <code className="flex-1 text-xs font-mono text-foreground truncate">
                  {depositAddress}
                </code>
                {copiedField === 'address' ? (
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>
            </div>

            {/* Token mint */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Coins className="w-3 h-3" />
                Token Mint (POLY)
              </label>
              <div
                onClick={() => copyToClipboard(tokenMint, 'mint')}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all",
                  "bg-muted/30 border border-border/50 hover:border-primary/30",
                  copiedField === 'mint' && "border-green-500/50 bg-green-500/5"
                )}
              >
                <code className="flex-1 text-xs font-mono text-foreground truncate">
                  {tokenMint}
                </code>
                {copiedField === 'mint' ? (
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>
            </div>

            {/* Your wallet address input for auto-detection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Wallet className="w-3 h-3" />
                Your Wallet Address (for auto-detect)
              </label>
              <Input
                placeholder="Enter your Solana wallet address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="h-11 font-mono text-sm bg-muted/30 border-border/50 focus:border-primary/50"
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/80">
                Only send <strong>POLY tokens</strong> on Solana. Other tokens may be lost permanently.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('method')}
                className="flex-1 h-12 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={startDepositDetection}
                disabled={!walletAddress}
                className="flex-1 h-12 rounded-xl"
              >
                <Search className="w-4 h-4 mr-2" />
                I've Sent It
              </Button>
            </div>

            {/* Manual verify link */}
            <button
              onClick={() => setStep('verify')}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Have a transaction signature? Verify manually
            </button>
          </motion.div>
        );

      case 'detecting':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 py-4"
          >
            {/* Scanning animation */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-20 h-20">
                {/* Outer ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/30"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Middle ring */}
                <motion.div
                  className="absolute inset-2 rounded-full border-2 border-primary/50"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.3, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />
                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Search className="w-8 h-8 text-primary" />
                  </motion.div>
                </div>
              </div>

              <div className="text-center">
                <h3 className="font-semibold text-foreground">Detecting Deposit</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Looking for your POLY transfer...
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Attempt {detectAttempts + 1} of 24
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${((detectAttempts + 1) / 24) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Info */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="w-4 h-4 shrink-0" />
                <span className="truncate font-mono text-xs">{walletAddress}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Coins className="w-4 h-4 shrink-0" />
                <span>Expecting {depositAmount} POLY</span>
              </div>
            </div>

            {/* Cancel button */}
            <Button
              variant="outline"
              onClick={stopDetection}
              className="w-full h-11 rounded-xl"
            >
              Verify Manually Instead
            </Button>
          </motion.div>
        );

      case 'verify':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            {/* Wallet address input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Wallet className="w-3 h-3" />
                Your Wallet Address
              </label>
              <Input
                placeholder="Enter your Solana wallet address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="h-12 font-mono text-sm bg-muted/30 border-border/50 focus:border-primary/50"
              />
            </div>

            {/* Transaction signature input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Hash className="w-3 h-3" />
                Transaction Signature
              </label>
              <Input
                placeholder="Paste your transaction signature"
                value={txSignature}
                onChange={(e) => setTxSignature(e.target.value)}
                className="h-12 font-mono text-sm bg-muted/30 border-border/50 focus:border-primary/50"
              />
            </div>

            {/* Transaction preview */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-foreground">{depositAmount} POLY</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credits to receive</span>
                <span className="font-medium text-primary">{expectedCredits} credits</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('send')}
                disabled={isLoading}
                className="flex-1 h-12 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleVerifyDeposit}
                disabled={isLoading || !txSignature || !walletAddress}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify Deposit
                    <Check className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4 space-y-6"
          >
            {/* Success animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>
            </motion.div>

            {/* Credits added */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-4xl font-bold text-foreground">+{creditsAdded}</span>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-muted-foreground mt-2"
              >
                credits added to your account
              </motion.p>
            </div>

            {/* View on Solscan */}
            {txSignature && (
              <motion.a
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                View on Solscan
                <ExternalLink className="w-3 h-3" />
              </motion.a>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full h-12 rounded-xl"
              >
                Done
              </Button>
            </motion.div>
          </motion.div>
        );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-[420px] p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50 overflow-hidden"
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>Deposit POLY Tokens</DialogTitle>
          </VisuallyHidden>
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <span className="font-semibold text-foreground block">Deposit POLY</span>
                  <span className="text-xs text-muted-foreground">
                    {step === 'amount' && 'Choose amount'}
                    {step === 'method' && 'Select method'}
                    {step === 'send' && 'Send tokens'}
                    {step === 'detecting' && 'Detecting...'}
                    {step === 'verify' && 'Verify transaction'}
                    {step === 'success' && 'Complete'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Step indicator */}
            {step !== 'success' && (
              <div className="flex gap-2 mt-4">
                {['amount', 'method', 'send', 'detecting', 'verify'].map((s, i) => (
                  <div
                    key={s}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      step === s ? "bg-primary" : 
                      ['amount', 'method', 'send', 'detecting', 'verify'].indexOf(step) > i ? "bg-primary/50" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              {renderStep()}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Overlay for Quick Deposit */}
      <DepositProgressOverlay
        stage={showProgressOverlay ? stage : 'idle'}
        stageMessage={stageMessage}
        signature={signature}
        creditsAdded={creditsAdded}
        onDismiss={handleProgressDismiss}
        onRetry={handleRetryQuickDeposit}
        onManualFallback={handleManualFallback}
      />
    </>
  );
};