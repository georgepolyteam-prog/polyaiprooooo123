import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDown, Loader2, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { polygon } from "wagmi/chains";
import { toast } from "sonner";

const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  safeAddress: string;
  eoaBalance: number;
  onSuccess: () => void;
}

export function DepositDialog({ 
  open, 
  onOpenChange, 
  safeAddress, 
  eoaBalance,
  onSuccess 
}: DepositDialogProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "processing" | "success" | "error">("input");
  const [errorMessage, setErrorMessage] = useState("");

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: polygon.id });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAmount("");
      setStep("input");
      setTxHash(null);
      setErrorMessage("");
    }
  }, [open]);

  const parsedAmount = parseFloat(amount) || 0;
  const isValidAmount = parsedAmount > 0 && parsedAmount <= eoaBalance;

  const handleDeposit = async () => {
    if (!address || !safeAddress || !isValidAmount || !publicClient) return;

    setIsDepositing(true);
    setStep("processing");

    try {
      // Convert to USDC units (6 decimals)
      const amountInUnits = BigInt(Math.floor(parsedAmount * 1e6));

      toast.info("Please confirm the transfer in your wallet...");

      // Transfer USDC from EOA to Safe
      const hash = await writeContractAsync({
        account: address,
        chain: polygon,
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [safeAddress as `0x${string}`, amountInUnits],
      });

      setTxHash(hash);
      toast.info("Transaction submitted, waiting for confirmation...");

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted");
      }

      setStep("success");
      toast.success(`Deposited ${parsedAmount.toFixed(2)} USDC to Safe`);
      onSuccess();
    } catch (error: any) {
      console.error("[Deposit] Error:", error);
      setStep("error");
      const msg = error?.message || "Deposit failed";
      if (msg.includes("rejected") || msg.includes("denied")) {
        setErrorMessage("Transaction was cancelled");
      } else {
        setErrorMessage(msg.slice(0, 100));
      }
      toast.error("Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleMaxClick = () => {
    // Leave a tiny amount for gas
    const maxAmount = Math.max(0, eoaBalance - 0.01);
    setAmount(maxAmount.toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDown className="w-5 h-5 text-emerald-400" />
            Deposit to Safe
          </DialogTitle>
          <DialogDescription>
            Transfer USDC from your browser wallet to your Safe smart wallet
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="text-sm text-muted-foreground">Available Balance</div>
              <div className="text-2xl font-bold text-foreground">
                ${eoaBalance.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USDC</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount to Deposit</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-20"
                  step="0.01"
                  min="0"
                  max={eoaBalance}
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
              {parsedAmount > eoaBalance && (
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
                onClick={handleDeposit}
                disabled={!isValidAmount || isDepositing}
              >
                <ArrowDown className="w-4 h-4" />
                Deposit ${parsedAmount.toFixed(2)}
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium">Processing Deposit</p>
              <p className="text-sm text-muted-foreground">
                {txHash ? "Waiting for confirmation..." : "Please confirm in your wallet..."}
              </p>
            </div>
            {txHash && (
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on Polygonscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="font-medium text-lg">Deposit Successful!</p>
              <p className="text-sm text-muted-foreground">
                ${parsedAmount.toFixed(2)} USDC has been transferred to your Safe
              </p>
            </div>
            {txHash && (
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on Polygonscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
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
              <p className="font-medium text-lg">Deposit Failed</p>
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
