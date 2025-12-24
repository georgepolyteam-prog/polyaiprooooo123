import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Copy, ExternalLink, Users, RefreshCw, Trophy, Sparkles, Crown, Medal, Award } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(40)].map((_, i) => (
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
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-[0_0_12px_rgba(250,204,21,0.4)]">
        <Crown className="w-5 h-5 text-yellow-900" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.4)]">
        <Medal className="w-4 h-4 text-slate-700" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_10px_rgba(217,119,6,0.4)]">
        <Award className="w-4 h-4 text-amber-100" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-10 h-10">
      <span className="text-base font-bold font-mono text-muted-foreground">#{rank}</span>
    </div>
  );
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-border/30">
      <div className="p-6 border-b border-border/30">
        <div className="flex gap-4">
          <Skeleton className="h-5 w-16 bg-muted/30" />
          <Skeleton className="h-5 w-40 bg-muted/30" />
          <Skeleton className="h-5 w-24 ml-auto bg-muted/30" />
        </div>
      </div>
      {[...Array(10)].map((_, i) => (
        <div key={i} className="p-5 border-b border-border/20 last:border-0">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full bg-muted/30" />
            <Skeleton className="h-5 w-36 bg-muted/30" />
            <Skeleton className="h-5 w-24 ml-auto bg-muted/30" />
            <Skeleton className="h-5 w-20 bg-muted/30" />
            <Skeleton className="h-9 w-24 bg-muted/30" />
          </div>
        </div>
      ))}
    </div>
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

  const navigate = useNavigate();

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      // Always use 24h timeframe
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
    toast.success('Wallet address copied');
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
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative overflow-hidden">
      {/* Animated background layers */}
      <div className="fixed inset-0 cyber-grid-animated opacity-20" />
      <CyberParticles />
      
      {/* Ambient glow orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-poly-purple/20 rounded-full blur-[120px] animate-pulse-soft" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-poly-cyan/15 rounded-full blur-[120px] animate-pulse-soft" />
      <div className="fixed top-1/2 right-0 w-64 h-64 bg-poly-pink/10 rounded-full blur-[100px] animate-pulse-soft" />
      
      <TopBar />
      
      <div className="relative max-w-6xl mx-auto px-4 py-8 pt-20">
        {/* Premium Header */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6 border border-poly-purple/30">
            <div className="w-2 h-2 rounded-full bg-poly-cyan animate-pulse" />
            <span className="text-sm text-muted-foreground">Live 24h Activity</span>
            {lastUpdated && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-xs text-muted-foreground/70">Updated {lastUpdated}</span>
              </>
            )}
          </div>
          
          <div className="flex items-center justify-center gap-4 mb-4">
            <motion.div 
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="p-3 rounded-2xl bg-gradient-to-br from-poly-purple via-poly-cyan to-poly-pink shadow-glow-lg"
            >
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>
          <h1 className="text-5xl font-bold gradient-text-animated">
            24H Activity
          </h1>
            <Sparkles className="w-8 h-8 text-poly-cyan animate-pulse" />
          </div>
          
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Most active wallets from 20,000 recent trades
          </p>
        </motion.div>

        {/* Search & Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col md:flex-row gap-4 mb-8"
        >
          <div className="flex flex-1 gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-poly-cyan transition-colors" />
              <Input
                placeholder="Search any wallet address (0x...)"
                value={searchWallet}
                onChange={(e) => setSearchWallet(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchWalletAddress()}
                className="pl-12 h-12 text-base bg-card/50 border-border/50 focus:border-poly-purple/50 focus:ring-2 focus:ring-poly-purple/20 rounded-xl transition-all"
              />
            </div>
            <Button 
              onClick={searchWalletAddress} 
              className="h-12 px-6 bg-gradient-to-r from-poly-purple to-poly-cyan hover:opacity-90 text-white border-0 rounded-xl shadow-glow"
            >
              <Search className="w-5 h-5 mr-2" />
              Search
            </Button>
          </div>

          <div className="flex gap-3">
            <Select
              value={minVolume.toString()}
              onValueChange={(value) => setMinVolume(parseInt(value))}
            >
              <SelectTrigger className="w-[160px] h-12 bg-card/50 border-border/50 rounded-xl">
                <SelectValue placeholder="Min Volume" />
              </SelectTrigger>
              <SelectContent className="glass-card border-border/50">
                <SelectItem value="0">All Volume</SelectItem>
                <SelectItem value="100">$100+</SelectItem>
                <SelectItem value="500">$500+</SelectItem>
                <SelectItem value="1000">$1K+</SelectItem>
                <SelectItem value="5000">$5K+</SelectItem>
                <SelectItem value="10000">$10K+</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-12 w-12 border-border/50 hover:bg-poly-purple/10 hover:border-poly-purple/50 rounded-xl"
            >
              <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
            </Button>
          </div>
        </motion.div>

        {/* Leaderboard Table */}
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
              <Users className="w-20 h-20 text-muted-foreground/30 mx-auto mb-6" />
              <h3 className="text-2xl font-semibold mb-3">No traders found</h3>
              <p className="text-muted-foreground">Try adjusting your volume filter</p>
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card rounded-2xl overflow-hidden border border-border/30"
            >
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      <th className="w-16 p-3 text-center text-sm font-semibold text-muted-foreground">Rank</th>
                      <th className="p-3 text-left text-sm font-semibold text-muted-foreground">Wallet</th>
                      <th className="w-24 p-3 text-right text-sm font-semibold text-muted-foreground">Volume</th>
                      <th className="w-16 p-3 text-right text-sm font-semibold text-muted-foreground hidden sm:table-cell">Trades</th>
                      <th className="w-16 p-3 text-right text-sm font-semibold text-muted-foreground hidden md:table-cell">Markets</th>
                      <th className="w-24 p-3 text-center text-sm font-semibold text-muted-foreground hidden lg:table-cell">Buy/Sell</th>
                      <th className="w-20 p-3 text-center text-sm font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((trader, index) => (
                      <motion.tr 
                        key={trader.wallet}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.015 }}
                        className={cn(
                          "border-b border-border/20 last:border-0 hover:bg-muted/5 transition-colors",
                          trader.rank <= 3 && "bg-gradient-to-r from-poly-purple/5 to-transparent"
                        )}
                      >
                        <td className="p-3">
                          <div className="flex justify-center">
                            <RankBadge rank={trader.rank} />
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => navigate(`/wallet/${trader.wallet}?timeframe=24h`)}
                            className="font-mono text-sm text-poly-cyan hover:text-poly-purple transition-colors truncate"
                          >
                            {trader.wallet.slice(0, 6)}...{trader.wallet.slice(-4)}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <span className={cn(
                            "font-bold",
                            trader.rank === 1 && "text-yellow-400",
                            trader.rank === 2 && "text-slate-300",
                            trader.rank === 3 && "text-amber-500",
                            trader.rank > 3 && "text-foreground"
                          )}>
                            {formatVolume(trader.volume)}
                          </span>
                        </td>
                        <td className="p-3 text-right hidden sm:table-cell">
                          <span className="text-muted-foreground text-sm">{formatNumber(trader.trades)}</span>
                        </td>
                        <td className="p-3 text-right hidden md:table-cell">
                          <span className="text-muted-foreground text-sm">{trader.markets}</span>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <div className="flex items-center justify-center gap-1 text-xs">
                            <span className="text-success font-medium">{trader.buyRatio}%</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-destructive">{100 - trader.buyRatio}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-poly-purple/20 hover:text-poly-purple"
                              onClick={() => copyWallet(trader.wallet)}
                              title="Copy wallet"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-poly-cyan/20 hover:text-poly-cyan"
                              onClick={() => navigate(`/wallet/${trader.wallet}?timeframe=24h`)}
                              title="View profile"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
