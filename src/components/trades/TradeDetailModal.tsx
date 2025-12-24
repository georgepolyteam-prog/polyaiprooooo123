import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, TrendingUp, TrendingDown, Activity, BarChart3, Clock, Wallet, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

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
}

export function TradeDetailModal({ trade, onClose }: TradeDetailModalProps) {
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [walletTrades, setWalletTrades] = useState<Trade[]>([]);
  const [walletMetrics, setWalletMetrics] = useState<WalletMetrics | null>(null);
  const [loading, setLoading] = useState(true);

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

  const totalPnL = pnlData?.pnl_over_time?.[pnlData.pnl_over_time.length - 1]?.pnl_to_date || 0;
  const pnlIsPositive = totalPnL >= 0;

  // Format PnL data for chart
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
        className="bg-card border border-border rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border p-4 sm:p-6 flex items-start justify-between gap-4">
          <div className="flex gap-4 flex-1 min-w-0">
            {trade.image && (
              <img 
                src={trade.image} 
                alt={trade.title}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 line-clamp-2">
                {trade.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-muted-foreground text-sm">
                <span className="font-mono text-primary">{trade.user.slice(0, 10)}...{trade.user.slice(-8)}</span>
                <span className="hidden sm:inline">•</span>
                <span>{new Date(trade.timestamp * 1000).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Trade Details Card */}
          <div className="glass-card rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Trade Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <div className="text-muted-foreground text-sm mb-1">Side</div>
                <div className={`text-xl sm:text-2xl font-bold flex items-center gap-2 ${
                  trade.side === 'BUY' ? 'text-success' : 'text-destructive'
                }`}>
                  {trade.side === 'BUY' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  {trade.side} {trade.token_label}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-sm mb-1">Price</div>
                <div className="text-xl sm:text-2xl font-bold text-foreground">${trade.price.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-sm mb-1">Shares</div>
                <div className="text-xl sm:text-2xl font-bold text-foreground">{shares.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-sm mb-1">Volume</div>
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  ${(trade.price * shares).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <a
                href={`https://polymarket.com/event/${trade.market_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm"
              >
                View Market on Polymarket
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
                <div className={`glass-card rounded-xl p-4 sm:p-6 border ${
                  pnlIsPositive ? 'border-success/30' : 'border-destructive/30'
                }`}>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <Target className="w-4 h-4" />
                    Total PnL
                  </div>
                  <div className={`text-xl sm:text-2xl md:text-3xl font-bold ${
                    pnlIsPositive ? 'text-success' : 'text-destructive'
                  }`}>
                    {pnlIsPositive ? '+' : ''}{formatVolume(totalPnL)}
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 sm:p-6">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <BarChart3 className="w-4 h-4" />
                    Total Volume
                  </div>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                    {formatVolume(walletMetrics?.total_volume || 0)}
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 sm:p-6">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <Activity className="w-4 h-4" />
                    Total Trades
                  </div>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                    {walletMetrics?.total_trades || 0}
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 sm:p-6">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <Wallet className="w-4 h-4" />
                    Markets
                  </div>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                    {walletMetrics?.unique_markets || 0}
                  </div>
                </div>
              </div>

              {/* PnL Chart */}
              {chartData.length > 0 && (
                <div className="glass-card rounded-xl p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Profit & Loss Over Time
                  </h3>
                  <div className="h-[250px] sm:h-[300px]">
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
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `$${value}`}
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
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Recent Trades ({walletTrades.length})
                  </h3>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {walletTrades.slice(0, 20).map((t, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-foreground font-medium truncate text-sm sm:text-base">{t.title}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                              {new Date(t.timestamp * 1000).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 sm:gap-4">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
