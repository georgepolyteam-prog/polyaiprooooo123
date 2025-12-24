import { useMemo, useState } from "react";
import { X, ExternalLink, Filter, Fish, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TradePanel } from "./TradePanel";

interface MarketDataPanelProps {
  data: {
    market: {
      question: string;
      odds: number;
      volume: number;
      liquidity: number;
      url: string;
      tokenId?: string;
      noTokenId?: string;
      conditionId?: string;
    };
    whales: Array<{
      id: string;
      wallet: string;
      side: string;
      amount: number;
      price: number;
      timeAgo: string;
    }>;
    orderbook: {
      bids: Array<{ price: number; size: number }>;
      asks: Array<{ price: number; size: number }>;
      spread: number;
      bidTotal: number;
      askTotal: number;
    };
    priceHistory: Array<{ date: string; price: number }>;
    recentTrades: Array<{
      id: string;
      side: string;
      size: number;
      price: number;
      timeAgo: string;
      wallet?: string;
      isWhale?: boolean;
      isNew?: boolean;
    }>;
    tradeStats: {
      buyPressure: number;
      sellPressure: number;
      netFlow: number;
      totalCount?: number;
      largestTrade?: number;
      buyVolume?: number;
      sellVolume?: number;
      totalVolume24h?: number;
      yesVolume24h?: number;
      noVolume24h?: number;
      uniqueTraders24h?: number;
      largestTrades?: Array<{
        id: string;
        side: string;
        size: number;
        price: number;
        timeAgo: string;
        wallet?: string;
        isWhale?: boolean;
      }>;
    };
    topTraders?: Array<{
      address: string;
      totalVolume: number;
      tradeCount: number;
      winRate: number;
      lastTrade: string;
    }>;
    arbitrage: {
      isMultiMarket: boolean;
      marketCount: number;
      totalProbability: number;
      hasArbitrage: boolean;
    };
  };
  onClose: () => void;
}

const formatVolume = (vol: number) => {
  const absVol = Math.abs(vol);
  const sign = vol < 0 ? '-' : '';
  if (absVol >= 1000000) return `${sign}$${(absVol / 1000000).toFixed(1)}M`;
  if (absVol >= 1000) return `${sign}$${(absVol / 1000).toFixed(0)}K`;
  return `${sign}$${absVol.toFixed(0)}`;
};

const formatWallet = (wallet: string) => {
  if (!wallet || wallet.length < 10) return wallet || 'Unknown';
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

// Whale threshold: trades >= $500 are considered whale trades
const WHALE_THRESHOLD = 500;

export function MarketDataPanel({ data, onClose }: MarketDataPanelProps) {
  const [tradeFilter, setTradeFilter] = useState<'all' | 'whales' | 'yes' | 'no'>('all');
  const [expanded, setExpanded] = useState(false);
  
  const priceChange = data.priceHistory.length > 1
    ? data.priceHistory[data.priceHistory.length - 1].price - data.priceHistory[0].price
    : 0;

  const priceHigh = data.priceHistory.length > 0
    ? Math.max(...data.priceHistory.map(p => p.price))
    : 0;

  const priceLow = data.priceHistory.length > 0
    ? Math.min(...data.priceHistory.map(p => p.price))
    : 0;

  // Check for price data inconsistency (current odds should be within chart range)
  const priceDataMismatch = useMemo(() => {
    if (data.priceHistory.length === 0) return false;
    const currentOdds = data.market.odds;
    return currentOdds < priceLow - 10 || currentOdds > priceHigh + 10;
  }, [data.market.odds, data.priceHistory, priceHigh, priceLow]);

  // Mark trades as whales based on size threshold
  const tradesWithWhaleFlag = useMemo(() => {
    return data.recentTrades.map((trade, index) => ({
      ...trade,
      isWhale: trade.size >= WHALE_THRESHOLD,
      isNew: index < 3 // First 3 trades are "new"
    }));
  }, [data.recentTrades]);

  // Filter trades based on selected filter
  const filteredTrades = useMemo(() => {
    return tradesWithWhaleFlag.filter(trade => {
      if (tradeFilter === 'whales') return trade.isWhale;
      if (tradeFilter === 'yes') return trade.side === 'BUY';
      if (tradeFilter === 'no') return trade.side === 'SELL';
      return true;
    });
  }, [tradesWithWhaleFlag, tradeFilter]);

  // Display trades (expanded or first 8)
  const displayedTrades = expanded ? filteredTrades : filteredTrades.slice(0, 8);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b sticky top-0 bg-background z-10">
        {/* Data source attribution */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span className="inline-flex items-center gap-1.5">
            Powered by{" "}
            <a
              href="https://domeapi.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-poly-cyan underline underline-offset-2 decoration-poly-cyan/50 hover:decoration-poly-cyan transition-colors"
              aria-label="Powered by domeapi.io (opens in a new tab)"
            >
              domeapi.io
              <ExternalLink className="w-3 h-3" />
            </a>
          </span>
          <span>Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base leading-tight line-clamp-2">{data.market.question}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-bold text-primary">{data.market.odds.toFixed(1)}%</span>
              <span className="text-muted-foreground">{formatVolume(data.market.volume)}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Trade Activity - Dashboard Style */}
        <section className="bg-card border rounded-lg p-3">
          {/* Volume Summary - Using full 24h data from dashboard */}
          {(data.tradeStats.totalVolume24h || data.tradeStats.totalCount) && (
            <div className="mb-3 pb-3 border-b">
              <h3 className="font-semibold text-sm mb-2">Volume Summary (24h)</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">
                    {data.tradeStats.uniqueTraders24h 
                      ? `${data.tradeStats.uniqueTraders24h} traders` 
                      : `${data.tradeStats.totalCount || 0} trades`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-foreground">
                    {formatVolume(data.tradeStats.totalVolume24h || (data.tradeStats.buyVolume || 0) + (data.tradeStats.sellVolume || 0))} total
                  </span>
                </div>
                <div>
                  <span className="text-success">
                    {formatVolume(data.tradeStats.yesVolume24h || data.tradeStats.buyVolume || 0)} YES
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-destructive">
                    {formatVolume(data.tradeStats.noVolume24h || data.tradeStats.sellVolume || 0)} NO
                  </span>
                </div>
              </div>
              {/* Net Flow */}
              <div className="mt-2 pt-2 border-t border-border/50 text-center">
                <span className={cn(
                  "font-semibold text-xs",
                  (data.tradeStats.yesVolume24h || 0) - (data.tradeStats.noVolume24h || 0) > 0 ? 'text-success' : 'text-destructive'
                )}>
                  {(data.tradeStats.yesVolume24h || 0) - (data.tradeStats.noVolume24h || 0) > 0 ? '+' : ''}
                  {formatVolume((data.tradeStats.yesVolume24h || data.tradeStats.buyVolume || 0) - (data.tradeStats.noVolume24h || data.tradeStats.sellVolume || 0))} net flow
                </span>
              </div>
            </div>
          )}

          {/* Filter Buttons - Dashboard Style */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Live Trades</h3>
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-muted-foreground mr-1" />
              {(['all', 'whales', 'yes', 'no'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTradeFilter(f)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1",
                    tradeFilter === f 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === 'whales' ? (
                    <>
                      <Fish className="w-3 h-3" />
                      Whales
                    </>
                  ) : f === 'yes' ? (
                    'Yes'
                  ) : f === 'no' ? (
                    'No'
                  ) : (
                    'All'
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {displayedTrades.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-foreground">No trades match filter</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different filter</p>
            </div>
          ) : (
            <>
              {/* Trade List - Dashboard Style */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {displayedTrades.map(trade => (
                  <div 
                    key={trade.id} 
                    className={cn(
                      "flex items-center justify-between py-2 px-2 rounded-lg transition-colors",
                      trade.isNew && "bg-accent/10",
                      trade.isWhale && "border border-warning/30 bg-warning/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {trade.isNew && (
                        <span className="text-[9px] text-accent font-bold flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          NEW
                        </span>
                      )}
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                        trade.side === 'BUY' 
                          ? "bg-success/20 text-success" 
                          : "bg-destructive/20 text-destructive"
                      )}>
                        {trade.side === 'BUY' ? 'YES' : 'NO'}
                      </span>
                      <span className="font-mono font-bold text-xs">{formatVolume(trade.size)}</span>
                      <span className="text-muted-foreground text-[10px]">@</span>
                      <span className="font-mono text-xs">{trade.price.toFixed(1)}%</span>
                      {trade.isWhale && <Fish className="w-3 h-3 text-warning" />}
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {trade.wallet && (
                        <span className="font-mono">{formatWallet(trade.wallet)}</span>
                      )}
                      <span>{trade.timeAgo}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expand/Collapse Button */}
              {filteredTrades.length > 8 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="w-full mt-2 h-7 text-xs"
                >
                  {expanded ? (
                    <>Show Less <ChevronUp className="w-3 h-3 ml-1" /></>
                  ) : (
                    <>Show {filteredTrades.length - 8} More <ChevronDown className="w-3 h-3 ml-1" /></>
                  )}
                </Button>
              )}
              
              {/* Buy/Sell Pressure */}
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-success">Yes: {data.tradeStats.buyPressure.toFixed(0)}%</span>
                  <span className="text-destructive">No: {(100 - data.tradeStats.buyPressure).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-destructive/30 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-success transition-all duration-500" 
                    style={{ width: `${data.tradeStats.buyPressure}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </section>


        {/* Order Book */}
        <section className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Live Order Book</h3>
            <span className="text-xs text-muted-foreground">
              Spread: {data.orderbook.spread.toFixed(2)}%
            </span>
          </div>
          
          {data.orderbook.bids.length === 0 && data.orderbook.asks.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-foreground">Order book data unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">This market may have low liquidity or data is still loading</p>
            </div>
          ) : (
            <>
              {(() => {
                const maxBidSize = Math.max(...data.orderbook.bids.map(b => b.size), 1);
                const maxAskSize = Math.max(...data.orderbook.asks.map(a => a.size), 1);
                const totalBidDepth = data.orderbook.bids.reduce((sum, b) => sum + b.size, 0);
                const totalAskDepth = data.orderbook.asks.reduce((sum, a) => sum + a.size, 0);
                const midPrice = data.orderbook.bids.length > 0 && data.orderbook.asks.length > 0
                  ? (data.orderbook.bids[0].price + data.orderbook.asks[0].price) / 2
                  : data.market.odds;
                
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Bids */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                          <span>BIDS (Buy YES)</span>
                          <span className="text-success">{formatVolume(totalBidDepth)}</span>
                        </div>
                        <div className="space-y-1">
                          {data.orderbook.bids.slice(0, 6).map((bid, i) => (
                            <div key={i} className="relative">
                              <div 
                                className="absolute inset-y-0 left-0 bg-success/20 rounded"
                                style={{ width: `${(bid.size / maxBidSize) * 100}%` }}
                              />
                              <div className="relative flex justify-between px-2 py-1 text-xs">
                                <span className="text-success font-mono">{bid.price.toFixed(1)}%</span>
                                <span className="text-muted-foreground">{formatVolume(bid.size)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Asks */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                          <span className="text-destructive">{formatVolume(totalAskDepth)}</span>
                          <span>ASKS (Sell YES)</span>
                        </div>
                        <div className="space-y-1">
                          {data.orderbook.asks.slice(0, 6).map((ask, i) => (
                            <div key={i} className="relative">
                              <div 
                                className="absolute inset-y-0 right-0 bg-destructive/20 rounded"
                                style={{ width: `${(ask.size / maxAskSize) * 100}%` }}
                              />
                              <div className="relative flex justify-between px-2 py-1 text-xs">
                                <span className="text-muted-foreground">{formatVolume(ask.size)}</span>
                                <span className="text-destructive font-mono">{ask.price.toFixed(1)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-6 text-xs">
                      <div className="text-center">
                        <div className="text-muted-foreground">Mid Price</div>
                        <div className="font-bold">{midPrice.toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Total Depth</div>
                        <div className="font-bold">{formatVolume(totalBidDepth + totalAskDepth)}</div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </section>

        {/* Price Chart */}
        <section className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Price History (7d)</h3>
              <div className={cn(
                "text-xs font-medium",
                priceChange >= 0 ? "text-success" : "text-destructive"
              )}>
                {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(1)}%
              </div>
            </div>
          </div>
          
          {data.priceHistory.length > 0 ? (
            <>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.priceHistory}>
                    <defs>
                      <linearGradient id="priceGradientSidebar" x1="0" y1="0" x2="0" y2="1">
                        <stop 
                          offset="5%" 
                          stopColor={priceChange >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} 
                          stopOpacity={0.3}
                        />
                        <stop 
                          offset="95%" 
                          stopColor={priceChange >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} 
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                    />
                    <YAxis 
                      domain={[Math.max(0, priceLow - 5), Math.min(100, priceHigh + 5)]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                      width={35}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Price']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke={priceChange >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} 
                      strokeWidth={2}
                      fill="url(#priceGradientSidebar)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <div>
                  <div className="text-muted-foreground">Current Price</div>
                  <div className="font-bold">{data.market.odds.toFixed(1)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">7d High / Low</div>
                  <div className="font-mono">
                    {priceHigh.toFixed(1)}% / {priceLow.toFixed(1)}%
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-foreground">Price history unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">Historical data may start from Oct 14, 2025</p>
            </div>
          )}
        </section>

        {/* Trade Panel */}
        <section>
          <TradePanel 
            marketData={{
              tokenId: data.market.tokenId,
              yesTokenId: data.market.tokenId, // YES token (tokenId is the YES token)
              noTokenId: data.market.noTokenId, // NO token
              conditionId: data.market.conditionId,
              title: data.market.question,
              currentPrice: data.market.odds / 100,
              url: data.market.url,
              eventSlug: data.market.url ? (() => { try { return new URL(data.market.url).pathname.split('/')[2]; } catch { return undefined; } })() : undefined,
              marketSlug: data.market.url ? (() => { try { return new URL(data.market.url).pathname.split('/')[3]; } catch { return undefined; } })() : undefined,
            }}
          />
        </section>

      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-muted/30">
        <a 
          href={data.market.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
        >
          View on Polymarket
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
