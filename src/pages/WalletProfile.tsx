import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, ArrowLeft, TrendingUp, Activity, Layers, RefreshCw, ArrowUpRight, ArrowDownRight, Wallet, Target, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const WALLET_PROFILE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-profile`;

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

interface ProfileData {
  address: string;
  stats: WalletStats;
  recentTrades: Trade[];
  topMarkets: TopMarket[];
  rank: number | null;
}

// Cyber particles
function CyberParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
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
            y: [0, -80, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 6 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, gradient }: { 
  title: string; 
  value: string; 
  subtitle?: string;
  icon: React.ReactNode;
  gradient?: string;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-5 relative overflow-hidden group"
    >
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        gradient || "bg-gradient-to-br from-poly-purple/10 to-poly-cyan/10"
      )} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-muted/50 text-poly-cyan">{icon}</div>
          <span className="text-sm text-muted-foreground font-medium">{title}</span>
        </div>
        <div className="text-2xl font-bold gradient-text">{value}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
        )}
      </div>
    </motion.div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-40 bg-muted/30" />
      <div className="glass-card rounded-2xl p-8">
        <Skeleton className="h-10 w-80 mb-3 bg-muted/30" />
        <Skeleton className="h-5 w-48 bg-muted/30" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-5">
            <Skeleton className="h-5 w-24 mb-3 bg-muted/30" />
            <Skeleton className="h-8 w-28 bg-muted/30" />
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl">
          <div className="p-5 border-b border-border/30">
            <Skeleton className="h-6 w-36 bg-muted/30" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border-b border-border/20">
              <Skeleton className="h-5 w-full mb-2 bg-muted/30" />
              <Skeleton className="h-4 w-36 bg-muted/30" />
            </div>
          ))}
        </div>
        <div className="glass-card rounded-xl">
          <div className="p-5 border-b border-border/30">
            <Skeleton className="h-6 w-36 bg-muted/30" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border-b border-border/20">
              <Skeleton className="h-5 w-full bg-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WalletProfile() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWalletProfile = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        address,
        timeframe: '24h'
      });
      
      const response = await fetch(`${WALLET_PROFILE_URL}?${params}`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch wallet profile:', error);
      toast.error('Failed to load wallet profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    fetchWalletProfile();
  }, [fetchWalletProfile]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWalletProfile();
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Wallet address copied');
    }
  };

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

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 cyber-grid-animated opacity-20" />
        <CyberParticles />
        <TopBar />
        <div className="max-w-5xl mx-auto px-4 py-8 pt-20 relative">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="fixed inset-0 cyber-grid-animated opacity-20" />
        <TopBar />
        <div className="max-w-5xl mx-auto px-4 py-8 pt-20 relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 glass-card rounded-2xl"
          >
            <Wallet className="w-20 h-20 text-muted-foreground/30 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-3">Wallet not found</h2>
            <p className="text-muted-foreground mb-6">No trading activity found for this address in the last 24 hours</p>
            <Button onClick={() => navigate('/leaderboard')} className="bg-gradient-to-r from-poly-purple to-poly-cyan text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leaderboard
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 cyber-grid-animated opacity-20" />
      <CyberParticles />
      
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-poly-purple/15 rounded-full blur-[120px] animate-pulse-soft" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-poly-cyan/10 rounded-full blur-[120px] animate-pulse-soft" />
      
      <TopBar />
      
      <div className="relative max-w-5xl mx-auto px-4 py-8 pt-20">
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Button 
            variant="ghost" 
            onClick={() => navigate('/leaderboard')}
            className="mb-6 hover:bg-poly-purple/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leaderboard
          </Button>
        </motion.div>

        {/* Wallet Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8 mb-6 border border-border/30"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-poly-purple to-poly-cyan">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-mono font-bold gradient-text">
                  {address?.slice(0, 10)}...{address?.slice(-8)}
                </h1>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-poly-purple/20" onClick={copyAddress}>
                  <Copy className="w-4 h-4" />
                </Button>
                <a
                  href={`https://polygonscan.com/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-poly-cyan/20 text-muted-foreground hover:text-poly-cyan transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-3">
                {profile.rank && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-poly-purple/20 to-poly-cyan/20 border border-poly-purple/30">
                    <Trophy className="w-4 h-4 text-poly-cyan" />
                    <span className="text-sm font-medium">Rank #{profile.rank}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50">
                  <Zap className="w-4 h-4 text-poly-pink" />
                  <span className="text-sm text-muted-foreground">24 Hour Data</span>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-11 w-11 border-border/50 hover:bg-poly-purple/10 hover:border-poly-purple/50 rounded-xl"
            >
              <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            title="Volume" 
            value={formatVolume(profile.stats.volume)}
            icon={<TrendingUp className="w-4 h-4" />}
            gradient="bg-gradient-to-br from-poly-purple/15 to-transparent"
          />
          <StatCard 
            title="Trades" 
            value={profile.stats.trades.toLocaleString()}
            icon={<Activity className="w-4 h-4" />}
            gradient="bg-gradient-to-br from-poly-cyan/15 to-transparent"
          />
          <StatCard 
            title="Markets" 
            value={profile.stats.markets.toString()}
            icon={<Layers className="w-4 h-4" />}
            gradient="bg-gradient-to-br from-poly-pink/15 to-transparent"
          />
          <StatCard 
            title="Buy Ratio" 
            value={`${profile.stats.buyRatio}%`}
            subtitle={`${profile.stats.buys} buys / ${profile.stats.sells} sells`}
            icon={<Target className="w-4 h-4" />}
            gradient="bg-gradient-to-br from-success/15 to-transparent"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Trades */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-xl border border-border/30"
          >
            <div className="p-5 border-b border-border/30">
              <h3 className="font-semibold text-lg">Recent Activity</h3>
              <p className="text-sm text-muted-foreground">Last 24 hours</p>
            </div>
            <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto">
              {profile.recentTrades.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  No trades in the last 24 hours
                </div>
              ) : (
                profile.recentTrades.map((trade, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">
                          {trade.marketTitle}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className={cn(
                            "flex items-center gap-1 font-semibold",
                            trade.side?.toUpperCase() === 'BUY' ? "text-success" : "text-destructive"
                          )}>
                            {trade.side?.toUpperCase() === 'BUY' ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {trade.side?.toUpperCase() === 'BUY' ? 'YES' : 'NO'}
                          </span>
                          <span>•</span>
                          <span>{formatTime(trade.timestamp)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{formatVolume(trade.volume)}</p>
                        <p className="text-xs text-muted-foreground">
                          @{(trade.price * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Top Markets */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-xl border border-border/30"
          >
            <div className="p-5 border-b border-border/30">
              <h3 className="font-semibold text-lg">Top Markets</h3>
              <p className="text-sm text-muted-foreground">By volume traded</p>
            </div>
            <div className="divide-y divide-border/20">
              {profile.topMarkets.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  No market activity
                </div>
              ) : (
                profile.topMarkets.map((market, i) => (
                  <motion.div 
                    key={market.slug}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm",
                          i === 0 && "bg-gradient-to-br from-yellow-400 to-amber-500 text-black",
                          i === 1 && "bg-gradient-to-br from-slate-300 to-gray-400 text-black",
                          i === 2 && "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
                          i > 2 && "bg-muted/50 text-muted-foreground"
                        )}>
                          {i + 1}
                        </span>
                        <p className="font-medium truncate text-sm">
                          {market.title}
                        </p>
                      </div>
                      <p className="font-bold text-sm whitespace-nowrap gradient-text">
                        {formatVolume(market.volume)}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
