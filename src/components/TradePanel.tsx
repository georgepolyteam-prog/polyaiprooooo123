import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Removed Dialog imports - using inline overlay instead
import { Wallet, TrendingUp, TrendingDown, ExternalLink, AlertCircle, Loader2, Zap, Target, ArrowRight, Link2, CheckCircle2, RotateCcw, Shield } from 'lucide-react';
import { TradeProgressOverlay } from './TradeProgressOverlay';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { buildPolymarketTradeUrl } from '@/lib/polymarket-trade';
import { useDomeRouter } from '@/hooks/useDomeRouter';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import { motion, AnimatePresence } from 'framer-motion';

interface TradePanelProps {
  marketData: {
    tokenId?: string;
    yesTokenId?: string;
    noTokenId?: string;
    conditionId?: string;
    title: string;
    currentPrice: number;
    url?: string;
    eventSlug?: string;
    marketSlug?: string;
    isLoading?: boolean;
  };
  defaultSide?: 'YES' | 'NO';
}

const POLYGON_CHAIN_ID = 137;

export function TradePanel({ marketData, defaultSide = 'YES' }: TradePanelProps) {
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  
  const [amount, setAmount] = useState('');
  const [selectedSide, setSelectedSide] = useState<'YES' | 'NO'>(defaultSide);
  const [isMarketOrder, setIsMarketOrder] = useState(true);
  const [limitPrice, setLimitPrice] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Use Dome Router hook - handles linking, credentials, and trading (Direct EOA)
  const {
    isLinked,
    isLinking,
    linkUser,
    isPlacingOrder,
    placeOrder,
    tradeStage,
    tradeStageMessage,
    clearSession,
    isDomeReady,
  } = useDomeRouter();

  // Use EOA balance directly (no Safe wallet)
  const { balance, hasSufficientBalance, refetch, isFullyApproved, approveUSDC, isApproving } = useUSDCBalance();
  
  // Check if on correct network
  const isWrongNetwork = isConnected && chainId !== POLYGON_CHAIN_ID;

  // Check if direct trading is available
  const hasYesToken = !!(marketData.yesTokenId || marketData.tokenId);
  const hasNoToken = !!marketData.noTokenId;
  
  // Trading readiness: linked + approved + funded
  const isFunded = balance > 0;
  const canDirectTrade = hasYesToken && isConnected && !isWrongNetwork && isLinked && isFullyApproved && isFunded;

  useEffect(() => {
    console.log('[TradePanel] State:', { 
      isConnected, isWrongNetwork, isLinked, isFullyApproved, hasYesToken, hasNoToken, 
      selectedSide, canDirectTrade, amount, balance, isFunded, isDomeReady
    });
  }, [isConnected, isWrongNetwork, isLinked, isFullyApproved, hasYesToken, hasNoToken, selectedSide, canDirectTrade, amount, balance, isFunded, isDomeReady]);

  const handleSwitchNetwork = async () => {
    try {
      await switchChainAsync({ chainId: POLYGON_CHAIN_ID });
      toast.success('Switched to Polygon network');
      refetch();
    } catch (error) {
      console.error('Network switch error:', error);
      toast.error('Failed to switch network. Please switch manually in your wallet.');
    }
  };

  const handleLinkWallet = async () => {
    try {
      await linkUser();
    } catch (error) {
      // Error already handled in hook
    }
  };

  const validateOrder = () => {
    const yesToken = marketData.yesTokenId || marketData.tokenId;
    const noToken = marketData.noTokenId;
    
    if (selectedSide === 'YES' && !yesToken) {
      toast.error('YES token ID not available for direct trading');
      return false;
    }
    
    if (selectedSide === 'NO' && !noToken) {
      toast.error('NO token ID not available for direct trading');
      return false;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return false;
    }

    const marketPrice = selectedSide === 'YES' ? marketData.currentPrice : (1 - marketData.currentPrice);
    const orderPrice = isMarketOrder 
      ? marketPrice 
      : (limitPrice ? parseFloat(limitPrice) / 100 : marketPrice);

    if (!isMarketOrder && limitPrice) {
      const limitPriceNum = parseFloat(limitPrice);
      if (limitPriceNum < 1 || limitPriceNum > 99) {
        toast.error('Limit price must be between 1¢ and 99¢');
        return false;
      }
    }

    const expectedShares = amountNum / Math.max(orderPrice, 0.01);
    const MIN_SHARES = 5;
    
    if (expectedShares < MIN_SHARES) {
      const minAmount = Math.ceil(MIN_SHARES * orderPrice * 100) / 100;
      toast.error(`Minimum order is ${MIN_SHARES} shares (~$${minAmount.toFixed(2)})`);
      return false;
    }

    if (!hasSufficientBalance(amountNum)) {
      toast.error(`Insufficient USDC balance. You have $${balance.toFixed(2)}`);
      return false;
    }

    return true;
  };

  const handleShowConfirmation = () => {
    if (validateOrder()) {
      setShowConfirmation(true);
    }
  };

  const handleDirectTrade = async () => {
    setShowConfirmation(false);
    
    const yesToken = marketData.yesTokenId || marketData.tokenId;
    const noToken = marketData.noTokenId;
    const tokenId = selectedSide === 'YES' ? yesToken : noToken;
    
    const amountNum = parseFloat(amount);
    const marketPrice = selectedSide === 'YES' ? marketData.currentPrice : (1 - marketData.currentPrice);
    
    // For market orders (FOK), use market price + buffer to ensure fill
    // For BUY: add a small buffer (5%) to ensure fill
    // For limit orders (GTC), use the user's specified price
    let orderPrice: number;
    if (isMarketOrder) {
      // Market order: use market price with a 5% buffer for BUY
      // Round to 2 decimals for API compatibility
      orderPrice = Math.round(Math.min(marketPrice * 1.05, 0.99) * 100) / 100;
    } else {
      // Limit order: use user's specified price or current market price
      orderPrice = limitPrice ? parseFloat(limitPrice) / 100 : marketPrice;
      orderPrice = Math.round(orderPrice * 100) / 100;
    }
    
    const expectedShares = amountNum / Math.max(isMarketOrder ? marketPrice : orderPrice, 0.01);

    const result = await placeOrder({
      tokenId: tokenId!,
      side: 'BUY',
      amount: amountNum,
      price: orderPrice,
      isMarketOrder,
      orderType: isMarketOrder ? 'FOK' : 'GTC',
    });

    if (result.success) {
      toast.success(
        `Order placed! ${expectedShares.toFixed(2)} ${selectedSide} shares @ ${(marketPrice * 100).toFixed(1)}¢`,
        {
          description: result.orderId 
            ? `Order ID: ${result.orderId.slice(0, 12)}...` 
            : 'Order submitted successfully',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
        }
      );
      setAmount('');
      setLimitPrice('');
      refetch();
    }
  };

  const handleTradeOnPolymarket = () => {
    let eventSlug = marketData.eventSlug;
    let marketSlug = marketData.marketSlug;
    
    if (!eventSlug && marketData.url) {
      try {
        const urlObj = new URL(marketData.url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts[0] === 'event' && pathParts[1]) {
          eventSlug = pathParts[1];
          marketSlug = pathParts[2] || undefined;
        }
      } catch {
        // Fallback to direct URL
      }
    }

    if (!eventSlug) {
      if (marketData.url) {
        const url = new URL(marketData.url);
        url.searchParams.set('r', '019b3424');
        window.open(url.toString(), '_blank');
        toast.success('Opening Polymarket...');
        return;
      }
      toast.error('Market URL not available');
      return;
    }

    const tradeUrl = buildPolymarketTradeUrl({
      eventSlug,
      marketSlug,
      side: selectedSide.toLowerCase() as 'yes' | 'no',
      amount: parseFloat(amount) || undefined,
    });

    window.open(tradeUrl, '_blank');
    toast.success('Opening Polymarket with your trade pre-filled!');
  };

  const marketPrice = selectedSide === 'YES' ? marketData.currentPrice : (1 - marketData.currentPrice);
  const displayPrice = isMarketOrder 
    ? marketPrice 
    : (limitPrice ? parseFloat(limitPrice) / 100 : marketPrice);
  const shares = amount ? (parseFloat(amount) / displayPrice).toFixed(2) : '0';
  const payout = amount ? (parseFloat(amount) / displayPrice).toFixed(2) : '0';

  const yesPrice = (marketData.currentPrice * 100).toFixed(1);
  const noPrice = ((1 - marketData.currentPrice) * 100).toFixed(1);

  return (
    <>
      <TradeProgressOverlay 
        tradeStage={tradeStage} 
        tradeStageMessage={tradeStageMessage}
        selectedSide={selectedSide}
      />
      
      <div className="relative rounded-2xl overflow-hidden">
        <div className={cn(
          "absolute inset-0 opacity-30 transition-all duration-500",
          selectedSide === 'YES' 
            ? "bg-gradient-to-br from-emerald-500/20 via-transparent to-emerald-500/10" 
            : "bg-gradient-to-br from-red-500/20 via-transparent to-red-500/10"
        )} />
        
        <div className="relative backdrop-blur-xl bg-card/80 border border-border/50 p-5 space-y-5">
          {/* Loading State */}
          {marketData.isLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading market data...</p>
            </div>
          )}
          
          {!marketData.isLoading && (
            <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                selectedSide === 'YES' ? "bg-emerald-400" : "bg-red-400"
              )} />
              <h3 className="font-semibold text-foreground">Trade</h3>
            </div>
            <div className="flex items-center gap-2">
              {isConnected && !isWrongNetwork && isLinked && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear credentials and re-link?')) {
                      clearSession();
                    }
                  }}
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition-colors px-2 py-1 rounded hover:bg-orange-500/10 border border-orange-500/30"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Re-link</span>
                </button>
              )}
              {isConnected && !isWrongNetwork && (
                <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted/50">
                  ${balance.toFixed(2)} USDC
                </span>
              )}
              {marketData.url && (
                <a
                  href={marketData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Network warning */}
          <AnimatePresence>
            {isWrongNetwork && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30"
              >
                <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-orange-200 mb-2">Switch to Polygon network.</p>
                  <Button size="sm" variant="outline" onClick={handleSwitchNetwork} disabled={isSwitching}>
                    {isSwitching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                    Switch to Polygon
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Link Wallet Step */}
          <AnimatePresence>
            {isConnected && !isWrongNetwork && !isLinked && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/50"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-primary text-sm">Link Wallet</p>
                    <p className="text-xs text-primary/70">One-time setup to enable trading</p>
                  </div>
                </div>
                <Button onClick={handleLinkWallet} disabled={isLinking || !isDomeReady} className="w-full">
                  {isLinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                  {isLinking ? 'Linking...' : 'Link Wallet'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Approve Contracts Step */}
          <AnimatePresence>
            {isConnected && !isWrongNetwork && isLinked && !isFullyApproved && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-2 border-blue-500/50"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-200 text-sm">Approve Trading Contracts</p>
                    <p className="text-xs text-blue-300/70">One-time approval to enable trading</p>
                  </div>
                </div>
                <Button 
                  onClick={approveUSDC} 
                  disabled={isApproving}
                  className="w-full bg-blue-500 hover:bg-blue-600"
                >
                  {isApproving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Approving...</>
                  ) : (
                    <><Shield className="w-4 h-4 mr-2" />Approve Contracts</>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fund Wallet Step */}
          <AnimatePresence>
            {isConnected && !isWrongNetwork && isLinked && isFullyApproved && !isFunded && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 border-2 border-emerald-500/50"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-200 text-sm">Fund Your Wallet</p>
                    <p className="text-xs text-emerald-300/70">Send USDC (Polygon) to your wallet to trade</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-mono break-all">{address}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Side Selector */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => setSelectedSide('YES')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative rounded-xl p-4 transition-all duration-300",
                selectedSide === 'YES'
                  ? "bg-emerald-500/20 border-2 border-emerald-500"
                  : "bg-muted/30 border border-border/50 hover:border-emerald-500/30"
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <div className={cn("flex items-center gap-1.5 font-bold text-lg", selectedSide === 'YES' ? "text-emerald-400" : "text-emerald-400/50")}>
                  <TrendingUp className="w-5 h-5" />
                  YES
                </div>
                <span className={cn("font-mono text-2xl font-bold", selectedSide === 'YES' ? "text-emerald-400" : "text-emerald-400/50")}>
                  {yesPrice}¢
                </span>
              </div>
            </motion.button>

            <motion.button
              onClick={() => setSelectedSide('NO')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative rounded-xl p-4 transition-all duration-300",
                selectedSide === 'NO'
                  ? "bg-red-500/20 border-2 border-red-500"
                  : "bg-muted/30 border border-border/50 hover:border-red-500/30"
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <div className={cn("flex items-center gap-1.5 font-bold text-lg", selectedSide === 'NO' ? "text-red-400" : "text-red-400/50")}>
                  <TrendingDown className="w-5 h-5" />
                  NO
                </div>
                <span className={cn("font-mono text-2xl font-bold", selectedSide === 'NO' ? "text-red-400" : "text-red-400/50")}>
                  {noPrice}¢
                </span>
              </div>
            </motion.button>
          </div>

          {/* Order Type Toggle */}
          <div className="flex gap-2 p-1 bg-muted/30 rounded-lg">
            <button
              onClick={() => setIsMarketOrder(true)}
              className={cn("flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all", isMarketOrder ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Zap className="w-4 h-4 inline mr-1" />
              Market
            </button>
            <button
              onClick={() => setIsMarketOrder(false)}
              className={cn("flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all", !isMarketOrder ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Target className="w-4 h-4 inline mr-1" />
              Limit
            </button>
          </div>

          {/* Limit Price Input */}
          {!isMarketOrder && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Limit Price (¢)</label>
              <Input
                type="number"
                placeholder="50"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                min="1"
                max="99"
                className="bg-muted/30"
              />
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Amount (USDC)</label>
            <Input
              type="number"
              placeholder="10.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              className="bg-muted/30 text-lg"
            />
          </div>

          {/* Trade Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 rounded-lg bg-muted/20 border border-border/30 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-mono">{shares}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-mono">{(displayPrice * 100).toFixed(1)}¢</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-muted-foreground">Max Payout</span>
                <span className={selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"}>${payout}</span>
              </div>
            </div>
          )}

          {/* Trade Button */}
          {isConnected ? (
            <Button
              onClick={canDirectTrade ? handleShowConfirmation : handleTradeOnPolymarket}
              disabled={isPlacingOrder || (canDirectTrade && (!amount || parseFloat(amount) <= 0))}
              className={cn("w-full", selectedSide === 'YES' ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600")}
            >
              {isPlacingOrder ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Placing Order...</>
              ) : canDirectTrade ? (
                <><Zap className="w-4 h-4 mr-2" />Buy {selectedSide}</>
              ) : (
                <><ExternalLink className="w-4 h-4 mr-2" />Trade on Polymarket</>
              )}
            </Button>
          ) : (
            <Button onClick={() => open()} className="w-full">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          )}
            </>
          )}
        </div>
      </div>

      {/* Inline Confirmation Overlay */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm bg-background/80 rounded-2xl"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm mx-4 p-5 rounded-xl bg-card border border-border shadow-xl"
            >
              <h3 className="text-lg font-semibold mb-4">Confirm Order</h3>
              <p className="text-sm text-muted-foreground mb-4">Review your order details before confirming.</p>
              <div className="space-y-3 py-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Side</span>
                  <span className={selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"}>{selectedSide}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>${amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span>{(displayPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares</span>
                  <span>{shares}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="outline" onClick={() => setShowConfirmation(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleDirectTrade} 
                  className={cn("flex-1", selectedSide === 'YES' ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600")}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Confirm
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
