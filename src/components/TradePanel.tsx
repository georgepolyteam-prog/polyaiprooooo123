import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Wallet, TrendingUp, TrendingDown, ExternalLink, AlertCircle, Loader2, Zap, Target, ArrowRight, Link2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { buildPolymarketTradeUrl } from '@/lib/polymarket-trade';
import { usePolymarketLink } from '@/hooks/usePolymarketLink';
import { useDomeTrading } from '@/hooks/useDomeTrading';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import { motion, AnimatePresence } from 'framer-motion';

interface TradePanelProps {
  marketData: {
    tokenId?: string;      // Kept for backward compatibility (YES token)
    yesTokenId?: string;   // Token for YES outcome
    noTokenId?: string;    // Token for NO outcome
    conditionId?: string;
    title: string;
    currentPrice: number;
    url?: string;
    eventSlug?: string;
    marketSlug?: string;
  };
  defaultSide?: 'YES' | 'NO';
}

// Polygon mainnet chain ID
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

  // Dome trading hooks (no client-side signing required for orders!)
  const { isLinked, isLinking, linkUser, checkLinkStatus } = usePolymarketLink();
  const { placeOrder, isPlacingOrder } = useDomeTrading();
  const { balance, isFullyApproved, isApproving, approveUSDC, hasSufficientBalance, refetch } = useUSDCBalance();

  // Check if on correct network
  const isWrongNetwork = isConnected && chainId !== POLYGON_CHAIN_ID;

  // Check if direct trading is available (requires linking)
  const hasYesToken = !!(marketData.yesTokenId || marketData.tokenId);
  const hasNoToken = !!marketData.noTokenId;
  const canDirectTrade = hasYesToken && isConnected && !isWrongNetwork && isLinked;

  // Debug logging for trading state
  useEffect(() => {
    console.log('[TradePanel] State:', { 
      isConnected, isWrongNetwork, isLinked, isFullyApproved, 
      hasYesToken, hasNoToken, selectedSide, canDirectTrade,
      amount, balance
    });
  }, [isConnected, isWrongNetwork, isLinked, isFullyApproved, hasYesToken, hasNoToken, selectedSide, canDirectTrade, amount, balance]);

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

  // Handle wallet linking
  const handleLinkWallet = async () => {
    try {
      await linkUser();
    } catch (error) {
      // Error already handled in hook
    }
  };

  // Validate order before showing confirmation
  const validateOrder = () => {
    console.log('[TradePanel] validateOrder called', { selectedSide, marketData });
    
    const yesToken = marketData.yesTokenId || marketData.tokenId;
    const noToken = marketData.noTokenId;
    
    console.log('[TradePanel] Token check:', { yesToken, noToken, selectedSide });
    
    if (selectedSide === 'YES' && !yesToken) {
      toast.error('YES token ID not available for direct trading');
      return false;
    }
    
    if (selectedSide === 'NO' && !noToken) {
      toast.error('NO token ID not available for direct trading. Try trading on Polymarket directly.');
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
    
    console.log('[TradePanel] Share calculation:', { expectedShares, MIN_SHARES, orderPrice, amountNum });
    
    if (expectedShares < MIN_SHARES) {
      const minAmount = Math.ceil(MIN_SHARES * orderPrice * 100) / 100;
      toast.error(`Minimum order is ${MIN_SHARES} shares (~$${minAmount.toFixed(2)} at ${isMarketOrder ? 'current' : 'limit'} price)`);
      return false;
    }

    if (!hasSufficientBalance(amountNum)) {
      toast.error(`Insufficient USDC balance. You have $${balance.toFixed(2)}`);
      return false;
    }

    console.log('[TradePanel] Validation passed!');
    return true;
  };

  const handleShowConfirmation = () => {
    console.log('[TradePanel] handleShowConfirmation called');
    const isValid = validateOrder();
    console.log('[TradePanel] Validation result:', isValid);
    if (isValid) {
      console.log('[TradePanel] Setting showConfirmation to true');
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
    const orderPrice = isMarketOrder 
      ? marketPrice 
      : (limitPrice ? parseFloat(limitPrice) / 100 : marketPrice);
    const expectedShares = amountNum / Math.max(orderPrice, 0.01);

    console.log(`[Trade] Placing ${isMarketOrder ? 'market' : 'limit'} order via Dome: side=${selectedSide}, tokenId=${tokenId?.slice(0, 20)}..., price=${orderPrice}, size=${expectedShares}`);

    // Use Dome trading - no signature required!
    const result = await placeOrder({
      tokenId: tokenId!,
      side: 'BUY',
      size: expectedShares,
      price: orderPrice,
      orderType: isMarketOrder ? 'FOK' : 'GTC',
    });

    if (result.success) {
      // Enhanced success toast with order details
      toast.success(
        `Order placed! ${expectedShares.toFixed(2)} ${selectedSide} shares @ ${(orderPrice * 100).toFixed(1)}¢`,
        {
          description: result.orderId 
            ? `Order ID: ${result.orderId.slice(0, 12)}...` 
            : 'Order submitted successfully',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          action: {
            label: 'View Activity',
            onClick: () => window.open('https://polymarket.com/activity', '_blank'),
          },
        }
      );
      setAmount('');
      setLimitPrice('');
      refetch();
    } else if (result.error) {
      // Enhanced error with details
      toast.error(result.error, {
        description: result.details || 'Please try again or contact support.',
      });
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
    <div className="relative rounded-2xl overflow-hidden">
      {/* Animated background gradient */}
      <div className={cn(
        "absolute inset-0 opacity-30 transition-all duration-500",
        selectedSide === 'YES' 
          ? "bg-gradient-to-br from-emerald-500/20 via-transparent to-emerald-500/10" 
          : "bg-gradient-to-br from-red-500/20 via-transparent to-red-500/10"
      )} />
      
      {/* Glass panel */}
      <div className="relative backdrop-blur-xl bg-card/80 border border-border/50 p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              selectedSide === 'YES' ? "bg-emerald-400" : "bg-red-400"
            )} />
            <h3 className="font-semibold text-foreground">Trade</h3>
          </div>
          <div className="flex items-center gap-3">
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
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
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
              className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 backdrop-blur-sm"
            >
              <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-orange-200 mb-2">
                  Wrong network detected. Switch to Polygon.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSwitchNetwork}
                  disabled={isSwitching}
                  className="text-xs border-orange-500/30 text-orange-200 hover:bg-orange-500/20"
                >
                  {isSwitching ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Switching...
                    </>
                  ) : (
                    'Switch to Polygon'
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Link wallet notice - required before trading - PROMINENT */}
        <AnimatePresence>
          {isConnected && !isWrongNetwork && !isLinked && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/50 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-primary text-sm">Step 1 of 3: Link Wallet</p>
                  <p className="text-xs text-primary/70">Sign once to enable trading forever</p>
                </div>
              </div>
              <Button
                size="default"
                onClick={handleLinkWallet}
                disabled={isLinking}
                className="w-full"
              >
                {isLinking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Linking Wallet...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Link Wallet to Trade
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Approval required notice - PROMINENT */}
        <AnimatePresence>
          {isConnected && !isWrongNetwork && isLinked && !isFullyApproved && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-2 border-amber-500/50 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-200 text-sm">Step 2 of 3: Approve USDC</p>
                  <p className="text-xs text-amber-300/70">One-time approval to enable trading</p>
                </div>
              </div>
              <Button
                size="default"
                onClick={approveUSDC}
                disabled={isApproving}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving USDC...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve USDC for Trading
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Epic Side Selector */}
        <div className="grid grid-cols-2 gap-3">
          {/* YES Button */}
          <motion.button
            onClick={() => setSelectedSide('YES')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "relative group overflow-hidden rounded-xl p-4 transition-all duration-300",
              selectedSide === 'YES'
                ? "trade-btn-yes-active"
                : "bg-muted/30 border border-border/50 hover:border-emerald-500/30"
            )}
          >
            {/* Animated glow ring */}
            {selectedSide === 'YES' && (
              <motion.div
                className="absolute inset-0 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, transparent 50%, rgba(16, 185, 129, 0.2) 100%)',
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.4), inset 0 0 30px rgba(16, 185, 129, 0.1)'
                }}
              />
            )}
            
            {/* Shimmer effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>
            
            <div className="relative flex flex-col items-center gap-1">
              <div className={cn(
                "flex items-center gap-1.5 font-bold text-lg transition-colors",
                selectedSide === 'YES' ? "text-white" : "text-emerald-400/70"
              )}>
                <TrendingUp className="w-5 h-5" />
                YES
              </div>
              <motion.span
                key={yesPrice}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "font-mono text-2xl font-bold tabular-nums",
                  selectedSide === 'YES' ? "text-white" : "text-emerald-400/50"
                )}
              >
                {yesPrice}¢
              </motion.span>
            </div>
            
            {/* Selection indicator */}
            {selectedSide === 'YES' && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500"
              />
            )}
          </motion.button>

          {/* NO Button */}
          <motion.button
            onClick={() => setSelectedSide('NO')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "relative group overflow-hidden rounded-xl p-4 transition-all duration-300",
              selectedSide === 'NO'
                ? "trade-btn-no-active"
                : "bg-muted/30 border border-border/50 hover:border-red-500/30"
            )}
          >
            {/* Animated glow ring */}
            {selectedSide === 'NO' && (
              <motion.div
                className="absolute inset-0 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, transparent 50%, rgba(239, 68, 68, 0.2) 100%)',
                  boxShadow: '0 0 30px rgba(239, 68, 68, 0.4), inset 0 0 30px rgba(239, 68, 68, 0.1)'
                }}
              />
            )}
            
            {/* Shimmer effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>
            
            <div className="relative flex flex-col items-center gap-1">
              <div className={cn(
                "flex items-center gap-1.5 font-bold text-lg transition-colors",
                selectedSide === 'NO' ? "text-white" : "text-red-400/70"
              )}>
                <TrendingDown className="w-5 h-5" />
                NO
              </div>
              <motion.span
                key={noPrice}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "font-mono text-2xl font-bold tabular-nums",
                  selectedSide === 'NO' ? "text-white" : "text-red-400/50"
                )}
              >
                {noPrice}¢
              </motion.span>
            </div>
            
            {/* Selection indicator */}
            {selectedSide === 'NO' && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500"
              />
            )}
          </motion.button>
        </div>

        {/* Order type toggle */}
        <AnimatePresence>
          {canDirectTrade && isFullyApproved && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30 backdrop-blur-sm">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Order Type</span>
                  <span className="text-xs text-muted-foreground">
                    {isMarketOrder ? 'Fill immediately' : 'Set your price'}
                  </span>
                </div>
                <div className="relative flex items-center gap-0.5 bg-muted/50 rounded-lg p-1">
                  {/* Sliding background */}
                  <motion.div
                    className={cn(
                      "absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-md",
                      selectedSide === 'YES' 
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-600" 
                        : "bg-gradient-to-r from-red-500 to-red-600"
                    )}
                    animate={{ x: isMarketOrder ? '100%' : '0%' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                  <button
                    onClick={() => setIsMarketOrder(false)}
                    className={cn(
                      "relative z-10 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                      !isMarketOrder ? "text-white" : "text-muted-foreground"
                    )}
                  >
                    <Target className="w-3 h-3" />
                    Limit
                  </button>
                  <button
                    onClick={() => setIsMarketOrder(true)}
                    className={cn(
                      "relative z-10 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                      isMarketOrder ? "text-white" : "text-muted-foreground"
                    )}
                  >
                    <Zap className="w-3 h-3" />
                    Market
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Limit price input */}
        <AnimatePresence>
          {canDirectTrade && isFullyApproved && !isMarketOrder && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <label className="text-sm text-muted-foreground">Limit Price</label>
              <div className="relative">
                <Input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={`${(marketPrice * 100).toFixed(1)}`}
                  min="1"
                  max="99"
                  step="0.1"
                  className={cn(
                    "bg-muted/30 border-border/50 pr-8 font-mono text-lg",
                    "focus:ring-2 transition-all",
                    selectedSide === 'YES' ? "focus:ring-emerald-500/30" : "focus:ring-red-500/30"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¢</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Current: {(marketPrice * 100).toFixed(1)}¢</span>
                <span>Your limit: {limitPrice ? `${parseFloat(limitPrice).toFixed(1)}¢` : `${(marketPrice * 100).toFixed(1)}¢`}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Amount input */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={cn(
                "bg-muted/30 border-border/50 pl-7 font-mono text-lg",
                "focus:ring-2 transition-all",
                selectedSide === 'YES' ? "focus:ring-emerald-500/30" : "focus:ring-red-500/30"
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USDC</span>
          </div>
        </div>

        {/* Trade preview */}
        <AnimatePresence>
          {amount && parseFloat(amount) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn(
                "relative p-4 rounded-xl overflow-hidden",
                "bg-gradient-to-br from-muted/30 to-muted/10",
                "border",
                selectedSide === 'YES' ? "border-emerald-500/20" : "border-red-500/20"
              )}
            >
              {/* Subtle glow */}
              <div className={cn(
                "absolute inset-0 opacity-20",
                selectedSide === 'YES' 
                  ? "bg-gradient-to-br from-emerald-500/20 to-transparent" 
                  : "bg-gradient-to-br from-red-500/20 to-transparent"
              )} />
              
              <div className="relative space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Shares</span>
                  <motion.span
                    key={shares}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-mono font-bold text-foreground"
                  >
                    {shares}
                  </motion.span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {isMarketOrder ? 'Est. Price' : 'Limit Price'}
                  </span>
                  <span className="font-mono text-foreground">{(displayPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    Potential Payout
                    <ArrowRight className="w-3 h-3" />
                  </span>
                  <motion.span
                    key={payout}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      "font-mono font-bold text-lg",
                      selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    ${payout}
                  </motion.span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direct Trade Button - ALWAYS VISIBLE when connected */}
        {isConnected && !isWrongNetwork && (
          <div>
            {/* Determine button state */}
            {(() => {
              const amountNum = parseFloat(amount) || 0;
              const hasAmount = amountNum > 0;
              const hasBalance = hasSufficientBalance(amountNum);
              const canTrade = isLinked && isFullyApproved && hasAmount && hasBalance && (selectedSide === 'YES' || hasNoToken);
              
              // Determine disabled reason
              let disabledReason = '';
              if (!isLinked) disabledReason = 'Link wallet first (Step 1)';
              else if (!isFullyApproved) disabledReason = 'Approve USDC first (Step 2)';
              else if (!hasAmount) disabledReason = 'Enter an amount';
              else if (!hasBalance) disabledReason = `Insufficient balance ($${balance.toFixed(2)} available)`;
              else if (selectedSide === 'NO' && !hasNoToken) disabledReason = 'NO token not available';
              
              // Always-clickable handler with feedback
              const handleOrderButtonClick = () => {
                console.log('[TradePanel] Button clicked, state:', {
                  isLinked, isFullyApproved, amount, balance,
                  hasYesToken, hasNoToken, selectedSide, canTrade
                });
                
                if (!isLinked) {
                  toast.error('Please link your wallet first (Step 1)', {
                    description: 'Scroll up and click "Link Wallet to Trade"'
                  });
                  return;
                }
                if (!isFullyApproved) {
                  toast.error('Please approve USDC first (Step 2)', {
                    description: 'Scroll up and click "Approve USDC for Trading"'
                  });
                  return;
                }
                if (!hasAmount) {
                  toast.error('Please enter an amount');
                  return;
                }
                if (!hasBalance) {
                  toast.error(`Insufficient USDC balance`, {
                    description: `You have $${balance.toFixed(2)} but need $${amountNum.toFixed(2)}`
                  });
                  return;
                }
                if (selectedSide === 'NO' && !hasNoToken) {
                  toast.error('NO token not available for this market', {
                    description: 'Try trading YES instead, or use Polymarket directly'
                  });
                  return;
                }
                
                // All conditions met - show confirmation
                handleShowConfirmation();
              };
              
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {/* Insufficient balance warning */}
                  {hasAmount && !hasBalance && isLinked && isFullyApproved && (
                    <p className="text-xs text-destructive mb-2 text-center">
                      Insufficient balance. You need ${amountNum.toFixed(2)} USDC.
                    </p>
                  )}
                  
                  <motion.button
                    onClick={handleOrderButtonClick}
                    disabled={isPlacingOrder}
                    whileHover={canTrade ? { scale: 1.01 } : {}}
                    whileTap={canTrade ? { scale: 0.99 } : {}}
                    className={cn(
                      "relative w-full py-4 rounded-xl font-bold text-lg overflow-hidden",
                      "transition-all duration-300",
                      canTrade 
                        ? (selectedSide === 'YES' ? "trade-cta-yes text-white" : "trade-cta-no text-white")
                        : "bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted/70 cursor-pointer"
                    )}
                  >
                    {/* Animated shimmer - only when enabled */}
                    {canTrade && (
                      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                      </div>
                    )}
                    
                    <span className="relative flex items-center justify-center gap-2">
                      {isPlacingOrder ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Placing Order...
                        </>
                      ) : canTrade ? (
                        <>
                          <Zap className="w-5 h-5" />
                          {isMarketOrder ? 'Market' : 'Limit'} {selectedSide}
                        </>
                      ) : (
                        <span className="text-sm">{disabledReason || 'Place Order'}</span>
                      )}
                    </span>
                  </motion.button>
                </motion.div>
              );
            })()}
          </div>
        )}

        {/* Order Confirmation Dialog - Portal to body with high z-index */}
        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation} modal={true}>
          <DialogContent className="sm:max-w-md" elevated>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedSide === 'YES' ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                Confirm {isMarketOrder ? 'Market' : 'Limit'} Order
              </DialogTitle>
              <DialogDescription>
                Review your order details before placing.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Market</span>
                  <span className="font-medium text-foreground text-right max-w-[200px] truncate">
                    {marketData.title}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Side</span>
                  <span className={cn(
                    "font-bold",
                    selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"
                  )}>
                    {selectedSide}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shares</span>
                  <span className="font-mono font-medium text-foreground">{shares}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isMarketOrder ? 'Est. Price' : 'Limit Price'}
                  </span>
                  <span className="font-mono text-foreground">{(displayPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-mono font-bold text-foreground">${amount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Potential Payout</span>
                  <span className={cn(
                    "font-mono font-bold",
                    selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"
                  )}>
                    ${payout}
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Order type: <span className="font-medium">{isMarketOrder ? 'Fill or Kill (FOK)' : 'Good Till Cancelled (GTC)'}</span>
              </p>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDirectTrade}
                disabled={isPlacingOrder}
                className={cn(
                  selectedSide === 'YES'
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                )}
              >
                {isPlacingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Placing...
                  </>
                ) : (
                  'Confirm Order'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Wallet connection */}
        {!isConnected && (
          <Button
            onClick={() => open()}
            variant="default"
            className="w-full py-4 font-medium bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white border-0 shadow-lg shadow-primary/20"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet to Trade
          </Button>
        )}

        {canDirectTrade && isFullyApproved && (
          <p className="text-xs text-center text-muted-foreground">
            Trades attributed to builder program
          </p>
        )}
      </div>
    </div>
  );
}
