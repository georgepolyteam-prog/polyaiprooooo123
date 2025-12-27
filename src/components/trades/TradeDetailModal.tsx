import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { X, ExternalLink, TrendingUp, TrendingDown, Activity, BarChart3, Clock, Wallet, Target, Copy, Sparkles, Check, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
  resolved_url?: string; // Cached resolved URL (shareUrl for external links)
}

interface PnLData {
  wallet_address: string;
  pnl_over_time: Array<{
    timestamp: number;
    pnl_to_date: number;
  }>;
}

interface WalletMetrics {
  total_volume: number;
  total_trades: number;
  unique_markets: number;
}

interface TradeDetailModalProps {
  trade: Trade;
  onClose: () => void;
  onTrade?: (marketUrl: string, trade: Trade, side: 'YES' | 'NO') => void;
  onAnalyze?: (trade: Trade, resolvedUrl: string) => void;
}

export function TradeDetailModal({ trade, onClose, onTrade, onAnalyze }: TradeDetailModalProps) {
  const isMobile = useIsMobile();
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [walletTrades, setWalletTrades] = useState<Trade[]>([]);
  const [walletMetrics, setWalletMetrics] = useState<WalletMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(trade.resolved_url || null);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [loadingSide, setLoadingSide] = useState<'YES' | 'NO' | null>(null);
  // Store both shareUrl (for external links) and canonicalMarketUrl (for trading API calls)
  const [canonicalMarketUrl, setCanonicalMarketUrl] = useState<string | null>(null);
  
  // Resolve correct market URL on mount
  useEffect(() => {
    async function resolveMarketUrl() {
      if (trade.resolved_url) {
        setResolvedUrl(trade.resolved_url);
        // For backwards compatibility, use resolved_url as canonical too
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
          // Use shareUrl for external links, canonicalMarketUrl for trading
          setResolvedUrl(data.shareUrl || data.fullUrl);
          setCanonicalMarketUrl(data.canonicalMarketUrl || data.fullUrl);
        } else {
          // Fallback to market_slug based URL
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

  useEffect(() => {
    fetchWalletData();
  }, [trade.user]);

  async function fetchWalletData() {
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
        setPnlData(data.pnlData);
        setWalletTrades(data.recentTrades || []);
        setWalletMetrics(data.walletMetrics);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  }

  const copyWallet = async () => {
    await navigator.clipboard.writeText(trade.user);
    setCopied(true);
    toast({ title: "Wallet address copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrade = (side: 'YES' | 'NO') => {
    setLoadingSide(side);
    // Use canonicalMarketUrl for trading (proper /event/{slug}/{marketSlug} format)
    // This ensures market-dashboard can parse it correctly, even for multi-market events
    const marketUrl = canonicalMarketUrl || resolvedUrl || `https://polymarket.com/event/${trade.market_slug}`;
    // Small delay for loading state visibility
    setTimeout(() => {
      onTrade?.(marketUrl, trade, side);
      setLoadingSide(null);
    }, 150);
  };

  const handleAnalyze = () => {
    const url = resolvedUrl || `https://polymarket.com/event/${trade.market_slug}`;
    // Don't close - let the new modal stack on top
    onAnalyze?.(trade, url);
  };

  const totalPnL = pnlData?.pnl_over_time?.[pnlData.pnl_over_time.length - 1]?.pnl_to_date || 0;
  const pnlIsPositive = totalPnL >= 0;

  const chartData = pnlData?.pnl_over_time?.map(point => ({
    date: new Date(point.timestamp * 1000).toLocaleDateString(),
    pnl: point.pnl_to_date
  })) || [];

  const shares = trade.shares_normalized || trade.shares || 0;

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(2)}`;
  };

  const modalContent = (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border p-4 sm:p-6 flex items-start justify-between gap-4 z-10">
        <div className="flex gap-4 flex-1 min-w-0">
          {trade.image && (
            <img 
              src={trade.image} 
              alt={trade.title}
              className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground mb-2 line-clamp-2">
              {trade.title}
            </h2>
            {/* Wallet with links */}
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              <div className="flex items-center gap-1.5">
                <Link 
                  to={`/wallet/${trade.user}`}
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="font-mono text-primary hover:text-primary/80 hover:underline transition-colors min-h-[44px] flex items-center"
                >
                  {trade.user.slice(0, 8)}...{trade.user.slice(-6)}
                </Link>
                <button
                  onClick={copyWallet}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={`https://polymarket.com/profile/${trade.user}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md hover:bg-muted hover:text-primary transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <span className="hidden sm:inline text-muted-foreground/50">•</span>
              <span className="text-xs sm:text-sm">{new Date(trade.timestamp * 1000).toLocaleString()}</span>
            </div>
          </div>
        </div>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 min-h-[44px] min-w-[44px]"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
        {/* Action Buttons - BUY YES/NO */}
        <div className="flex gap-2">
          {/* BUY YES Button */}
          <Button
            variant="outline"
            className={cn(
              "flex-1 h-12 sm:h-14 gap-2 font-semibold rounded-xl transition-all duration-200 min-h-[48px]",
              "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            )}
            onClick={() => handleTrade('YES')}
            disabled={loadingSide !== null}
          >
            {loadingSide === 'YES' ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : (
              <>
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">BUY YES</span>
                <span className="sm:hidden">YES</span>
              </>
            )}
          </Button>
          
          {/* BUY NO Button */}
          <Button
            variant="outline"
            className={cn(
              "flex-1 h-12 sm:h-14 gap-2 font-semibold rounded-xl transition-all duration-200 min-h-[48px]",
              "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/50 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]"
            )}
            onClick={() => handleTrade('NO')}
            disabled={loadingSide !== null}
          >
            {loadingSide === 'NO' ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : (
              <>
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">BUY NO</span>
                <span className="sm:hidden">NO</span>
              </>
            )}
          </Button>
        </div>
        
        {/* Analyze Button - Separate Row */}
        <Button
          variant="outline"
          className="w-full h-11 gap-2 font-semibold rounded-xl bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all duration-200"
          onClick={handleAnalyze}
        >
          <Sparkles className="w-4 h-4" />
          Analyze Market
        </Button>

        {/* Trade Details Card */}
        <div className="glass-card rounded-xl p-4 sm:p-6">
          <h3 className="text-base sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Trade Details
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div>
              <div className="text-muted-foreground text-xs sm:text-sm mb-1">Side</div>
              <div className={`text-lg sm:text-2xl font-bold flex items-center gap-1.5 ${
                trade.side === 'BUY' ? 'text-success' : 'text-destructive'
              }`}>
                {trade.side === 'BUY' ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                <span className="truncate">{trade.side} {trade.token_label}</span>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs sm:text-sm mb-1">Price</div>
              <div className="text-lg sm:text-2xl font-bold text-foreground">${trade.price.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs sm:text-sm mb-1">Shares</div>
              <div className="text-lg sm:text-2xl font-bold text-foreground">{shares.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs sm:text-sm mb-1">Volume</div>
              <div className="text-lg sm:text-2xl font-bold text-primary">
                ${(trade.price * shares).toFixed(2)}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <a
              href={resolvedUrl || `https://polymarket.com/event/${trade.market_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm min-h-[44px]"
            >
              {resolvingUrl ? 'Resolving link...' : 'View Market on Polymarket'}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">Loading wallet analytics...</p>
          </div>
        ) : (
          <>
            {/* Wallet Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className={`glass-card rounded-xl p-3 sm:p-6 border ${
                pnlIsPositive ? 'border-success/30' : 'border-destructive/30'
              }`}>
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm mb-1 sm:mb-2">
                  <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Total PnL
                </div>
                <div className={`text-lg sm:text-2xl md:text-3xl font-bold ${
                  pnlIsPositive ? 'text-success' : 'text-destructive'
                }`}>
                  {pnlIsPositive ? '+' : ''}{formatVolume(totalPnL)}
                </div>
              </div>
              <div className="glass-card rounded-xl p-3 sm:p-6">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm mb-1 sm:mb-2">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Total Volume
                </div>
                <div className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground">
                  {formatVolume(walletMetrics?.total_volume || 0)}
                </div>
              </div>
              <div className="glass-card rounded-xl p-3 sm:p-6">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm mb-1 sm:mb-2">
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Total Trades
                </div>
                <div className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground">
                  {walletMetrics?.total_trades || 0}
                </div>
              </div>
              <div className="glass-card rounded-xl p-3 sm:p-6">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm mb-1 sm:mb-2">
                  <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Markets
                </div>
                <div className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground">
                  {walletMetrics?.unique_markets || 0}
                </div>
              </div>
            </div>

            {/* PnL Chart */}
            {chartData.length > 0 && (
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-base sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Profit & Loss Over Time
                </h3>
                <div className="h-[200px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={pnlIsPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={pnlIsPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'PnL']}
                      />
                      <Area
                        type="monotone"
                        dataKey="pnl"
                        stroke={pnlIsPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                        strokeWidth={2}
                        fill="url(#pnlGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recent Trades */}
            {walletTrades.length > 0 && (
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-base sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Recent Trades ({walletTrades.length})
                </h3>
                <div className="space-y-2 max-h-[300px] sm:max-h-[350px] overflow-y-auto overscroll-contain">
                  {walletTrades.slice(0, 20).map((t, i) => (
                    <a
                      key={i}
                      href={`https://polymarket.com/event/${t.market_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-muted/30 rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors min-h-[60px]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-foreground font-medium truncate text-sm sm:text-base flex items-center gap-1.5">
                            {t.title}
                            <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {new Date(t.timestamp * 1000).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className={`px-2 py-1 rounded text-xs sm:text-sm font-bold ${
                            t.side === 'BUY' 
                              ? 'bg-success/20 text-success' 
                              : 'bg-destructive/20 text-destructive'
                          }`}>
                            {t.side}
                          </div>
                          <div className="text-foreground font-bold text-sm sm:text-base">${t.price.toFixed(3)}</div>
                          <div className="text-muted-foreground text-xs sm:text-sm">
                            {(t.shares_normalized || t.shares || 0).toFixed(2)} shares
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Use Sheet on mobile for better UX
  if (isMobile) {
    return (
      <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[95vh] p-0 rounded-t-2xl">
          {/* Drag handle indicator */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30 z-10" />
          
          {modalContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-2xl max-w-5xl w-full h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {modalContent}
      </motion.div>
    </motion.div>
  );
}
