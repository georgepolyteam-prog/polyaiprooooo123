import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { PandoraMarket } from '@/lib/pandora-api';
import { PREDICTION_AMM_ABI, PANDORA_CONTRACTS, ERC20_ABI } from '@/config/sonic';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TradeModalProps {
  market: PandoraMarket;
  onClose: () => void;
}

type TradeSide = 'YES' | 'NO';

export function TradeModal({ market, onClose }: TradeModalProps) {
  const { address } = useAccount();
  const [side, setSide] = useState<TradeSide>('YES');
  const [amount, setAmount] = useState('');
  const [needsApproval, setNeedsApproval] = useState(true);

  // Approval write
  const { 
    writeContract: approve, 
    isPending: isApproving,
    data: approvalHash 
  } = useWriteContract();

  // Buy write
  const { 
    writeContract: buy, 
    isPending: isBuying,
    data: buyHash 
  } = useWriteContract();

  // Wait for approval
  const { isLoading: isWaitingApproval } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  // Wait for buy
  const { isLoading: isWaitingBuy, isSuccess: isBuySuccess } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  const isLoading = isApproving || isWaitingApproval || isBuying || isWaitingBuy;

  const handleApprove = async () => {
    if (!amount || parseFloat(amount) <= 0 || !address) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const amountInWei = parseUnits(amount, 6); // USDC has 6 decimals
      
      approve({
        address: PANDORA_CONTRACTS.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [market.marketAddress as `0x${string}`, amountInWei],
      } as any);
      
      setNeedsApproval(false);
      toast.success('Approval submitted!');
    } catch (error) {
      console.error('Approval failed:', error);
      toast.error('Approval failed');
    }
  };

  const handleBuy = async () => {
    if (!amount || parseFloat(amount) <= 0 || !address) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const amountInWei = parseUnits(amount, 6); // USDC has 6 decimals
      const outcome = side === 'YES' ? 0 : 1;
      const minTokensOut = BigInt(0); // Set proper slippage in production
      
      buy({
        address: market.marketAddress as `0x${string}`,
        abi: PREDICTION_AMM_ABI,
        functionName: 'buy',
        args: [outcome, amountInWei, minTokensOut],
      } as any);
      
      toast.success('Trade submitted!');
    } catch (error) {
      console.error('Trade failed:', error);
      toast.error('Trade failed');
    }
  };

  // Calculate expected tokens (simplified)
  const calculateTokensOut = () => {
    if (!amount || parseFloat(amount) <= 0) return '0';
    const amountNum = parseFloat(amount);
    const price = side === 'YES' ? market.currentOddsYes : market.currentOddsNo;
    const tokens = amountNum / (price / 100);
    return tokens.toFixed(2);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h3 className="text-2xl font-bold text-foreground">Trade</h3>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Market question */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {market.question}
            </p>

            {/* Side selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSide('YES')}
                className={cn(
                  "relative py-4 rounded-xl font-semibold transition-all duration-200",
                  "border-2 flex items-center justify-center gap-2",
                  side === 'YES'
                    ? "bg-success/10 border-success text-success shadow-lg shadow-success/20"
                    : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                YES {market.currentOddsYes}%
              </button>
              <button
                onClick={() => setSide('NO')}
                className={cn(
                  "relative py-4 rounded-xl font-semibold transition-all duration-200",
                  "border-2 flex items-center justify-center gap-2",
                  side === 'NO'
                    ? "bg-destructive/10 border-destructive text-destructive shadow-lg shadow-destructive/20"
                    : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <TrendingDown className="w-4 h-4" />
                NO {market.currentOddsNo}%
              </button>
            </div>

            {/* Amount input */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "w-full px-4 py-4 rounded-xl text-lg font-medium",
                    "bg-muted/50 border border-border",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    "placeholder:text-muted-foreground/50"
                  )}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  USDC
                </div>
              </div>
              
              {/* Quick amounts */}
              <div className="flex gap-2 mt-3">
                {['10', '25', '50', '100'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Expected output */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You'll receive</span>
                <span className="font-semibold text-foreground tabular-nums">
                  ~{calculateTokensOut()} {side} tokens
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg price</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {side === 'YES' ? market.currentOddsYes : market.currentOddsNo}¢
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Potential payout</span>
                <span className="font-semibold text-success tabular-nums">
                  ${calculateTokensOut()} (if {side} wins)
                </span>
              </div>
            </div>

            {/* Success state */}
            {isBuySuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-success" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-success">Trade successful!</p>
                  <p className="text-sm text-success/80">Your position has been opened</p>
                </div>
                {buyHash && (
                  <a
                    href={`https://sonicscan.org/tx/${buyHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-success/10 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-success" />
                  </a>
                )}
              </motion.div>
            )}

            {/* Trade button */}
            {needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={isLoading || !amount || parseFloat(amount) <= 0}
                className={cn(
                  "w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve USDC'
                )}
              </button>
            ) : (
              <button
                onClick={handleBuy}
                disabled={isLoading || !amount || parseFloat(amount) <= 0 || isBuySuccess}
                className={cn(
                  "w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200",
                  side === 'YES' ? "bg-success text-white" : "bg-destructive text-white",
                  "hover:opacity-90 active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Trading...
                  </>
                ) : isBuySuccess ? (
                  'Trade Complete!'
                ) : (
                  `Buy ${side}`
                )}
              </button>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Trading on Pandora prediction markets on Sonic network. 
                Always trade responsibly and only risk what you can afford to lose.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
