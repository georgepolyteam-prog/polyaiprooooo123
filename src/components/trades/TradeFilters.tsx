import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, X, Filter, TrendingUp, TrendingDown, Star, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface TradeFiltersProps {
  filter: 'all' | 'buy' | 'sell';
  setFilter: (filter: 'all' | 'buy' | 'sell') => void;
  minVolume: number;
  setMinVolume: (value: number) => void;
  whalesOnly: boolean;
  setWhalesOnly: (value: boolean) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  tokenFilter: 'all' | 'yes' | 'no';
  setTokenFilter: (value: 'all' | 'yes' | 'no') => void;
  marketFilter: string;
  setMarketFilter: (value: string) => void;
  availableMarkets: string[];
  totalTrades: number;
  hideUpDown: boolean;
  setHideUpDown: (value: boolean) => void;
  trackedOnly?: boolean;
  setTrackedOnly?: (value: boolean) => void;
  hasTrackedWallets?: boolean;
}

export function TradeFilters({
  filter,
  setFilter,
  minVolume,
  setMinVolume,
  whalesOnly,
  setWhalesOnly,
  searchTerm,
  setSearchTerm,
  tokenFilter,
  setTokenFilter,
  marketFilter,
  setMarketFilter,
  availableMarkets,
  totalTrades,
  hideUpDown,
  setHideUpDown,
  trackedOnly = false,
  setTrackedOnly,
  hasTrackedWallets = false
}: TradeFiltersProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(true); // Open by default
  const [minVolumeInput, setMinVolumeInput] = useState(minVolume > 0 ? minVolume.toString() : '');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local input with parent state when parent changes externally
  useEffect(() => {
    setMinVolumeInput(minVolume > 0 ? minVolume.toString() : '');
  }, [minVolume]);

  const handleMinVolumeChange = (value: string) => {
    // Allow only numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    setMinVolumeInput(formatted);
    
    // Debounced realtime update (200ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const parsed = parseFloat(formatted) || 0;
      setMinVolume(parsed);
    }, 200);
  };

  const handleMinVolumeBlur = () => {
    // Immediate apply on blur (clear any pending debounce)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const parsed = parseFloat(minVolumeInput) || 0;
    setMinVolume(parsed);
  };

  return (
    <div className="mb-6 space-y-3">
      {/* Main Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button
          onClick={() => setFilter('all')}
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
          className="min-h-[44px] sm:min-h-[36px]"
        >
          All Trades
        </Button>
        <Button
          onClick={() => setFilter('buy')}
          variant={filter === 'buy' ? 'default' : 'ghost'}
          size="sm"
          className={`min-h-[44px] sm:min-h-[36px] ${filter === 'buy' ? 'bg-success hover:bg-success/90' : ''}`}
        >
          <TrendingUp className="w-4 h-4 mr-1" />
          Buys
        </Button>
        <Button
          onClick={() => setFilter('sell')}
          variant={filter === 'sell' ? 'default' : 'ghost'}
          size="sm"
          className={`min-h-[44px] sm:min-h-[36px] ${filter === 'sell' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
        >
          <TrendingDown className="w-4 h-4 mr-1" />
          Sells
        </Button>

        {/* Whale Toggle with Tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={() => setWhalesOnly(!whalesOnly)}
                  variant={whalesOnly ? 'default' : 'outline'}
                  size="sm"
                  className={`min-h-[44px] sm:min-h-[36px] ${whalesOnly ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : ''}`}
                >
                  🐋 Whales ($1k+)
                </Button>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              <p className="text-sm">Shows trades $1K+ only. Keeps up to <strong>2,000 whale trades</strong> vs 200 regular trades for deeper history and less lag.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Whale mode badge */}
        {whalesOnly && (
          <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
            Up to 2K trades
          </Badge>
        )}

        {/* Tracked Wallets Toggle - Only show if user is logged in */}
        {user && setTrackedOnly && (
          <Button
            onClick={() => setTrackedOnly(!trackedOnly)}
            variant={trackedOnly ? 'default' : 'outline'}
            size="sm"
            className={`min-h-[44px] sm:min-h-[36px] gap-1.5 ${trackedOnly ? 'bg-primary hover:bg-primary/90' : ''}`}
            title={hasTrackedWallets ? "Filter to show only tracked wallet trades" : "Track wallets first to use this filter"}
            disabled={!hasTrackedWallets && !trackedOnly}
          >
            <Star className={`w-3.5 h-3.5 ${trackedOnly ? 'fill-current' : ''}`} />
            Tracked
          </Button>
        )}

        {/* Advanced Filters Toggle */}
        <Button
          onClick={() => setExpanded(!expanded)}
          variant="ghost"
          size="sm"
          className="gap-1 min-h-[44px] sm:min-h-[36px]"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </Button>

        <div className="ml-auto text-xs sm:text-sm text-muted-foreground">
          Showing {totalTrades} of last {whalesOnly ? '2,000' : '200'}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Markets or wallets..."
                    className="pl-10 pr-8 min-h-[44px]"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Min Volume */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Min Volume</label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={minVolumeInput}
                    onChange={(e) => handleMinVolumeChange(e.target.value)}
                    onBlur={handleMinVolumeBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handleMinVolumeBlur()}
                    placeholder="0"
                    className="w-full min-h-[44px]"
                  />
                </div>
              </div>

              {/* Token Type */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Token Type</label>
                <div className="relative">
                  <select
                    value={tokenFilter}
                    onChange={(e) => setTokenFilter(e.target.value as 'all' | 'yes' | 'no')}
                    className="w-full min-h-[44px] px-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer"
                  >
                    <option value="all">All Tokens</option>
                    <option value="yes">YES Tokens</option>
                    <option value="no">NO Tokens</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Market Filter */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Market</label>
                <div className="relative">
                  <select
                    value={marketFilter}
                    onChange={(e) => setMarketFilter(e.target.value)}
                    className="w-full min-h-[44px] px-3 pr-8 rounded-md border border-input bg-background text-sm truncate appearance-none cursor-pointer"
                  >
                    <option value="all">All Markets</option>
                    {availableMarkets.slice(0, 20).map(slug => (
                      <option key={slug} value={slug}>
                        {slug.replace(/-/g, ' ').slice(0, 40)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Hide Up/Down Markets Toggle */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Market Type</label>
                <Button
                  onClick={() => setHideUpDown(!hideUpDown)}
                  variant={hideUpDown ? 'default' : 'outline'}
                  size="sm"
                  className={`w-full min-h-[44px] ${hideUpDown ? 'bg-primary hover:bg-primary/90' : ''}`}
                >
                  {hideUpDown ? '✓ Hiding Up/Down' : 'Hide Up/Down'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
