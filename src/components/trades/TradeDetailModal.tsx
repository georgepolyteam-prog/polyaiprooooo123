import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ExternalLink, TrendingUp, TrendingDown, Copy, Sparkles, Check, Loader2, Star, BarChart3, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, ChevronLeft, Activity, Layers, Trophy, CheckCircle2, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useTrackedWallets } from '@/hooks/useTrackedWallets';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { WalletPnlChart } from './WalletPnlChart';
import { MarketChartView } from './MarketChartView';

interface Trade {
  token_id: string;
  token_label: string;
  side: 'BUY' | 'SELL';
  market_slug: string;
  condition_id: string;
  shares_normalized?: number;
  shares?: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  user: string;
  image?: string;
  resolved_url?: string;
}

interface WalletMetrics {
  total_volume: number;
  total_trades: number;
  unique_markets: number;
  orders_capped?: boolean;
}

interface PnlSummary {
  total_pnl: number;
  totalPnl?: number;
  series: Array<{ timestamp: number; pnl_to_date: number }>;
  winRate?: number;
  avgTradeSize?: number;
  unrealizedPnl?: number;
  unrealized_pnl?: number;
  combinedPnl?: number;
  combined_pnl?: number;
  positionCount?: number;
  positionsValue?: number;
}

interface RecentTrade {
  token_label: string;
  side: string;
  market_slug: string;
  title: string;
  shares_normalized?: number;
  shares?: number;
  price: number;
  timestamp: number;
}

interface TradeDetailModalProps {
  trade: Trade;
  onClose: () => void;
  onTrade?: (marketUrl: string, trade: Trade, side: 'YES' | 'NO') => void;
  onAnalyze?: (trade: Trade, resolvedUrl: string) => void;
}

export function TradeDetailModal({ trade, onClose, onTrade, onAnalyze }: TradeDetailModalProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { isWalletTracked, trackWallet, untrackWallet } = useTrackedWallets();
  
  const [walletMetrics, setWalletMetrics] = useState<WalletMetrics | null>(null);
  const [pnlSummary, setPnlSummary] = useState<PnlSummary | null>(null);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(trade.resolved_url || null);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [loadingSide, setLoadingSide] = useState<'YES' | 'NO' | null>(null);
  const [canonicalMarketUrl, setCanonicalMarketUrl] = useState<string | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [showChartView, setShowChartView] = useState(false);
  const [fetchedImage, setFetchedImage] = useState<string | null>(null);
  
  // Image cache to avoid refetching for same condition_id
  const [imageCache] = useState<Map<string, string>>(new Map());
  
  const isTracked = isWalletTracked(trade.user);
  
  useEffect(() => {
    async function resolveMarketUrl() {
      if (trade.resolved_url) {
        setResolvedUrl(trade.resolved_url);
        setCanonicalMarketUrl(trade.resolved_url);
        return;
      }
      
      if (!trade.market_slug) return;
      
      setResolvingUrl(true);
      try {
        const { data, error } = await supabase.functions.invoke('resolve-market-url', {
          body: { marketSlug: trade.market_slug, conditionId: trade.condition_id, tokenId: trade.token_id }
        });
        
        if (!error && data) {
          setResolvedUrl(data.shareUrl || data.fullUrl);
          setCanonicalMarketUrl(data.canonicalMarketUrl || data.fullUrl);
        } else {
          const fallbackUrl = `https://polymarket.com/event/${trade.market_slug}`;
          setResolvedUrl(fallbackUrl);
          setCanonicalMarketUrl(fallbackUrl);
        }
      } catch (err) {
        console.error('Error resolving market URL:', err);
        const fallbackUrl = `https://polymarket.com/event/${trade.market_slug}`;
        setResolvedUrl(fallbackUrl);
        setCanonicalMarketUrl(fallbackUrl);
      } finally {
        setResolvingUrl(false);
      }
    }
    
    resolveMarketUrl();
  }, [trade.market_slug, trade.condition_id, trade.resolved_url, trade.token_id]);

  // Fetch correct market image using condition_id (same as Markets/Chat pages)
  useEffect(() => {
    async function fetchMarketImage() {
      if (!trade.condition_id) return;
      
      // Check cache first
      if (imageCache.has(trade.condition_id)) {
        setFetchedImage(imageCache.get(trade.condition_id) || null);
        return;
      }
      
      try {
        const { data, error } = await supabase.functions.invoke('get-market-previews', {
          body: { conditionIds: [trade.condition_id] }
        });
        
        if (!error && data?.markets?.[0]?.image) {
          const image = data.markets[0].image;
          imageCache.set(trade.condition_id, image);
          setFetchedImage(image);
        }
      } catch (err) {
        console.error('Error fetching market image:', err);
      }
    }
    
    fetchMarketImage();
  }, [trade.condition_id, imageCache]);

  const fetchWalletData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-analytics', {
        body: { address: trade.user }
      });

      if (error) {
        console.error('Error fetching wallet analytics:', error);
        setLoading(false);
        return;
      }

      if (data) {
        console.log('[TradeDetailModal] Raw wallet-analytics response:', data);
        
        // Normalize walletMetrics - prefer snake_case, fallback to camelCase
        const rawMetrics = data.walletMetrics || {};
        const normalizedMetrics: WalletMetrics = {
          total_volume: rawMetrics.total_volume ?? rawMetrics.totalVolume ?? 0,
          total_trades: rawMetrics.total_trades ?? rawMetrics.totalTrades ?? 0,
          unique_markets: rawMetrics.unique_markets ?? rawMetrics.uniqueMarkets ?? 0,
          orders_capped: rawMetrics.orders_capped ?? rawMetrics.ordersCapped ?? false,
        };
        setWalletMetrics(normalizedMetrics);
        
        // Normalize pnlSummary - prefer snake_case, fallback to camelCase
        const rawPnl = data.pnlSummary || {};
        const seriesData = rawPnl.series || [];
        const lastSeriesValue = seriesData.length > 0 ? (seriesData[seriesData.length - 1]?.pnl_to_date ?? 0) : 0;
        
        const normalizedPnl: PnlSummary = {
          total_pnl: rawPnl.total_pnl ?? rawPnl.totalPnl ?? lastSeriesValue ?? 0,
          series: seriesData,
          winRate: rawPnl.winRate ?? 0,
          avgTradeSize: rawPnl.avgTradeSize ?? 0,
          unrealizedPnl: rawPnl.unrealizedPnl ?? rawPnl.unrealized_pnl ?? 0,
          combinedPnl: rawPnl.combinedPnl ?? rawPnl.combined_pnl ?? 0,
          positionCount: rawPnl.positionCount ?? 0,
          positionsValue: rawPnl.positionsValue ?? 0,
        };
        
        console.log('[TradeDetailModal] Normalized PnL:', normalizedPnl);
        setPnlSummary(normalizedPnl);
        setRecentTrades(data.recentTrades || []);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  }, [trade.user]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const copyWallet = async () => {
    await navigator.clipboard.writeText(trade.user);
    setCopied(true);
    toast({ title: "Wallet address copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrade = (side: 'YES' | 'NO') => {
    setLoadingSide(side);
    const marketUrl = canonicalMarketUrl || resolvedUrl || `https://polymarket.com/event/${trade.market_slug}`;
    setTimeout(() => {
      onTrade?.(marketUrl, trade, side);
      setLoadingSide(null);
    }, 150);
  };

  const handleAnalyze = () => {
    const url = resolvedUrl || `https://polymarket.com/event/${trade.market_slug}`;
    onAnalyze?.(trade, url);
  };

  const handleTrackWallet = async () => {
    // Wait for auth to load before checking
    if (authLoading) return;
    
    if (!user) {
      toast({ 
        title: "Account required", 
        description: "Create a free account to save tracked wallets across sessions.",
        variant: "destructive" 
      });
      // Redirect to email auth with return path
      const returnPath = encodeURIComponent(location.pathname);
      navigate(`/auth?step=email&next=${returnPath}`);
      return;
    }
    
    setTrackingLoading(true);
    if (isTracked) {
      await untrackWallet(trade.user);
    } else {
      await trackWallet(trade.user);
    }
    setTrackingLoading(false);
  };

  // Helper to ensure we always get a safe number (never NaN/undefined)
  const toNumber = (val: unknown, fallback = 0): number => {
    if (val === null || val === undefined) return fallback;
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(num) || !isFinite(num) ? fallback : num;
  };

  const shares = toNumber(trade.shares_normalized) || toNumber(trade.shares) || 0;
  const safePrice = toNumber(trade.price);
  const volume = safePrice * shares;

  const formatVolume = (vol: number | undefined | null) => {
    const safeVol = toNumber(vol);
    if (safeVol >= 1000000) return `$${(safeVol / 1000000).toFixed(2)}M`;
    if (safeVol >= 1000) return `$${(safeVol / 1000).toFixed(1)}K`;
    return `$${safeVol.toFixed(2)}`;
  };

  const formatPnl = (pnl: number) => {
    const formatted = formatVolume(Math.abs(pnl));
    return pnl >= 0 ? `+${formatted}` : `-${formatted.slice(1)}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Full profile view content
  const fullProfileContent = (
    <div className="flex flex-col h-full max-h-[85vh] sm:max-h-[80vh]">
      {/* Header with back button */}
      <div className="bg-card/95 backdrop-blur-xl border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setShowFullProfile(false)} className="shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground">Wallet Profile</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs text-muted-foreground">
              {trade.user.slice(0, 10)}...{trade.user.slice(-8)}
            </span>
            <button onClick={copyWallet} className="p-1 hover:bg-muted rounded">
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchWalletData} disabled={loading} className="shrink-0">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
        {!isMobile && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Full profile content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-4 bg-muted/20 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Volume</span>
            </div>
            <div className="font-bold text-lg">{walletMetrics ? formatVolume(walletMetrics.total_volume) : '—'}</div>
          </div>
          <div className="rounded-xl p-4 bg-muted/20 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Trades</span>
            </div>
            <div className="font-bold text-lg">
              {walletMetrics?.total_trades !== undefined 
                ? (walletMetrics.orders_capped && walletMetrics.total_trades >= 1000 ? '1000+' : walletMetrics.total_trades)
                : '—'}
            </div>
          </div>
          <div className="rounded-xl p-4 bg-muted/20 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Markets</span>
            </div>
            <div className="font-bold text-lg">
              {walletMetrics?.unique_markets !== undefined 
                ? (walletMetrics.orders_capped ? `${walletMetrics.unique_markets}+` : walletMetrics.unique_markets)
                : '—'}
            </div>
          </div>
          <div className="rounded-xl p-4 bg-muted/20 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total PnL</span>
            </div>
            <div className={cn(
              "font-bold text-lg",
              pnlSummary?.total_pnl !== undefined && pnlSummary.total_pnl >= 0 ? "text-success" : "text-destructive"
            )}>
              {pnlSummary?.total_pnl !== undefined ? formatPnl(pnlSummary.total_pnl) : '—'}
            </div>
          </div>
        </div>

        {/* PnL Chart */}
        {pnlSummary && pnlSummary.series.length > 0 && (
          <WalletPnlChart 
            series={pnlSummary.series} 
            totalPnl={pnlSummary.total_pnl}
            unrealizedPnl={pnlSummary.unrealizedPnl}
            combinedPnl={pnlSummary.combinedPnl}
          />
        )}

        {/* Recent Trades */}
        <div className="rounded-xl border border-border/30 overflow-hidden">
          <div className="p-3 border-b border-border/30 bg-muted/10">
            <h3 className="font-semibold text-sm">Recent Activity</h3>
          </div>
          <div className="divide-y divide-border/20 max-h-[300px] overflow-y-auto">
            {recentTrades.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No recent trades
              </div>
            ) : (
              recentTrades.slice(0, 20).map((t, i) => {
                const tradeShares = t.shares_normalized || t.shares || 0;
                const tradePrice = t.price ?? 0;
                const tradeVolume = tradePrice * tradeShares;
                return (
                  <div key={i} className="p-3 hover:bg-muted/10 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className={cn(
                            "flex items-center gap-1 font-semibold",
                            t.side?.toUpperCase() === 'BUY' ? "text-success" : "text-destructive"
                          )}>
                            {t.side?.toUpperCase() === 'BUY' ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {t.token_label || (t.side?.toUpperCase() === 'BUY' ? 'YES' : 'NO')}
                          </span>
                          <span>•</span>
                          <span>{formatTime(t.timestamp)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">{formatVolume(tradeVolume)}</p>
                        <p className="text-xs text-muted-foreground">
                          @{((t.price ?? 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* External Links */}
        <div className="flex gap-2">
          <a
            href={`https://polymarket.com/profile/${trade.user}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="outline" className="w-full gap-2 h-10 rounded-xl">
              <ExternalLink className="w-4 h-4" />
              Polymarket Profile
            </Button>
          </a>
          <a
            href={`https://polygonscan.com/address/${trade.user}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="outline" className="w-full gap-2 h-10 rounded-xl">
              <ExternalLink className="w-4 h-4" />
              Polygonscan
            </Button>
          </a>
        </div>
      </div>
    </div>
  );

  // Main modal content
  const mainContent = (
    <div className="flex flex-col h-full max-h-[85vh] sm:max-h-[80vh]">
      {/* Compact Header */}
      <div className="bg-card/95 backdrop-blur-xl border-b border-border p-4 flex items-start gap-3">
        {(fetchedImage || trade.image) ? (
          <img 
            src={fetchedImage || trade.image} 
            alt={trade.title}
            className="w-12 h-12 rounded-xl object-cover shrink-0"
            onError={(e) => {
              // Hide broken images
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground line-clamp-2 leading-tight">
            {trade.title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <button 
              onClick={() => setShowFullProfile(true)}
              className="font-mono text-xs text-primary hover:underline"
            >
              {trade.user.slice(0, 6)}...{trade.user.slice(-4)}
            </button>
            <button onClick={copyWallet} className="p-1 hover:bg-muted rounded">
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
            <a
              href={`https://polymarket.com/profile/${trade.user}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-muted rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
          </div>
        </div>
        {!isMobile && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Trade Summary Card */}
        <div className="rounded-xl p-4 bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                trade.side === 'BUY' ? 'bg-success/20' : 'bg-destructive/20'
              )}>
                {trade.side === 'BUY' ? (
                  <TrendingUp className="w-5 h-5 text-success" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-destructive" />
                )}
              </div>
              <div>
                <div className={cn(
                  "font-bold text-lg",
                  trade.side === 'BUY' ? 'text-success' : 'text-destructive'
                )}>
                  {trade.side} {trade.token_label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(trade.timestamp * 1000).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg text-primary">{formatVolume(volume)}</div>
              <div className="text-xs text-muted-foreground">
                {toNumber(shares).toFixed(0)} @ ${toNumber(trade.price).toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        {/* View Chart Button */}
        <Button
          variant="outline"
          className="w-full h-12 gap-2 font-semibold rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:border-primary/50 hover:bg-primary/15 transition-all group"
          onClick={() => setShowChartView(true)}
        >
          <LineChart className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-foreground">View Chart</span>
          <span className="text-xs text-muted-foreground ml-auto">Candlesticks</span>
        </Button>

        {/* Quick Stats Row with PnL and Win Rate */}
        {!loading && walletMetrics && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg p-3 bg-muted/20 text-center">
                <div className="text-xs text-muted-foreground mb-1">Volume</div>
                <div className="font-bold text-sm">{formatVolume(walletMetrics.total_volume)}</div>
              </div>
              <div className="rounded-lg p-3 bg-muted/20 text-center">
                <div className="text-xs text-muted-foreground mb-1">Trades</div>
                <div className="font-bold text-sm">
                  {walletMetrics.orders_capped && walletMetrics.total_trades >= 1000 ? '1000+' : walletMetrics.total_trades}
                </div>
              </div>
              <div className="rounded-lg p-3 bg-muted/20 text-center">
                <div className="text-xs text-muted-foreground mb-1">Markets</div>
                <div className="font-bold text-sm">
                  {walletMetrics.orders_capped ? `${walletMetrics.unique_markets}+` : walletMetrics.unique_markets}
                </div>
              </div>
              <div className="rounded-lg p-3 bg-muted/20 text-center">
                <div className="text-xs text-muted-foreground mb-1">PnL</div>
                <div className={cn(
                  "font-bold text-sm",
                  (pnlSummary?.total_pnl ?? pnlSummary?.totalPnl ?? 0) >= 0 ? "text-success" : "text-destructive"
                )}>
                  {(pnlSummary?.total_pnl !== undefined || pnlSummary?.totalPnl !== undefined) 
                    ? formatPnl(pnlSummary?.total_pnl ?? pnlSummary?.totalPnl ?? 0) 
                    : '—'}
                </div>
              </div>
            </div>
            
            {/* Win Rate Row - Professional UI */}
            {pnlSummary?.winRate !== undefined && (
              <div className={cn(
                "rounded-xl p-3 border",
                pnlSummary.winRate >= 50 
                  ? "bg-gradient-to-r from-success/5 via-success/10 to-success/5 border-success/20" 
                  : "bg-gradient-to-r from-destructive/5 via-destructive/10 to-destructive/5 border-destructive/20"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      pnlSummary.winRate >= 50 ? "bg-success/20" : "bg-destructive/20"
                    )}>
                      <Trophy className={cn(
                        "w-5 h-5",
                        pnlSummary.winRate >= 50 ? "text-success" : "text-destructive"
                      )} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">Win Rate</div>
                      <div className={cn(
                        "font-bold text-xl tabular-nums",
                        pnlSummary.winRate >= 50 ? "text-success" : "text-destructive"
                      )}>
                        {toNumber(pnlSummary.winRate).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
                    pnlSummary.winRate >= 60 ? "bg-success/20 text-success" :
                    pnlSummary.winRate >= 50 ? "bg-success/15 text-success" :
                    "bg-destructive/20 text-destructive"
                  )}>
                    {pnlSummary.winRate >= 50 && (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {pnlSummary.winRate >= 60 ? 'Excellent' : 
                     pnlSummary.winRate >= 50 ? 'Good' : 'Below Avg'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg p-3 bg-muted/20 text-center animate-pulse">
                <div className="h-3 bg-muted/40 rounded mb-2 w-12 mx-auto" />
                <div className="h-5 bg-muted/40 rounded w-16 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className={cn(
              "h-14 gap-2 font-bold rounded-xl transition-all",
              "bg-success/20 border border-success/40 text-success hover:bg-success/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            )}
            onClick={() => handleTrade('YES')}
            disabled={loadingSide !== null}
          >
            {loadingSide === 'YES' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                BUY YES
              </>
            )}
          </Button>
          
          <Button
            className={cn(
              "h-14 gap-2 font-bold rounded-xl transition-all",
              "bg-destructive/20 border border-destructive/40 text-destructive hover:bg-destructive/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            )}
            onClick={() => handleTrade('NO')}
            disabled={loadingSide !== null}
          >
            {loadingSide === 'NO' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <TrendingDown className="w-5 h-5" />
                BUY NO
              </>
            )}
          </Button>
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-2">
          {/* Track Wallet Button */}
          <Button
            variant="outline"
            className={cn(
              "h-12 gap-2 font-semibold rounded-xl transition-all",
              isTracked 
                ? "bg-primary/20 border-primary/50 text-primary" 
                : "border-border/50 hover:border-primary/50 hover:bg-primary/10"
            )}
            onClick={handleTrackWallet}
            disabled={trackingLoading || authLoading}
          >
            {trackingLoading || authLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Star className={cn("w-4 h-4", isTracked && "fill-primary")} />
            )}
            {isTracked ? 'Tracked' : 'Track Wallet'}
          </Button>

          {/* Analyze Button */}
          <Button
            variant="outline"
            className="h-12 gap-2 font-semibold rounded-xl border-border/50 hover:border-secondary/50 hover:bg-secondary/10"
            onClick={handleAnalyze}
          >
            <Sparkles className="w-4 h-4" />
            Analyze
          </Button>
        </div>

        {/* PnL Chart - Compact Version */}
        {loading ? (
          <div className="rounded-xl p-3 bg-muted/20 border border-border/30 animate-pulse">
            <div className="h-24 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        ) : pnlSummary && pnlSummary.series.length > 0 ? (
          <WalletPnlChart 
            series={pnlSummary.series} 
            totalPnl={pnlSummary.total_pnl}
            unrealizedPnl={pnlSummary.unrealizedPnl}
            combinedPnl={pnlSummary.combinedPnl}
            compact
          />
        ) : (
          <div className="rounded-xl p-3 bg-muted/20 border border-border/30 text-center text-xs text-muted-foreground">
            No PnL history available
          </div>
        )}

        {/* View Full Profile Button */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setShowFullProfile(true)}
              className="text-primary hover:underline flex items-center gap-1"
            >
              <BarChart3 className="w-4 h-4" />
              View Full Wallet Profile
            </button>
            <a
              href={resolvedUrl || `https://polymarket.com/event/${trade.market_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {resolvingUrl ? 'Loading...' : 'View Market'}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const modalContent = (
    <AnimatePresence mode="wait">
      {showChartView ? (
        <MarketChartView
          conditionId={trade.condition_id}
          marketUrl={canonicalMarketUrl || resolvedUrl || `https://polymarket.com/event/${trade.market_slug}`}
          title={trade.title}
          image={fetchedImage || trade.image}
          onBack={() => setShowChartView(false)}
          onClose={onClose}
          onTrade={(side) => handleTrade(side)}
          onAnalyze={handleAnalyze}
          isMobile={isMobile}
        />
      ) : showFullProfile ? (
        <motion.div
          key="full-profile"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          {fullProfileContent}
        </motion.div>
      ) : (
        <motion.div
          key="main"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          {mainContent}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (isMobile) {
    return (
      <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
        <SheetContent 
          side="bottom" 
          className="p-0 rounded-t-3xl max-h-[90vh] border-t border-border/50 bg-card"
        >
          {modalContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-md rounded-2xl bg-card border border-border/50 shadow-2xl overflow-hidden"
      >
        {modalContent}
      </motion.div>
    </div>
  );
}
