import type { PolyMarket, Trade, Orderbook } from '@/hooks/usePolymarketTerminal';

interface CachedMarketData {
  orderbook: Orderbook | null;
  trades: Trade[];
  timestamp: number;
}

interface CachedMarketsData {
  markets: PolyMarket[];
  timestamp: number;
}

const MARKETS_CACHE_KEY = 'poly_terminal_markets';
const DATA_CACHE_KEY = 'poly_terminal_data';
const MARKETS_TTL_MS = 10 * 60 * 1000; // 10 minutes for markets list
const DATA_TTL_MS = 30 * 1000; // 30 seconds for orderbook/trades

/**
 * Terminal cache for localStorage persistence
 * - Markets list: 10 minute TTL
 * - Market data (orderbook/trades): 30 second TTL
 */
export const terminalCache = {
  // === MARKETS LIST CACHE ===
  
  getMarkets(): PolyMarket[] | null {
    try {
      const raw = localStorage.getItem(MARKETS_CACHE_KEY);
      if (!raw) return null;
      
      const cached: CachedMarketsData = JSON.parse(raw);
      const age = Date.now() - cached.timestamp;
      
      if (age > MARKETS_TTL_MS) {
        console.log('[TerminalCache] Markets cache expired');
        return null;
      }
      
      console.log(`[TerminalCache] Using cached markets (${cached.markets.length} markets, ${Math.round(age / 1000)}s old)`);
      return cached.markets;
    } catch (err) {
      console.error('[TerminalCache] Failed to read markets cache:', err);
      return null;
    }
  },
  
  setMarkets(markets: PolyMarket[]): void {
    try {
      const data: CachedMarketsData = {
        markets,
        timestamp: Date.now(),
      };
      localStorage.setItem(MARKETS_CACHE_KEY, JSON.stringify(data));
      console.log(`[TerminalCache] Cached ${markets.length} markets`);
    } catch (err) {
      console.error('[TerminalCache] Failed to cache markets:', err);
    }
  },

  // === MARKET DATA CACHE (orderbook/trades) ===
  
  getMarketData(slug: string): CachedMarketData | null {
    try {
      const raw = localStorage.getItem(`${DATA_CACHE_KEY}_${slug}`);
      if (!raw) return null;
      
      const cached: CachedMarketData = JSON.parse(raw);
      const age = Date.now() - cached.timestamp;
      
      if (age > DATA_TTL_MS) {
        console.log(`[TerminalCache] Data cache expired for ${slug}`);
        return null;
      }
      
      console.log(`[TerminalCache] Using cached data for ${slug} (${Math.round(age / 1000)}s old)`);
      return cached;
    } catch (err) {
      console.error('[TerminalCache] Failed to read data cache:', err);
      return null;
    }
  },
  
  setMarketData(slug: string, orderbook: Orderbook | null, trades: Trade[]): void {
    try {
      const data: CachedMarketData = {
        orderbook,
        trades,
        timestamp: Date.now(),
      };
      localStorage.setItem(`${DATA_CACHE_KEY}_${slug}`, JSON.stringify(data));
    } catch (err) {
      console.error('[TerminalCache] Failed to cache market data:', err);
    }
  },
  
  // === PREFETCH SUPPORT ===
  
  /**
   * Prefetch and cache data for multiple markets in parallel
   * Returns the number of markets successfully prefetched
   */
  async prefetchMarkets(
    markets: PolyMarket[],
    fetchFn: (market: PolyMarket) => Promise<{ orderbook: Orderbook | null; trades: Trade[] } | null>
  ): Promise<number> {
    const promises = markets.map(async (market) => {
      // Skip if already cached and fresh
      const existing = this.getMarketData(market.slug);
      if (existing) return false;
      
      try {
        const data = await fetchFn(market);
        if (data) {
          this.setMarketData(market.slug, data.orderbook, data.trades);
          return true;
        }
        return false;
      } catch (err) {
        console.error(`[TerminalCache] Failed to prefetch ${market.slug}:`, err);
        return false;
      }
    });
    
    const results = await Promise.all(promises);
    const prefetched = results.filter(Boolean).length;
    console.log(`[TerminalCache] Prefetched ${prefetched}/${markets.length} markets`);
    return prefetched;
  },

  // === UTILITIES ===
  
  clear(): void {
    try {
      // Clear markets cache
      localStorage.removeItem(MARKETS_CACHE_KEY);
      
      // Clear all data caches (find keys that match our pattern)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(DATA_CACHE_KEY)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log('[TerminalCache] Cache cleared');
    } catch (err) {
      console.error('[TerminalCache] Failed to clear cache:', err);
    }
  },
};
