import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, TrendingUp, TrendingDown, Flame, ChevronRight, X, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDflowApi, type KalshiMarket, type KalshiEvent } from '@/hooks/useDflowApi';
import { useDflowWebSocket, type PriceUpdate } from '@/hooks/useDflowWebSocket';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface KalshiMarketSidebarProps {
  selectedTicker?: string;
  onSelectMarket: (market: KalshiMarket) => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function KalshiMarketSidebar({
  selectedTicker,
  onSelectMarket,
  className,
  collapsed = false,
  onToggleCollapse,
}: KalshiMarketSidebarProps) {
  const { getEvents, searchEvents, loading } = useDflowApi();
  const [markets, setMarkets] = useState<KalshiMarket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('kalshi-favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  // Get top market tickers for WebSocket
  const topTickers = useMemo(() => 
    markets.slice(0, 20).map(m => m.ticker), 
    [markets]
  );

  // WebSocket for live prices
  useDflowWebSocket({
    tickers: topTickers,
    channels: ['prices'],
    onPriceUpdate: (update: PriceUpdate) => {
      setLivePrices(prev => ({
        ...prev,
        [update.ticker]: update.yesBid,
      }));
    },
  });

  // Fetch markets - no mock fallback
  const fetchMarkets = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const events = await getEvents('active');
      const allMarkets: KalshiMarket[] = [];
      
      events.forEach((event: KalshiEvent) => {
        if (event.markets) {
          event.markets.forEach(market => {
            if (!market.title && event.title) {
              market.title = event.title;
            }
            allMarkets.push(market);
          });
        }
      });
      
      // Sort by volume
      allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      setMarkets(allMarkets);
    } catch (err) {
      console.error('Failed to fetch markets:', err);
      setMarkets([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [getEvents]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('kalshi-favorites', JSON.stringify([...favorites]));
  }, [favorites]);

  // Toggle favorite
  const toggleFavorite = (ticker: string) => {
    setFavorites(prev => {
      const newFavs = new Set(prev);
      if (newFavs.has(ticker)) {
        newFavs.delete(ticker);
      } else {
        newFavs.add(ticker);
      }
      return newFavs;
    });
  };

  // Filter and sort markets
  const filteredMarkets = useMemo(() => {
    let result = markets.filter(m => {
      const status = (m.status || '').toLowerCase();
      return status === 'active' || status === 'initialized' || !status;
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m =>
        (m.title || '').toLowerCase().includes(query) ||
        (m.subtitle || '').toLowerCase().includes(query) ||
        (m.ticker || '').toLowerCase().includes(query)
      );
    }

    // Favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.ticker);
      const bFav = favorites.has(b.ticker);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return (b.volume || 0) - (a.volume || 0);
    });

    return result.slice(0, 100);
  }, [markets, searchQuery, favorites]);

  // Format volume
  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol}`;
  };

  if (collapsed) {
    return (
      <div className={cn(
        'w-12 bg-card/30 border-r border-border/30 flex flex-col items-center py-4',
        className
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="mb-4"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        {filteredMarkets.slice(0, 8).map((market, idx) => (
          <button
            key={market.ticker}
            onClick={() => onSelectMarket(market)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center mb-2 text-xs font-bold transition-all',
              selectedTicker === market.ticker
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      'w-72 bg-card/30 border-r border-border/30 flex flex-col',
      className
    )}>
      {/* Header */}
      <div className="p-3 border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Markets</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchMarkets}
              disabled={isRefreshing}
              className="h-7 w-7"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            </Button>
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="h-7 w-7"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/40 border-border/30"
          />
        </div>
      </div>

      {/* Markets list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <AnimatePresence mode="popLayout">
            {filteredMarkets.map((market) => {
              const livePrice = livePrices[market.ticker];
              const price = livePrice ?? market.yesPrice;
              const isSelected = selectedTicker === market.ticker;
              const isFavorite = favorites.has(market.ticker);

              return (
                <motion.button
                  key={market.ticker}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={() => onSelectMarket(market)}
                  className={cn(
                    'w-full p-2.5 rounded-lg text-left transition-all group',
                    isSelected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted/50 border border-transparent'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs font-medium line-clamp-2 leading-snug',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {market.title}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn(
                          'text-sm font-bold font-mono',
                          price >= 50 ? 'text-emerald-500' : 'text-red-500'
                        )}>
                          {price}¢
                        </span>
                        
                        {market.volume > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" />
                            {formatVolume(market.volume)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(market.ticker);
                      }}
                      className={cn(
                        'p-1 rounded transition-colors',
                        isFavorite
                          ? 'text-yellow-500'
                          : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-yellow-500'
                      )}
                    >
                      <Star className={cn('w-3.5 h-3.5', isFavorite && 'fill-current')} />
                    </button>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
          
          {filteredMarkets.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No markets found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
