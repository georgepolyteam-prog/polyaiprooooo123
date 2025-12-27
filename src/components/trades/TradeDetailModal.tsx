import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { X, ExternalLink, TrendingUp, TrendingDown, Activity, Copy, Sparkles, Check, Loader2, Star, Zap, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useTrackedWallets } from '@/hooks/useTrackedWallets';
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
  resolved_url?: string;
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isWalletTracked, trackWallet, untrackWallet } = useTrackedWallets();
  
  const [walletMetrics, setWalletMetrics] = useState<WalletMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(trade.resolved_url || null);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [loadingSide, setLoadingSide] = useState<'YES' | 'NO' | null>(null);
  const [canonicalMarketUrl, setCanonicalMarketUrl] = useState<string | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  
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
    if (!user) {
      toast({ title: "Sign in to track wallets", variant: "destructive" });
      navigate('/auth');
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

  const shares = trade.shares_normalized || trade.shares || 0;
  const volume = trade.price * shares;

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(2)}`;
  };

  const modalContent = (
    <div className="flex flex-col h-full max-h-[85vh] sm:max-h-[80vh]">
      {/* Compact Header */}
      <div className="bg-card/95 backdrop-blur-xl border-b border-border p-4 flex items-start gap-3">
        {trade.image && (
          <img 
            src={trade.image} 
            alt={trade.title}
            className="w-12 h-12 rounded-xl object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground line-clamp-2 leading-tight">
            {trade.title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Link 
              to={`/wallet/${trade.user}`}
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="font-mono text-xs text-primary hover:underline"
            >
              {trade.user.slice(0, 6)}...{trade.user.slice(-4)}
            </Link>
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
                {shares.toFixed(0)} @ ${trade.price.toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        {!loading && walletMetrics && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg p-3 bg-muted/20 text-center">
              <div className="text-xs text-muted-foreground mb-1">Volume</div>
              <div className="font-bold text-sm">{formatVolume(walletMetrics.total_volume)}</div>
            </div>
            <div className="rounded-lg p-3 bg-muted/20 text-center">
              <div className="text-xs text-muted-foreground mb-1">Trades</div>
              <div className="font-bold text-sm">{walletMetrics.total_trades}</div>
            </div>
            <div className="rounded-lg p-3 bg-muted/20 text-center">
              <div className="text-xs text-muted-foreground mb-1">Markets</div>
              <div className="font-bold text-sm">{walletMetrics.unique_markets}</div>
            </div>
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
            disabled={trackingLoading}
          >
            {trackingLoading ? (
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

        {/* Copy-Trade Coming Soon */}
        <div className="relative">
          <Button
            variant="outline"
            disabled
            className="w-full h-12 gap-2 font-semibold rounded-xl border-dashed border-border/50 text-muted-foreground relative overflow-hidden"
          >
            <Zap className="w-4 h-4" />
            Copy-Trade
          </Button>
          <div className="absolute -top-1 -right-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg">
            COMING SOON
          </div>
        </div>

        {/* View Full Profile Link */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between text-sm">
            <Link
              to={`/wallet/${trade.user}`}
              onClick={onClose}
              className="text-primary hover:underline flex items-center gap-1"
            >
              <BarChart3 className="w-4 h-4" />
              View Full Wallet Profile
            </Link>
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
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md rounded-2xl bg-card border border-border/50 shadow-2xl overflow-hidden"
      >
        {modalContent}
      </motion.div>
    </div>
  );
}
