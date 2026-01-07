import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { VersionedTransaction } from '@solana/web3.js';
import { 
  Search, 
  ArrowRight, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Loader2,
  Scale,
  Zap,
  Info,
  Copy,
  Check,
  RefreshCw,
  Wallet,
  Link2,
  ShoppingCart
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useArbitrageFinder, detectPlatform, isValidMarketUrl } from '@/hooks/useArbitrageFinder';
import { useDflowApi } from '@/hooks/useDflowApi';
import { useDomeRouter } from '@/hooks/useDomeRouter';
import { useUSDCBalance } from '@/hooks/useUSDCBalance';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

// Platform logos
import polyLogo from '@/assets/poly-logo-new.png';
import kalshiLogo from '@/assets/kalshi-logo.png';
import dflowLogo from '@/assets/dflow-logo.png';
import domeLogo from '@/assets/dome-logo.png';

const POLYGON_CHAIN_ID = 137;
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const ArbIntelligence = () => {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [tradeAmount, setTradeAmount] = useState('10');
  const [isExecutingTrade, setIsExecutingTrade] = useState<'yes' | 'no' | null>(null);
  
  const { findArbitrage, result, isLoading, error, reset } = useArbitrageFinder();

  // Solana wallet for Kalshi trades
  const { publicKey, signTransaction, connected: solanaConnected } = useWallet();
  const { connection } = useConnection();
  const { getOrder } = useDflowApi();

  // Ethereum wallet for Polymarket trades
  const { address: ethAddress, isConnected: ethConnected } = useAccount();
  const { open: openWeb3Modal } = useWeb3Modal();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { isLinked, linkUser, isLinking, placeOrder, isDomeReady } = useDomeRouter();
  const { balance: usdcBalance, hasSufficientBalance, isFullyApproved, approveUSDC, isApproving } = useUSDCBalance();

  const isWrongNetwork = ethConnected && chainId !== POLYGON_CHAIN_ID;

  const detectedPlatform = url ? detectPlatform(url) : null;
  const isValidUrl = url ? isValidMarketUrl(url) : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !isValidUrl) return;
    await findArbitrage(url);
  };

  const handleCopyStrategy = () => {
    if (result?.arbitrage?.strategy) {
      navigator.clipboard.writeText(result.arbitrage.strategy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setUrl('');
    reset();
  };

  const getPlatformLogo = (platform: 'polymarket' | 'kalshi') => {
    return platform === 'polymarket' ? polyLogo : kalshiLogo;
  };

  // Execute Kalshi trade via DFlow (Solana)
  const executeKalshiTrade = async (side: 'YES' | 'NO', ticker: string, price: number) => {
    if (!publicKey || !signTransaction) {
      toast.error('Connect your Solana wallet first');
      return;
    }

    setIsExecutingTrade(side === 'YES' ? 'yes' : 'no');
    const toastId = toast.loading(`Preparing ${side} trade on Kalshi...`);

    try {
      const amountUSDC = parseFloat(tradeAmount);
      const amountInLamports = Math.floor(amountUSDC * 1_000_000);

      // This is a simplified version - in production you'd need the proper token mints
      const orderResponse = await getOrder(
        USDC_MINT,
        ticker, // Would need proper output mint
        amountInLamports,
        publicKey.toBase58()
      );

      toast.loading('Sign in your wallet...', { id: toastId });

      const txBuffer = Buffer.from(orderResponse.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));
      const signedTx = await signTransaction(transaction);

      toast.loading('Submitting transaction...', { id: toastId });

      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      toast.success(`${side} trade submitted on Kalshi!`, { id: toastId });
      console.log('Kalshi trade signature:', signature);
    } catch (err: any) {
      console.error('Kalshi trade failed:', err);
      if (err?.message?.includes('User rejected')) {
        toast.error('Trade cancelled', { id: toastId });
      } else {
        toast.error('Trade failed: ' + (err?.message || 'Unknown error'), { id: toastId });
      }
    } finally {
      setIsExecutingTrade(null);
    }
  };

  // Execute Polymarket trade via Dome
  const executePolymarketTrade = async (side: 'YES' | 'NO', tokenId: string, price: number) => {
    if (!ethConnected) {
      openWeb3Modal();
      return;
    }

    if (isWrongNetwork) {
      try {
        await switchChainAsync({ chainId: POLYGON_CHAIN_ID });
      } catch {
        toast.error('Please switch to Polygon network');
        return;
      }
    }

    if (!isLinked) {
      toast.error('Please link your wallet first');
      return;
    }

    if (!isFullyApproved) {
      toast.error('Please approve contracts first');
      return;
    }

    const amountNum = parseFloat(tradeAmount);
    if (!hasSufficientBalance(amountNum)) {
      toast.error(`Insufficient balance. You have $${usdcBalance.toFixed(2)}`);
      return;
    }

    setIsExecutingTrade(side === 'YES' ? 'yes' : 'no');

    try {
      const orderPrice = Math.round(Math.min(price * 1.15, 0.99) * 100) / 100;

      const result = await placeOrder({
        tokenId,
        side: 'BUY',
        amount: amountNum,
        price: orderPrice,
        isMarketOrder: true,
      });

      if (result.success) {
        toast.success(`${side} trade placed on Polymarket!`);
      }
    } catch (err: any) {
      toast.error('Trade failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExecutingTrade(null);
    }
  };

  // Handle trade execution based on platform
  const executeTrade = async (platform: 'polymarket' | 'kalshi', side: 'YES' | 'NO', tokenIdOrTicker: string, price: number) => {
    if (platform === 'kalshi') {
      await executeKalshiTrade(side, tokenIdOrTicker, price);
    } else {
      await executePolymarketTrade(side, tokenIdOrTicker, price);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Scale className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Arbitrage Intelligence
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            AI-powered cross-platform arbitrage detection between Polymarket and Kalshi.
            Paste a market URL and find price discrepancies automatically.
          </p>
          
          {/* Powered by badges */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Powered by</span>
              <img src={domeLogo} alt="Dome" className="h-4 opacity-70" />
              <span>&</span>
              <img src={dflowLogo} alt="DFlow" className="h-4 opacity-70" />
              <span>+ Claude AI</span>
            </div>
          </div>
        </div>

        {/* Wallet Status */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          {/* Solana Wallet for Kalshi */}
          <div className="flex items-center gap-2 text-xs">
            <img src={kalshiLogo} alt="Kalshi" className="w-4 h-4 rounded" />
            <span className="text-muted-foreground">Kalshi:</span>
            {solanaConnected ? (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <WalletMultiButton className="!h-6 !text-xs !py-0 !px-2 !rounded" />
            )}
          </div>

          {/* Ethereum Wallet for Polymarket */}
          <div className="flex items-center gap-2 text-xs">
            <img src={polyLogo} alt="Polymarket" className="w-4 h-4 rounded" />
            <span className="text-muted-foreground">Polymarket:</span>
            {ethConnected ? (
              <div className="flex items-center gap-1">
                {isWrongNetwork ? (
                  <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                    Wrong Network
                  </Badge>
                ) : !isLinked ? (
                  <Button size="sm" variant="outline" onClick={linkUser} disabled={isLinking || !isDomeReady} className="h-6 text-xs">
                    {isLinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3 mr-1" />}
                    Link
                  </Button>
                ) : !isFullyApproved ? (
                  <Button size="sm" variant="outline" onClick={approveUSDC} disabled={isApproving} className="h-6 text-xs">
                    {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    ${usdcBalance.toFixed(2)}
                  </Badge>
                )}
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => openWeb3Modal()} className="h-6 text-xs">
                <Wallet className="w-3 h-3 mr-1" />
                Connect
              </Button>
            )}
          </div>
        </div>

        {/* URL Input */}
        <Card className="mb-8 border-primary/20 bg-card/50 backdrop-blur">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {detectedPlatform ? (
                    <img 
                      src={getPlatformLogo(detectedPlatform)} 
                      alt={detectedPlatform}
                      className="w-5 h-5 rounded"
                    />
                  ) : (
                    <Search className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <Input
                  type="url"
                  placeholder="Paste a Polymarket or Kalshi market URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-12 pr-4 py-6 text-lg bg-background/50"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <Button 
                  type="submit" 
                  disabled={!isValidUrl || isLoading}
                  className="flex-1 py-6 text-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      Find Arbitrage
                    </>
                  )}
                </Button>
                {result && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleReset}
                    className="py-6"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </Button>
                )}
              </div>

              {url && !isValidUrl && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Please enter a valid Polymarket or Kalshi market URL
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="mb-8 border-destructive/50 bg-destructive/10">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Error</p>
                      <p className="text-sm text-muted-foreground">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result?.success && result.sourceMarket && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search Info */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Search query: <span className="text-foreground font-medium">"{result.searchQuery}"</span>
                </span>
                <span>
                  {result.searchResultsCount} results found
                </span>
              </div>

              {/* Market Comparison */}
              <div className="grid md:grid-cols-2 gap-6">
                <MarketCard 
                  market={result.sourceMarket} 
                  label="Source Market"
                  isSource
                />
                
                {result.matchedMarket ? (
                  <MarketCard 
                    market={result.matchedMarket} 
                    label="Matched Market"
                  />
                ) : (
                  <Card className="border-dashed border-muted-foreground/30 bg-muted/10">
                    <CardContent className="flex flex-col items-center justify-center h-full py-12">
                      <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground text-center">
                        No matching market found on {result.sourceMarket.platform === 'polymarket' ? 'Kalshi' : 'Polymarket'}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Arbitrage Strategy with Trading */}
              {result.arbitrage?.exists && (
                <Card className="border-green-500/50 bg-green-500/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <TrendingUp className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                          <CardTitle className="text-green-500">
                            Arbitrage Opportunity Found!
                          </CardTitle>
                          <CardDescription>
                            {result.arbitrage.confidence}% confidence match
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-500 border-green-500/50 text-lg px-4 py-2">
                        +{result.arbitrage.profitPercent.toFixed(2)}% Profit
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Strategy */}
                    <div className="p-4 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">Strategy</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleCopyStrategy}
                          className="h-8"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-lg font-medium">{result.arbitrage.strategy}</p>
                    </div>

                    {/* Trade Amount Input */}
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <label className="block text-sm font-medium mb-2">Trade Amount (USD)</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={tradeAmount}
                          onChange={(e) => setTradeAmount(e.target.value)}
                          className="flex-1"
                          placeholder="10"
                        />
                        <div className="flex gap-1">
                          {[10, 25, 50, 100].map((amt) => (
                            <Button
                              key={amt}
                              variant="outline"
                              size="sm"
                              onClick={() => setTradeAmount(amt.toString())}
                              className={cn(tradeAmount === amt.toString() && 'bg-primary/20')}
                            >
                              ${amt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Trade Instructions with Execute Buttons */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Buy YES */}
                      <div className="p-4 rounded-lg bg-background/50 border border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="font-medium">Buy YES</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <img 
                            src={getPlatformLogo(result.arbitrage.buyYesPlatform)} 
                            alt={result.arbitrage.buyYesPlatform}
                            className="w-5 h-5 rounded"
                          />
                          <span className="capitalize">{result.arbitrage.buyYesPlatform}</span>
                          <span className="text-muted-foreground">@</span>
                          <span className="font-bold">{(result.arbitrage.buyYesPrice * 100).toFixed(1)}¢</span>
                        </div>
                        <Button
                          className="w-full bg-green-500 hover:bg-green-600"
                          onClick={() => executeTrade(
                            result.arbitrage!.buyYesPlatform,
                            'YES',
                            result.arbitrage!.buyYesPlatform === 'kalshi' 
                              ? (result.arbitrage!.buyYesTicker || '') 
                              : (result.arbitrage!.buyYesTokenId || ''),
                            result.arbitrage!.buyYesPrice
                          )}
                          disabled={
                            isExecutingTrade !== null ||
                            (result.arbitrage.buyYesPlatform === 'kalshi' && !solanaConnected) ||
                            (result.arbitrage.buyYesPlatform === 'polymarket' && (!ethConnected || !isLinked || !isFullyApproved))
                          }
                        >
                          {isExecutingTrade === 'yes' ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <ShoppingCart className="w-4 h-4 mr-2" />
                          )}
                          Buy YES on {result.arbitrage.buyYesPlatform}
                        </Button>
                      </div>

                      {/* Buy NO */}
                      <div className="p-4 rounded-lg bg-background/50 border border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-red-500" />
                          <span className="font-medium">Buy NO</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <img 
                            src={getPlatformLogo(result.arbitrage.buyNoPlatform)} 
                            alt={result.arbitrage.buyNoPlatform}
                            className="w-5 h-5 rounded"
                          />
                          <span className="capitalize">{result.arbitrage.buyNoPlatform}</span>
                          <span className="text-muted-foreground">@</span>
                          <span className="font-bold">{(result.arbitrage.buyNoPrice * 100).toFixed(1)}¢</span>
                        </div>
                        <Button
                          className="w-full bg-red-500 hover:bg-red-600"
                          onClick={() => executeTrade(
                            result.arbitrage!.buyNoPlatform,
                            'NO',
                            result.arbitrage!.buyNoPlatform === 'kalshi' 
                              ? (result.arbitrage!.buyNoTicker || '') 
                              : (result.arbitrage!.buyNoTokenId || ''),
                            result.arbitrage!.buyNoPrice
                          )}
                          disabled={
                            isExecutingTrade !== null ||
                            (result.arbitrage.buyNoPlatform === 'kalshi' && !solanaConnected) ||
                            (result.arbitrage.buyNoPlatform === 'polymarket' && (!ethConnected || !isLinked || !isFullyApproved))
                          }
                        >
                          {isExecutingTrade === 'no' ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <ShoppingCart className="w-4 h-4 mr-2" />
                          )}
                          Buy NO on {result.arbitrage.buyNoPlatform}
                        </Button>
                      </div>
                    </div>

                    {/* Profit Breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard 
                        label="Total Cost" 
                        value={`${(result.arbitrage.totalCost * 100).toFixed(1)}¢`}
                      />
                      <StatCard 
                        label="Guaranteed Payout" 
                        value="$1.00"
                      />
                      <StatCard 
                        label="Net Profit" 
                        value={`+${(result.arbitrage.netProfit * 100).toFixed(1)}¢`}
                        highlight
                      />
                      <StatCard 
                        label="ROI" 
                        value={`+${result.arbitrage.profitPercent.toFixed(2)}%`}
                        highlight
                      />
                    </div>

                    {/* Risk Warning */}
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-500 mb-1">Risk Factors</p>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• Prices may change before execution (slippage)</li>
                          <li>• Platform fees may reduce profit (~1-2% each side)</li>
                          <li>• Liquidity may limit order size</li>
                          <li>• Markets must resolve to the same outcome</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No Arb Found */}
              {result.matchedMarket && !result.arbitrage?.exists && (
                <Card className="border-muted-foreground/30">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">No Arbitrage Opportunity</p>
                        <p className="text-sm text-muted-foreground">
                          Markets are matched but prices don't create an arbitrage opportunity.
                          Total cost would be {'>'}$1.00, resulting in a loss.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* How It Works */}
        {!result && !isLoading && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-6 text-center">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <StepCard 
                number={1}
                title="Paste URL"
                description="Enter any Polymarket or Kalshi market URL"
              />
              <StepCard 
                number={2}
                title="Claude Analyzes"
                description="AI finds matching markets and compares prices"
              />
              <StepCard 
                number={3}
                title="Execute Trades"
                description="Trade directly on both platforms"
              />
            </div>

            {/* Link to Sports Arb */}
            <div className="text-center mt-8">
              <p className="text-muted-foreground mb-3">
                Looking for automated sports arbitrage scanning?
              </p>
              <Link to="/sports-arb">
                <Button variant="outline">
                  Go to Sports Arb Scanner
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-components
interface MarketCardProps {
  market: {
    platform: 'polymarket' | 'kalshi';
    title: string;
    yesPrice: number;
    noPrice: number;
    volume?: number;
    url: string;
  };
  label: string;
  isSource?: boolean;
}

const MarketCard = ({ market, label, isSource }: MarketCardProps) => {
  const logo = market.platform === 'polymarket' ? polyLogo : kalshiLogo;
  
  return (
    <Card className={cn(
      "relative overflow-hidden",
      isSource && "border-primary/30"
    )}>
      {isSource && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="capitalize">
            {label}
          </Badge>
          <a 
            href={market.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt={market.platform} className="w-8 h-8 rounded" />
          <div>
            <p className="capitalize font-medium">{market.platform}</p>
            <p className="text-xs text-muted-foreground">Prediction Market</p>
          </div>
        </div>
        
        <p className="font-medium line-clamp-2">{market.title}</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-xs text-muted-foreground mb-1">YES</p>
            <p className="text-xl font-bold text-green-500">
              {(market.yesPrice * 100).toFixed(1)}¢
            </p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-xs text-muted-foreground mb-1">NO</p>
            <p className="text-xl font-bold text-red-500">
              {(market.noPrice * 100).toFixed(1)}¢
            </p>
          </div>
        </div>

        {market.volume && (
          <p className="text-xs text-muted-foreground">
            Volume: ${market.volume.toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const StatCard = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={cn(
    "p-4 rounded-lg border text-center",
    highlight ? "bg-green-500/10 border-green-500/30" : "bg-background/50 border-border"
  )}>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className={cn(
      "text-lg font-bold",
      highlight && "text-green-500"
    )}>{value}</p>
  </div>
);

const StepCard = ({ number, title, description }: { number: number; title: string; description: string }) => (
  <Card className="text-center">
    <CardContent className="pt-6">
      <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export default ArbIntelligence;
