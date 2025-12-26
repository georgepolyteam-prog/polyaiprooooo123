import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { 
  RefreshCw, ExternalLink, Wallet, ArrowUpRight, ArrowDownRight, 
  Clock, Filter, Zap, TrendingUp, Activity, BarChart3, Sparkles,
  Package, ShoppingCart, XCircle, TrendingDown, DollarSign, Percent,
  AlertCircle, Loader2, Gift, Copy, CheckCircle2, Shield
} from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectWallet } from "@/components/ConnectWallet";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { CyberLoader } from "@/components/dashboard/CyberLoader";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { SellPositionModal } from "@/components/SellPositionModal";
import { MarketTradeModal } from "@/components/MarketTradeModal";
import { AnalysisSelectionModal } from "@/components/AnalysisSelectionModal";
import { ClaimWinningsCard, ClaimableWinningsSummary } from "@/components/ClaimWinningsCard";
import { useDomeRouter } from "@/hooks/useDomeRouter";
import { fetchTradeableMarketData } from "@/lib/market-trade-data";
import { ClaimablePosition } from "@/hooks/useClaimWinnings";

interface Position {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  outcome: string;
  title: string;
  eventSlug: string;
  eventTitle: string;
  redeemable: boolean;
  mergeable: boolean;
}

interface OpenOrder {
  id: string;
  status: string;
  market: string;
  asset_id: string;
  side: string;
  original_size: string;
  size_matched: string;
  price: string;
  outcome: string;
  created_at: number | string;
  expiration: number | string;
  owner: string;
}

interface PositionStats {
  totalValue: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  positionCount: number;
  openOrderCount: number;
}

interface Trade {
  marketSlug: string;
  marketTitle: string;
  side: string;
  volume: number;
  price: number;
  shares: number;
  timestamp: number;
}

interface TopMarket {
  slug: string;
  title: string;
  volume: number;
}

interface WalletStats {
  volume: number;
  trades: number;
  markets: number;
  buys: number;
  sells: number;
  buyRatio: number;
  timeframe: string;
}

type TimeFilter = "24h" | "7d" | "30d" | "all";

const getSideColor = (side: string) => {
  const s = side?.toUpperCase();
  return s === "BUY" || s === "YES"
    ? "from-emerald-500/30 to-emerald-400/10 text-emerald-400 border-emerald-500/50"
    : "from-rose-500/30 to-rose-400/10 text-rose-400 border-rose-500/50";
};

const formatTime = (timestamp: number) => {
  try {
    if (!timestamp || isNaN(timestamp)) return "Unknown";
    const date = new Date(timestamp * 1000);
    return format(date, "MMM d, HH:mm");
  } catch {
    return "Unknown";
  }
};

const getPolymarketUrl = (marketSlug?: string) => {
  if (!marketSlug) return "https://polymarket.com";
  return `https://polymarket.com/event/${marketSlug}`;
};

export default function MyTrades() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const { placeOrder, isPlacingOrder, credentials } = useDomeRouter();
  
  // With direct EOA, we always query using the EOA address
  const queryAddress = address;
  
  const [copiedAddress, setCopiedAddress] = useState(false);
  
  // Positions tab state
  const [positions, setPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [positionStats, setPositionStats] = useState<PositionStats | null>(null);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [hasTriedFetchPositions, setHasTriedFetchPositions] = useState(false);
  
  // History tab state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [topMarkets, setTopMarkets] = useState<TopMarket[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasTriedFetchHistory, setHasTriedFetchHistory] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30d");

  // Modal state
  const [sellModalPosition, setSellModalPosition] = useState<Position | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedMarketForTrade, setSelectedMarketForTrade] = useState<any>(null);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisContext, setAnalysisContext] = useState<any>(null);

  const [activeTab, setActiveTab] = useState("positions");

  const fetchPositions = useCallback(async () => {
    if (!isConnected || !queryAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsLoadingPositions(true);
    setHasTriedFetchPositions(true);

    try {
      // Build URL with the correct address (Safe or EOA)
      let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-positions?address=${queryAddress}`;
      
      // Pass user's API credentials so the edge function can fetch their orders
      if (credentials) {
        url += `&apiKey=${encodeURIComponent(credentials.apiKey)}&secret=${encodeURIComponent(credentials.apiSecret)}&passphrase=${encodeURIComponent(credentials.apiPassphrase)}`;
      }

      console.log('[MyTrades] Fetching positions for:', queryAddress);

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        console.error("[MyTrades] API error:", result.error);
        toast.error(result.error);
        return;
      }

      setPositions(result.positions || []);
      setPositionStats(result.stats || null);
      
      const posCount = result.positions?.length || 0;
      if (posCount === 0) {
        toast.info("No positions found");
      } else {
        toast.success(`Loaded ${posCount} positions`);
      }
    } catch (err) {
      console.error("[MyTrades] Error:", err);
      toast.error("Failed to fetch positions");
    } finally {
      setIsLoadingPositions(false);
    }
  }, [isConnected, queryAddress, credentials]);

  const fetchHistory = useCallback(async () => {
    if (!isConnected || !queryAddress) return;

    setIsLoadingHistory(true);
    setHasTriedFetchHistory(true);

    try {
      console.log('[MyTrades] Fetching history for:', queryAddress);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-profile?address=${queryAddress}&timeframe=${timeFilter}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        console.error("[MyTrades] API error:", result.error);
        return;
      }

      setStats(result.stats || null);
      setTrades(result.recentTrades || []);
      setTopMarkets(result.topMarkets || []);
    } catch (err) {
      console.error("[MyTrades] Error:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isConnected, queryAddress, timeFilter]);

  const refreshOpenOrders = useCallback(async () => {
    if (!isConnected || !address) return;

    setIsLoadingOrders(true);
    try {
      // Open orders fetching requires the CLOB client which is now internal to useDomeRouter
      // For now, we'll rely on the positions endpoint which may include order data
      setOpenOrders([]);
    } catch (err) {
      console.error("[MyTrades] Open orders error:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [address, isConnected]);

  // Auto-fetch when wallet is connected
  useEffect(() => {
    if (isConnected && address && !hasTriedFetchPositions) {
      fetchPositions();
    }
  }, [isConnected, address, hasTriedFetchPositions, fetchPositions]);

  // Poll open orders every 10s
  useEffect(() => {
    if (!isConnected || !address) return;

    refreshOpenOrders();
    const id = window.setInterval(() => {
      refreshOpenOrders();
    }, 10_000);

    return () => window.clearInterval(id);
  }, [address, isConnected, refreshOpenOrders]);

  // Fetch history when switching to history tab
  useEffect(() => {
    if (activeTab === "history" && !hasTriedFetchHistory && isConnected && address) {
      fetchHistory();
    }
  }, [activeTab, hasTriedFetchHistory, isConnected, address, fetchHistory]);

  // Refetch history when filter changes
  useEffect(() => {
    if (hasTriedFetchHistory && isConnected && address && activeTab === "history") {
      fetchHistory();
    }
  }, [timeFilter]);

  const handleCancelOrder = async (orderId: string) => {
    setCancellingOrderId(orderId);

    try {
      // Order cancellation requires CLOB client - show message to user
      toast.error("Order cancellation not yet available in new trading system");
    } catch (err) {
      console.error("Cancel order error:", err);
      toast.error("Failed to cancel order");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleSellPosition = async (shares: number, price: number, isMarketOrder?: boolean) => {
    if (!sellModalPosition || !address) return;
    
    try {
      // For MARKET SELL: amount = shares (SDK will find best price)
      // For LIMIT SELL: amount = USDC value (price × shares)
      const amount = isMarketOrder ? shares : shares * price;
      
      const result = await placeOrder({
        tokenId: sellModalPosition.asset,
        side: "SELL",
        amount,
        price: price,
        isMarketOrder: isMarketOrder,
      });

      if (result?.success) {
        const statusMsg = result.status === 'matched' || result.status === 'filled'
          ? "Sell order filled!"
          : isMarketOrder 
            ? "Market sell submitted!"
            : "Limit sell order placed!";
        toast.success(statusMsg);
        // Refresh positions after successful order
        setTimeout(() => fetchPositions(), 2000);
      } else {
        toast.error(result?.error || "Failed to place sell order");
      }
    } catch (err) {
      console.error("Sell error:", err);
      toast.error("Failed to place sell order");
      throw err;
    }
  };

  const handleAnalyzeMarket = (market: TopMarket) => {
    setAnalysisContext({
      eventTitle: market.title,
      outcomeQuestion: market.title,
      currentOdds: 0.5,
      volume: market.volume,
      url: `https://polymarket.com/event/${market.slug}`,
      slug: market.slug,
      eventSlug: market.slug,
    });
    setAnalysisModalOpen(true);
  };

  const handleTradeMarket = useCallback(async (market: TopMarket) => {
    const res = await fetchTradeableMarketData(`https://polymarket.com/event/${market.slug}`);

    if (res.ok === false) {
      toast.error(res.message);
      return;
    }

    // Clear previous state first, then set new state
    setSelectedMarketForTrade(null);
    // Use setTimeout to ensure state is cleared before setting new value
    setTimeout(() => {
      setSelectedMarketForTrade(res.data);
      setTradeModalOpen(true);
    }, 0);
  }, []);

  const handleAnalysisSelect = (type: 'quick' | 'deep') => {
    setAnalysisModalOpen(false);
    navigate('/chat', {
      state: {
        autoAnalyze: true,
        deepResearch: type === 'deep',
        marketContext: analysisContext,
      }
    });
  };

  // Handle trading from a position
  const handleTradeFromPosition = useCallback(async (pos: Position) => {
    const url = getPolymarketUrl(pos.eventSlug);
    const res = await fetchTradeableMarketData(url);

    if (res.ok === false) {
      toast.error(res.message);
      return;
    }

    setSelectedMarketForTrade(null);
    setTimeout(() => {
      setSelectedMarketForTrade(res.data);
      setTradeModalOpen(true);
    }, 0);
  }, []);

  const maxVolume = topMarkets.length > 0 ? Math.max(...topMarkets.map(m => m.volume)) : 1;

  // Compute claimable positions (redeemable = true means market is resolved and user has winning shares)
  const claimablePositions: ClaimablePosition[] = useMemo(() => {
    return positions
      .filter(pos => pos.redeemable && pos.size > 0)
      .map(pos => ({
        conditionId: pos.conditionId,
        title: pos.title || pos.eventTitle,
        eventSlug: pos.eventSlug,
        outcome: (pos.outcome === 'Yes' || pos.outcome === 'YES' ? 'YES' : 'NO') as 'YES' | 'NO',
        winningShares: pos.size,
        claimableUsdc: pos.size, // 1 winning share = 1 USDC
        yesTokenId: pos.outcome === 'Yes' || pos.outcome === 'YES' ? pos.asset : undefined,
        noTokenId: pos.outcome === 'No' || pos.outcome === 'NO' ? pos.asset : undefined,
      }));
  }, [positions]);

  const totalClaimable = claimablePositions.reduce((sum, p) => sum + p.claimableUsdc, 0);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 cyber-grid opacity-30" />
        <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        
        <TopBar />
        <main className="relative max-w-7xl mx-auto px-4 py-12">
          <GlassCard cyber glow className="p-12">
            <div className="flex flex-col items-center justify-center gap-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center animate-pulse">
                  <Wallet className="w-12 h-12 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-secondary opacity-50 blur-xl animate-pulse" />
                <div className="absolute inset-[-12px] rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
              </div>
              
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  Connect Your Wallet
                </h2>
                <p className="text-muted-foreground max-w-md text-lg">
                  Connect your wallet to view your positions and trading history
                </p>
              </div>
              
              <ConnectWallet />
            </div>
          </GlassCard>
        </main>
      </div>
    );
  }

  if (isLoadingPositions && !hasTriedFetchPositions) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 cyber-grid opacity-30" />
        <TopBar />
        <CyberLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-24 md:pb-0">
      {/* Background effects */}
      <div className="fixed inset-0 cyber-grid opacity-20" />
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
      
      <TopBar />
      
      <main className="relative max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent flex items-center gap-3">
              <Package className="w-8 h-8 text-primary animate-pulse" />
              My Positions
            </h1>
            <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Badge variant="outline" className="bg-blue-500/20 border-blue-500/50 text-blue-300 gap-1">
                <Wallet className="w-3 h-3" />
                Connected
              </Badge>
              <button
                onClick={() => {
                  if (queryAddress) {
                    navigator.clipboard.writeText(queryAddress);
                    setCopiedAddress(true);
                    setTimeout(() => setCopiedAddress(false), 2000);
                    toast.success('Address copied!');
                  }
                }}
                className="font-mono text-xs bg-background/50 px-2 py-0.5 rounded border border-border/30 hover:border-primary/50 transition-colors flex items-center gap-1"
              >
                {queryAddress?.slice(0, 6)}...{queryAddress?.slice(-4)}
                {copiedAddress ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
          
          <Button
            onClick={() =>
              activeTab === "positions"
                ? fetchPositions()
                : activeTab === "orders"
                  ? refreshOpenOrders()
                  : fetchHistory()
            }
            disabled={isLoadingPositions || isLoadingOrders || isLoadingHistory}
            className="gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground shadow-lg shadow-primary/25"
          >
            <RefreshCw
              className={`w-4 h-4 ${(isLoadingPositions || isLoadingOrders || isLoadingHistory) ? "animate-spin" : ""}`}
            />
            {(isLoadingPositions || isLoadingOrders || isLoadingHistory) ? "Syncing..." : "Refresh"}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <GlassCard cyber glow className="p-4 group hover:scale-[1.02] transition-transform">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Portfolio Value</p>
                <div className="mt-1 text-2xl font-bold text-foreground">
                  $<AnimatedNumber value={positionStats?.totalValue || 0} format={(n) => n.toFixed(2)} />
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard cyber glow className="p-4 group hover:scale-[1.02] transition-transform">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Unrealized P&L</p>
                <div className={`mt-1 text-2xl font-bold ${(positionStats?.totalUnrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(positionStats?.totalUnrealizedPnl || 0) >= 0 ? '+' : ''}
                  $<AnimatedNumber value={positionStats?.totalUnrealizedPnl || 0} format={(n) => n.toFixed(2)} />
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-rose-500/20 flex items-center justify-center">
                <Percent className="w-5 h-5 text-secondary" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard cyber glow className="p-4 group hover:scale-[1.02] transition-transform">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Open Positions</p>
                <div className="mt-1 text-2xl font-bold text-foreground">
                  <AnimatedNumber value={positionStats?.positionCount || 0} format={(n) => Math.round(n).toString()} />
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-accent" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard cyber glow className="p-4 group hover:scale-[1.02] transition-transform">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Open Orders</p>
                <div className="mt-1 text-2xl font-bold text-foreground">
                  <AnimatedNumber value={openOrders.length} format={(n) => Math.round(n).toString()} />
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-background/50 border border-white/10 flex-wrap h-auto">
            <TabsTrigger value="positions" className="gap-2 data-[state=active]:bg-primary/20">
              <Package className="w-4 h-4" />
              Positions
            </TabsTrigger>
            <TabsTrigger value="claimable" className="gap-2 data-[state=active]:bg-[#BFFF0A]/20">
              <Gift className="w-4 h-4" />
              Claimable
              {claimablePositions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-[#BFFF0A]/20 text-[#BFFF0A] border-[#BFFF0A]/30">
                  {claimablePositions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 data-[state=active]:bg-primary/20">
              <ShoppingCart className="w-4 h-4" />
              Open Orders
              {openOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {openOrders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary/20">
              <Clock className="w-4 h-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="wallet" className="gap-2 data-[state=active]:bg-secondary/20">
              <Shield className="w-4 h-4" />
              Wallet
            </TabsTrigger>
          </TabsList>

          {/* Positions Tab */}
          <TabsContent value="positions" className="space-y-4">
            <GlassCard cyber className="overflow-hidden">
              <div className="p-4 border-b border-border/30 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Active Positions
                </h3>
              </div>
              
              <div className="divide-y divide-border/20">
                {isLoadingPositions ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))
                ) : positions.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-lg">No open positions</p>
                    <p className="text-sm text-muted-foreground/60 mt-2">
                      Your positions will appear here when you make trades
                    </p>
                  </div>
                ) : (
                  positions.map((pos, i) => (
                    <div 
                      key={i} 
                      className="p-4 hover:bg-primary/5 transition-colors group"
                    >
                      {/* Mobile: Stack layout */}
                      <div className="flex flex-col gap-3 sm:hidden">
                        <div className="flex items-start gap-3">
                          {/* Outcome badge */}
                          <div className={`w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br flex items-center justify-center border font-bold text-xs ${
                            pos.outcome === 'Yes' || pos.outcome === 'YES'
                              ? 'from-emerald-500/30 to-emerald-400/10 text-emerald-400 border-emerald-500/50'
                              : 'from-rose-500/30 to-rose-400/10 text-rose-400 border-rose-500/50'
                          }`}>
                            {pos.outcome === 'Yes' || pos.outcome === 'YES' ? 'YES' : 'NO'}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <a 
                              href={getPolymarketUrl(pos.eventSlug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors"
                            >
                              {pos.title || pos.eventTitle}
                            </a>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{pos.size.toFixed(2)} shares</span>
                          <span>Avg: {(pos.avgPrice * 100).toFixed(1)}¢</span>
                          <span>Now: {(pos.curPrice * 100).toFixed(1)}¢</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`text-lg font-bold ${pos.cashPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pos.cashPnl >= 0 ? '+' : ''}${pos.cashPnl.toFixed(2)}
                            </div>
                            <div className={`text-xs ${pos.percentPnl >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                              {pos.percentPnl >= 0 ? '+' : ''}{pos.percentPnl.toFixed(1)}%
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTradeFromPosition(pos)}
                              className="gap-2 border-primary/50 text-primary hover:bg-primary/20"
                            >
                              <TrendingUp className="w-4 h-4" />
                              Trade
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSellModalPosition(pos)}
                              className="gap-2 border-rose-500/50 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                            >
                              <TrendingDown className="w-4 h-4" />
                              Sell
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Desktop: Row layout */}
                      <div className="hidden sm:flex items-center gap-4">
                        {/* Outcome badge */}
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center border font-bold text-sm ${
                          pos.outcome === 'Yes' || pos.outcome === 'YES'
                            ? 'from-emerald-500/30 to-emerald-400/10 text-emerald-400 border-emerald-500/50'
                            : 'from-rose-500/30 to-rose-400/10 text-rose-400 border-rose-500/50'
                        }`}>
                          {pos.outcome === 'Yes' || pos.outcome === 'YES' ? 'YES' : 'NO'}
                        </div>
                        
                        {/* Position info */}
                        <div className="flex-1 min-w-0">
                          <a 
                            href={getPolymarketUrl(pos.eventSlug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-2"
                          >
                            {pos.title || pos.eventTitle}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span>{pos.size.toFixed(2)} shares</span>
                            <span>•</span>
                            <span>Avg: {(pos.avgPrice * 100).toFixed(1)}¢</span>
                            <span>•</span>
                            <span>Now: {(pos.curPrice * 100).toFixed(1)}¢</span>
                          </div>
                        </div>
                        
                        {/* P&L */}
                        <div className="text-right mr-4">
                          <div className={`text-lg font-bold ${pos.cashPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pos.cashPnl >= 0 ? '+' : ''}${pos.cashPnl.toFixed(2)}
                          </div>
                          <div className={`text-sm ${pos.percentPnl >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                            {pos.percentPnl >= 0 ? '+' : ''}{pos.percentPnl.toFixed(1)}%
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTradeFromPosition(pos)}
                            className="gap-2 border-primary/50 text-primary hover:bg-primary/20"
                          >
                            <TrendingUp className="w-4 h-4" />
                            Trade
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSellModalPosition(pos)}
                            className="gap-2 border-rose-500/50 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                          >
                            <TrendingDown className="w-4 h-4" />
                            Sell
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Claimable Winnings Tab */}
          <TabsContent value="claimable" className="space-y-4">
            {claimablePositions.length > 0 && (
              <ClaimableWinningsSummary positions={claimablePositions} />
            )}
            
            {claimablePositions.length === 0 ? (
              <GlassCard cyber className="p-12">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#BFFF0A]/20 to-[#BFFF0A]/5 flex items-center justify-center mb-4">
                    <Gift className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-lg">No claimable winnings</p>
                  <p className="text-sm text-muted-foreground/60 mt-2">
                    When your markets resolve in your favor, you can claim your USDC here
                  </p>
                </div>
              </GlassCard>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {claimablePositions.map((position) => (
                  <ClaimWinningsCard
                    key={position.conditionId}
                    position={position}
                    onClaimSuccess={() => fetchPositions()}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Open Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <GlassCard cyber className="overflow-hidden">
              <div className="p-4 border-b border-border/30">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-yellow-400" />
                  Pending Orders
                </h3>
              </div>
              
              <div className="divide-y divide-border/20">
                {isLoadingOrders ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))
                ) : openOrders.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mb-4">
                      <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-lg">No open orders</p>
                    <p className="text-sm text-muted-foreground/60 mt-2">
                      Limit orders waiting to fill will appear here
                    </p>
                  </div>
                ) : (
                  openOrders.map((order) => (
                    <div 
                      key={order.id} 
                      className="p-4 hover:bg-primary/5 transition-colors"
                    >
                      {/* Mobile: Stack layout */}
                      <div className="flex flex-col gap-3 sm:hidden">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br flex items-center justify-center border ${getSideColor(order.side)}`}>
                            {order.side?.toUpperCase() === "BUY" ? (
                              <ArrowUpRight className="w-5 h-5" />
                            ) : (
                              <ArrowDownRight className="w-5 h-5" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground line-clamp-2">
                              {order.outcome || order.market || 'Order'}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Badge variant="outline" className={`${getSideColor(order.side)} border text-xs`}>
                                {order.side}
                              </Badge>
                              <span>{parseFloat(order.original_size).toFixed(2)} @ {(parseFloat(order.price) * 100).toFixed(1)}¢</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            {order.status || 'LIVE'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={cancellingOrderId === order.id}
                            className="gap-2 text-rose-400 hover:bg-rose-500/20"
                          >
                            {cancellingOrderId === order.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Cancel
                          </Button>
                        </div>
                      </div>
                      
                      {/* Desktop: Row layout */}
                      <div className="hidden sm:flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center border ${getSideColor(order.side)}`}>
                          {order.side?.toUpperCase() === "BUY" ? (
                            <ArrowUpRight className="w-5 h-5" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {order.outcome || order.market || 'Order'}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <Badge variant="outline" className={`${getSideColor(order.side)} border`}>
                              {order.side}
                            </Badge>
                            <span>{parseFloat(order.original_size).toFixed(2)} shares</span>
                            <span>@ {(parseFloat(order.price) * 100).toFixed(1)}¢</span>
                          </div>
                        </div>
                        
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          {order.status || 'LIVE'}
                        </Badge>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancellingOrderId === order.id}
                          className="gap-2 text-rose-400 hover:bg-rose-500/20"
                        >
                          {cancellingOrderId === order.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {/* History Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <GlassCard cyber className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Total Volume</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  $<AnimatedNumber value={stats?.volume || 0} format={(n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                </p>
              </GlassCard>
              <GlassCard cyber className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Total Trades</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  <AnimatedNumber value={stats?.trades || 0} format={(n) => Math.round(n).toString()} />
                </p>
              </GlassCard>
              <GlassCard cyber className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Markets</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  <AnimatedNumber value={stats?.markets || 0} format={(n) => Math.round(n).toString()} />
                </p>
              </GlassCard>
              <GlassCard cyber className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Buy Ratio</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  <AnimatedNumber value={stats?.buyRatio || 50} format={(n) => Math.round(n).toString()} />%
                </p>
              </GlassCard>
            </div>

            {/* Filter */}
            <GlassCard cyber className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Timeframe:</span>
                </div>
                <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                  <SelectTrigger className="w-36 h-9 bg-background/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </GlassCard>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Recent Trades */}
              <div className="lg:col-span-2">
                <GlassCard cyber className="overflow-hidden">
                  <div className="p-4 border-b border-border/30">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Recent Trades
                    </h3>
                  </div>
                  
                  <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto">
                    {isLoadingHistory ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-4 flex items-center gap-4">
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))
                    ) : trades.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                          <Clock className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground text-lg">No trades found</p>
                      </div>
                    ) : (
                      trades.map((trade, i) => (
                        <div 
                          key={i} 
                          className="p-4 hover:bg-primary/5 transition-colors group"
                        >
                          {/* Mobile: Stack layout */}
                          <div className="flex flex-col gap-2 sm:hidden">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br ${getSideColor(trade.side)} flex items-center justify-center border`}>
                                {trade.side?.toUpperCase() === "BUY" ? (
                                  <ArrowUpRight className="w-4 h-4" />
                                ) : (
                                  <ArrowDownRight className="w-4 h-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground line-clamp-2">
                                  {trade.marketTitle || trade.marketSlug}
                                </p>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`bg-gradient-to-r ${getSideColor(trade.side)} border font-mono text-xs shrink-0`}
                              >
                                ${trade.volume?.toFixed(2)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-11">
                              <span>{trade.shares?.toFixed(2)} @ {(trade.price * 100).toFixed(1)}¢</span>
                              <span>•</span>
                              <span>{formatTime(trade.timestamp)}</span>
                            </div>
                          </div>
                          
                          {/* Desktop: Row layout */}
                          <div className="hidden sm:flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getSideColor(trade.side)} flex items-center justify-center border`}>
                              {trade.side?.toUpperCase() === "BUY" ? (
                                <ArrowUpRight className="w-5 h-5" />
                              ) : (
                                <ArrowDownRight className="w-5 h-5" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                {trade.marketTitle || trade.marketSlug}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{trade.shares?.toFixed(2)} shares @ {(trade.price * 100).toFixed(1)}¢</span>
                                <span>•</span>
                                <span>{formatTime(trade.timestamp)}</span>
                              </div>
                            </div>
                            
                            <Badge 
                              variant="outline" 
                              className={`bg-gradient-to-r ${getSideColor(trade.side)} border font-mono`}
                            >
                              ${trade.volume?.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </GlassCard>
              </div>

              {/* Top Markets */}
              <div>
                <GlassCard cyber glow className="overflow-hidden">
                  <div className="p-4 border-b border-border/30">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-secondary" />
                      Top Markets
                    </h3>
                  </div>
                  
                  <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto touch-pan-y overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {isLoadingHistory ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-2 w-full" />
                        </div>
                      ))
                    ) : topMarkets.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No market data</p>
                    ) : (
                      topMarkets.slice(0, 8).map((market, i) => (
                        <div
                          key={i}
                          className="group cursor-pointer hover:bg-primary/5 p-2 -mx-2 rounded-lg transition-colors"
                          onClick={() => handleTradeMarket(market)}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-sm text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                              {market.title}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground font-mono">
                                ${market.volume.toFixed(0)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAnalyzeMarket(market);
                                }}
                              >
                                <Sparkles className="w-3 h-3 mr-1" />
                                Analyze
                              </Button>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent transition-all duration-500"
                              style={{ width: `${(market.volume / maxVolume) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </GlassCard>
              </div>
            </div>
          </TabsContent>

          {/* Wallet Tab - removed Safe wallet panel since we now use direct EOA */}
          <TabsContent value="wallet" className="space-y-4">
            <GlassCard cyber glow className="p-6">
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Direct EOA Trading</h3>
                <p className="text-muted-foreground mb-4">
                  Your wallet ({address?.slice(0, 6)}...{address?.slice(-4)}) is used directly for trading.
                </p>
                <p className="text-sm text-muted-foreground">
                  Fund your wallet with USDC on Polygon to trade on Polymarket.
                </p>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>

      </main>

      {/* Sell Modal */}
      {sellModalPosition && (
        <SellPositionModal
          position={sellModalPosition}
          onClose={() => setSellModalPosition(null)}
          onSell={handleSellPosition}
        />
      )}

      {/* Trade Modal */}
      <MarketTradeModal
        key={selectedMarketForTrade?.tokenId || 'trade-modal'}
        open={tradeModalOpen}
        onOpenChange={(open) => {
          setTradeModalOpen(open);
          if (!open) {
            // Clear state when modal closes
            setTimeout(() => setSelectedMarketForTrade(null), 100);
          }
        }}
        marketData={selectedMarketForTrade}
      />

      {/* Analysis Selection Modal */}
      <AnalysisSelectionModal
        key={analysisContext?.slug || 'analysis-modal'}
        open={analysisModalOpen}
        onOpenChange={(open) => {
          setAnalysisModalOpen(open);
          if (!open) {
            setTimeout(() => setAnalysisContext(null), 100);
          }
        }}
        marketContext={analysisContext}
        onSelect={handleAnalysisSelect}
      />
    </div>
  );
}
