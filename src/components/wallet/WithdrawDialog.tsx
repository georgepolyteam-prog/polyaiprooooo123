import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUp, Loader2, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { useSafeWallet } from "@/hooks/useSafeWallet";
import { toast } from "sonner";

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  safeBalance: number;
  isDeployed: boolean;
  onSuccess: () => void;
}

export function WithdrawDialog({ 
  open, 
  onOpenChange, 
  safeBalance,
  isDeployed,
  onSuccess 
}: WithdrawDialogProps) {
  const { address } = useAccount();
  const { withdrawUSDC, isWithdrawing } = useSafeWallet();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"input" | "processing" | "success" | "error">("input");
  const [errorMessage, setErrorMessage] = useState("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAmount("");
      setStep("input");
      setErrorMessage("");
    }
  }, [open]);

  const parsedAmount = parseFloat(amount) || 0;
  const isValidAmount = parsedAmount > 0 && parsedAmount <= safeBalance;

  const handleWithdraw = async () => {
    if (!address || !isValidAmount) return;

    if (!isDeployed) {
      toast.error("Safe wallet is not deployed");
      return;
    }

    setStep("processing");

    try {
      toast.info("Please sign the withdrawal transaction...");

      const success = await withdrawUSDC(parsedAmount, address);

      if (success) {
        setStep("success");
        onSuccess();
      } else {
        throw new Error("Withdrawal failed");
      }
    } catch (error: any) {
      console.error("[Withdraw] Error:", error);
      setStep("error");
      const msg = error?.message || "Withdrawal failed";
      if (msg.includes("rejected") || msg.includes("denied")) {
        setErrorMessage("Transaction was cancelled");
      } else {
        setErrorMessage(msg.slice(0, 100));
      }
    }
  };

  const handleMaxClick = () => {
    setAmount(safeBalance.toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUp className="w-5 h-5 text-primary" />
            Withdraw from Safe
          </DialogTitle>
          <DialogDescription>
            Transfer USDC from your Safe smart wallet to your browser wallet
          </DialogDescription>
        </DialogHeader>

        {!isDeployed && (
          <div className="py-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="font-medium text-destructive">Safe Not Deployed</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your Safe wallet needs to be deployed before you can withdraw
              </p>
            </div>
          </div>
        )}

        {isDeployed && step === "input" && (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="text-sm text-muted-foreground">Safe Balance</div>
              <div className="text-2xl font-bold text-foreground">
                ${safeBalance.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USDC</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Amount to Withdraw</Label>
              <div className="relative">
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-20"
                  step="0.01"
                  min="0"
                  max={safeBalance}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs"
                  onClick={handleMaxClick}
                >
                  MAX
                </Button>
              </div>
              {parsedAmount > safeBalance && (
                <p className="text-sm text-destructive">Insufficient balance</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleWithdraw}
                disabled={!isValidAmount || isWithdrawing || safeBalance === 0}
              >
                <ArrowUp className="w-4 h-4" />
                Withdraw ${parsedAmount.toFixed(2)}
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium">Processing Withdrawal</p>
              <p className="text-sm text-muted-foreground">
                Please sign the transaction in your wallet...
              </p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="font-medium text-lg">Withdrawal Successful!</p>
              <p className="text-sm text-muted-foreground">
                ${parsedAmount.toFixed(2)} USDC has been sent to your wallet
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)} className="mt-2">
              Done
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-medium text-lg">Withdrawal Failed</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setStep("input")}>Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
