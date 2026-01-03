import { useState, useEffect, useCallback, useMemo, useDeferredValue, memo, useRef, startTransition } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

// Debounce utility for localStorage writes
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}
import { TrendingUp, TrendingDown, Zap, Shield, ArrowRight, RefreshCw, Search, Sparkles, Wallet, BarChart3, Filter, X, LayoutGrid, List } from 'lucide-react';
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
import kalshiLogo from '@/assets/kalshi-logo-green.jpeg';
import solanaLogo from '@/assets/solana-logo.png';

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

// Cache key and TTL
const MARKETS_CACHE_KEY = 'kalshi_markets_cache';
const CACHE_TTL_MS = 120000; // 2 minutes

export default function Kalshi() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { getEvents, getMarkets, filterOutcomeMints, getMarketsByMints, loading, error, callDflowApi, searchEvents, getTagsByCategories } = useDflowApi();
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
  const [sellPosition, setSellPosition] = useState<any | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [allMarkets, setAllMarkets] = useState<KalshiMarket[]>([]);
  
  const deferredSearchQuery = useDeferredValue(searchQuery);
  
  // Warm up edge function on mount to eliminate cold start
  useEffect(() => {
    supabase.functions.invoke('dflow-api', { 
      body: { action: 'ping', params: {} }
    }).catch(() => {}); // Silent warm-up
  }, []);
  
  // Load cached markets immediately on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(MARKETS_CACHE_KEY);
      if (cached) {
        const { markets: cachedMarkets, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS && cachedMarkets?.length > 0) {
          console.log('[Kalshi] Loading from cache:', cachedMarkets.length, 'markets');
          setMarkets(cachedMarkets);
          setIsLoading(false);
        }
      }
    } catch (e) {
      console.log('[Kalshi] Cache read failed');
    }
    // Always fetch fresh data in background
    fetchMarkets();
    // Fetch categories
    getTagsByCategories().then(data => {
      if (data?.tagsByCategories) {
        setCategories(Object.keys(data.tagsByCategories).slice(0, 8));
      }
    }).catch(() => {});
  }, []);
  
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

  // Fetch positions when portfolio tab is selected or wallet connects
  useEffect(() => {
    if (activeTab === 'portfolio' && connected && publicKey) {
      startTransition(() => {
        fetchPositions();
      });
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
    toast.loading('Refreshing portfolio...', { id: 'refresh-portfolio' });
    
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
      // Store full info for each mint: { uiAmount, rawAmount, decimals }
      const mintToInfo: Record<string, { uiAmount: number; rawAmount: string; decimals: number }> = {};
      const excludedHitSet = new Set<string>();
      
      allTokenAccounts.forEach(account => {
        const info = account.account.data.parsed?.info;
        const tokenAmount = info?.tokenAmount;
        const rawAmount = tokenAmount?.amount || "0";
        const decimals = tokenAmount?.decimals ?? 0;
        const mint = info?.mint;
        
        if (!mint) return;
        
        // Check if non-zero using raw string comparison
        if (rawAmount === "0") return;
        
        // Track excluded mints
        if (EXCLUDED_MINTS.includes(mint)) {
          excludedHitSet.add(mint);
          return;
        }
        
        // Compute uiAmount robustly - fallback if uiAmount is null
        let uiAmount = tokenAmount?.uiAmount;
        if (uiAmount == null || isNaN(uiAmount)) {
          // Compute from raw amount and decimals
          uiAmount = Number(rawAmount) / Math.pow(10, decimals);
        }
        
        mintToInfo[mint] = { uiAmount, rawAmount, decimals };
      });
      
      debug.excludedHits = Array.from(excludedHitSet);
      debug.eligibleCount = Object.keys(mintToInfo).length;
      
      // Sample mints for debugging
      debug.sampleMints = Object.entries(mintToInfo).slice(0, 5).map(([mint, info]) => ({
        mint: mint.slice(0, 8) + '...' + mint.slice(-4),
        amount: info.uiAmount.toString(),
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
      
      const allMints = Object.keys(mintToInfo);
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
          const yesMint = accountInfo.yesMint;
          if (yesMint && mintToInfo[yesMint]) {
            const info = mintToInfo[yesMint];
            positionsList.push({
              marketTicker: market.ticker,
              marketTitle: market.title,
              side: 'yes',
              quantity: info.uiAmount,
              avgPrice: market.yesPrice,
              currentPrice: market.yesPrice,
              pnl: 0,
              pnlPercent: 0,
              // For selling
              sideMint: yesMint,
              decimals: info.decimals,
              rawAmount: info.rawAmount,
            });
          }
          
          // Check if user holds NO token
          const noMint = accountInfo.noMint;
          if (noMint && mintToInfo[noMint]) {
            const info = mintToInfo[noMint];
            positionsList.push({
              marketTicker: market.ticker,
              marketTitle: market.title,
              side: 'no',
              quantity: info.uiAmount,
              avgPrice: market.noPrice,
              currentPrice: market.noPrice,
              pnl: 0,
              pnlPercent: 0,
              // For selling
              sideMint: noMint,
              decimals: info.decimals,
              rawAmount: info.rawAmount,
            });
          }
        }
      }
      
      console.log(`[Portfolio] Built ${positionsList.length} positions from ${marketsData.length} markets`);
      setDebugInfo(debug);
      setPositions(positionsList);
      toast.success(`Found ${positionsList.length} positions`, { id: 'refresh-portfolio' });
    } catch (err) {
      console.error('[Portfolio] Error fetching positions:', err);
      debug.error = err instanceof Error ? err.message : 'Unknown error';
      setDebugInfo(debug);
      toast.error(`Failed to load portfolio: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: 'refresh-portfolio' });
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

  // Clear completed orders - only keep pending/open, remove closed/failed/expired/unknown
  const clearCompletedOrders = useCallback(() => {
    if (!publicKey) return;
    const pending = recentOrders.filter(o => o.status === 'pending' || o.status === 'open');
    setRecentOrders(pending);
    localStorage.setItem(`${RECENT_ORDERS_KEY}_${publicKey.toBase58()}`, JSON.stringify(pending));
    toast.success('Cleared completed orders');
  }, [publicKey, recentOrders]);

  const fetchMarkets = async () => {
    const fetchStart = performance.now();
    // Only show loading if we don't have cached data
    if (markets.length === 0) {
      setIsLoading(true);
    }
    try {
      // Try to get events with nested markets first
      const events = await getEvents('active');
      
      // Flatten events into markets
      const allMarketsData: KalshiMarket[] = [];
      events.forEach((event: KalshiEvent) => {
        if (event.markets && event.markets.length > 0) {
          event.markets.forEach(market => {
            // Add event info to market if title is missing
            if (!market.title && event.title) {
              market.title = event.title;
            }
            allMarketsData.push(market);
          });
        }
      });
      
      const fetchedMarkets = allMarketsData.length > 0 
        ? allMarketsData 
        : (await getMarkets()).length > 0 
          ? await getMarkets() 
          : DEMO_MARKETS;
      
      setMarkets(fetchedMarkets);
      setAllMarkets(fetchedMarkets);
      
      // Cache the fresh data
      try {
        sessionStorage.setItem(MARKETS_CACHE_KEY, JSON.stringify({
          markets: fetchedMarkets,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.log('[Kalshi] Cache write failed');
      }
      
      console.log(`[Kalshi] Fetched ${fetchedMarkets.length} markets in ${Math.round(performance.now() - fetchStart)}ms`);
    } catch (err) {
      console.error('Failed to fetch markets:', err);
      // Use demo markets as fallback only if we have nothing
      if (markets.length === 0) {
        setMarkets(DEMO_MARKETS);
        setAllMarkets(DEMO_MARKETS);
        toast.info('Showing demo markets');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Prefetch cache to avoid duplicate requests
  const prefetchedRef = useRef<Set<string>>(new Set());
  
  // Prefetch trades on hover for faster modal open - uses cached getTrades
  const { getTrades } = useDflowApi();
  const handlePrefetch = useCallback((ticker: string) => {
    if (prefetchedRef.current.has(ticker)) return;
    prefetchedRef.current.add(ticker);
    // Silent prefetch - populates the client-side cache
    getTrades(ticker, 50).catch(() => {});
  }, [getTrades]);

  // Server-side search for ALL markets (not just local filter)
  const [searchResults, setSearchResults] = useState<KalshiMarket[]>([]);
  
  useEffect(() => {
    if (!deferredSearchQuery || deferredSearchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    
    const doSearch = async () => {
      try {
        const results = await searchEvents(deferredSearchQuery);
        const searchMarkets = results.flatMap(e => e.markets || []);
        setSearchResults(searchMarkets);
      } catch {
        // Fallback to local search of ALL markets
        const localResults = allMarkets.filter(market =>
          (market.title || '').toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
          (market.subtitle || '').toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
          (market.ticker || '').toLowerCase().includes(deferredSearchQuery.toLowerCase())
        );
        setSearchResults(localResults);
      } finally {
        setIsSearching(false);
      }
    };
    
    const timer = setTimeout(doSearch, 400);
    return () => clearTimeout(timer);
  }, [deferredSearchQuery, searchEvents, allMarkets]);

  // Use search results when searching, otherwise filter local markets
  const filteredMarkets = useMemo(() => {
    // If actively searching, use search results
    if (deferredSearchQuery && searchResults.length > 0) {
      return searchResults.filter(market => {
        const status = (market.status || '').toLowerCase();
        return status === 'active' || status === 'initialized' || status === '' || !status;
      });
    }
    
    // If searching but no results yet, show all markets with local filter
    if (deferredSearchQuery && isSearching) {
      const localResults = allMarkets.filter(market =>
        (market.title || '').toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        (market.subtitle || '').toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        (market.ticker || '').toLowerCase().includes(deferredSearchQuery.toLowerCase())
      );
      return localResults.filter(market => {
        const status = (market.status || '').toLowerCase();
        return status === 'active' || status === 'initialized' || status === '' || !status;
      });
    }
    
    // Otherwise use displayed markets with filters
    let result = markets.filter(market => {
      const status = (market.status || '').toLowerCase();
      return status === 'active' || status === 'initialized' || status === '' || !status;
    });
    
    // Category filter
    if (selectedCategory) {
      result = result.filter(market =>
        (market.subtitle || '').toLowerCase().includes(selectedCategory.toLowerCase()) ||
        (market.ticker || '').toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }
    
    return showAll ? result : result.slice(0, 60);
  }, [markets, allMarkets, deferredSearchQuery, selectedCategory, showAll, searchResults, isSearching]);

  return (
    <div className="min-h-screen bg-background">
      {/* NEW PREMIUM HERO SECTION */}
      <section className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-purple-500/10" />
        
        {/* Premium grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
        
        {/* Floating orbs */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '700ms' }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-20 sm:pb-28">
          {/* Premium Logo Bubbles with animations */}
          <div className="flex justify-center gap-4 sm:gap-8 mb-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#00D395] to-emerald-600 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#00D395]/20 border-2 border-[#00D395]/40 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                <img src={kalshiLogo} alt="Kalshi" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover" />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: -30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
              className="flex items-center justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 via-primary to-purple-400 bg-clip-text text-transparent"
              >
                ✕
              </motion.div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border-2 border-purple-500/40 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                <img src={solanaLogo} alt="Solana" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
              </div>
            </motion.div>
          </div>

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
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6"
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Powered by DFlow on Solana</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              <span className="text-foreground">Kalshi</span>
              <span className="bg-gradient-to-r from-emerald-400 via-primary to-purple-400 bg-clip-text text-transparent"> Markets</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              Trade prediction markets on Solana
            </p>
            
            {/* Premium Buy/Sell Pills */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, type: 'spring' }}
                whileHover={{ scale: 1.05 }}
                className="relative group w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border-2 border-emerald-500/40 backdrop-blur-sm shadow-xl">
                  <div className="p-2 rounded-full bg-emerald-500/20">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-emerald-400/80 font-medium">Buy</p>
                    <p className="text-lg text-emerald-400 font-bold">YES</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, type: 'spring' }}
                whileHover={{ scale: 1.05 }}
                className="relative group w-full sm:w-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-red-500/20 to-red-600/20 border-2 border-red-500/40 backdrop-blur-sm shadow-xl">
                  <div className="p-2 rounded-full bg-red-500/20">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-red-400/80 font-medium">Buy</p>
                    <p className="text-lg text-red-400 font-bold">NO</p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Wallet Button */}
            {!connected ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <WalletMultiButton className="!h-14 !px-8 !rounded-full !bg-gradient-to-r !from-emerald-500 !to-primary hover:!opacity-90 !text-primary-foreground !font-semibold !text-lg !transition-all !duration-300 !shadow-lg hover:!shadow-xl hover:!shadow-emerald-500/20" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-emerald-500/10 border border-emerald-500/30"
              >
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-medium">
                  {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16">
            <KalshiFeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Lightning Fast"
              description="Sub-second execution on Solana"
              index={0}
            />
            <KalshiFeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Deep Liquidity"
              description="Kalshi's institutional markets"
              index={1}
            />
            <KalshiFeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Non-Custodial"
              description="Trade with your Solana wallet"
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
            <TabsList className="bg-muted/40 p-1.5 rounded-2xl backdrop-blur-sm border border-border/50">
              <TabsTrigger 
                value="markets" 
                className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-border/50 transition-all"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Markets
              </TabsTrigger>
              <TabsTrigger 
                value="portfolio" 
                className="rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-border/50 transition-all disabled:opacity-50"
                disabled={!connected}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Portfolio
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/50 backdrop-blur-sm">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-9 px-3 rounded-lg transition-all"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-9 px-3 rounded-lg transition-all"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search all markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 pr-4 w-full sm:w-72 h-11 rounded-xl bg-muted/40 border-border/50 backdrop-blur-sm focus:border-primary/50 transition-all"
                />
              </div>
              
              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  toast.loading('Refreshing markets...', { id: 'refresh-markets' });
                  fetchMarkets().then(() => {
                    toast.success('Markets refreshed', { id: 'refresh-markets' });
                  });
                }}
                disabled={isLoading}
                className="h-11 w-11 rounded-xl border-border/50 bg-muted/40 backdrop-blur-sm hover:bg-muted/60 hover:border-primary/50 transition-all"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          <TabsContent value="markets" className="mt-0">
            {/* Category Filters */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <Button
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="rounded-full h-9 px-5 font-medium transition-all hover:scale-105"
                >
                  All
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className="rounded-full h-9 px-5 font-medium transition-all hover:scale-105"
                  >
                    {cat}
                  </Button>
                ))}
                {selectedCategory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className="rounded-full h-9 px-4 font-medium transition-all hover:scale-105"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            )}

            {/* Search indicator */}
            {isSearching && (
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Searching all 5,000+ markets...
              </div>
            )}
            
            {/* Search results count */}
            {deferredSearchQuery && searchResults.length > 0 && !isSearching && (
              <div className="mb-4 flex items-center gap-2 text-sm text-emerald-400">
                <Search className="w-4 h-4" />
                Found {searchResults.length} markets matching "{deferredSearchQuery}"
              </div>
            )}

            {/* Markets Grid/List */}
            {isLoading ? (
              <KalshiLoadingSkeleton />
            ) : filteredMarkets.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">No markets found</p>
                {selectedCategory && (
                  <Button variant="link" onClick={() => setSelectedCategory(null)} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarkets.map((market, index) => (
                  <KalshiMarketCard
                    key={market.ticker}
                    market={market}
                    onClick={() => setSelectedMarket(market)}
                    onAIAnalysis={() => setAiMarket(market)}
                    onPrefetch={handlePrefetch}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              // List view - more detailed
              <div className="space-y-3">
                {filteredMarkets.map((market) => (
                  <div
                    key={market.ticker}
                    onClick={() => setSelectedMarket(market)}
                    className="group cursor-pointer p-4 rounded-2xl bg-card/80 border border-border/50 hover:border-primary/30 transition-all flex items-center gap-4"
                  >
                    {/* Status */}
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      market.status === 'active' ? "bg-emerald-400" : "bg-muted"
                    )} />
                    
                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {market.title || market.ticker}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {market.subtitle || market.ticker}
                      </p>
                    </div>
                    
                    {/* Prices */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className={cn(
                          "text-lg font-bold",
                          market.yesPrice > market.noPrice ? "text-emerald-400" : "text-foreground"
                        )}>
                          {market.yesPrice}¢
                        </p>
                        <p className="text-xs text-muted-foreground">YES</p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-lg font-bold",
                          market.noPrice > market.yesPrice ? "text-red-400" : "text-foreground"
                        )}>
                          {market.noPrice}¢
                        </p>
                        <p className="text-xs text-muted-foreground">NO</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-foreground">
                          ${((market.volume || 0) / 1000).toFixed(0)}k
                        </p>
                        <p className="text-xs text-muted-foreground">Volume</p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAiMarket(market);
                        }}
                        className={cn(
                          "flex items-center justify-center gap-1.5 h-9 px-4",
                          "rounded-full text-sm font-medium",
                          "bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10",
                          "border border-primary/20 hover:border-primary/40",
                          "text-primary",
                          "transition-all duration-300",
                          "hover:shadow-lg hover:shadow-primary/20",
                          "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden sm:inline">AI</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View All Button - now functional */}
            {markets.filter(m => {
              const status = (m.status || '').toLowerCase();
              return status === 'active' || status === 'initialized' || status === '' || !status;
            }).length > 60 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 text-center"
              >
                <Button
                  variant="outline"
                  onClick={() => setShowAll(!showAll)}
                  className="h-12 px-10 rounded-2xl border-border/50 hover:border-primary/50 hover:bg-primary/5 group transition-all shadow-lg hover:shadow-xl"
                >
                  {showAll ? 'Show Less' : `View All ${markets.length} Markets`}
                  <ArrowRight className={cn(
                    "w-4 h-4 ml-2 transition-transform",
                    showAll ? "rotate-90" : "group-hover:translate-x-1"
                  )} />
                </Button>
              </motion.div>
            )}
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
              onSellPosition={(pos) => setSellPosition(pos)}
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
              // Debounce localStorage write
              setTimeout(() => {
                localStorage.setItem(`${RECENT_ORDERS_KEY}_${publicKey.toBase58()}`, JSON.stringify(newOrders));
              }, 100);
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

      {/* Sell Modal */}
      {sellPosition && (
        <KalshiTradingModal
          market={{
            ticker: sellPosition.marketTicker,
            title: sellPosition.marketTitle,
            yesPrice: sellPosition.side === 'yes' ? sellPosition.currentPrice : 100 - sellPosition.currentPrice,
            noPrice: sellPosition.side === 'no' ? sellPosition.currentPrice : 100 - sellPosition.currentPrice,
            accounts: {},
          } as any}
          onClose={() => setSellPosition(null)}
          mode="sell"
          initialSide={sellPosition.side.toUpperCase() as 'YES' | 'NO'}
          sellMint={sellPosition.sideMint}
          sellDecimals={sellPosition.decimals}
          maxShares={sellPosition.quantity}
          onOrderSubmitted={(order) => {
            const newOrders = [order, ...recentOrders].slice(0, 20);
            setRecentOrders(newOrders);
            if (publicKey) {
              localStorage.setItem(`${RECENT_ORDERS_KEY}_${publicKey.toBase58()}`, JSON.stringify(newOrders));
            }
            fetchPositions();
          }}
        />
      )}
    </div>
  );
}
