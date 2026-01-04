import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pause,
  Play,
  TrendingUp,
  TrendingDown,
  Activity,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Clock,
  Download,
  Volume2,
  VolumeX,
  HelpCircle,
  Eye,
  Settings,
  Users,
  Target,
  Zap as ZapIcon,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { TradeDetailModal } from "@/components/trades/TradeDetailModal";
import { TradeFilters } from "@/components/trades/TradeFilters";
import { TradeStats } from "@/components/trades/TradeStats";
import { TopTradersSidebar } from "@/components/trades/TopTradersSidebar";
import { MarketHeatmap } from "@/components/trades/MarketHeatmap";
import { AnalysisSelectionModal } from "@/components/AnalysisSelectionModal";
import { MarketTradeModal } from "@/components/MarketTradeModal";
import { LiveTradesTour } from "@/components/trades/LiveTradesTour";
import { LiveTradesHowItWorks } from "@/components/trades/LiveTradesHowItWorks";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchTradeableMarketData, TradeableMarketData } from "@/lib/market-trade-data";
import { useTrackedWallets } from "@/hooks/useTrackedWallets";
import dflowLogo from "@/assets/dflow-logo.png";

interface Trade {
  token_id: string;
  token_label: string;
  side: "BUY" | "SELL";
  market_slug: string;
  condition_id: string;
  shares: number;
  shares_normalized: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  order_hash: string;
  user: string;
  taker: string;
  image?: string;
  resolved_url?: string; // Cached resolved URL
  _batchIndex?: number; // For CSS stagger animation
  _batchTime?: number; // Batch timestamp
}

interface MarketContext {
  eventTitle: string;
  outcomeQuestion: string;
  currentOdds: number;
  volume: number;
  url: string;
  slug: string;
  eventSlug: string;
  image?: string;
}

// Simplified trade info for analysis context
interface TradeAnalysisInfo {
  title: string;
  price: number;
  shares_normalized?: number;
  shares?: number;
  market_slug: string;
  image?: string;
}

// Constants for connection health
const STALE_THRESHOLD_MS = 15000;
const WATCHDOG_INTERVAL_MS = 5000;
const HARD_RECONNECT_INTERVAL_MS = 300000;
const WHALE_THRESHOLD = 1000; // $1k+
const MEGA_WHALE_THRESHOLD = 10000; // $10k+

// Insider detection thresholds
const INSIDER_THRESHOLDS = {
  freshWalletHours: 24,
  largeTradeMult: 3,
  nicheMarketVolume: 10000,
  rapidEntryMinutes: 30,
  rapidEntryCount: 3,
  repeatedEntries: 3,
  minTradeVolume: 500,
};

// Performance optimization constants
const BATCH_INTERVAL_MS = 50; // Flush trades every 50ms for near-instant realtime feel
const MAX_IMAGE_BATCH_SIZE = 20; // Max items per batch
const IMAGE_FETCH_DELAY_MS = 1000; // Delay before batching
const STATS_THROTTLE_MS = 500; // Recalculate stats every 500ms (faster updates)
const SIDEBAR_THROTTLE_MS = 1000; // Recalculate topTraders/marketVolumes every 1 second

export default function LiveTrades() {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [whaleTrades, setWhaleTrades] = useState<Trade[]>([]); // Dedicated whale buffer
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastUpdateAgo, setLastUpdateAgo] = useState<number>(0);
  const [tradesPerMinute, setTradesPerMinute] = useState(0);

  // Throttled trades for expensive calculations (stats, topTraders, marketVolumes)
  const [throttledTrades, setThrottledTrades] = useState<Trade[]>([]);
  const lastStatsUpdateRef = useRef<number>(0);
  const lastSidebarUpdateRef = useRef<number>(0);

  // Advanced filters
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");
  const [minVolume, setMinVolume] = useState(0);
  const [whalesOnly, setWhalesOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tokenFilter, setTokenFilter] = useState<"all" | "yes" | "no">("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [hideUpDown, setHideUpDown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Insider activity filter states
  const [insiderOnly, setInsiderOnly] = useState(false);
  const [enabledInsiderSignals, setEnabledInsiderSignals] = useState<Set<string>>(
    new Set(["fresh_wallet", "unusual_sizing", "repeated_entries", "rapid_clustering"]),
  );
  const [showInsiderSettings, setShowInsiderSettings] = useState(false);

  // Tracked wallets hook
  const { trackedWallets, getTrackedAddresses } = useTrackedWallets();
  const trackedAddresses = useMemo(() => getTrackedAddresses(), [getTrackedAddresses]);

  // Analysis modal state (for heatmap analyze)
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisContext, setAnalysisContext] = useState<MarketContext | null>(null);

  // Trade modal state (lifted from TradeDetailModal)
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeMarketData, setTradeMarketData] = useState<TradeableMarketData | null>(null);
  const [tradeDefaultSide, setTradeDefaultSide] = useState<"YES" | "NO">("YES");

  // Analysis modal for trade detail (lifted from TradeDetailModal)
  const [tradeAnalysisModalOpen, setTradeAnalysisModalOpen] = useState(false);
  const [tradeAnalysisContext, setTradeAnalysisContext] = useState<{
    trade: TradeAnalysisInfo;
    resolvedUrl: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pausedTradesRef = useRef<Trade[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsUrlRef = useRef<string | null>(null);
  const lastMessageTimeRef = useRef<number>(Date.now());
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hardReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tradeCounterRef = useRef<{ count: number; startTime: number }>({ count: 0, startTime: Date.now() });
  const imageCacheRef = useRef<Map<string, string>>(new Map()); // condition_id -> image URL
  const imagePreCachedRef = useRef<boolean>(false);

  // Wallet activity tracking for insider detection
  const walletActivityMapRef = useRef<
    Map<
      string,
      {
        firstSeen: number;
        trades: Trade[];
        totalVolume: number;
        avgTradeSize: number;
        marketCounts: Map<string, number>;
      }
    >
  >(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Batching refs for performance
  const tradeQueueRef = useRef<Trade[]>([]);
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to track loading/connected state for timeout callbacks (avoid stale closures)
  const loadingRef = useRef(loading);
  const connectedRef = useRef(connected);
  const isConnectingRef = useRef(false);
  const soundEnabledRef = useRef(soundEnabled);
  const pausedRef = useRef(paused);

  // Connection timeout constant (10 seconds)
  const CONNECTION_TIMEOUT_MS = 10000;

  // Sync refs with state
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1pbWlrcHN0dXd4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/",
    );
  }, []);

  // Throttle stats updates - update throttledTrades every STATS_THROTTLE_MS
  useEffect(() => {
    const now = Date.now();
    if (now - lastStatsUpdateRef.current >= STATS_THROTTLE_MS) {
      setThrottledTrades(trades);
      lastStatsUpdateRef.current = now;
    }
  }, [trades]);

  // Batch flush interval - flush queued trades every BATCH_INTERVAL_MS
  useEffect(() => {
    batchIntervalRef.current = setInterval(() => {
      if (tradeQueueRef.current.length > 0 && !pausedRef.current) {
        const batch = [...tradeQueueRef.current];
        tradeQueueRef.current = [];

        // Add batch index for stagger animation - each trade gets unique delay
        const timestampedBatch = batch.map((trade, i) => ({
          ...trade,
          _batchIndex: i,
          _batchTime: Date.now() + i * 20, // Stagger each trade by 20ms for smooth realtime feel
        }));

        setTrades((prev) => {
          const combined = [...timestampedBatch, ...prev];
          // Deduplicate
          const seen = new Set<string>();
          const deduped = combined.filter((t) => {
            const key = t.order_hash || `${t.tx_hash}-${t.timestamp}-${t.token_id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return deduped.slice(0, 200);
        });
      }
    }, BATCH_INTERVAL_MS);

    return () => {
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
      }
    };
  }, []);

  // Fetch image for a specific market by condition_id (on-demand, accurate)
  const fetchMarketImage = useCallback(async (conditionId: string, marketSlug: string): Promise<string | null> => {
    // Check cache first (by condition_id - most reliable)
    const cached = imageCacheRef.current.get(conditionId);
    if (cached) return cached;

    // Also check by slug as fallback
    const cachedBySlug = imageCacheRef.current.get(marketSlug);
    if (cachedBySlug) {
      // Also cache by condition_id for future lookups
      imageCacheRef.current.set(conditionId, cachedBySlug);
      return cachedBySlug;
    }

    try {
      // Fetch from get-market-previews with condition_id (most accurate)
      const { data, error } = await supabase.functions.invoke("get-market-previews", {
        body: { conditionIds: [conditionId] },
      });

      if (error || !data?.markets?.[0]?.image) {
        console.warn(`[LiveTrades] No image for condition_id ${conditionId}`);
        // Mark as checked so we don't keep retrying
        imageCacheRef.current.set(conditionId, "");
        return null;
      }

      const image = data.markets[0].image;

      // Cache by both condition_id and slug
      imageCacheRef.current.set(conditionId, image);
      if (marketSlug) {
        imageCacheRef.current.set(marketSlug, image);
      }

      return image;
    } catch (err) {
      console.error(`[LiveTrades] Failed to fetch image for ${conditionId}:`, err);
      // Mark as checked to avoid retrying
      imageCacheRef.current.set(conditionId, "");
      return null;
    }
  }, []);

  // Pre-cache images using polymarket-data (same as Markets page)
  const preCacheImages = useCallback(async () => {
    if (imagePreCachedRef.current) return;
    imagePreCachedRef.current = true;

    try {
      console.log("[LiveTrades] Pre-caching market images (same as Markets page)...");

      // Use same edge function as Markets page
      const { data, error } = await supabase.functions.invoke("polymarket-data", {
        body: {
          action: "getEvents",
          limit: 100,
          order: "volume24hr",
          ascending: false,
        },
      });

      if (error || !data?.events) {
        console.log("[LiveTrades] Pre-cache failed:", error);
        return;
      }

      let cachedCount = 0;
      for (const event of data.events) {
        // Cache event image by all its outcome condition_ids
        if (event.image) {
          for (const outcome of event.outcomes || []) {
            if (outcome.conditionId) {
              imageCacheRef.current.set(outcome.conditionId, event.image);
              cachedCount++;
            }
          }
        }
        // Also cache individual outcome images if available
        for (const outcome of event.outcomes || []) {
          if (outcome.image && outcome.conditionId) {
            imageCacheRef.current.set(outcome.conditionId, outcome.image);
          }
        }
      }

      console.log(`[LiveTrades] Pre-cached ${cachedCount} market images from polymarket-data`);
    } catch (err) {
      console.warn("[LiveTrades] Pre-cache error:", err);
    }
  }, []);

  // Separate refs for condition_ids and slugs
  const pendingConditionIdsRef = useRef<Set<string>>(new Set());
  const pendingSlugsRef = useRef<Set<string>>(new Set());
  const imageFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch images for condition_ids AND slugs in a single batch
  const fetchMarketImages = useCallback(async (conditionIds: string[], slugs: string[]) => {
    if (conditionIds.length === 0 && slugs.length === 0) return;

    try {
      console.log(`[LiveTrades] 🔍 Fetching images for:`, {
        conditionIds: conditionIds.slice(0, 3),
        slugs: slugs.slice(0, 3),
        totalConditionIds: conditionIds.length,
        totalSlugs: slugs.length,
      });

      // Call get-market-previews with separated arrays
      const { data, error } = await supabase.functions.invoke("get-market-previews", {
        body: {
          conditionIds: conditionIds.length > 0 ? conditionIds : undefined,
          eventSlugs: slugs.length > 0 ? slugs : undefined,
        },
      });

      if (error) {
        console.error("[LiveTrades] ❌ Fetch error:", error);
        return;
      }

      if (!data?.markets) {
        console.warn("[LiveTrades] ⚠️ No markets returned");
        return;
      }

      console.log(`[LiveTrades] ✅ Received ${data.markets.length} markets`);

      // Count markets with/without images
      const withImages = data.markets.filter((m: any) => m.image).length;
      const withoutImages = data.markets.filter((m: any) => !m.image).length;
      console.log(`[LiveTrades] 🖼️ ${withImages} with images, ${withoutImages} without`);

      let cached = 0;
      for (const market of data.markets) {
        if (market.image) {
          // Cache by ALL possible keys
          if (market.slug) {
            imageCacheRef.current.set(market.slug, market.image);
            cached++;
          }
          if (market.conditionId) {
            imageCacheRef.current.set(market.conditionId, market.image);
            cached++;
          }
          if (market.marketSlug) {
            imageCacheRef.current.set(market.marketSlug, market.image);
            cached++;
          }
          if (market.eventSlug) {
            imageCacheRef.current.set(market.eventSlug, market.image);
            cached++;
          }
        }
      }

      console.log(`[LiveTrades] 💾 Cached ${cached} image keys (total cache size: ${imageCacheRef.current.size})`);

      // Find condition_ids that didn't get images - try Gamma API fallback
      const missingConditionIds = conditionIds.filter(
        (id) => !data.markets.find((m: any) => m.conditionId === id && m.image),
      );

      if (missingConditionIds.length > 0) {
        console.log(`[LiveTrades] 🔄 Trying Gamma fallback for ${missingConditionIds.length} missing images`);

        // Try fetching directly from Gamma API for missing condition_ids (limit to 5)
        for (const conditionId of missingConditionIds.slice(0, 5)) {
          try {
            const response = await fetch(`https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`);
            if (response.ok) {
              const markets = await response.json();
              if (markets?.[0]) {
                const market = markets[0];
                const eventSlug = market.eventSlug || market.event_slug || market.groupSlug;

                // First check if market has an image directly
                if (market.image) {
                  imageCacheRef.current.set(conditionId, market.image);
                  console.log(`[LiveTrades] ✅ Fallback found market image for ${conditionId.slice(0, 10)}...`);
                  continue;
                }

                // Try to get event image if eventSlug exists
                if (eventSlug) {
                  const eventRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${eventSlug}`);
                  if (eventRes.ok) {
                    const events = await eventRes.json();
                    const image = events?.[0]?.image;
                    if (image) {
                      imageCacheRef.current.set(conditionId, image);
                      console.log(`[LiveTrades] ✅ Fallback found event image for ${conditionId.slice(0, 10)}...`);
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Ignore fallback errors silently
          }
        }
      }

      // Update existing trades with newly cached images
      setTrades((prev) =>
        prev.map((trade) => {
          if (!trade.image) {
            const cachedImage =
              imageCacheRef.current.get(trade.condition_id) || imageCacheRef.current.get(trade.market_slug);
            if (cachedImage) {
              return { ...trade, image: cachedImage };
            }
          }
          return trade;
        }),
      );

      // Also update whale trades with newly cached images
      setWhaleTrades((prev) =>
        prev.map((trade) => {
          if (!trade.image) {
            const cachedImage =
              imageCacheRef.current.get(trade.condition_id) || imageCacheRef.current.get(trade.market_slug);
            if (cachedImage) {
              return { ...trade, image: cachedImage };
            }
          }
          return trade;
        }),
      );
    } catch (err) {
      console.error("[LiveTrades] 💥 Batch fetch exception:", err);
    }
  }, []);

  // Queue a condition_id or slug for batched fetching
  const queueImageFetch = useCallback(
    (slug: string, conditionId?: string) => {
      let needsFetch = false;

      // Check if slug needs fetching
      if (slug && !imageCacheRef.current.has(slug) && !pendingSlugsRef.current.has(slug)) {
        pendingSlugsRef.current.add(slug);
        needsFetch = true;
      }

      // Check if conditionId needs fetching
      if (conditionId && !imageCacheRef.current.has(conditionId) && !pendingConditionIdsRef.current.has(conditionId)) {
        pendingConditionIdsRef.current.add(conditionId);
        needsFetch = true;
      }

      if (!needsFetch) return;

      // Clear existing timer
      if (imageFetchTimeoutRef.current) {
        clearTimeout(imageFetchTimeoutRef.current);
      }

      // Batch fetch after delay OR when queue is large
      const totalQueued = pendingConditionIdsRef.current.size + pendingSlugsRef.current.size;

      if (totalQueued >= MAX_IMAGE_BATCH_SIZE) {
        // Immediate fetch for large batches
        const cIds = Array.from(pendingConditionIdsRef.current).slice(0, MAX_IMAGE_BATCH_SIZE);
        const slugsArr = Array.from(pendingSlugsRef.current).slice(0, MAX_IMAGE_BATCH_SIZE);
        pendingConditionIdsRef.current.clear();
        pendingSlugsRef.current.clear();
        fetchMarketImages(cIds, slugsArr);
      } else {
        // Delayed batch
        imageFetchTimeoutRef.current = setTimeout(() => {
          const cIds = Array.from(pendingConditionIdsRef.current);
          const slugsArr = Array.from(pendingSlugsRef.current);
          pendingConditionIdsRef.current.clear();
          pendingSlugsRef.current.clear();
          if (cIds.length > 0 || slugsArr.length > 0) {
            fetchMarketImages(cIds, slugsArr);
          }
        }, IMAGE_FETCH_DELAY_MS);
      }
    },
    [fetchMarketImages],
  );

  // Update wallet activity for insider detection
  const updateWalletActivity = useCallback((trade: Trade) => {
    const wallet = trade.user;
    const volume = trade.price * (trade.shares_normalized || trade.shares);

    if (!walletActivityMapRef.current.has(wallet)) {
      walletActivityMapRef.current.set(wallet, {
        firstSeen: trade.timestamp,
        trades: [],
        totalVolume: 0,
        avgTradeSize: 0,
        marketCounts: new Map(),
      });
    }

    const activity = walletActivityMapRef.current.get(wallet)!;
    activity.trades.push(trade);
    activity.totalVolume += volume;
    activity.avgTradeSize = activity.totalVolume / activity.trades.length;

    const marketCount = activity.marketCounts.get(trade.market_slug) || 0;
    activity.marketCounts.set(trade.market_slug, marketCount + 1);
  }, []);

  // Detect insider signals for a trade
  const detectInsiderSignals = useCallback((trade: Trade): { signals: string[]; details: string[] } => {
    const signals: string[] = [];
    const details: string[] = [];
    const wallet = trade.user;
    const activity = walletActivityMapRef.current.get(wallet);

    if (!activity) return { signals: [], details: [] };

    const tradeVolume = trade.price * (trade.shares_normalized || trade.shares);
    const walletAgeHours = (trade.timestamp - activity.firstSeen) / 3600;

    if (walletAgeHours < INSIDER_THRESHOLDS.freshWalletHours && tradeVolume >= INSIDER_THRESHOLDS.minTradeVolume) {
      signals.push("fresh_wallet");
      details.push(`Wallet age: ${Math.round(walletAgeHours)}h`);
    }

    if (activity.trades.length > 1 && tradeVolume > activity.avgTradeSize * INSIDER_THRESHOLDS.largeTradeMult) {
      signals.push("unusual_sizing");
      details.push(`${Math.round(tradeVolume / activity.avgTradeSize)}x avg size`);
    }

    const marketEntries = activity.marketCounts.get(trade.market_slug) || 0;
    if (marketEntries >= INSIDER_THRESHOLDS.repeatedEntries) {
      signals.push("repeated_entries");
      details.push(`${marketEntries} entries in market`);
    }

    const recentTrades = activity.trades.filter(
      (t) => trade.timestamp - t.timestamp < INSIDER_THRESHOLDS.rapidEntryMinutes * 60,
    );
    if (recentTrades.length >= INSIDER_THRESHOLDS.rapidEntryCount) {
      signals.push("rapid_clustering");
      details.push(`${recentTrades.length} trades in ${INSIDER_THRESHOLDS.rapidEntryMinutes}min`);
    }

    return { signals, details };
  }, []);

  const forceReconnect = useCallback(() => {
    console.log("Force reconnecting...");
    if (wsRef.current) {
      wsRef.current.close(4000, "forced_reconnect");
      wsRef.current = null;
    }
  }, []);

  // Whale alert - clickable to view trade details
  const showWhaleAlert = useCallback((trade: Trade, volume: number) => {
    // Only play sound if explicitly enabled - use ref to avoid stale closure
    if (soundEnabledRef.current) {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } catch {
        // Silently fail
      }
    }

    toast.custom(
      (t) => (
        <div
          onClick={() => {
            setSelectedTrade(trade);
            toast.dismiss(t);
          }}
          className="cursor-pointer bg-card border border-border rounded-lg p-4 shadow-lg flex items-start gap-3 hover:bg-muted/50 transition-colors"
        >
          <span className="text-2xl">🐋</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{volume >= MEGA_WHALE_THRESHOLD ? "MEGA " : ""}Whale Alert!</p>
            <p className="text-sm text-muted-foreground truncate">
              ${volume.toFixed(0)} {trade.side} on {trade.title?.slice(0, 50)}...
            </p>
          </div>
        </div>
      ),
      {
        duration: 5000,
      },
    );
  }, []); // No dependencies - using ref for soundEnabled

  const connectWebSocket = useCallback(async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;
    isConnectingRef.current = true;

    // Clear any existing connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    try {
      if (!wsUrlRef.current) {
        setLoading(true);
        setError(null);

        // Set connection timeout - use refs to avoid stale closure
        connectionTimeoutRef.current = setTimeout(() => {
          if (loadingRef.current && !connectedRef.current) {
            console.log("Connection timeout reached");
            setLoading(false);
            setError("Connection timed out. Please try again.");
            isConnectingRef.current = false;
          }
        }, CONNECTION_TIMEOUT_MS);

        const { data, error } = await supabase.functions.invoke("dome-ws-url");

        if (error || !data?.wsUrl) {
          console.error("Failed to get WebSocket URL:", error);
          setError("Failed to connect to trade feed. Please try again.");
          setLoading(false);
          isConnectingRef.current = false;
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
          }
          return;
        }
        wsUrlRef.current = data.wsUrl;
      }

      const ws = new WebSocket(wsUrlRef.current);

      ws.onopen = () => {
        console.log("WebSocket connected to Dome");
        setConnected(true);
        setLoading(false);
        setError(null);
        isConnectingRef.current = false;

        // Clear connection timeout on successful connection
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        lastMessageTimeRef.current = Date.now();
        tradeCounterRef.current = { count: 0, startTime: Date.now() };

        ws.send(
          JSON.stringify({
            action: "subscribe",
            platform: "polymarket",
            version: 1,
            type: "orders",
            filters: {
              users: ["*"],
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        lastMessageTimeRef.current = Date.now();

        const data = JSON.parse(event.data);

        if (data.type === "ack") {
          console.log("Subscription confirmed:", data.subscription_id);
        }

        if (data.type === "event") {
          const rawTrade = data.data;

          tradeCounterRef.current.count++;

          // Primary lookup by condition_id (most accurate), fallback to slug
          const cachedImage =
            (rawTrade.condition_id && imageCacheRef.current.get(rawTrade.condition_id)) ||
            (rawTrade.market_slug && imageCacheRef.current.get(rawTrade.market_slug)) ||
            null;

          const newTrade: Trade = {
            ...rawTrade,
            image: cachedImage || null,
          };

          // Queue on-demand image fetch by slug and condition_id if not cached
          if (!newTrade.image) {
            queueImageFetch(newTrade.market_slug, newTrade.condition_id);
          }

          // Update wallet activity for insider detection
          updateWalletActivity(newTrade);

          const volume = newTrade.price * (newTrade.shares_normalized || newTrade.shares);
          if (volume >= WHALE_THRESHOLD) {
            showWhaleAlert(newTrade, volume);

            // Try to get cached image before adding to whale trades
            if (!newTrade.image) {
              const cachedImg =
                imageCacheRef.current.get(newTrade.condition_id) || imageCacheRef.current.get(newTrade.market_slug);
              if (cachedImg) {
                newTrade.image = cachedImg;
              }
            }

            // Accumulate whale trades in dedicated buffer (keep up to 2000)
            setWhaleTrades((prev) => {
              const exists = prev.some(
                (t) =>
                  (t.order_hash && t.order_hash === newTrade.order_hash) ||
                  (t.tx_hash === newTrade.tx_hash &&
                    t.timestamp === newTrade.timestamp &&
                    t.token_id === newTrade.token_id),
              );
              if (exists) return prev;
              return [newTrade, ...prev.slice(0, 1999)];
            });
          }

          // Use ref to avoid stale closure - check if paused
          if (pausedRef.current) {
            pausedTradesRef.current.unshift(newTrade);
            setQueuedCount(pausedTradesRef.current.length);
          } else {
            // Queue trade for batched processing instead of immediate state update
            tradeQueueRef.current.push(newTrade);
          }
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected, code:", event.code);
        setConnected(false);
        wsRef.current = null;
        isConnectingRef.current = false;

        // Only attempt reconnect if not a forced close
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 2000);
        }
      };

      wsRef.current = ws;
    } catch (err: unknown) {
      console.error("Error connecting to WebSocket:", err);
      setError("Failed to connect to trade feed. Please try again.");
      setLoading(false);
      isConnectingRef.current = false;
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    }
  }, [queueImageFetch, showWhaleAlert]);

  // Watchdog - check connection health
  useEffect(() => {
    watchdogIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = now - lastMessageTimeRef.current;

      setLastUpdateAgo(Math.floor(timeSinceLastMessage / 1000));

      const elapsed = (now - tradeCounterRef.current.startTime) / 60000;
      if (elapsed > 0) {
        setTradesPerMinute(Math.round(tradeCounterRef.current.count / elapsed));
      }

      // Only force reconnect if WebSocket is actually open but stale
      if (wsRef.current?.readyState === WebSocket.OPEN && timeSinceLastMessage > STALE_THRESHOLD_MS) {
        console.log(`Connection stale (${Math.floor(timeSinceLastMessage / 1000)}s), forcing reconnect...`);
        forceReconnect();
      }
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
      }
    };
  }, [forceReconnect]);

  // Hard reconnect every 5 minutes
  useEffect(() => {
    hardReconnectTimeoutRef.current = setInterval(() => {
      console.log("Periodic hard reconnect...");
      forceReconnect();
    }, HARD_RECONNECT_INTERVAL_MS);

    return () => {
      if (hardReconnectTimeoutRef.current) {
        clearInterval(hardReconnectTimeoutRef.current);
      }
    };
  }, [forceReconnect]);

  // Pre-cache images on mount (before WebSocket connects)
  useEffect(() => {
    preCacheImages();
  }, [preCacheImages]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      // Dismiss all whale alert toasts on unmount
      toast.dismiss();

      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      // Cleanup batch image fetch timer
      if (imageFetchTimeoutRef.current) {
        clearTimeout(imageFetchTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  const togglePause = useCallback(() => {
    if (paused) {
      setTrades((prev) => [...pausedTradesRef.current, ...prev].slice(0, 499));
      pausedTradesRef.current = [];
      setQueuedCount(0);
    }
    setPaused(!paused);
  }, [paused]);

  // Compute stats - use throttledTrades for performance (updates every 1s)
  const stats = useMemo(() => {
    let totalVolume = 0;
    let buyVolume = 0;
    let sellVolume = 0;
    let largestTrade = 0;

    throttledTrades.forEach((trade) => {
      const volume = trade.price * (trade.shares_normalized || trade.shares);
      totalVolume += volume;
      if (trade.side === "BUY") buyVolume += volume;
      else sellVolume += volume;
      if (volume > largestTrade) largestTrade = volume;
    });

    return {
      totalVolume,
      totalTrades: throttledTrades.length,
      avgTradeSize: throttledTrades.length > 0 ? totalVolume / throttledTrades.length : 0,
      largestTrade,
      buyVolume,
      sellVolume,
      whaleCount: whaleTrades.length,
    };
  }, [throttledTrades, whaleTrades.length]);

  // Compute top traders - use throttledTrades for performance (updates every 1s)
  const topTraders = useMemo(() => {
    const walletStats: Record<string, { volume: number; trades: number; markets: Set<string>; buys: number }> = {};

    throttledTrades.forEach((trade) => {
      const volume = trade.price * (trade.shares_normalized || trade.shares);
      if (!walletStats[trade.user]) {
        walletStats[trade.user] = { volume: 0, trades: 0, markets: new Set(), buys: 0 };
      }
      walletStats[trade.user].volume += volume;
      walletStats[trade.user].trades++;
      walletStats[trade.user].markets.add(trade.market_slug);
      if (trade.side === "BUY") walletStats[trade.user].buys++;
    });

    return Object.entries(walletStats)
      .map(([wallet, s]) => ({
        wallet,
        volume: s.volume,
        trades: s.trades,
        markets: s.markets.size,
        buyPercent: s.trades > 0 ? (s.buys / s.trades) * 100 : 0,
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }, [throttledTrades]);

  // Compute market heatmap - use throttledTrades for performance (updates every 1s)
  const marketVolumes = useMemo(() => {
    const volumes: Record<string, { volume: number; trades: number; title: string; image?: string }> = {};

    throttledTrades.forEach((trade) => {
      const volume = trade.price * (trade.shares_normalized || trade.shares);
      const slug = trade.market_slug;
      if (!volumes[slug]) {
        volumes[slug] = { volume: 0, trades: 0, title: trade.title, image: trade.image };
      }
      volumes[slug].volume += volume;
      volumes[slug].trades++;
      if (trade.image && !volumes[slug].image) {
        volumes[slug].image = trade.image;
      }
    });

    return Object.entries(volumes)
      .map(([slug, data]) => ({ slug, ...data }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }, [throttledTrades]);

  // Available markets for filter dropdown
  const availableMarkets = useMemo(() => {
    return [...new Set(trades.map((t) => t.market_slug))];
  }, [trades]);

  // Apply all filters - use whale buffer when whalesOnly is active
  const filteredTrades = useMemo(() => {
    // Use dedicated whale buffer when whales filter is active
    const sourceArray = whalesOnly ? whaleTrades : trades;

    return sourceArray.filter((trade) => {
      const volume = trade.price * (trade.shares_normalized || trade.shares);

      // Side filter
      if (filter === "buy" && trade.side !== "BUY") return false;
      if (filter === "sell" && trade.side !== "SELL") return false;

      // Volume filter (skip whale threshold check when using whale buffer)
      if (volume < minVolume) return false;

      // Token filter
      if (tokenFilter === "yes" && trade.token_label?.toLowerCase() !== "yes") return false;
      if (tokenFilter === "no" && trade.token_label?.toLowerCase() !== "no") return false;

      // Market filter
      if (marketFilter !== "all" && trade.market_slug !== marketFilter) return false;

      // Hide Up/Down markets filter
      if (hideUpDown && trade.title) {
        const titleLower = trade.title.toLowerCase();
        if (
          titleLower.includes(" up ") ||
          titleLower.includes(" down ") ||
          titleLower.startsWith("up ") ||
          titleLower.startsWith("down ") ||
          titleLower.endsWith(" up") ||
          titleLower.endsWith(" down") ||
          titleLower.includes(" up?") ||
          titleLower.includes(" down?")
        ) {
          return false;
        }
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !trade.title?.toLowerCase().includes(term) &&
          !trade.user?.toLowerCase().includes(term) &&
          !trade.market_slug?.toLowerCase().includes(term)
        ) {
          return false;
        }
      }

      // Tracked wallets filter - if enabled, ONLY show tracked wallet trades
      if (trackedOnly) {
        // If no tracked wallets, show nothing (user needs to track wallets first)
        if (trackedAddresses.size === 0) return false;
        if (!trackedAddresses.has(trade.user.toLowerCase())) {
          return false;
        }
      }

      // Insider activity filter - at the end of filter chain
      if (insiderOnly) {
        const { signals } = detectInsiderSignals(trade);
        const matchingSignals = signals.filter((s) => enabledInsiderSignals.has(s));
        if (matchingSignals.length === 0) return false;
      }

      return true;
    });
  }, [
    trades,
    whaleTrades,
    filter,
    minVolume,
    whalesOnly,
    tokenFilter,
    marketFilter,
    searchTerm,
    hideUpDown,
    trackedOnly,
    trackedAddresses,
    insiderOnly,
    enabledInsiderSignals,
    detectInsiderSignals,
  ]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const formatVolume = (price: number, shares: number) => {
    const volume = (price ?? 0) * (shares ?? 0);
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}k`;
    return `$${volume.toFixed(2)}`;
  };

  const getWhaleLevel = (price: number, shares: number) => {
    const volume = price * shares;
    if (volume >= MEGA_WHALE_THRESHOLD) return "mega";
    if (volume >= WHALE_THRESHOLD) return "whale";
    return null;
  };

  const exportToCSV = useCallback(() => {
    const csv = [
      ["Timestamp", "Market", "Wallet", "Side", "Token", "Price", "Shares", "Volume"],
      ...filteredTrades.map((t) => [
        new Date(t.timestamp * 1000).toISOString(),
        t.title,
        t.user,
        t.side,
        t.token_label,
        t.price,
        t.shares_normalized || t.shares,
        (t.price * (t.shares_normalized || t.shares)).toFixed(2),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poly-trades-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredTrades.length} trades`);
  }, [filteredTrades]);

  const isStale = lastUpdateAgo > 10;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 md:pb-0">
      <TopBar />

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-secondary/15 rounded-full blur-[150px]" />
      </div>

      <main className="flex-1 relative z-10 container mx-auto px-4 py-8">
        {/* Dome Attribution */}
        <div className="mb-6 flex items-center justify-center gap-4">
          <a
            href="https://domeapi.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-background/80 to-muted/30 border border-border/50 hover:border-primary/40 transition-all group backdrop-blur-sm"
          >
            <span className="text-sm font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              dome
            </span>
            <span className="text-xs text-muted-foreground">(domeapi.io)</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </a>

          {/* How It Works Button */}
          <Button
            onClick={() => setShowHowItWorks(true)}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="w-4 h-4" />
            How It Works
          </Button>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-1 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Live Trade Feed
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1 flex-wrap">
              Real-time Polymarket activity
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Connection status */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
                isStale
                  ? "bg-warning/10 border-warning/30 text-warning"
                  : connected
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isStale ? "bg-warning" : connected ? "bg-success animate-pulse" : "bg-destructive"
                }`}
              />
              <span className="font-medium">{isStale ? "Stale" : connected ? "Live" : "Offline"}</span>
              {connected && <span className="text-xs opacity-70">{lastUpdateAgo}s ago</span>}
            </div>

            {/* Trades per minute */}
            {tradesPerMinute > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
                <Activity className="w-3 h-3" />
                <span>{tradesPerMinute}/min</span>
              </div>
            )}

            {/* Sound toggle */}
            <Button
              onClick={() => setSoundEnabled(!soundEnabled)}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={soundEnabled ? "Disable whale alerts" : "Enable whale alerts"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>

            {/* Export */}
            <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-1">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            <Button onClick={togglePause} variant={paused ? "default" : "secondary"} className="gap-2 relative">
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {paused ? "Resume" : "Pause"}
              {paused && queuedCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {queuedCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Dashboard */}
        <TradeStats {...stats} />

        {/* Filters */}
        <TradeFilters
          filter={filter}
          setFilter={setFilter}
          minVolume={minVolume}
          setMinVolume={setMinVolume}
          whalesOnly={whalesOnly}
          setWhalesOnly={setWhalesOnly}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          tokenFilter={tokenFilter}
          setTokenFilter={setTokenFilter}
          marketFilter={marketFilter}
          setMarketFilter={setMarketFilter}
          availableMarkets={availableMarkets}
          totalTrades={filteredTrades.length}
          hideUpDown={hideUpDown}
          setHideUpDown={setHideUpDown}
          trackedOnly={trackedOnly}
          setTrackedOnly={setTrackedOnly}
          hasTrackedWallets={trackedWallets.length > 0}
          insiderOnly={insiderOnly}
          setInsiderOnly={setInsiderOnly}
          enabledInsiderSignals={enabledInsiderSignals}
          setEnabledInsiderSignals={setEnabledInsiderSignals}
          showInsiderSettings={showInsiderSettings}
          setShowInsiderSettings={setShowInsiderSettings}
        />

        {/* Banners */}
        <AnimatePresence>
          {paused && queuedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-primary">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{queuedCount} new trades waiting</span>
              </div>
              <Button size="sm" onClick={togglePause} className="gap-1">
                <Play className="w-3 h-3" />
                Resume
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isStale && connected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-warning">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Connection may be stale - auto-reconnecting...</span>
              </div>
              <Button size="sm" variant="outline" onClick={forceReconnect} className="gap-1">
                <RefreshCw className="w-3 h-3" />
                Reconnect Now
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Trades Feed */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-border overflow-hidden bg-card/50 backdrop-blur-sm">
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5">Market</div>
                <div className="col-span-2">Side</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Volume</div>
                <div className="col-span-1 text-right">Time</div>
              </div>

              {/* Trades List */}
              <div className="divide-y divide-border/50 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto min-h-[200px]">
                {filteredTrades.map((trade, index) => {
                  const tradeId = trade.order_hash || `${trade.tx_hash}-${trade.timestamp}-${trade.token_id}`;
                  const whaleLevel = getWhaleLevel(trade.price, trade.shares_normalized || trade.shares);
                  // CSS stagger animation for smooth entry - only for recent trades
                  const isRecentBatch = trade._batchTime && Date.now() - trade._batchTime < 500;
                  const staggerDelay = isRecentBatch ? (trade._batchIndex || 0) * 30 : 0;
                  const { signals, details } = detectInsiderSignals(trade);
                  const matchingSignals = signals.filter((s) => enabledInsiderSignals.has(s));

                  return (
                    <div
                      key={tradeId}
                      onClick={() => setSelectedTrade(trade)}
                      className={`group grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer ${
                        isRecentBatch ? "animate-fade-in" : ""
                      } ${
                        whaleLevel === "mega"
                          ? "bg-warning/10 shadow-[0_0_20px_rgba(234,179,8,0.2)]" // Static glow instead of animate-pulse
                          : whaleLevel === "whale"
                            ? "bg-warning/5"
                            : ""
                      }`}
                      style={isRecentBatch ? { animationDelay: `${staggerDelay}ms` } : undefined}
                    >
                      {/* Market Info */}
                      <div className="sm:col-span-5 flex items-center gap-3 min-w-0">
                        {trade.image ? (
                          <img
                            src={trade.image}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                            onError={(e) => {
                              // Hide broken/wrong images and show fallback
                              e.currentTarget.style.display = "none";
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg bg-muted items-center justify-center shrink-0",
                            trade.image ? "hidden" : "flex",
                          )}
                        >
                          <Activity className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-foreground font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {trade.title}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {trade.user.slice(0, 6)}...{trade.user.slice(-4)}
                          </div>
                        </div>
                        {whaleLevel && (
                          <span
                            className={`hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              whaleLevel === "mega"
                                ? "bg-destructive/20 text-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]" // Static glow
                                : "bg-warning/20 text-warning"
                            }`}
                          >
                            {whaleLevel === "mega" ? "🔥 MEGA" : "🐋 WHALE"}
                          </span>
                        )}
                        {/* Insider signal badges - clickable to show details */}
                        {matchingSignals.length > 0 && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toast.custom(
                                  (t) => (
                                    <div className="bg-card border border-border rounded-lg p-4 shadow-lg max-w-xs">
                                      <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                        <p className="font-semibold text-foreground">Insider Signals Detected</p>
                                      </div>
                                      <div className="space-y-2">
                                        {details.map((detail, i) => (
                                          <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1 flex-shrink-0" />
                                            <span>{detail}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-3 pt-3 border-t border-border/50">
                                        <p className="text-xs text-muted-foreground">
                                          Signals:{" "}
                                          {matchingSignals
                                            .map((s) => s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()))
                                            .join(", ")}
                                        </p>
                                      </div>
                                    </div>
                                  ),
                                  {
                                    duration: 5000,
                                  },
                                );
                              }}
                              className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
                              title="Click to view insider signal details"
                            >
                              🚨 {matchingSignals.length} SIGNAL{matchingSignals.length > 1 ? "S" : ""}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Side */}
                      <div className="sm:col-span-2 flex items-center">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                            trade.side === "BUY" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                          }`}
                        >
                          {trade.side === "BUY" ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {trade.side} {trade.token_label}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="sm:col-span-2 flex items-center sm:justify-end">
                        <span className="text-foreground font-mono font-semibold">
                          ${(trade.price ?? 0).toFixed(3)}
                        </span>
                      </div>

                      {/* Volume */}
                      <div className="sm:col-span-2 flex items-center sm:justify-end">
                        <span
                          className={`font-mono font-bold ${
                            whaleLevel === "mega"
                              ? "text-destructive"
                              : whaleLevel === "whale"
                                ? "text-warning"
                                : "text-primary"
                          }`}
                        >
                          {formatVolume(trade.price, trade.shares_normalized || trade.shares)}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="sm:col-span-1 flex items-center sm:justify-end">
                        <span className="text-xs text-muted-foreground">{formatTime(trade.timestamp)}</span>
                      </div>

                      {/* Mobile: Show whale badge */}
                      <div className="sm:hidden flex items-center justify-between">
                        {whaleLevel && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              whaleLevel === "mega"
                                ? "bg-destructive/20 text-destructive"
                                : "bg-warning/20 text-warning"
                            }`}
                          >
                            {whaleLevel === "mega" ? "🔥 MEGA" : "🐋 WHALE"}
                          </span>
                        )}
                        {matchingSignals.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.custom(
                                (t) => (
                                  <div className="bg-card border border-border rounded-lg p-4 shadow-lg max-w-xs">
                                    <div className="flex items-center gap-2 mb-2">
                                      <AlertTriangle className="w-4 h-4 text-red-400" />
                                      <p className="font-semibold text-foreground">Insider Signals Detected</p>
                                    </div>
                                    <div className="space-y-2">
                                      {details.map((detail, i) => (
                                        <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1 flex-shrink-0" />
                                          <span>{detail}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-border/50">
                                      <p className="text-xs text-muted-foreground">
                                        Signals:{" "}
                                        {matchingSignals
                                          .map((s) => s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()))
                                          .join(", ")}
                                      </p>
                                    </div>
                                  </div>
                                ),
                                {
                                  duration: 5000,
                                },
                              );
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
                            title="Click to view insider signal details"
                          >
                            🚨 {matchingSignals.length} SIGNAL{matchingSignals.length > 1 ? "S" : ""}
                          </button>
                        )}
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Empty State */}
            {filteredTrades.length === 0 && !loading && (
              <div className="text-center py-20">
                <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
                <p className="text-muted-foreground text-lg">
                  {trades.length > 0 ? "No trades match your filters" : "Waiting for trades..."}
                </p>
                <p className="text-muted-foreground/60 text-sm mt-2">
                  {connected ? "Connected to live feed" : "Reconnecting..."}
                </p>
                {!connected && (
                  <Button onClick={connectWebSocket} variant="outline" className="mt-4 gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Reconnect
                  </Button>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading && !error && (
              <div className="text-center py-20">
                <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground">Connecting to live feed...</p>
                <p className="text-muted-foreground/60 text-xs mt-2">This may take a few seconds</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="text-center py-20">
                <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                <p className="text-destructive font-medium">{error}</p>
                <Button
                  onClick={() => {
                    wsUrlRef.current = null;
                    setError(null);
                    connectWebSocket();
                  }}
                  variant="outline"
                  className="mt-4 gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar - Single render, CSS controls visibility for desktop/mobile */}
          <div className="hidden lg:block space-y-4">
            <TopTradersSidebar
              traders={topTraders}
              onWalletClick={(wallet) => {
                const traderTrade = trades.find((t) => t.user === wallet);
                if (traderTrade) {
                  setSelectedTrade(traderTrade);
                }
              }}
            />
            <MarketHeatmap
              markets={marketVolumes}
              onMarketClick={(slug) => setMarketFilter(slug === marketFilter ? "all" : slug)}
              onAnalyze={async (market) => {
                let resolvedUrl = `https://polymarket.com/event/${market.slug}`;
                try {
                  const { data } = await supabase.functions.invoke("resolve-market-url", {
                    body: { marketSlug: market.slug },
                  });
                  if (data?.fullUrl) {
                    resolvedUrl = data.fullUrl;
                  }
                } catch (err) {
                  console.error("Error resolving market URL:", err);
                }

                setAnalysisContext({
                  eventTitle: market.title || market.slug.replace(/-/g, " "),
                  outcomeQuestion: market.title || market.slug.replace(/-/g, " "),
                  currentOdds: 0.5,
                  volume: market.volume,
                  url: resolvedUrl,
                  slug: market.slug,
                  eventSlug: market.slug,
                  image: market.image,
                });
                setAnalysisModalOpen(true);
              }}
              selectedMarket={marketFilter !== "all" ? marketFilter : undefined}
            />
          </div>
        </div>

        {/* Mobile Sidebars - Shown below trade feed on mobile only */}
        <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <TopTradersSidebar
            traders={topTraders}
            onWalletClick={(wallet) => {
              const traderTrade = trades.find((t) => t.user === wallet);
              if (traderTrade) {
                setSelectedTrade(traderTrade);
              }
            }}
          />
          <MarketHeatmap
            markets={marketVolumes}
            onMarketClick={(slug) => setMarketFilter(slug === marketFilter ? "all" : slug)}
            onAnalyze={async (market) => {
              let resolvedUrl = `https://polymarket.com/event/${market.slug}`;
              try {
                const { data } = await supabase.functions.invoke("resolve-market-url", {
                  body: { marketSlug: market.slug },
                });
                if (data?.fullUrl) {
                  resolvedUrl = data.fullUrl;
                }
              } catch (err) {
                console.error("Error resolving market URL:", err);
              }

              setAnalysisContext({
                eventTitle: market.title || market.slug.replace(/-/g, " "),
                outcomeQuestion: market.title || market.slug.replace(/-/g, " "),
                currentOdds: 0.5,
                volume: market.volume,
                url: resolvedUrl,
                slug: market.slug,
                eventSlug: market.slug,
                image: market.image,
              });
              setAnalysisModalOpen(true);
            }}
            selectedMarket={marketFilter !== "all" ? marketFilter : undefined}
          />
        </div>
      </main>

      <Footer />

      <AnimatePresence>
        {selectedTrade && (
          <TradeDetailModal
            trade={selectedTrade}
            onClose={() => setSelectedTrade(null)}
            onTrade={async (marketUrl, trade, side) => {
              // Open modal immediately with loading state
              // Use 0.5 as placeholder - we'll get the REAL price from the API
              setTradeMarketData({
                title: trade.title,
                currentPrice: 0.5, // Placeholder - will be replaced with actual market price
                url: marketUrl,
                isLoading: true,
              });
              setTradeDefaultSide(side);
              setTradeModalOpen(true);

              // Fetch full data in background - this has the CORRECT current market price
              const res = await fetchTradeableMarketData(marketUrl);
              if (res.ok === false) {
                setTradeModalOpen(false);
                if (res.reason === "needs_market_selection") {
                  toast.error("This event has multiple markets", {
                    description: "Open Polymarket to select a specific outcome",
                    action: {
                      label: "Open on Polymarket",
                      onClick: () => window.open(marketUrl, "_blank"),
                    },
                  });
                } else {
                  toast.error(res.message || "Failed to load market data");
                }
                return;
              }
              // Use the fetched data which has the correct currentPrice from the market
              setTradeMarketData(res.data);
            }}
            onAnalyze={(trade, resolvedUrl) => {
              setTradeAnalysisContext({
                trade: {
                  title: trade.title,
                  price: trade.price,
                  shares_normalized: trade.shares_normalized,
                  shares: trade.shares,
                  market_slug: trade.market_slug,
                  image: trade.image,
                },
                resolvedUrl,
              });
              setTradeAnalysisModalOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Trade Modal (lifted from TradeDetailModal) */}
      {tradeMarketData && (
        <MarketTradeModal
          open={tradeModalOpen}
          onOpenChange={setTradeModalOpen}
          defaultSide={tradeDefaultSide}
          marketData={tradeMarketData}
        />
      )}

      {/* Analysis Modal for Trade Detail (lifted) */}
      <AnalysisSelectionModal
        open={tradeAnalysisModalOpen}
        onOpenChange={setTradeAnalysisModalOpen}
        marketContext={
          tradeAnalysisContext
            ? {
                eventTitle: tradeAnalysisContext.trade.title,
                outcomeQuestion: tradeAnalysisContext.trade.title,
                currentOdds: tradeAnalysisContext.trade.price,
                volume:
                  tradeAnalysisContext.trade.price *
                  (tradeAnalysisContext.trade.shares_normalized || tradeAnalysisContext.trade.shares || 0),
                url: tradeAnalysisContext.resolvedUrl,
                slug: tradeAnalysisContext.trade.market_slug,
                eventSlug: tradeAnalysisContext.trade.market_slug,
                image: tradeAnalysisContext.trade.image,
              }
            : null
        }
        onSelect={(type) => {
          if (!tradeAnalysisContext) return;
          setTradeAnalysisModalOpen(false);
          const { trade, resolvedUrl } = tradeAnalysisContext;
          navigate("/chat", {
            state: {
              autoAnalyze: true,
              deepResearch: type === "deep",
              marketContext: {
                eventTitle: trade.title,
                outcomeQuestion: trade.title,
                currentOdds: trade.price,
                volume: trade.price * (trade.shares_normalized || trade.shares || 0),
                url: resolvedUrl,
                slug: trade.market_slug,
                eventSlug: trade.market_slug,
                image: trade.image,
              },
            },
          });
        }}
      />

      {/* Analysis Modal for Heatmap */}
      <AnalysisSelectionModal
        open={analysisModalOpen}
        onOpenChange={setAnalysisModalOpen}
        marketContext={analysisContext}
        onSelect={(type) => {
          if (!analysisContext) return;
          setAnalysisModalOpen(false);
          navigate("/chat", {
            state: {
              autoAnalyze: true,
              deepResearch: type === "deep",
              marketContext: analysisContext,
            },
          });
        }}
      />

      {/* Tour for first-time visitors */}
      <LiveTradesTour />

      {/* How It Works Modal */}
      <LiveTradesHowItWorks open={showHowItWorks} onOpenChange={setShowHowItWorks} />
    </div>
  );
}
