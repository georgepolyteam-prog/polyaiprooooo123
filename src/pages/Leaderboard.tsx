import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Copy, ExternalLink, Users, RefreshCw, Trophy, Sparkles, Crown, Medal, Award, HelpCircle, TrendingUp, BarChart3, Zap, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const LEADERBOARD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/leaderboard`;

interface Trader {
  rank: number;
  wallet: string;
  volume: number;
  trades: number;
  markets: number;
  buys: number;
  sells: number;
  buyRatio: number;
}

interface Stats {
  totalVolume: number;
  totalTrades: number;
  totalTraders: number;
  timeframe: string;
}

// Animated cyber particles
function CyberParticles() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? 'hsl(var(--poly-purple))' : i % 3 === 1 ? 'hsl(var(--poly-cyan))' : 'hsl(var(--poly-pink))',
            boxShadow: i % 3 === 0 ? '0 0 10px hsl(var(--poly-purple))' : i % 3 === 1 ? '0 0 10px hsl(var(--poly-cyan))' : '0 0 10px hsl(var(--poly-pink))',
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
}

// Compact rank badge
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <motion.div 
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="relative"
      >
        <div className="absolute inset-0 bg-yellow-500 blur-md opacity-50" />
        <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/30">
          <Crown className="w-5 h-5 text-yellow-900" />
        </div>
      </motion.div>
    );
  }
  if (rank === 2) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-slate-400 blur-md opacity-30" />
        <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg">
          <Medal className="w-4 h-4 text-slate-700" />
        </div>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-orange-500 blur-md opacity-30" />
        <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
          <Award className="w-4 h-4 text-amber-100" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/30 border border-border/50">
      <span className="text-sm font-bold font-mono text-muted-foreground">#{rank}</span>
    </div>
  );
}

// Sick loading skeleton with shimmer
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative overflow-hidden rounded-xl bg-card/50 border border-border/30 p-4"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            />
            <div className="h-4 w-16 bg-muted/50 rounded mb-2 animate-pulse" />
            <div className="h-7 w-24 bg-muted/30 rounded animate-pulse" />
          </motion.div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="glass-card rounded-2xl overflow-hidden border border-border/30">
        {/* Header */}
        <div className="p-4 border-b border-border/30 bg-muted/5">
          <div className="flex gap-4">
            <div className="h-4 w-12 bg-muted/40 rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted/40 rounded animate-pulse" />
            <div className="h-4 w-20 ml-auto bg-muted/40 rounded animate-pulse" />
          </div>
        </div>

        {/* Rows */}
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            className="relative p-4 border-b border-border/20 last:border-0"
          >
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
            />
            
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className={cn(
                "w-10 h-10 rounded-full animate-pulse",
                i < 3 ? "bg-gradient-to-br from-yellow-500/30 to-orange-500/30" : "bg-muted/30"
              )} />
              
              {/* Wallet */}
              <div className="flex-1">
                <div className="h-5 w-28 bg-muted/40 rounded mb-1 animate-pulse" />
                <div className="h-3 w-16 bg-muted/20 rounded animate-pulse md:hidden" />
              </div>
              
              {/* Stats */}
              <div className="hidden md:flex gap-8">
                <div className="h-5 w-16 bg-muted/30 rounded animate-pulse" />
                <div className="h-5 w-12 bg-muted/30 rounded animate-pulse" />
                <div className="h-5 w-10 bg-muted/30 rounded animate-pulse" />
              </div>
              
              {/* Actions */}
              <div className="h-8 w-16 bg-muted/30 rounded animate-pulse" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Loading Indicator */}
      <motion.div
        className="flex items-center justify-center gap-3 py-6"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Zap className="w-5 h-5 text-primary" />
        </motion.div>
        <span className="text-sm text-muted-foreground">Loading leaderboard...</span>
      </motion.div>
    </div>
  );
}

// Stats Card Component
function StatsCard({ icon: Icon, label, value, gradient }: { 
  icon: React.ElementType; 
  label: string; 
  value: string;
  gradient: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl bg-card/50 border border-border/30 p-4 backdrop-blur-sm"
    >
      <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-br", gradient)} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl md:text-2xl font-bold">{value}</p>
      </div>
    </motion.div>
  );
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchWallet, setSearchWallet] = useState('');
  const [minVolume, setMinVolume] = useState(0);
  const [stats, setStats] = useState<Stats>({
    totalVolume: 0,
    totalTrades: 0,
    totalTraders: 0,
    timeframe: '24h'
  });
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cached, error: cacheError } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .eq('timeframe', '24h')
        .eq('min_volume', 0)
        .single();

      if (!cacheError && cached?.data) {
        const cachedData = cached.data as any;
        
        const filteredLeaderboard = (cachedData.leaderboard || [])
          .filter((t: Trader) => t.volume >= minVolume)
          .map((t: Trader, i: number) => ({ ...t, rank: i + 1 }));
        
        setLeaderboard(filteredLeaderboard);
        setStats({
          totalVolume: cachedData.totalVolume || 0,
          totalTrades: cachedData.totalTrades || 0,
          totalTraders: cachedData.totalTraders || 0,
          timeframe: '24h'
        });
        
        const updatedAt = new Date(cached.updated_at);
        const minutesAgo = Math.floor((Date.now() - updatedAt.getTime()) / 60000);
        if (minutesAgo < 1) {
          setLastUpdated('just now');
        } else if (minutesAgo < 60) {
          setLastUpdated(`${minutesAgo}m ago`);
        } else {
          const hoursAgo = Math.floor(minutesAgo / 60);
          setLastUpdated(`${hoursAgo}h ago`);
        }
        
        setLoading(false);
        setRefreshing(false);
        return;
      }

      await fetchLiveLeaderboard();
      
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      toast.error('Failed to load leaderboard');
      setLoading(false);
      setRefreshing(false);
    }
  }, [minVolume]);

  const fetchLiveLeaderboard = async () => {
    try {
      const params = new URLSearchParams({
        timeframe: '24h',
        min_volume: minVolume.toString(),
        limit: '100'
      });
      
      const response = await fetch(`${LEADERBOARD_URL}?${params}`, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      
      setLeaderboard(data.leaderboard || []);
      setStats(data.stats || {
        totalVolume: 0,
        totalTrades: 0,
        totalTraders: 0,
        timeframe: '24h'
      });
      setLastUpdated('live');
    } catch (error) {
      console.error('Failed to fetch live leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const searchWalletAddress = () => {
    const wallet = searchWallet.trim();
    if (!wallet) return;
    
    if (wallet.length < 10) {
      toast.error('Please enter a valid wallet address');
      return;
    }
    
    navigate(`/wallet/${wallet}?timeframe=24h`);
  };

  const copyWallet = (wallet: string) => {
    navigator.clipboard.writeText(wallet);
    setCopiedWallet(wallet);
    toast.success('Wallet copied!');
    setTimeout(() => setCopiedWallet(null), 2000);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 cyber-grid-animated opacity-10" />
      <CyberParticles />
      
      {/* Ambient glow orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px] animate-pulse" />
      
      <TopBar />
      
      <div className="relative max-w-6xl mx-auto px-4 py-8 pt-20 pb-24">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div 
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="relative"
              >
                <div className="absolute inset-0 bg-yellow-500 blur-xl opacity-30" />
                <div className="relative p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                </div>
              </motion.div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    Live 24h • {lastUpdated && `Updated ${lastUpdated}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/help')}
                className="text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          {!loading && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatsCard
                icon={DollarSign}
                label="Total Volume"
                value={formatVolume(stats.totalVolume)}
                gradient="from-green-500 to-emerald-500"
              />
              <StatsCard
                icon={BarChart3}
                label="Total Trades"
                value={formatNumber(stats.totalTrades)}
                gradient="from-blue-500 to-cyan-500"
              />
              <StatsCard
                icon={Users}
                label="Active Traders"
                value={formatNumber(stats.totalTraders)}
                gradient="from-purple-500 to-pink-500"
              />
              <StatsCard
                icon={TrendingUp}
                label="Timeframe"
                value="24h"
                gradient="from-orange-500 to-red-500"
              />
            </div>
          )}

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex flex-1 gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search wallet address..."
                  value={searchWallet}
                  onChange={(e) => setSearchWallet(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchWalletAddress()}
                  className="pl-10 bg-card/50 border-border/50"
                />
              </div>
              <Button 
                onClick={searchWalletAddress} 
                className="gap-2"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </div>

            <Select
              value={minVolume.toString()}
              onValueChange={(value) => setMinVolume(parseInt(value))}
            >
              <SelectTrigger className="w-full md:w-40 bg-card/50 border-border/50">
                <SelectValue placeholder="Min Volume" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Volume</SelectItem>
                <SelectItem value="100">$100+</SelectItem>
                <SelectItem value="500">$500+</SelectItem>
                <SelectItem value="1000">$1K+</SelectItem>
                <SelectItem value="5000">$5K+</SelectItem>
                <SelectItem value="10000">$10K+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingSkeleton />
            </motion.div>
          ) : leaderboard.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 glass-card rounded-2xl border border-border/30"
            >
              <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No traders found</h3>
              <p className="text-muted-foreground">Try adjusting your volume filter</p>
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl overflow-hidden border border-border/30"
            >
              {/* Table Header - Desktop */}
              <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-border/30 bg-muted/5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-4">Wallet</div>
                <div className="col-span-2 text-right">Volume</div>
                <div className="col-span-2 text-right">Trades</div>
                <div className="col-span-1 text-right">Markets</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-border/20">
                {leaderboard.map((trader, index) => (
                  <motion.div 
                    key={trader.wallet}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "grid grid-cols-12 gap-4 p-4 items-center cursor-pointer",
                      "hover:bg-muted/10 transition-colors",
                      trader.rank <= 3 && "bg-gradient-to-r from-primary/5 to-transparent"
                    )}
                    onClick={() => navigate(`/wallet/${trader.wallet}?timeframe=24h`)}
                  >
                    {/* Rank */}
                    <div className="col-span-3 md:col-span-1 flex justify-center">
                      <RankBadge rank={trader.rank} />
                    </div>

                    {/* Wallet */}
                    <div className="col-span-9 md:col-span-4">
                      <span className="font-mono text-sm hover:text-primary transition-colors">
                        {trader.wallet.slice(0, 6)}...{trader.wallet.slice(-4)}
                      </span>
                      <div className="md:hidden mt-1 text-xs text-muted-foreground">
                        {formatVolume(trader.volume)} • {trader.trades} trades
                      </div>
                    </div>

                    {/* Volume - Desktop */}
                    <div className="hidden md:block col-span-2 text-right">
                      <span className={cn(
                        "font-bold",
                        trader.rank === 1 && "text-yellow-400",
                        trader.rank === 2 && "text-slate-300",
                        trader.rank === 3 && "text-amber-500",
                        trader.rank > 3 && "text-green-500"
                      )}>
                        {formatVolume(trader.volume)}
                      </span>
                    </div>

                    {/* Trades - Desktop */}
                    <div className="hidden md:block col-span-2 text-right text-muted-foreground">
                      {formatNumber(trader.trades)}
                    </div>

                    {/* Markets - Desktop */}
                    <div className="hidden md:block col-span-1 text-right text-muted-foreground">
                      {trader.markets}
                    </div>

                    {/* Actions */}
                    <div className="hidden md:flex col-span-2 justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyWallet(trader.wallet);
                        }}
                      >
                        <Copy className={cn(
                          "w-3.5 h-3.5",
                          copiedWallet === trader.wallet && "text-green-500"
                        )} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/wallet/${trader.wallet}?timeframe=24h`);
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
