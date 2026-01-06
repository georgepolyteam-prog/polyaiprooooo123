import { useState, useEffect, useCallback, useMemo, useDeferredValue, memo, useRef, startTransition } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// Debounce utility for localStorage writes
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}
import {
  TrendingUp,
  TrendingDown,
  Zap,
  ArrowRight,
  RefreshCw,
  Search,
  Wallet,
  LayoutGrid,
  List,
  Sparkles,
  Shield,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDflowApi, type KalshiMarket, type KalshiEvent } from "@/hooks/useDflowApi";
import { KalshiMarketCard } from "@/components/kalshi/KalshiMarketCard";
import { KalshiTradingModal } from "@/components/kalshi/KalshiTradingModal";
import { KalshiLoadingSkeleton, KalshiSearchLoadingSkeleton } from "@/components/kalshi/KalshiLoadingSkeleton";
import { KalshiPortfolio } from "@/components/kalshi/KalshiPortfolio";
import { KalshiAIInsight } from "@/components/kalshi/KalshiAIInsight";
import { KalshiConnectWallet } from "@/components/kalshi/KalshiConnectWallet";
import { KalshiAIButton } from "@/components/kalshi/KalshiAIButton";
import { KalshiFeaturedMarket } from "@/components/kalshi/KalshiFeaturedMarket";
import { KalshiTabNav } from "@/components/kalshi/KalshiTabNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import kalshiLogo from "@/assets/kalshi-logo-green.jpeg";
import solanaLogo from "@/assets/solana-logo.png";

// Demo markets for when API is unavailable
const DEMO_MARKETS: KalshiMarket[] = [
  {
    ticker: "BTCUSD-25DEC31",
    title: "Will Bitcoin exceed $100,000 by end of 2025?",
    subtitle: "BTC Price Prediction",
    status: "active",
    yesPrice: 67,
    noPrice: 33,
    volume: 1250000,
    closeTime: "2025-12-31T00:00:00Z",
    accounts: {},
  },
  {
    ticker: "FEDRATE-25JAN",
    title: "Will the Fed cut rates in January 2025?",
    subtitle: "Federal Reserve Policy",
    status: "active",
    yesPrice: 23,
    noPrice: 77,
    volume: 890000,
    closeTime: "2025-01-31T00:00:00Z",
    accounts: {},
  },
  {
    ticker: "STARSHIP-25Q1",
    title: "Will SpaceX Starship reach orbit in Q1 2025?",
    subtitle: "Space Technology",
    status: "active",
    yesPrice: 82,
    noPrice: 18,
    volume: 567000,
    closeTime: "2025-03-31T00:00:00Z",
    accounts: {},
  },
  {
    ticker: "TIKTOK-25MAR",
    title: "Will there be a TikTok ban in the US by March 2025?",
    subtitle: "Tech Policy",
    status: "active",
    yesPrice: 45,
    noPrice: 55,
    volume: 2100000,
    closeTime: "2025-03-31T00:00:00Z",
    accounts: {},
  },
  {
    ticker: "SPX-25JAN6K",
    title: "Will the S&P 500 close above 6,000 in January?",
    subtitle: "Stock Market",
    status: "active",
    yesPrice: 58,
    noPrice: 42,
    volume: 1780000,
    closeTime: "2025-01-31T00:00:00Z",
    accounts: {},
  },
  {
    ticker: "GPT5-25Q1",
    title: "Will OpenAI release GPT-5 in Q1 2025?",
    subtitle: "AI & Technology",
    status: "active",
    yesPrice: 31,
    noPrice: 69,
    volume: 920000,
    closeTime: "2025-03-31T00:00:00Z",
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
  side: "YES" | "NO";
  amountUSDC: number;
  estimatedShares: string;
  timestamp: number;
  status?: "pending" | "open" | "closed" | "failed" | "expired" | "unknown";
}

// Token program IDs
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

// LocalStorage key for recent orders
const RECENT_ORDERS_KEY = "kalshi_recent_orders";

// Cache key and TTL
const MARKETS_CACHE_KEY = "kalshi_markets_cache";
const CACHE_TTL_MS = 120000; // 2 minutes

export default function Kalshi() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const {
    getEvents,
    getMarkets,
    filterOutcomeMints,
    getMarketsByMints,
    loading,
    error,
    callDflowApi,
    searchEvents,
    getTagsByCategories,
  } = useDflowApi();
  const [markets, setMarkets] = useState<KalshiMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);
  const [aiMarket, setAiMarket] = useState<KalshiMarket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("markets");
  const [positions, setPositions] = useState<any[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [sellPosition, setSellPosition] = useState<any | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [allMarkets, setAllMarkets] = useState<KalshiMarket[]>([]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Warm up edge function on mount to eliminate cold start
  useEffect(() => {
    supabase.functions
      .invoke("dflow-api", {
        body: { action: "ping", params: {} },
      })
      .catch(() => {}); // Silent warm-up
  }, []);

  // Load cached markets immediately on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(MARKETS_CACHE_KEY);
      if (cached) {
        const { markets: cachedMarkets, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS && cachedMarkets?.length > 0) {
          console.log("[Kalshi] Loading from cache:", cachedMarkets.length, "markets");
          setMarkets(cachedMarkets);
          setIsLoading(false);
        }
      }
    } catch (e) {
      console.log("[Kalshi] Cache read failed");
    }
    // Always fetch fresh data in background
    fetchMarkets();
    // Fetch categories
    getTagsByCategories()
      .then((data) => {
        if (data?.tagsByCategories) {
          setCategories(Object.keys(data.tagsByCategories).slice(0, 8));
        }
      })
      .catch(() => {});
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
        console.log("[Portfolio] Failed to load recent orders");
      }
    }
  }, [publicKey]);

  // Fetch positions when portfolio tab is selected or wallet connects
  useEffect(() => {
    if (activeTab === "portfolio" && connected && publicKey) {
      startTransition(() => {
        fetchPositions();
      });
    }
  }, [activeTab, connected, publicKey]);

  // Known non-market mints to exclude from portfolio scan
  const EXCLUDED_MINTS = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "So11111111111111111111111111111111111111112", // wSOL
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  ];

  const fetchPositions = useCallback(async () => {
    if (!publicKey || !connection) {
      console.log("[Portfolio] No wallet connected, skipping fetch");
      return;
    }

    const walletAddress = publicKey.toBase58();
    console.log("[Portfolio] Starting fetch for wallet:", walletAddress);
    setPositionsLoading(true);
    setDebugInfo(null);
    toast.loading("Refreshing portfolio...", { id: "refresh-portfolio" });

    const debug: DebugInfo = {
      tokenkegCount: 0,
      token2022Count: 0,
      eligibleCount: 0,
      excludedHits: [],
      sampleMints: [],
      outcomeMints: [],
    };

    try {
      const { PublicKey } = await import("@solana/web3.js");

      // Step 1: Get token accounts from BOTH programs
      console.log("[Portfolio] Step 1: Fetching token accounts from Tokenkeg + Token-2022...");

      const [tokenkegAccounts, token2022Accounts] = await Promise.all([
        connection
          .getParsedTokenAccountsByOwner(publicKey, { programId: new PublicKey(TOKEN_PROGRAM_ID) })
          .catch((err) => {
            console.log("[Portfolio] Tokenkeg fetch error:", err);
            return { value: [] };
          }),
        connection
          .getParsedTokenAccountsByOwner(publicKey, { programId: new PublicKey(TOKEN_2022_PROGRAM_ID) })
          .catch((err) => {
            console.log("[Portfolio] Token-2022 fetch error:", err);
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

      allTokenAccounts.forEach((account) => {
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
      debug.sampleMints = Object.entries(mintToInfo)
        .slice(0, 5)
        .map(([mint, info]) => ({
          mint: mint.slice(0, 8) + "..." + mint.slice(-4),
          amount: info.uiAmount.toString(),
        }));

      console.log(`[Portfolio] ${debug.eligibleCount} eligible accounts (non-zero, after exclusions)`);
      console.log("[Portfolio] Excluded mints hit:", debug.excludedHits);

      if (debug.eligibleCount === 0) {
        console.log("[Portfolio] No eligible token accounts found");
        setDebugInfo(debug);
        setPositions([]);
        setPositionsLoading(false);
        return;
      }

      const allMints = Object.keys(mintToInfo);
      console.log(`[Portfolio] Step 2: Calling filterOutcomeMints with ${allMints.length} mints...`);
      console.log("[Portfolio] Sample mints:", allMints.slice(0, 3));

      // Step 2: Filter to only prediction market outcome mints using DFlow API
      const outcomeMints = await filterOutcomeMints(allMints);
      debug.outcomeMints = outcomeMints;
      console.log(`[Portfolio] filterOutcomeMints returned ${outcomeMints.length} prediction market mints`);

      if (outcomeMints.length === 0) {
        console.log("[Portfolio] No prediction market tokens found in wallet");
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
              side: "yes",
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
              side: "no",
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
      toast.success(`Found ${positionsList.length} positions`, { id: "refresh-portfolio" });
    } catch (err) {
      console.error("[Portfolio] Error fetching positions:", err);
      debug.error = err instanceof Error ? err.message : "Unknown error";
      setDebugInfo(debug);
      toast.error(`Failed to load portfolio: ${err instanceof Error ? err.message : "Unknown error"}`, {
        id: "refresh-portfolio",
      });
    } finally {
      setPositionsLoading(false);
    }
  }, [publicKey, connection, filterOutcomeMints, getMarketsByMints]);

  // Send debug report to backend for server-visible logging
  const sendDebugReport = useCallback(async () => {
    if (!publicKey || !debugInfo) return;

    try {
      await callDflowApi("clientLog", {
        wallet: publicKey.toBase58(),
        tokenkegCount: debugInfo.tokenkegCount,
        token2022Count: debugInfo.token2022Count,
        eligibleCount: debugInfo.eligibleCount,
        excludedHits: debugInfo.excludedHits,
        sampleMints: debugInfo.sampleMints,
        outcomeMints: debugInfo.outcomeMints,
        recentOrderSignatures: recentOrders.slice(0, 5).map((o) => o.signature),
        error: debugInfo.error,
      });
      toast.success("Debug report sent");
    } catch (err) {
      toast.error("Failed to send debug report");
    }
  }, [publicKey, debugInfo, recentOrders, callDflowApi]);

  // Clear completed orders - only keep pending/open, remove closed/failed/expired/unknown
  const clearCompletedOrders = useCallback(() => {
    if (!publicKey) return;
    const pending = recentOrders.filter((o) => o.status === "pending" || o.status === "open");
    setRecentOrders(pending);
    localStorage.setItem(`${RECENT_ORDERS_KEY}_${publicKey.toBase58()}`, JSON.stringify(pending));
    toast.success("Cleared completed orders");
  }, [publicKey, recentOrders]);

  const fetchMarkets = async () => {
    const fetchStart = performance.now();
    // Only show loading if we don't have cached data
    if (markets.length === 0) {
      setIsLoading(true);
    }
    try {
      // Try to get events with nested markets first
      const events = await getEvents("active");

      // Flatten events into markets
      const allMarketsData: KalshiMarket[] = [];
      events.forEach((event: KalshiEvent) => {
        if (event.markets && event.markets.length > 0) {
          event.markets.forEach((market) => {
            // Add event info to market if title is missing
            if (!market.title && event.title) {
              market.title = event.title;
            }
            allMarketsData.push(market);
          });
        }
      });

      const fetchedMarkets =
        allMarketsData.length > 0
          ? allMarketsData
          : (await getMarkets()).length > 0
            ? await getMarkets()
            : DEMO_MARKETS;

      setMarkets(fetchedMarkets);
      setAllMarkets(fetchedMarkets);

      // Cache the fresh data
      try {
        sessionStorage.setItem(
          MARKETS_CACHE_KEY,
          JSON.stringify({
            markets: fetchedMarkets,
            timestamp: Date.now(),
          }),
        );
      } catch (e) {
        console.log("[Kalshi] Cache write failed");
      }

      console.log(
        `[Kalshi] Fetched ${fetchedMarkets.length} markets in ${Math.round(performance.now() - fetchStart)}ms`,
      );
    } catch (err) {
      console.error("Failed to fetch markets:", err);
      // Use demo markets as fallback only if we have nothing
      if (markets.length === 0) {
        setMarkets(DEMO_MARKETS);
        setAllMarkets(DEMO_MARKETS);
        toast.info("Showing demo markets");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Prefetch cache to avoid duplicate requests
  const prefetchedRef = useRef<Set<string>>(new Set());

  // Prefetch trades on hover for faster modal open - uses cached getTrades
  const { getTrades } = useDflowApi();
  const handlePrefetch = useCallback(
    (ticker: string) => {
      if (prefetchedRef.current.has(ticker)) return;
      prefetchedRef.current.add(ticker);
      // Silent prefetch - populates the client-side cache
      getTrades(ticker, 50).catch(() => {});
    },
    [getTrades],
  );

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
        const searchMarkets = results.flatMap((e) => e.markets || []);
        setSearchResults(searchMarkets);
      } catch {
        // Fallback to local search of ALL markets
        const localResults = allMarkets.filter(
          (market) =>
            (market.title || "").toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
            (market.subtitle || "").toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
            (market.ticker || "").toLowerCase().includes(deferredSearchQuery.toLowerCase()),
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
      return searchResults.filter((market) => {
        const status = (market.status || "").toLowerCase();
        return status === "active" || status === "initialized" || status === "" || !status;
      });
    }

    // If searching but no results yet, show all markets with local filter
    if (deferredSearchQuery && isSearching) {
      const localResults = allMarkets.filter(
        (market) =>
          (market.title || "").toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
          (market.subtitle || "").toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
          (market.ticker || "").toLowerCase().includes(deferredSearchQuery.toLowerCase()),
      );
      return localResults.filter((market) => {
        const status = (market.status || "").toLowerCase();
        return status === "active" || status === "initialized" || status === "" || !status;
      });
    }

    // Otherwise use displayed markets with filters
    let result = markets.filter((market) => {
      const status = (market.status || "").toLowerCase();
      return status === "active" || status === "initialized" || status === "" || !status;
    });

    // Category filter
    if (selectedCategory) {
      result = result.filter(
        (market) =>
          (market.subtitle || "").toLowerCase().includes(selectedCategory.toLowerCase()) ||
          (market.ticker || "").toLowerCase().includes(selectedCategory.toLowerCase()),
      );
    }

    return showAll ? result : result.slice(0, 60);
  }, [markets, allMarkets, deferredSearchQuery, selectedCategory, showAll, searchResults, isSearching]);

  // Get featured market (highest volume active market)
  const featuredMarket = useMemo(() => {
    const activeMarkets = markets.filter((m) => m.status === "active" || !m.status);
    if (activeMarkets.length === 0) return null;
    return activeMarkets.reduce((a, b) => ((a.volume || 0) > (b.volume || 0) ? a : b));
  }, [markets]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Geo-blocking Notice Banner - Restricted Jurisdictions */}
      <div className="bg-destructive/10 border-b border-destructive/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-destructive/20 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">
              Kalshi Trading Restrictions
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Please ensure you are geo-blocking the US and restricted Kalshi jurisdictions before trading.{' '}
              <Link to="/kalshi-disclaimer" className="text-primary hover:underline font-medium">
                View full list of restricted regions →
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Dismissible Kalshi Disclaimer Banner */}
      <AnimatePresence>
        {!sessionStorage.getItem('kalshi_disclaimer_dismissed') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative bg-muted/30 border-b border-border/40"
          >
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-1 rounded-md bg-primary/10">
                  <Shield className="w-3 h-3 text-primary flex-shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground truncate sm:whitespace-normal font-mono">
                  <span className="font-medium text-foreground">Third-party interface.</span>{' '}
                  <span className="hidden sm:inline">Trades execute via DFlow on Solana. </span>
                  <Link to="/kalshi-disclaimer" className="text-primary hover:underline font-medium">
                    Disclaimer
                  </Link>
                </p>
              </div>
              <button
                onClick={() => {
                  sessionStorage.setItem('kalshi_disclaimer_dismissed', 'true');
                  window.dispatchEvent(new Event('storage'));
                }}
                className="p-1 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
                aria-label="Dismiss disclaimer"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/30">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/3 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
          {/* Section label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
              // kalshi markets
            </span>
          </motion.div>

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative">
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-card/60 border border-border/40 flex items-center justify-center overflow-hidden">
                  <img src={kalshiLogo} alt="Kalshi" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover" />
                </div>
              </motion.div>
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xl sm:text-2xl font-bold text-foreground"
                >
                  Kalshi Markets
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 font-mono"
                >
                  <Zap className="w-3 h-3 text-primary" />
                  Trade on Solana via DFlow
                </motion.p>
              </div>
            </div>

            {/* Wallet */}
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/30 border border-border/40"
              >
                <span className="text-[10px] font-mono text-muted-foreground">
                  Powered by DFlow
                </span>
                <div className="w-px h-2.5 bg-border/50" />
                <img src={solanaLogo} alt="Solana" className="w-3.5 h-3.5" />
              </motion.div>

              {!connected ? (
                <WalletMultiButton className="!h-9 sm:!h-10 !px-4 !rounded-xl !bg-primary hover:!bg-primary/90 !shadow-lg !border !border-primary/50 !text-primary-foreground !font-medium !text-sm !transition-all duration-200" />
              ) : (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 hover:border-primary/50 transition-all cursor-pointer group"
                >
                  <div className="relative">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  </div>
                  <span className="text-xs font-mono font-medium text-primary">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                  </span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Featured Market */}
          {featuredMarket && !isLoading && (
            <div className="mb-6 sm:mb-8">
              <KalshiFeaturedMarket
                market={featuredMarket}
                onTrade={() => setSelectedMarket(featuredMarket)}
                onAIAnalysis={() => setAiMarket(featuredMarket)}
              />
            </div>
          )}

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-6 border-t border-border/30"
          >
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold font-mono text-foreground">{allMarkets.length}+</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase tracking-wider">Markets</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold font-mono text-primary">~400ms</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase tracking-wider">Execution</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold font-mono text-foreground">99.9%</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono uppercase tracking-wider">Uptime</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Markets Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 sm:pb-32">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4"
        >
          <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            // browse & trade
          </span>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-muted/30 p-1 rounded-xl backdrop-blur-sm border border-border/40 w-full sm:w-auto">
              <TabsTrigger
                value="markets"
                className="rounded-lg px-4 sm:px-5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/40 transition-all flex-1 sm:flex-none text-sm"
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                Markets
              </TabsTrigger>
              <TabsTrigger
                value="portfolio"
                className="rounded-lg px-4 sm:px-5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/40 transition-all flex-1 sm:flex-none text-sm"
              >
                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                Portfolio
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* View Mode Toggle */}
              <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-muted/30 border border-border/40">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8 p-0 rounded-md transition-all"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8 p-0 rounded-md transition-all"
                >
                  <List className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Search */}
              <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
                <Input
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 w-full h-10 rounded-xl bg-background border-border/40 focus:border-primary/50 transition-all text-sm"
                />
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  toast.loading("Refreshing...", { id: "refresh-markets" });
                  fetchMarkets().then(() => {
                    toast.success("Refreshed", { id: "refresh-markets" });
                  });
                }}
                disabled={isLoading}
                className="h-10 w-10 rounded-xl border-border/40 bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-all flex-shrink-0"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          <TabsContent value="markets" className="mt-0">
            {/* Category Navigation */}
            {categories.length > 0 && (
              <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5 mb-5 bg-background/90 backdrop-blur-xl border-b border-border/30">
                <KalshiTabNav
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              </div>
            )}

            {/* Search results count */}
            {deferredSearchQuery && searchResults.length > 0 && !isSearching && (
              <div className="mb-4 flex items-center gap-2 text-xs text-primary font-mono">
                <Search className="w-3.5 h-3.5" />
                Found {searchResults.length} markets for "{deferredSearchQuery}"
              </div>
            )}

            {/* Markets Grid/List */}
            {isLoading ? (
              <KalshiLoadingSkeleton />
            ) : isSearching ? (
              <KalshiSearchLoadingSkeleton />
            ) : filteredMarkets.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <p className="text-muted-foreground text-lg">No markets found</p>
                {selectedCategory && (
                  <Button variant="link" onClick={() => setSelectedCategory(null)} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
              // List view
              <div className="space-y-2">
                {filteredMarkets.map((market) => (
                  <div
                    key={market.ticker}
                    onClick={() => setSelectedMarket(market)}
                    className="group cursor-pointer p-3 sm:p-4 rounded-xl bg-card/60 border border-border/40 hover:border-primary/30 hover:bg-card/80 transition-all flex items-center gap-3 sm:gap-4"
                  >
                    {/* Status */}
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        market.status === "active" ? "bg-emerald-500" : "bg-muted",
                      )}
                    />

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">
                        {market.title || market.ticker}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {market.subtitle || market.ticker}
                      </p>
                    </div>

                    {/* Prices */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-bold font-mono",
                            market.yesPrice > market.noPrice ? "text-emerald-500" : "text-foreground/70",
                          )}
                        >
                          {market.yesPrice}¢
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">YES</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-bold font-mono",
                            market.noPrice > market.yesPrice ? "text-red-500" : "text-foreground/70",
                          )}
                        >
                          {market.noPrice}¢
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">NO</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-mono font-medium text-foreground">
                          ${((market.volume || 0) / 1000).toFixed(0)}k
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">Vol</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      <KalshiAIButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setAiMarket(market);
                        }}
                        compact
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View All Button - works for both search and browse */}
            {(filteredMarkets.length >= 60 || (deferredSearchQuery && filteredMarkets.length > 20)) && !showAll && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-8 text-center"
              >
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="h-10 px-6 rounded-xl border-border/40 hover:border-primary/30 hover:bg-primary/5 group transition-all"
                >
                  {deferredSearchQuery
                    ? `Show All ${filteredMarkets.length} Results`
                    : `View All ${allMarkets.length} Markets`}
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </motion.div>
            )}

            {showAll && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setShowAll(false)}
                  className="h-9 px-5 rounded-lg text-muted-foreground hover:text-foreground text-sm"
                >
                  Show Less
                </Button>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="portfolio" className="mt-0">
            {connected ? (
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
            ) : (
              <KalshiConnectWallet />
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Trading Modal */}
      {selectedMarket && (
        <KalshiTradingModal
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
          onAIAnalysis={() => setAiMarket(selectedMarket)}
          onOrderSubmitted={(order) => {
            const newOrders = [order, ...recentOrders].slice(0, 20);
            setRecentOrders(newOrders);
            if (publicKey) {
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
          onTrade={() => setSelectedMarket(aiMarket)}
        />
      )}

      {/* Sell Modal */}
      {sellPosition && (
        <KalshiTradingModal
          market={
            {
              ticker: sellPosition.marketTicker,
              title: sellPosition.marketTitle,
              yesPrice: sellPosition.side === "yes" ? sellPosition.currentPrice : 100 - sellPosition.currentPrice,
              noPrice: sellPosition.side === "no" ? sellPosition.currentPrice : 100 - sellPosition.currentPrice,
              accounts: {},
            } as any
          }
          onClose={() => setSellPosition(null)}
          mode="sell"
          initialSide={sellPosition.side.toUpperCase() as "YES" | "NO"}
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
