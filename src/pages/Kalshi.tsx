import { useState, useEffect, useCallback, useMemo, useDeferredValue, memo, useRef, startTransition } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion, AnimatePresence } from "framer-motion";
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
  Menu,
  ChevronDown,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Click outside handler for modals
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is on modal backdrop
      if (target.closest("[data-modal-backdrop]")) {
        if (selectedMarket) setSelectedMarket(null);
        if (aiMarket) setAiMarket(null);
        if (sellPosition) setSellPosition(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedMarket, aiMarket, sellPosition]);

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

  // Professional color palette
  const colors = {
    primary: "#0D9488", // Teal-600
    primaryLight: "#5EEAD4", // Teal-300
    primaryDark: "#0F766E", // Teal-700
    secondary: "#475569", // Slate-600
    accent: "#8B5CF6", // Violet-500
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900">Menu</h3>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Markets
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Wallet className="mr-2 h-4 w-4" />
                  Portfolio
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Header */}
      <section className="relative overflow-hidden border-b border-slate-200">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-600/10 border border-teal-500/30 flex items-center justify-center">
                <img src={kalshiLogo} alt="Kalshi" className="w-7 h-7 rounded-lg object-cover" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Kalshi Markets</h1>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-teal-500" />
                  Powered by DFlow
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
              {!connected && (
                <WalletMultiButton className="!h-9 !px-4 !rounded-lg !bg-gradient-to-r !from-teal-600 !to-teal-700 hover:!opacity-90 !text-white !font-medium !text-sm" />
              )}
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative">
                <div className="absolute inset-0 bg-teal-500/20 rounded-xl blur-md" />
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-600/10 border border-teal-500/30 flex items-center justify-center overflow-hidden">
                  <img src={kalshiLogo} alt="Kalshi" className="w-10 h-10 rounded-lg object-cover" />
                </div>
              </motion.div>
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-2xl font-bold text-slate-900"
                >
                  Kalshi Prediction Markets
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-sm text-slate-600 flex items-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5 text-teal-500" />
                  Trade on Solana with zero fees • Powered by DFlow
                  <img src={solanaLogo} alt="Solana" className="w-4 h-4 ml-1" />
                </motion.p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!connected ? (
                <WalletMultiButton className="!h-11 !px-6 !rounded-xl !bg-gradient-to-r !from-teal-600 !to-teal-700 hover:!opacity-90 !text-white !font-medium !text-sm !transition-all" />
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 border border-teal-200">
                  <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-teal-700 font-medium text-sm">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Featured Market - Desktop only */}
          {featuredMarket && !isLoading && (
            <div className="hidden lg:block mb-8">
              <KalshiFeaturedMarket
                market={featuredMarket}
                onTrade={() => setSelectedMarket(featuredMarket)}
                onAIAnalysis={() => setAiMarket(featuredMarket)}
              />
            </div>
          )}

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 lg:gap-12 pt-6 border-t border-slate-200"
          >
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{allMarkets.length}+</p>
              <p className="text-xs sm:text-sm text-slate-600">Active Markets</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-teal-600">$0</p>
              <p className="text-xs sm:text-sm text-slate-600">Trading Fees</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-slate-900">~400ms</p>
              <p className="text-xs sm:text-sm text-slate-600">Avg. Execution</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-slate-900">24/7</p>
              <p className="text-xs sm:text-sm text-slate-600">Trading Hours</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-6">
        {/* Tabs and Controls */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-slate-100/80 p-1.5 rounded-xl backdrop-blur-sm border border-slate-200 w-full sm:w-auto">
              <TabsTrigger
                value="markets"
                className="rounded-lg px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 data-[state=active]:border data-[state=active]:border-slate-200 transition-all flex-1 sm:flex-none"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Markets
              </TabsTrigger>
              <TabsTrigger
                value="portfolio"
                className="rounded-lg px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 data-[state=active]:border data-[state=active]:border-slate-200 transition-all flex-1 sm:flex-none"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Portfolio
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 w-full h-11 rounded-xl bg-white border-slate-300 focus:border-teal-500 transition-all"
                />
              </div>

              {/* View Mode and Refresh */}
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 border border-slate-200">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 px-3 rounded-lg bg-white text-slate-700 hover:text-teal-700 hover:bg-white"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 px-3 rounded-lg bg-white text-slate-700 hover:text-teal-700 hover:bg-white"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    toast.loading("Refreshing markets...", { id: "refresh-markets" });
                    fetchMarkets().then(() => {
                      toast.success("Markets refreshed", { id: "refresh-markets" });
                    });
                  }}
                  disabled={isLoading}
                  className="h-11 w-11 rounded-xl border-slate-300 bg-white hover:bg-slate-50 hover:border-teal-500"
                >
                  <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </div>

          {/* Category Navigation */}
          {categories.length > 0 && activeTab === "markets" && (
            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 bg-white/80 backdrop-blur-sm border-b border-slate-200">
              <KalshiTabNav
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>
          )}

          <TabsContent value="markets" className="mt-0">
            {/* Search results header */}
            {deferredSearchQuery && searchResults.length > 0 && !isSearching && (
              <div className="mb-6 p-4 rounded-xl bg-teal-50 border border-teal-100">
                <div className="flex items-center gap-2 text-teal-700">
                  <Search className="w-4 h-4" />
                  <span className="font-medium">
                    Found {searchResults.length} markets for "{deferredSearchQuery}"
                  </span>
                </div>
              </div>
            )}

            {/* Markets Content */}
            {isLoading ? (
              <KalshiLoadingSkeleton />
            ) : isSearching ? (
              <KalshiSearchLoadingSkeleton />
            ) : filteredMarkets.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <Search className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No markets found</h3>
                <p className="text-slate-600 mb-4">Try adjusting your search or filters</p>
                {selectedCategory && (
                  <Button variant="outline" onClick={() => setSelectedCategory(null)} className="rounded-lg">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
              <div className="space-y-3">
                {filteredMarkets.map((market) => (
                  <div
                    key={market.ticker}
                    onClick={() => setSelectedMarket(market)}
                    className="group cursor-pointer p-4 rounded-xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-sm transition-all flex items-center gap-4"
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        market.status === "active" ? "bg-teal-500" : "bg-slate-300",
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                        {market.title || market.ticker}
                      </h3>
                      <p className="text-sm text-slate-600 truncate">{market.subtitle || market.ticker}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-base font-semibold",
                            market.yesPrice > market.noPrice ? "text-teal-600" : "text-slate-900",
                          )}
                        >
                          {market.yesPrice}¢
                        </p>
                        <p className="text-xs text-slate-500">YES</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-base font-semibold",
                            market.noPrice > market.yesPrice ? "text-rose-600" : "text-slate-900",
                          )}
                        >
                          {market.noPrice}¢
                        </p>
                        <p className="text-xs text-slate-500">NO</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-sm font-medium text-slate-900">
                          ${((market.volume || 0) / 1000).toFixed(0)}k
                        </p>
                        <p className="text-xs text-slate-500">Volume</p>
                      </div>
                    </div>

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

            {/* Load More Button */}
            {(filteredMarkets.length >= 60 || (deferredSearchQuery && filteredMarkets.length > 20)) && !showAll && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-10 text-center"
              >
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="h-12 px-8 rounded-xl border-slate-300 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 group transition-all"
                >
                  {deferredSearchQuery
                    ? `Show All ${filteredMarkets.length} Results`
                    : `View All ${filteredMarkets.length} Markets`}
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            )}

            {showAll && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setShowAll(false)}
                  className="h-10 px-6 rounded-lg text-slate-600 hover:text-slate-900"
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

      {/* Trading Modal with backdrop */}
      <AnimatePresence>
        {selectedMarket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            data-modal-backdrop
            onClick={(e) => e.target === e.currentTarget && setSelectedMarket(null)}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Analysis Modal with backdrop */}
      <AnimatePresence>
        {aiMarket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            data-modal-backdrop
            onClick={(e) => e.target === e.currentTarget && setAiMarket(null)}
          >
            <KalshiAIInsight
              market={aiMarket}
              onClose={() => setAiMarket(null)}
              onTrade={() => setSelectedMarket(aiMarket)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sell Modal with backdrop */}
      <AnimatePresence>
        {sellPosition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            data-modal-backdrop
            onClick={(e) => e.target === e.currentTarget && setSellPosition(null)}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
