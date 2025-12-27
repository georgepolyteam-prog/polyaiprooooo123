import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Copy, 
  ExternalLink, 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown,
  Activity, 
  Layers, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Target, 
  Trophy, 
  Zap,
  HelpCircle,
  AlertTriangle,
  Star,
  StarOff,
  ChevronDown,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useTrackedWallets } from '@/hooks/useTrackedWallets';
import { WalletPnlChart } from '@/components/trades/WalletPnlChart';
import { WalletHotMarkets } from '@/components/wallet/WalletHotMarkets';
import { WalletHowItWorks } from '@/components/wallet/WalletHowItWorks';

const WALLET_PROFILE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-profile`;
const WALLET_ANALYTICS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-analytics`;

interface Trade {
  marketSlug: string;
  marketTitle: string;
  side: string;
  token_label?: string; // YES or NO - the actual outcome token
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

interface PnlDataPoint {
  timestamp: number;
  pnl_to_date: number;
}

interface ProfileData {
  address: string;
  stats: WalletStats;
  recentTrades: Trade[];
  topMarkets: TopMarket[];
  rank: number | null;
}

interface AnalyticsData {
  pnlData: PnlDataPoint[];
  pnlSummary: {
    totalPnl: number;
    winRate: number;
    avgTradeSize: number;
  };
}

// Cyber particles background
function CyberParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 2 === 0 ? 'hsl(var(--poly-purple))' : 'hsl(var(--poly-cyan))',
            boxShadow: i % 2 === 0 ? '0 0 8px hsl(var(--poly-purple))' : '0 0 8px hsl(var(--poly-cyan))',
          }}
          animate={{
            y: [0, -60, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 5 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 4,
          }}
        />
      ))}
    </div>
  );
}

// Stat card component
function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend,
  className 
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 md:p-5",
        "bg-card/50 backdrop-blur-sm border border-border/30",
        "hover:border-poly-purple/30 transition-all duration-300 group",
        className
      )}
    >
      {/* Hover gradient */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-poly-purple/10 to-poly-cyan/5" />
      
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-muted/50 text-poly-cyan">
            {icon}
          </div>
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "text-xl md:text-2xl font-bold",
            trend === 'up' && "text-success",
            trend === 'down' && "text-destructive",
            !trend && "text-foreground"
          )}>
            {value}
          </span>
          {trend && (
            <span className={cn(
              "text-xs",
              trend === 'up' && "text-success",
              trend === 'down' && "text-destructive"
            )}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}

// Loading skeleton
function ProfileSkeleton() {
  const isMobile = useIsMobile();
  
  return (
    <div className="space-y-4 md:space-y-6">
      <Skeleton className="h-8 w-32 bg-muted/30" />
      <div className="rounded-xl p-4 md:p-6 border border-border/30 bg-card/30">
        <Skeleton className="h-8 w-64 mb-2 bg-muted/30" />
        <Skeleton className="h-4 w-40 bg-muted/30" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl p-4 border border-border/30 bg-card/30">
            <Skeleton className="h-4 w-16 mb-2 bg-muted/30" />
            <Skeleton className="h-6 w-20 bg-muted/30" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl bg-muted/30" />
      <Skeleton className="h-40 w-full rounded-xl bg-muted/30" />
    </div>
  );
}

export default function WalletProfile() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { trackWallet, untrackWallet, isWalletTracked, loading: trackingLoading } = useTrackedWallets();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const isTracked = address ? isWalletTracked(address) : false;

  // Fetch wallet profile data
  const fetchWalletProfile = useCallback(async () => {
    if (!address) return;
    
    try {
      const params = new URLSearchParams({
        address,
        timeframe: '30d'
      });
      
      const response = await fetch(`${WALLET_PROFILE_URL}?${params}`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch profile');
      
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch wallet profile:', error);
    }
  }, [address]);

  // Fetch wallet analytics (PnL data)
  const fetchWalletAnalytics = useCallback(async () => {
    if (!address) return;
    
    try {
      const response = await fetch(WALLET_ANALYTICS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ address })
      });
      
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      setAnalytics({
        pnlData: data.pnlData || [],
        pnlSummary: data.pnlSummary || { totalPnl: 0, winRate: 0, avgTradeSize: 0 }
      });
    } catch (error) {
      console.error('Failed to fetch wallet analytics:', error);
    }
  }, [address]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchWalletProfile(), fetchWalletAnalytics()]);
      setLoading(false);
      setRefreshing(false);
    };
    loadData();
  }, [fetchWalletProfile, fetchWalletAnalytics]);

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchWalletProfile(), fetchWalletAnalytics()]).then(() => {
      setRefreshing(false);
      toast.success('Data refreshed');
    });
  };

  const handleTrackToggle = async () => {
    if (!address || !user) {
      toast.error('Sign in to track wallets');
      return;
    }
    
    if (isTracked) {
      await untrackWallet(address);
      toast.success('Wallet untracked');
    } else {
      await trackWallet(address);
      toast.success('Wallet tracked');
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied');
    }
  };

  // Formatting helpers
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(2)}`;
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

  const formatPnl = (pnl: number) => {
    const prefix = pnl >= 0 ? '+' : '';
    if (Math.abs(pnl) >= 1000000) return `${prefix}$${(pnl / 1000000).toFixed(2)}M`;
    if (Math.abs(pnl) >= 1000) return `${prefix}$${(pnl / 1000).toFixed(1)}K`;
    return `${prefix}$${pnl.toFixed(2)}`;
  };

  // Loading state
  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 cyber-grid-animated opacity-10" />
        <CyberParticles />
        <TopBar />
        <div className="max-w-6xl mx-auto px-4 py-6 pt-20 relative">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  // Not found state
  if (!profile) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 cyber-grid-animated opacity-10" />
        <TopBar />
        <div className="max-w-6xl mx-auto px-4 py-6 pt-20 relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 rounded-2xl border border-border/30 bg-card/30"
          >
            <Wallet className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Wallet not found</h2>
            <p className="text-muted-foreground text-sm mb-6">No trading activity found for this address</p>
            <Button onClick={() => navigate('/leaderboard')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leaderboard
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const displayedTrades = showAllTrades 
    ? profile.recentTrades 
    : profile.recentTrades.slice(0, isMobile ? 20 : 15);

  const totalPnl = analytics?.pnlSummary?.totalPnl || 0;
  const winRate = analytics?.pnlSummary?.winRate || 0;
  const avgTradeSize = analytics?.pnlSummary?.avgTradeSize || (profile.stats.volume / Math.max(profile.stats.trades, 1));

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 cyber-grid-animated opacity-10" />
      <CyberParticles />
      <div className="fixed top-0 left-1/4 w-64 h-64 bg-poly-purple/10 rounded-full blur-[100px]" />
      <div className="fixed bottom-0 right-1/4 w-64 h-64 bg-poly-cyan/10 rounded-full blur-[100px]" />
      
      <TopBar />
      
      {/* How It Works Modal */}
      <WalletHowItWorks open={howItWorksOpen} onOpenChange={setHowItWorksOpen} />
      
      <div className="relative max-w-6xl mx-auto px-4 py-4 md:py-6 pt-16 md:pt-20 pb-24 md:pb-8">
        {/* Back + Actions Row */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between mb-4"
        >
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(-1)}
            className="hover:bg-poly-purple/10 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHowItWorksOpen(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">How it works</span>
            </Button>
            <Link to="/help">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Need help?</span>
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Wallet Header Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 md:p-6 mb-4 border border-border/30 bg-card/50 backdrop-blur-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-poly-purple to-poly-cyan shrink-0">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg md:text-xl font-mono font-bold truncate">
                    {address?.slice(0, isMobile ? 8 : 12)}...{address?.slice(isMobile ? -6 : -8)}
                  </h1>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyAddress}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <a
                      href={`https://polygonscan.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {profile.rank && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-poly-purple/20 to-poly-cyan/20 border border-poly-purple/30">
                      <Trophy className="w-3 h-3 text-poly-cyan" />
                      <span className="text-xs font-medium">Rank #{profile.rank}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50">
                    <Zap className="w-3 h-3 text-poly-pink" />
                    <span className="text-xs text-muted-foreground">30 Day Data</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={isTracked ? "default" : "outline"}
                size="sm"
                onClick={handleTrackToggle}
                disabled={trackingLoading || !user}
                className={cn(
                  isTracked && "bg-gradient-to-r from-poly-purple to-poly-cyan text-white"
                )}
              >
                {isTracked ? (
                  <>
                    <Star className="w-4 h-4 mr-1 fill-current" />
                    Tracked
                  </>
                ) : (
                  <>
                    <StarOff className="w-4 h-4 mr-1" />
                    Track
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid - 2x3 on mobile, 6 cols on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <StatCard 
            title="Volume" 
            value={formatVolume(profile.stats.volume)}
            subtitle="30 day total"
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <StatCard 
            title="Trades" 
            value={profile.stats.trades >= 1000 ? '1000+' : profile.stats.trades.toLocaleString()}
            subtitle={`${profile.stats.buys} buys / ${profile.stats.sells} sells`}
            icon={<Activity className="w-4 h-4" />}
          />
          <StatCard 
            title="Markets" 
            value={profile.stats.markets.toString()}
            subtitle="Unique markets"
            icon={<Layers className="w-4 h-4" />}
          />
          <StatCard 
            title="Total PnL" 
            value={formatPnl(totalPnl)}
            trend={totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'neutral'}
            icon={<BarChart3 className="w-4 h-4" />}
          />
          <StatCard 
            title="Win Rate" 
            value={`${winRate.toFixed(0)}%`}
            trend={winRate >= 50 ? 'up' : 'down'}
            icon={<Target className="w-4 h-4" />}
          />
          <StatCard 
            title="Avg Trade" 
            value={formatVolume(avgTradeSize)}
            subtitle="Per trade"
            icon={<Zap className="w-4 h-4" />}
          />
        </div>

        {/* PnL Chart */}
        {analytics && analytics.pnlData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4"
          >
            <WalletPnlChart 
              series={analytics.pnlData} 
              totalPnl={totalPnl}
              className="w-full"
            />
          </motion.div>
        )}

        {/* Hot Markets */}
        {profile.topMarkets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4"
          >
            <WalletHotMarkets markets={profile.topMarkets} />
          </motion.div>
        )}

        {/* Recent Trades - Extended for mobile */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm"
        >
          <div className="p-4 border-b border-border/30 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Recent Activity</h3>
              <p className="text-xs text-muted-foreground">
                {profile.recentTrades.length} trades in last 30 days
              </p>
            </div>
            {profile.recentTrades.length > displayedTrades.length && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllTrades(!showAllTrades)}
              >
                {showAllTrades ? 'Show less' : `Show all ${profile.recentTrades.length}`}
                <ChevronDown className={cn("w-4 h-4 ml-1 transition-transform", showAllTrades && "rotate-180")} />
              </Button>
            )}
          </div>
          
          <div className={cn(
            "divide-y divide-border/20 overflow-y-auto",
            isMobile ? "max-h-[60vh]" : "max-h-[500px]"
          )}>
            {profile.recentTrades.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No trades found</p>
              </div>
            ) : (
              <AnimatePresence>
                {displayedTrades.map((trade, i) => (
                  <motion.div 
                    key={`${trade.timestamp}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="p-3 md:p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {trade.marketTitle}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className={cn(
                            "flex items-center gap-0.5 font-semibold",
                            trade.side?.toUpperCase() === 'BUY' ? "text-success" : "text-destructive"
                          )}>
                            {trade.side?.toUpperCase() === 'BUY' ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {trade.side?.toUpperCase()} {trade.token_label || ''}
                          </span>
                          <span>•</span>
                          <span>{formatTime(trade.timestamp)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">{formatVolume(trade.volume)}</p>
                        <p className="text-xs text-muted-foreground">
                          @{(trade.price * 100).toFixed(1)}¢
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
          
          {/* Load more button for mobile */}
          {!showAllTrades && profile.recentTrades.length > displayedTrades.length && (
            <div className="p-3 border-t border-border/30">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAllTrades(true)}
              >
                Load {profile.recentTrades.length - displayedTrades.length} more trades
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </motion.div>

        {/* External Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-4 flex flex-wrap gap-2"
        >
          <a
            href={`https://polymarket.com/profile/${address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="text-xs">
              <ExternalLink className="w-3 h-3 mr-1.5" />
              View on Polymarket
            </Button>
          </a>
          <a
            href={`https://polygonscan.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="text-xs">
              <ExternalLink className="w-3 h-3 mr-1.5" />
              View on Polygonscan
            </Button>
          </a>
        </motion.div>
      </div>
    </div>
  );
}
