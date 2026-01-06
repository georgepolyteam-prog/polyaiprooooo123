import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Loader2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PolyMarketSidebarProps {
  markets: PolyMarket[];
  selectedMarket: PolyMarket | null;
  onSelectMarket: (market: PolyMarket) => void;
  loading?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function PolyMarketSidebar({
  markets,
  selectedMarket,
  onSelectMarket,
  loading = false,
  collapsed = false,
  onToggleCollapse,
}: PolyMarketSidebarProps) {
  const [search, setSearch] = useState('');

  const filteredMarkets = useMemo(() => {
    if (!search.trim()) return markets;
    const query = search.toLowerCase();
    return markets.filter(m =>
      m.title.toLowerCase().includes(query) ||
      m.question?.toLowerCase().includes(query)
    );
  }, [markets, search]);

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  if (collapsed) {
    return (
      <div className="h-full w-12 bg-card/80 border-r border-border/30 backdrop-blur-xl flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground rotate-90 mt-2">{markets.length}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-72 bg-card/80 border-r border-border/30 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Markets</span>
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {markets.length}
          </span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets..."
            className="pl-9 h-9 text-sm bg-muted/40 border-border/30 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Market List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary/50 animate-spin" />
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No markets found</p>
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="text-xs text-primary hover:underline mt-2"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <AnimatePresence>
              {filteredMarkets.map((market) => (
                <motion.button
                  key={market.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => onSelectMarket(market)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl transition-all',
                    'hover:bg-muted/50',
                    selectedMarket?.id === market.id
                      ? 'bg-primary/10 border border-primary/30 shadow-sm'
                      : 'border border-transparent'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {market.image && (
                      <img
                        src={market.image}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0 shadow-sm"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                        {market.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn(
                          'text-sm font-bold font-mono',
                          market.yesPrice >= 50 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {market.yesPrice}¢
                        </span>
                        {market.yesPrice >= 50 ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                          {formatVolume(market.volume24h || market.volume)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
