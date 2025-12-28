import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check, ExternalLink, Coins, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DepositCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const DepositCreditsDialog = ({ open, onOpenChange, onSuccess }: DepositCreditsDialogProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'info' | 'deposit' | 'verify' | 'success'>('info');
  const [depositAddress, setDepositAddress] = useState<string>('');
  const [tokenMint, setTokenMint] = useState<string>('');
  const [creditsPerToken, setCreditsPerToken] = useState<number>(10);
  const [txSignature, setTxSignature] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creditsAdded, setCreditsAdded] = useState(0);

  useEffect(() => {
    if (open) {
      setStep('info');
      setTxSignature('');
      setWalletAddress('');
      setAmount('');
      fetchDepositInfo();
    }
  }, [open]);

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
      toast.error('Failed to load deposit information');
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyDeposit = async () => {
    if (!txSignature || !walletAddress || !amount || !user?.id) {
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
          amount: parseFloat(amount)
        }
      });

      if (error) throw error;

      if (data.success) {
        setCreditsAdded(data.creditsAdded);
        setStep('success');
        onSuccess?.();
        toast.success(`Successfully added ${data.creditsAdded} credits!`);
      } else if (data.status === 'pending') {
        toast.info(data.message || 'Transaction pending, please try again in a moment');
      } else {
        toast.error(data.error || 'Failed to verify deposit');
      }
    } catch (err: any) {
      console.error('Error verifying deposit:', err);
      toast.error(err.message || 'Failed to verify deposit');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            Get Credits
          </DialogTitle>
          <DialogDescription>
            Deposit POLY tokens to receive credits
          </DialogDescription>
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-6 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">How it works</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                  <span>Send POLY tokens to our deposit address</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                  <span>Submit your transaction signature for verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                  <span>Receive {creditsPerToken} credits per POLY token</span>
                </li>
              </ul>
            </div>

            <div className="text-center py-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-3xl font-bold text-primary">1 POLY = {creditsPerToken} Credits</div>
            </div>

            <Button onClick={() => setStep('deposit')} className="w-full gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 'deposit' && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Deposit Address</Label>
              <div className="flex gap-2">
                <Input 
                  value={depositAddress} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(depositAddress)}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send POLY tokens to this Solana address
              </p>
            </div>

            <div className="space-y-2">
              <Label>Token Mint (POLY)</Label>
              <div className="flex gap-2">
                <Input 
                  value={tokenMint} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(tokenMint)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-sm">
              <p className="text-accent font-medium">Important</p>
              <p className="text-muted-foreground mt-1">
                Only send POLY tokens on the Solana network. Sending other tokens may result in loss of funds.
              </p>
            </div>

            <Button onClick={() => setStep('verify')} className="w-full gap-2">
              I've sent the tokens <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wallet">Your Wallet Address</Label>
                <Input
                  id="wallet"
                  placeholder="Your Solana wallet address"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount Sent (POLY)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="e.g., 100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {amount && (
                  <p className="text-xs text-muted-foreground">
                    You will receive {Math.floor(parseFloat(amount || '0') * creditsPerToken)} credits
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tx">Transaction Signature</Label>
                <Input
                  id="tx"
                  placeholder="Paste your transaction signature"
                  value={txSignature}
                  onChange={(e) => setTxSignature(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('deposit')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleVerifyDeposit} 
                disabled={isLoading || !txSignature || !walletAddress || !amount}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Deposit'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-6 py-4 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold">Deposit Successful!</h3>
              <p className="text-muted-foreground mt-1">
                {creditsAdded} credits have been added to your account
              </p>
            </div>

            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View on Solscan <ExternalLink className="w-3 h-3" />
            </a>

            <Button onClick={() => onOpenChange(false)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
