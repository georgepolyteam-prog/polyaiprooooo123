import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Wallet, TrendingUp, TrendingDown, ExternalLink, AlertCircle, Loader2, Zap, Target, ArrowRight, Link2, CheckCircle2, Shield, Copy, RotateCcw } from 'lucide-react';
import { TradeProgressOverlay } from './TradeProgressOverlay';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { buildPolymarketTradeUrl } from '@/lib/polymarket-trade';
import { usePrivyRouter } from '@/hooks/usePrivyRouter';
import { motion, AnimatePresence } from 'framer-motion';

interface PrivyTradePanelProps {
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
  };
  defaultSide?: 'YES' | 'NO';
}

export function PrivyTradePanel({ marketData, defaultSide = 'YES' }: PrivyTradePanelProps) {
  const {
    isReady,
    isAuthenticated,
    walletAddress,
    login,
    isLinked,
    isLinking,
    linkUser,
    isPlacingOrder,
    placeOrder,
    tradeStage,
    tradeStageMessage,
    clearSession,
  } = usePrivyRouter();
  
  const [amount, setAmount] = useState('');
  const [selectedSide, setSelectedSide] = useState<'YES' | 'NO'>(defaultSide);
  const [isMarketOrder, setIsMarketOrder] = useState(true);
  const [limitPrice, setLimitPrice] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Check if direct trading is available
  const hasYesToken = !!(marketData.yesTokenId || marketData.tokenId);
  const hasNoToken = !!marketData.noTokenId;
  
  const canDirectTrade = hasYesToken && isAuthenticated && isLinked;

  useEffect(() => {
    console.log('[PrivyTradePanel] State:', { 
      isAuthenticated, isLinked, hasYesToken, hasNoToken, selectedSide, canDirectTrade,
      amount, walletAddress
    });
  }, [isAuthenticated, isLinked, hasYesToken, hasNoToken, selectedSide, canDirectTrade, amount, walletAddress]);

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
    const yesToken = marketData.yesTokenId || marketData.tokenId;
    const noToken = marketData.noTokenId;
    
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

    if (!isMarketOrder && limitPrice) {
      const limitPriceNum = parseFloat(limitPrice);
      if (limitPriceNum < 1 || limitPriceNum > 99) {
        toast.error('Limit price must be between 1¢ and 99¢');
        return false;
      }
    }

    const marketPrice = selectedSide === 'YES' ? marketData.currentPrice : (1 - marketData.currentPrice);
    const orderPrice = isMarketOrder 
      ? marketPrice 
      : (limitPrice ? parseFloat(limitPrice) / 100 : marketPrice);

    const expectedShares = amountNum / Math.max(orderPrice, 0.01);
    const MIN_SHARES = 5;
    
    if (expectedShares < MIN_SHARES) {
      const minAmount = Math.ceil(MIN_SHARES * orderPrice * 100) / 100;
      toast.error(`Minimum order is ${MIN_SHARES} shares (~$${minAmount.toFixed(2)} at ${isMarketOrder ? 'current' : 'limit'} price)`);
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
    const orderPrice = isMarketOrder 
      ? marketPrice 
      : (limitPrice ? parseFloat(limitPrice) / 100 : marketPrice);
    const expectedShares = amountNum / Math.max(orderPrice, 0.01);

    const result = await placeOrder({
      tokenId: tokenId!,
      side: 'BUY',
      amount: amountNum,
      price: orderPrice,
      isMarketOrder,
    });

    if (result.success) {
      toast.success(
        `Order placed! ${expectedShares.toFixed(2)} ${selectedSide} shares @ ${(orderPrice * 100).toFixed(1)}¢`,
        {
          description: result.orderId 
            ? `Order ID: ${result.orderId.slice(0, 12)}...` 
            : 'Order submitted successfully',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
        }
      );
      setAmount('');
      setLimitPrice('');
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
      {/* Trade Progress Overlay */}
      <TradeProgressOverlay 
        tradeStage={tradeStage} 
        tradeStageMessage={tradeStageMessage}
        selectedSide={selectedSide}
      />
      
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
            <div className="flex items-center gap-2">
              {isAuthenticated && isLinked && (
                <button
                  onClick={() => clearSession()}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors p-1 rounded hover:bg-muted/50"
                  title="Reset trading session if having issues"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
              {walletAddress && (
                <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted/50">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
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

          {/* Step 1: Login with Privy */}
          <AnimatePresence>
            {!isAuthenticated && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-2 border-blue-500/50 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-200 text-sm">Step 1: Connect</p>
                    <p className="text-xs text-blue-300/70">Sign in to start trading</p>
                  </div>
                </div>
                <Button
                  size="default"
                  onClick={() => login()}
                  disabled={!isReady}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {!isReady ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 2: Link Wallet to Polymarket */}
          <AnimatePresence>
            {isAuthenticated && !isLinked && (
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
                    <p className="font-semibold text-primary text-sm">Step 2: Link to Polymarket</p>
                    <p className="text-xs text-primary/70">One-time setup for trading</p>
                  </div>
                </div>
                {walletAddress && (
                  <div className="mb-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Your wallet:</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(walletAddress);
                          toast.success('Copied wallet address!');
                        }}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                    <p className="font-mono text-xs text-foreground mt-1 truncate">{walletAddress}</p>
                  </div>
                )}
                <Button
                  size="default"
                  onClick={handleLinkWallet}
                  disabled={isLinking}
                  className="w-full"
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Link to Polymarket
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Side Selector */}
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
            {canDirectTrade && (
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

          {/* Amount input */}
          <div className="space-y-3">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground group-focus-within:text-foreground transition-colors">
                $
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 pr-4 h-14 text-2xl font-bold bg-muted/30 border-border/50 focus:border-primary/50 rounded-xl transition-all"
                min="0.1"
                step="0.1"
              />
            </div>
            
            {/* Quick amounts */}
            <div className="flex gap-2">
              {[5, 10, 25, 50].map((preset) => (
                <motion.button
                  key={preset}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setAmount(preset.toString())}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-lg border transition-all",
                    amount === preset.toString()
                      ? selectedSide === 'YES'
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : "bg-red-500/20 border-red-500/50 text-red-300"
                      : "bg-muted/20 border-border/30 text-muted-foreground hover:border-primary/30"
                  )}
                >
                  ${preset}
                </motion.button>
              ))}
            </div>

            {/* Limit price input */}
            <AnimatePresence>
              {canDirectTrade && !isMarketOrder && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                      Limit Price
                    </div>
                    <Input
                      type="number"
                      placeholder={(marketPrice * 100).toFixed(1)}
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="pl-24 pr-8 h-12 text-xl font-bold bg-muted/30 border-border/50 focus:border-primary/50 rounded-xl transition-all"
                      min="1"
                      max="99"
                      step="1"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                      ¢
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order summary */}
          <AnimatePresence>
            {amount && parseFloat(amount) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shares</span>
                  <span className="font-mono font-medium text-foreground">{shares}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-mono font-medium text-foreground">{(displayPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="h-px bg-border/30 my-2" />
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Potential payout</span>
                  <span className={cn(
                    "font-mono font-bold text-lg",
                    selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"
                  )}>
                    ${payout}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trade button */}
          {!isAuthenticated ? (
            <Button
              onClick={() => login()}
              disabled={!isReady}
              className="w-full h-14 text-lg font-bold rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
            >
              Sign In to Trade
            </Button>
          ) : !isLinked ? (
            <Button
              onClick={handleLinkWallet}
              disabled={isLinking}
              className="w-full h-14 text-lg font-bold rounded-xl"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5 mr-2" />
                  Link to Polymarket
                </>
              )}
            </Button>
          ) : hasYesToken ? (
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                onClick={handleShowConfirmation}
                disabled={isPlacingOrder || !amount || parseFloat(amount) <= 0}
                className={cn(
                  "w-full h-14 text-lg font-bold rounded-xl transition-all",
                  selectedSide === 'YES'
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                    : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
                  "text-white shadow-lg"
                )}
              >
                {isPlacingOrder ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    Buy {selectedSide}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </motion.div>
          ) : (
            <Button
              onClick={handleTradeOnPolymarket}
              className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
            >
              Trade on Polymarket
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSide === 'YES' ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
              Confirm {selectedSide} Order
            </DialogTitle>
            <DialogDescription>
              Review your order details before confirming
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono font-bold">${amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-mono font-bold">{shares}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-mono font-bold">{(displayPrice * 100).toFixed(1)}¢</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-mono font-bold">{isMarketOrder ? 'Market' : 'Limit'}</span>
              </div>
              <div className="h-px bg-border/30" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potential Payout</span>
                <span className={cn(
                  "font-mono font-bold text-lg",
                  selectedSide === 'YES' ? "text-emerald-400" : "text-red-400"
                )}>
                  ${payout}
                </span>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDirectTrade}
              disabled={isPlacingOrder}
              className={cn(
                selectedSide === 'YES'
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-red-500 hover:bg-red-600",
                "text-white"
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
    </>
  );
}
