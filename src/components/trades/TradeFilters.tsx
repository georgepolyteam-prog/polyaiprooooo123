import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, X, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  totalTrades
}: TradeFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-6 space-y-3">
      {/* Main Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => setFilter('all')}
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
        >
          All Trades
        </Button>
        <Button
          onClick={() => setFilter('buy')}
          variant={filter === 'buy' ? 'default' : 'ghost'}
          size="sm"
          className={filter === 'buy' ? 'bg-success hover:bg-success/90' : ''}
        >
          <TrendingUp className="w-4 h-4 mr-1" />
          Buys
        </Button>
        <Button
          onClick={() => setFilter('sell')}
          variant={filter === 'sell' ? 'default' : 'ghost'}
          size="sm"
          className={filter === 'sell' ? 'bg-destructive hover:bg-destructive/90' : ''}
        >
          <TrendingDown className="w-4 h-4 mr-1" />
          Sells
        </Button>

        {/* Whale Toggle */}
        <Button
          onClick={() => setWhalesOnly(!whalesOnly)}
          variant={whalesOnly ? 'default' : 'outline'}
          size="sm"
          className={whalesOnly ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : ''}
        >
          🐋 Whales Only
        </Button>

        {/* Advanced Filters Toggle */}
        <Button
          onClick={() => setExpanded(!expanded)}
          variant="ghost"
          size="sm"
          className="gap-1"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </Button>

        <div className="ml-auto text-sm text-muted-foreground">
          {totalTrades} trades
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
            <div className="p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search markets or wallets..."
                  className="pl-10 pr-8"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Min Volume */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Min Volume</label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={minVolume}
                    onChange={(e) => setMinVolume(Number(e.target.value))}
                    placeholder="0"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Token Type */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Token Type</label>
                <select
                  value={tokenFilter}
                  onChange={(e) => setTokenFilter(e.target.value as 'all' | 'yes' | 'no')}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">All Outcomes</option>
                  <option value="yes">Yes Only</option>
                  <option value="no">No Only</option>
                </select>
              </div>

              {/* Market Filter */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Market</label>
                <select
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm truncate"
                >
                  <option value="all">All Markets</option>
                  {availableMarkets.slice(0, 20).map(slug => (
                    <option key={slug} value={slug}>
                      {slug.replace(/-/g, ' ').slice(0, 40)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
