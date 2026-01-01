import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, Shield, ArrowRight, RefreshCw, Search, Sparkles, Wallet, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDflowApi, type KalshiMarket, type KalshiEvent } from '@/hooks/useDflowApi';
import { KalshiMarketCard } from '@/components/kalshi/KalshiMarketCard';
import { KalshiTradingModal } from '@/components/kalshi/KalshiTradingModal';
import { KalshiFeatureCard } from '@/components/kalshi/KalshiFeatureCard';
import { KalshiLoadingSkeleton } from '@/components/kalshi/KalshiLoadingSkeleton';
import { KalshiPortfolio } from '@/components/kalshi/KalshiPortfolio';
import { KalshiAIInsight } from '@/components/kalshi/KalshiAIInsight';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// Demo markets for when API is unavailable
const DEMO_MARKETS: KalshiMarket[] = [
  {
    ticker: 'BTCUSD-25DEC31',
    title: 'Will Bitcoin exceed $100,000 by end of 2025?',
    subtitle: 'BTC Price Prediction',
    status: 'active',
    yesPrice: 67,
    noPrice: 33,
    volume: 1250000,
    closeTime: '2025-12-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'FEDRATE-25JAN',
    title: 'Will the Fed cut rates in January 2025?',
    subtitle: 'Federal Reserve Policy',
    status: 'active',
    yesPrice: 23,
    noPrice: 77,
    volume: 890000,
    closeTime: '2025-01-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'STARSHIP-25Q1',
    title: 'Will SpaceX Starship reach orbit in Q1 2025?',
    subtitle: 'Space Technology',
    status: 'active',
    yesPrice: 82,
    noPrice: 18,
    volume: 567000,
    closeTime: '2025-03-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'TIKTOK-25MAR',
    title: 'Will there be a TikTok ban in the US by March 2025?',
    subtitle: 'Tech Policy',
    status: 'active',
    yesPrice: 45,
    noPrice: 55,
    volume: 2100000,
    closeTime: '2025-03-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'SPX-25JAN6K',
    title: 'Will the S&P 500 close above 6,000 in January?',
    subtitle: 'Stock Market',
    status: 'active',
    yesPrice: 58,
    noPrice: 42,
    volume: 1780000,
    closeTime: '2025-01-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'GPT5-25Q1',
    title: 'Will OpenAI release GPT-5 in Q1 2025?',
    subtitle: 'AI & Technology',
    status: 'active',
    yesPrice: 31,
    noPrice: 69,
    volume: 920000,
    closeTime: '2025-03-31T00:00:00Z',
    accounts: {},
  },
];

// Types for debug state and recent orders
interface DebugInfo {
  tokenkegCount: number;
  token2022Count: number;
  eligibleCount: number;
  excludedHits: string[];
  sampleMints: { mint: string; amount: string }[];
  outcomeMints: string[];
  error?: string;
}

interface RecentOrder {
  signature: string;
  ticker: string;
  side: 'YES' | 'NO';
  amountUSDC: number;
  estimatedShares: string;
  timestamp: number;
  status?: 'pending' | 'open' | 'closed' | 'failed' | 'expired' | 'unknown';
}

// Token program IDs
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// LocalStorage key for recent orders
const RECENT_ORDERS_KEY = 'kalshi_recent_orders';

export default function Kalshi() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { getEvents, getMarkets, filterOutcomeMints, getMarketsByMints, loading, error, callDflowApi } = useDflowApi();
  const [markets, setMarkets] = useState<KalshiMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);
  const [aiMarket, setAiMarket] = useState<KalshiMarket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('markets');
  const [positions, setPositions] = useState<any[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  // Load recent orders from localStorage
  useEffect(() => {
    if (publicKey) {
      try {
        const stored = localStorage.getItem(`${RECENT_ORDERS_KEY}_${publicKey.toBase58()}`);
        if (stored) {
          setRecentOrders(JSON.parse(stored));
        }
      } catch (e) {
        console.log('[Portfolio] Failed to load recent orders');
      }
    }
  }, [publicKey]);

  useEffect(() => {
    fetchMarkets();
  }, []);

  // Fetch positions when portfolio tab is selected or wallet connects
  useEffect(() => {
    if (activeTab === 'portfolio' && connected && publicKey) {
      fetchPositions();
    }
  }, [activeTab, connected, publicKey]);

  // Known non-market mints to exclude from portfolio scan
  const EXCLUDED_MINTS = [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'So11111111111111111111111111111111111111112', // wSOL
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  ];

  const fetchPositions = useCallback(async () => {
    if (!publicKey || !connection) {
      console.log('[Portfolio] No wallet connected, skipping fetch');
      return;
    }
    
    const walletAddress = publicKey.toBase58();
    console.log('[Portfolio] Starting fetch for wallet:', walletAddress);
    setPositionsLoading(true);
    setDebugInfo(null);
    
    const debug: DebugInfo = {
      tokenkegCount: 0,
      token2022Count: 0,
      eligibleCount: 0,
      excludedHits: [],
      sampleMints: [],
      outcomeMints: [],
    };
    
    try {
      const { PublicKey } = await import('@solana/web3.js');
      
      // Step 1: Get token accounts from BOTH programs
      console.log('[Portfolio] Step 1: Fetching token accounts from Tokenkeg + Token-2022...');
      
      const [tokenkegAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: new PublicKey(TOKEN_PROGRAM_ID) }
        ).catch(err => {
          console.log('[Portfolio] Tokenkeg fetch error:', err);
          return { value: [] };
        }),
        connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: new PublicKey(TOKEN_2022_PROGRAM_ID) }
        ).catch(err => {
          console.log('[Portfolio] Token-2022 fetch error:', err);
          return { value: [] };
        }),
      ]);
      
      debug.tokenkegCount = tokenkegAccounts.value.length;
      debug.token2022Count = token2022Accounts.value.length;
      console.log(`[Portfolio] Found ${debug.tokenkegCount} Tokenkeg + ${debug.token2022Count} Token-2022 accounts`);
      
      // Merge all accounts
      const allTokenAccounts = [...tokenkegAccounts.value, ...token2022Accounts.value];
      
      // Filter for non-zero balances using raw amount (string !== "0")
      const mintToAmount: Record<string, number> = {};
      const excludedHitSet = new Set<string>();
      
      allTokenAccounts.forEach(account => {
        const info = account.account.data.parsed?.info;
        const rawAmount = info?.tokenAmount?.amount || "0";
        const uiAmount = info?.tokenAmount?.uiAmount || 0;
        const mint = info?.mint;
        
        if (!mint) return;
        
        // Check if non-zero using raw string comparison
        if (rawAmount === "0") return;
        
        // Track excluded mints
        if (EXCLUDED_MINTS.includes(mint)) {
          excludedHitSet.add(mint);
          return;
        }
        
        mintToAmount[mint] = uiAmount;
      });
      
      debug.excludedHits = Array.from(excludedHitSet);
      debug.eligibleCount = Object.keys(mintToAmount).length;
      
      // Sample mints for debugging
      debug.sampleMints = Object.entries(mintToAmount).slice(0, 5).map(([mint, amount]) => ({
        mint: mint.slice(0, 8) + '...' + mint.slice(-4),
        amount: amount.toString(),
      }));
      
      console.log(`[Portfolio] ${debug.eligibleCount} eligible accounts (non-zero, after exclusions)`);
      console.log('[Portfolio] Excluded mints hit:', debug.excludedHits);
      
      if (debug.eligibleCount === 0) {
        console.log('[Portfolio] No eligible token accounts found');
        setDebugInfo(debug);
        setPositions([]);
        setPositionsLoading(false);
        return;
      }
      
      const allMints = Object.keys(mintToAmount);
      console.log(`[Portfolio] Step 2: Calling filterOutcomeMints with ${allMints.length} mints...`);
      console.log('[Portfolio] Sample mints:', allMints.slice(0, 3));
      
      // Step 2: Filter to only prediction market outcome mints using DFlow API
      const outcomeMints = await filterOutcomeMints(allMints);
      debug.outcomeMints = outcomeMints;
      console.log(`[Portfolio] filterOutcomeMints returned ${outcomeMints.length} prediction market mints`);
      
      if (outcomeMints.length === 0) {
        console.log('[Portfolio] No prediction market tokens found in wallet');
        setDebugInfo(debug);
        setPositions([]);
        setPositionsLoading(false);
        return;
      }
      
      // Step 3: Batch fetch market data for outcome mints using POST batch endpoint
      console.log(`[Portfolio] Step 3: Fetching market data for ${outcomeMints.length} mints...`);
      const marketsData = await getMarketsByMints(outcomeMints);
      console.log(`[Portfolio] getMarketsByMints returned ${marketsData.length} markets`);
      
      // Build positions from matched markets
      const positionsList: any[] = [];
      
      for (const market of marketsData) {
        if (!market.accounts) continue;
        
        // Check all account entries for matching mints
        for (const settlementKey of Object.keys(market.accounts)) {
          const accountInfo = market.accounts[settlementKey];
          if (!accountInfo) continue;
          
          // Check if user holds YES token
          if (accountInfo.yesMint && mintToAmount[accountInfo.yesMint]) {
            positionsList.push({
              marketTicker: market.ticker,
              marketTitle: market.title,
              side: 'yes',
              quantity: mintToAmount[accountInfo.yesMint],
              avgPrice: market.yesPrice,
              currentPrice: market.yesPrice,
              pnl: 0,
              pnlPercent: 0,
            });
          }
          
          // Check if user holds NO token
          if (accountInfo.noMint && mintToAmount[accountInfo.noMint]) {
            positionsList.push({
              marketTicker: market.ticker,
              marketTitle: market.title,
              side: 'no',
              quantity: mintToAmount[accountInfo.noMint],
              avgPrice: market.noPrice,
              currentPrice: market.noPrice,
              pnl: 0,
              pnlPercent: 0,
            });
          }
        }
      }
      
      console.log(`[Portfolio] Built ${positionsList.length} positions from ${marketsData.length} markets`);
      setDebugInfo(debug);
      setPositions(positionsList);
    } catch (err) {
      console.error('[Portfolio] Error fetching positions:', err);
      debug.error = err instanceof Error ? err.message : 'Unknown error';
      setDebugInfo(debug);
      toast.error(`Failed to load portfolio: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPositionsLoading(false);
    }
  }, [publicKey, connection, filterOutcomeMints, getMarketsByMints]);

  // Send debug report to backend for server-visible logging
  const sendDebugReport = useCallback(async () => {
    if (!publicKey || !debugInfo) return;
    
    try {
      await callDflowApi('clientLog', {
        wallet: publicKey.toBase58(),
        tokenkegCount: debugInfo.tokenkegCount,
        token2022Count: debugInfo.token2022Count,
        eligibleCount: debugInfo.eligibleCount,
        excludedHits: debugInfo.excludedHits,
        sampleMints: debugInfo.sampleMints,
        outcomeMints: debugInfo.outcomeMints,
        recentOrderSignatures: recentOrders.slice(0, 5).map(o => o.signature),
        error: debugInfo.error,
      });
      toast.success('Debug report sent');
    } catch (err) {
      toast.error('Failed to send debug report');
    }
  }, [publicKey, debugInfo, recentOrders, callDflowApi]);

  // Clear completed orders
  const clearCompletedOrders = useCallback(() => {
    if (!publicKey) return;
    const pending = recentOrders.filter(o => o.status === 'pending' || o.status === 'open' || !o.status);
    setRecentOrders(pending);
    localStorage.setItem(`${RECENT_ORDERS_KEY}_${publicKey.toBase58()}`, JSON.stringify(pending));
  }, [publicKey, recentOrders]);

  const fetchMarkets = async () => {
    setIsLoading(true);
    try {
      // Try to get events with nested markets first
      const events = await getEvents('active');
      
      // Flatten events into markets
      const allMarkets: KalshiMarket[] = [];
      events.forEach((event: KalshiEvent) => {
        if (event.markets && event.markets.length > 0) {
          event.markets.forEach(market => {
            // Add event info to market if title is missing
            if (!market.title && event.title) {
              market.title = event.title;
            }
            allMarkets.push(market);
          });
        }
      });
      
      if (allMarkets.length > 0) {
        setMarkets(allMarkets);
      } else {
        // Fallback to direct markets endpoint
        const directMarkets = await getMarkets();
        setMarkets(directMarkets.length > 0 ? directMarkets : DEMO_MARKETS);
      }
    } catch (err) {
      console.error('Failed to fetch markets:', err);
      // Use demo markets as fallback
      setMarkets(DEMO_MARKETS);
      toast.info('Showing demo markets');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMarkets = markets.filter(market =>
    (market.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (market.subtitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (market.ticker || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        
        {/* Animated Orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Powered by DFlow on Solana</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-foreground">Kalshi</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-purple-400 to-secondary bg-clip-text text-transparent">
                Markets
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl sm:text-2xl text-muted-foreground mb-10 leading-relaxed">
              Trade the future on Solana.
              <br />
              <span className="text-foreground font-medium">Fast. Simple. Powerful.</span>
            </p>
            
            {/* Wallet Button */}
            {!connected ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <WalletMultiButton className="!h-14 !px-8 !rounded-2xl !bg-primary hover:!bg-primary/90 !text-primary-foreground !font-semibold !text-lg !transition-all !duration-300 !shadow-lg hover:!shadow-xl hover:!shadow-primary/20" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30"
              >
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-medium">
                  {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <KalshiFeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Lightning Fast"
              description="Solana-native trading with sub-second execution and minimal fees"
              index={0}
            />
            <KalshiFeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Deep Liquidity"
              description="Powered by Kalshi's institutional-grade prediction markets"
              index={1}
            />
            <KalshiFeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Secure & Simple"
              description="Non-custodial SPL token trading with your Solana wallet"
              index={2}
            />
          </div>
        </div>
      </section>

      {/* Markets Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-muted/30 p-1 rounded-2xl">
              <TabsTrigger 
                value="markets" 
                className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Markets
              </TabsTrigger>
              <TabsTrigger 
                value="portfolio" 
                className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                disabled={!connected}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Portfolio
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64 h-11 rounded-xl bg-muted/30 border-border/50"
                />
              </div>
              
              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchMarkets}
                disabled={isLoading}
                className="h-11 w-11 rounded-xl border-border/50"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          <TabsContent value="markets" className="mt-0">
            {/* Markets Grid */}
            {isLoading ? (
              <KalshiLoadingSkeleton />
            ) : filteredMarkets.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">No markets found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarkets.map((market, index) => (
                  <KalshiMarketCard
                    key={market.ticker}
                    market={market}
                    onClick={() => setSelectedMarket(market)}
                    onAIAnalysis={() => setAiMarket(market)}
                    index={index}
                  />
                ))}
              </div>
            )}

            {/* View All Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12 text-center"
            >
              <Button
                variant="outline"
                className="h-12 px-8 rounded-2xl border-border/50 hover:border-primary/50 group"
              >
                View All Markets
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          </TabsContent>

          <TabsContent value="portfolio" className="mt-0">
            <KalshiPortfolio 
              positions={positions} 
              isLoading={positionsLoading}
              debugInfo={debugInfo}
              recentOrders={recentOrders}
              onSendDebugReport={sendDebugReport}
              onClearCompletedOrders={clearCompletedOrders}
              onRefreshPositions={fetchPositions}
            />
          </TabsContent>
        </Tabs>
      </section>

      {/* Trading Modal */}
      {selectedMarket && (
        <KalshiTradingModal
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
          onOrderSubmitted={(order) => {
            const newOrders = [order, ...recentOrders].slice(0, 20);
            setRecentOrders(newOrders);
            if (publicKey) {
              localStorage.setItem(`${RECENT_ORDERS_KEY}_${publicKey.toBase58()}`, JSON.stringify(newOrders));
            }
          }}
        />
      )}

      {/* AI Analysis Modal */}
      {aiMarket && (
        <KalshiAIInsight
          market={aiMarket}
          onClose={() => setAiMarket(null)}
        />
      )}
    </div>
  );
}
