import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.52.0";

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

// ============= DEEP RESEARCH API =============
const DEEP_RESEARCH_API_KEY = Deno.env.get("DEEP_RESEARCH_API_KEY");

async function getDeepResearch(query: string): Promise<{ answer: string; citations?: any[] } | null> {
  if (!DEEP_RESEARCH_API_KEY) {
    console.log("[DeepResearch] API key not configured");
    return null;
  }
  
  try {
    console.log(`[DeepResearch] Starting research for: ${query.substring(0, 100)}...`);
    const response = await fetch('https://deep-research-api.thekid-solana.workers.dev/answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DEEP_RESEARCH_API_KEY
      },
      body: JSON.stringify({
        query: query,
        text: true
      })
    });

    if (!response.ok) {
      console.error(`[DeepResearch] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.success) {
      console.error(`[DeepResearch] Failed: ${data.error || 'Unknown error'}`);
      return null;
    }

    console.log(`[DeepResearch] ✅ Success, received ${data.data?.answer?.length || 0} chars`);
    return data.data;
  } catch (error) {
    console.error("[DeepResearch] Error:", error);
    return null;
  }
}

// ============= DOME API CLIENT (DIRECT FETCH) =============
const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
const DOME_API_BASE = "https://api.domeapi.io/v1";

interface DomeMarket {
  market_slug: string;
  condition_id: string;
  title: string;
  start_time: number;
  end_time: number;
  completed_time: number | null;
  close_time: number | null;
  tags: string[];
  volume_1_week: number;
  volume_1_month: number;
  volume_1_year: number;
  volume_total: number;
  resolution_source: string;
  image: string;
  side_a: {
    id: string;
    label: string;
  };
  side_b: {
    id: string;
    label: string;
  };
  winning_side: string | null;
  status: "open" | "closed";
}

// Helper to interpret Dome market state
function getDomeMarketState(market: DomeMarket): { 
  isActive: boolean; 
  isResolved: boolean; 
  isClosed: boolean; 
  statusText: string;
  winner: string | null;
} {
  const isResolved = market.winning_side !== null;
  const isActive = market.status === "open";
  const isClosed = market.status === "closed" && !isResolved;
  
  let statusText: string;
  if (isActive) {
    statusText = "ACTIVE - Currently Trading";
  } else if (isResolved) {
    statusText = `RESOLVED - Winner: ${market.winning_side}`;
  } else {
    statusText = "CLOSED - Awaiting Resolution";
  }
  
  return { isActive, isResolved, isClosed, statusText, winner: market.winning_side };
}

interface DomeMarketPrice {
  token_id: string;
  price: number;
  timestamp: number;
}

// Direct fetch-based client (SDK has Deno-incompatible dependencies)
class DomeClient {
  private headers: Record<string, string>;
  
  constructor() {
    this.headers = DOME_API_KEY 
      ? { "Authorization": `Bearer ${DOME_API_KEY}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
    console.log(`[Dome] Initialized with direct fetch, API key: ${DOME_API_KEY ? 'configured' : 'MISSING'}`);
  }

  async getMarketBySlug(slug: string): Promise<DomeMarket | null> {
    if (!DOME_API_KEY) {
      console.log("[Dome] API key not configured, skipping lookup");
      return null;
    }
    
    try {
      console.log(`[Dome] Fetching market: ${slug}`);
      const response = await fetch(
        `${DOME_API_BASE}/polymarket/markets?market_slug=${encodeURIComponent(slug)}&limit=1`,
        { headers: this.headers }
      );
      
      if (!response.ok) {
        console.error(`[Dome] Markets API error: ${response.status} ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      console.log(`[Dome] Response:`, JSON.stringify(data).substring(0, 500));
      
      if (data?.markets && Array.isArray(data.markets) && data.markets.length > 0) {
        const market = data.markets[0];
        if (market && market.title && market.status !== undefined) {
          console.log(`[Dome] ✅ Found market: ${market.title}`);
          return market as DomeMarket;
        }
      }
      
      console.log(`[Dome] ⚠️ No markets found for slug: ${slug}`);
      return null;
    } catch (error) {
      console.error("[Dome] Error fetching market:", error);
      return null;
    }
  }

  async getMarketPrice(tokenId: string): Promise<DomeMarketPrice | null> {
    if (!DOME_API_KEY) return null;
    
    try {
      console.log(`[Dome] Fetching price for token: ${tokenId}`);
      // FIXED: Use singular endpoint with path param, same as dashboard
      const response = await fetch(
        `${DOME_API_BASE}/polymarket/market-price/${encodeURIComponent(tokenId)}`,
        { headers: this.headers }
      );
      
      if (!response.ok) {
        console.error(`[Dome] Price API error: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      console.log(`[Dome] Got price: ${data?.price}`);
      return {
        token_id: tokenId,
        price: data?.price ?? 0,
        timestamp: data?.at_time ?? Date.now() / 1000
      } as DomeMarketPrice;
    } catch (error) {
      console.error("[Dome] Error fetching price:", error);
      return null;
    }
  }

  async searchMarkets(query: string, limit: number = 10): Promise<DomeMarket[]> {
    if (!DOME_API_KEY) return [];
    
    try {
      console.log(`[Dome] Searching markets for: ${query}`);
      const response = await fetch(
        `${DOME_API_BASE}/polymarket/markets?status=open&limit=${limit}`,
        { headers: this.headers }
      );
      
      if (!response.ok) {
        console.error(`[Dome] Search API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      const markets = data?.markets || [];
      return markets.filter((m: any) => 
        m.title?.toLowerCase().includes(query.toLowerCase()) ||
        m.market_slug?.toLowerCase().includes(query.toLowerCase())
      ) as DomeMarket[];
    } catch (error) {
      console.error("[Dome] Error searching markets:", error);
      return [];
    }
  }

  async getTradeHistory(params: {
    market_slug?: string;
    condition_id?: string;
    token_id?: string;
    start_time?: number;
    end_time?: number;
    limit?: number;
    use24hFilter?: boolean;  // NEW: Default 24h filter to match dashboard
  }): Promise<any[]> {
    if (!DOME_API_KEY) return [];
    
    try {
      const queryParams = new URLSearchParams();
      if (params.market_slug) queryParams.append('market_slug', params.market_slug);
      if (params.condition_id) queryParams.append('condition_id', params.condition_id);
      if (params.token_id) queryParams.append('token_id', params.token_id);
      
      // Apply 24h filter by default (matching market-dashboard logic)
      const use24h = params.use24hFilter !== false;
      if (use24h && !params.start_time) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const oneDayAgoSeconds = nowSeconds - 86400;
        queryParams.append('start_time', oneDayAgoSeconds.toString());
        queryParams.append('end_time', nowSeconds.toString());
        console.log(`[Dome] 24h filter applied: ${new Date(oneDayAgoSeconds * 1000).toISOString()} to now`);
      } else if (params.start_time) {
        queryParams.append('start_time', params.start_time.toString());
      }
      if (params.end_time && !use24h) {
        queryParams.append('end_time', params.end_time.toString());
      }
      
      queryParams.append('limit', (params.limit || 100).toString());
      
      console.log(`[Dome] Fetching orders for: ${params.market_slug || params.token_id || 'all'} (24h=${use24h})`);
      
      const response = await fetch(
        `${DOME_API_BASE}/polymarket/orders?${queryParams.toString()}`,
        { headers: this.headers }
      );
      
      if (!response.ok) {
        console.error(`[Dome] Orders API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      const orders = data?.orders || [];
      console.log(`[Dome] ✅ Fetched ${orders.length} orders (24h filtered)`);
      return orders;
    } catch (error) {
      console.error("[Dome] Error fetching orders:", error);
      return [];
    }
  }

  async getWhaleActivity(marketSlug: string, minSize: number = 1000): Promise<{
    whaleCount: number;
    totalWhaleVolume: number;
    buyVolume: number;
    sellVolume: number;
    largestTrade: number;
    topWhales: Array<{ user: string; volume: number; tradeCount: number }>;
  }> {
    if (!DOME_API_KEY) {
      return { whaleCount: 0, totalWhaleVolume: 0, buyVolume: 0, sellVolume: 0, largestTrade: 0, topWhales: [] };
    }
    
    try {
      console.log(`[Dome] Calculating whale activity for: ${marketSlug} (min: $${minSize})`);
      
      const orders = await this.getTradeHistory({ market_slug: marketSlug, limit: 1000, use24hFilter: true });
      
      if (orders.length === 0) {
        console.log(`[Dome] No orders found for whale calculation`);
        return { whaleCount: 0, totalWhaleVolume: 0, buyVolume: 0, sellVolume: 0, largestTrade: 0, topWhales: [] };
      }
      
      // Filter for whale trades
      const whaleTrades = orders.filter((order: any) => {
        const shares = parseFloat(order.shares_normalized || order.shares || 0);
        const price = parseFloat(order.price || 0);
        return (shares * price) >= minSize;
      });
      
      console.log(`[Dome] ✅ Identified ${whaleTrades.length} whale trades (>$${minSize})`);
      
      const buyTrades = whaleTrades.filter((t: any) => (t.side || '').toUpperCase() === 'BUY');
      const sellTrades = whaleTrades.filter((t: any) => (t.side || '').toUpperCase() === 'SELL');
      
      const calcVolume = (trades: any[]) => trades.reduce((sum: number, t: any) => {
        const shares = parseFloat(t.shares_normalized || t.shares || 0);
        const price = parseFloat(t.price || 0);
        return sum + (shares * price);
      }, 0);
      
      const buyVolume = calcVolume(buyTrades);
      const sellVolume = calcVolume(sellTrades);
      
      // Group by user
      const whalesByUser = new Map<string, { volume: number; tradeCount: number }>();
      whaleTrades.forEach((trade: any) => {
        const user = trade.user || trade.taker || 'unknown';
        const shares = parseFloat(trade.shares_normalized || trade.shares || 0);
        const price = parseFloat(trade.price || 0);
        const volume = shares * price;
        
        const existing = whalesByUser.get(user) || { volume: 0, tradeCount: 0 };
        whalesByUser.set(user, {
          volume: existing.volume + volume,
          tradeCount: existing.tradeCount + 1
        });
      });
      
      const topWhales = Array.from(whalesByUser.entries())
        .map(([user, data]) => ({ user, ...data }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);
      
      const largestTrade = whaleTrades.length > 0
        ? Math.max(...whaleTrades.map((t: any) => {
            const shares = parseFloat(t.shares_normalized || t.shares || 0);
            const price = parseFloat(t.price || 0);
            return shares * price;
          }))
        : 0;
      
      return {
        whaleCount: whaleTrades.length,
        totalWhaleVolume: buyVolume + sellVolume,
        buyVolume,
        sellVolume,
        largestTrade,
        topWhales
      };
    } catch (error) {
      console.error("[Dome] Error calculating whale activity:", error);
      return { whaleCount: 0, totalWhaleVolume: 0, buyVolume: 0, sellVolume: 0, largestTrade: 0, topWhales: [] };
    }
  }

  async getComprehensiveMarketData(marketSlug: string): Promise<{
    market: DomeMarket | null;
    priceA: DomeMarketPrice | null;
    priceB: DomeMarketPrice | null;
    recentTrades: any[];
    tradeFlow: { 
      direction: string; strength: number; buyCount: number; sellCount: number; 
      buyVolume: number; sellVolume: number; netFlow: number; buyPressure: number; totalTrades: number;
      // NEW: Token-based volume matching sidebar
      yesVolume24h: number; noVolume24h: number; totalVolume24h: number; uniqueTraders24h: number;
    };
    whales: { 
      whaleCount: number;
      totalWhaleVolume: number;
      buyVolume: number;
      sellVolume: number;
      largestTrade: number;
      topWhale: { user: string; volume: number } | null;
      isWhaleActive: boolean 
    };
    volatility: { weeklySwing: number; isVolatile: boolean };
    priceHistory: { current: number; sevenDaysAgo: number; change7d: number; high7d: number; low7d: number; trend: string } | null;
    metadata: { dataSource: string; tradeCount: number; lastUpdate: number; dataFreshness: string };
  } | null> {
    if (!DOME_API_KEY) return null;

    try {
      console.log(`[Dome] Fetching comprehensive data for: ${marketSlug}`);

      const [market, recentTrades, whaleData] = await Promise.all([
        this.getMarketBySlug(marketSlug),
        this.getTradeHistory({ market_slug: marketSlug, limit: 1000, use24hFilter: true }), // Match sidebar (24h filter)
        this.getWhaleActivity(marketSlug, 1000)
      ]);

      if (!market) {
        console.log(`[Dome] ❌ Market not found: ${marketSlug}`);
        return null;
      }

      let priceA: DomeMarketPrice | null = null;
      let priceB: DomeMarketPrice | null = null;
      
      if (market.side_a?.id) {
        priceA = await this.getMarketPrice(market.side_a.id);
      }
      if (market.side_b?.id) {
        priceB = await this.getMarketPrice(market.side_b.id);
      }
      
      // Fetch candlesticks for price history
      let priceHistory: { current: number; sevenDaysAgo: number; change7d: number; high7d: number; low7d: number; trend: string } | null = null;
      if (market.condition_id || market.side_a?.id) {
        const candlesticks = await this.getCandlesticks(market.condition_id, market.side_a?.id);
        if (candlesticks.length > 1) {
          const prices = candlesticks.map((c: any) => parseFloat(c.close || c.price || 0)).filter((p: number) => p > 0);
          if (prices.length > 1) {
            const current = prices[prices.length - 1] * 100;
            const sevenDaysAgo = prices[0] * 100;
            const change7d = current - sevenDaysAgo;
            const high7d = Math.max(...prices) * 100;
            const low7d = Math.min(...prices) * 100;
            const trend = change7d > 2 ? 'RISING' : change7d < -2 ? 'FALLING' : 'STABLE';
            priceHistory = { current, sevenDaysAgo, change7d, high7d, low7d, trend };
            console.log(`[Dome] ✅ Price history: ${sevenDaysAgo.toFixed(1)}% → ${current.toFixed(1)}% (${change7d > 0 ? '+' : ''}${change7d.toFixed(1)}%)`);
          }
        }
      }


      // Filter dust trades (< $0.10 or < 0.1% price) - matching market-dashboard logic
      const validTrades = recentTrades.filter((t: any) => {
        const shares = parseFloat(t.shares_normalized || t.shares || 0);
        const price = parseFloat(t.price || 0);
        const usdValue = shares * price;
        return usdValue >= 0.10 && price >= 0.001;
      });
      
      console.log(`[Dome] Filtered ${recentTrades.length} -> ${validTrades.length} valid trades (removed ${recentTrades.length - validTrades.length} dust)`);
      
      // Get token IDs for YES/NO volume calculation (matching market-dashboard)
      const yesTokenId = market.side_a?.id;
      const noTokenId = market.side_b?.id;
      
      // Calculate YES/NO volume by token_id (matching sidebar exactly)
      let yesVolume24h = 0;
      let noVolume24h = 0;
      const uniqueTraders = new Set<string>();
      
      validTrades.forEach((t: any) => {
        const shares = parseFloat(t.shares_normalized || t.shares || 0);
        const price = parseFloat(t.price || 0);
        const usdValue = shares * price;
        
        // Track unique traders
        if (t.user) uniqueTraders.add(t.user);
        
        // Sum volume by token_id (NOT by BUY/SELL - this is the key fix!)
        if (t.token_id === yesTokenId) {
          yesVolume24h += usdValue;
        } else if (t.token_id === noTokenId) {
          noVolume24h += usdValue;
        }
      });
      
      const totalVolume24h = yesVolume24h + noVolume24h;
      const uniqueTraders24h = uniqueTraders.size;
      
      // Calculate trade flow stats matching market-dashboard
      const recentFlow = validTrades.slice(0, 100);
      const buyTrades = recentFlow.filter((t: any) => (t.side || '').toUpperCase() === 'BUY');
      const sellTrades = recentFlow.filter((t: any) => (t.side || '').toUpperCase() === 'SELL');
      const totalTrades = recentFlow.length;
      
      // Calculate volumes in USD (for buy/sell flow, separate from YES/NO)
      const calcUsdVolume = (trades: any[]) => trades.reduce((sum: number, t: any) => {
        const shares = parseFloat(t.shares_normalized || t.shares || 0);
        const price = parseFloat(t.price || 0);
        return sum + (shares * price);
      }, 0);
      
      const buyVolume = calcUsdVolume(buyTrades);
      const sellVolume = calcUsdVolume(sellTrades);
      const netFlow = buyVolume - sellVolume;
      
      // Calculate pressure (count-based like market-dashboard)
      const buyPressure = totalTrades > 0 ? (buyTrades.length / totalTrades) * 100 : 50;
      const flowDirection = buyPressure > 55 ? "BUYING" : buyPressure < 45 ? "SELLING" : "NEUTRAL";
      const flowStrength = totalTrades > 0 ? Math.abs(buyTrades.length - sellTrades.length) / totalTrades : 0;

      let volatility = 0;
      if (validTrades.length > 5) {
        const prices = validTrades.slice(0, 50)
          .map((t: any) => parseFloat(t.price || 0))
          .filter((p: number) => p > 0 && p < 1);
        if (prices.length > 1) {
          volatility = Math.max(...prices) - Math.min(...prices);
        }
      }

      const now = Date.now() / 1000;
      const latestTradeTime = validTrades[0]?.timestamp || now;
      const dataFreshness = `${Math.floor(now - latestTradeTime)}s ago`;

      // Verification logging - should match sidebar numbers
      console.log('[VOLUME VERIFY] ============================================');
      console.log(`[VOLUME VERIFY] Market: ${marketSlug}`);
      console.log(`[VOLUME VERIFY] YES Volume (24h): $${(yesVolume24h / 1000).toFixed(1)}K`);
      console.log(`[VOLUME VERIFY] NO Volume (24h): $${(noVolume24h / 1000).toFixed(1)}K`);
      console.log(`[VOLUME VERIFY] Total Volume (24h): $${(totalVolume24h / 1000).toFixed(1)}K`);
      console.log(`[VOLUME VERIFY] Math check: ${(yesVolume24h + noVolume24h).toFixed(0)} = ${totalVolume24h.toFixed(0)} ✓`);
      console.log(`[VOLUME VERIFY] Unique traders: ${uniqueTraders24h}`);
      console.log('[VOLUME VERIFY] ============================================');
      
      console.log('[Dome] ✅ Comprehensive data fetched:');
      console.log(`[Dome]    - ${validTrades.length} valid trades (24h)`);
      console.log(`[Dome]    - Buy pressure: ${buyPressure.toFixed(0)}%`);
      console.log(`[Dome]    - Net flow: $${netFlow.toFixed(2)}`);
      console.log(`[Dome]    - ${whaleData.whaleCount} whale trades`);
      console.log(`[Dome]    - Data freshness: ${dataFreshness}`);

      return {
        market,
        priceA,
        priceB,
        recentTrades: validTrades,
        tradeFlow: { 
          direction: flowDirection, 
          strength: flowStrength, 
          buyCount: buyTrades.length, 
          sellCount: sellTrades.length,
          buyVolume,
          sellVolume,
          netFlow,
          buyPressure: Math.round(buyPressure),
          totalTrades,
          // Token-based volume (matches sidebar exactly)
          yesVolume24h,
          noVolume24h,
          totalVolume24h,
          uniqueTraders24h
        },
        whales: {
          whaleCount: whaleData.whaleCount,
          totalWhaleVolume: whaleData.totalWhaleVolume,
          buyVolume: whaleData.buyVolume,
          sellVolume: whaleData.sellVolume,
          largestTrade: whaleData.largestTrade,
          topWhale: whaleData.topWhales[0] || null,
          isWhaleActive: whaleData.whaleCount > 5
        },
        volatility: { weeklySwing: volatility, isVolatile: volatility > 0.15 },
        priceHistory,
        metadata: { dataSource: 'dome-fetch', tradeCount: validTrades.length, lastUpdate: now, dataFreshness }
      };
    } catch (error) {
      console.error("[Dome] Error fetching comprehensive data:", error);
      return null;
    }
  }

  // Get markets by event slug using Dome API's event_slug parameter (for multi-outcome events)
  async getMarketsByEvent(eventSlug: string, limit: number = 50): Promise<DomeMarket[]> {
    if (!DOME_API_KEY) return [];
    
    try {
      console.log(`[Dome] Fetching markets by event_slug: ${eventSlug}`);
      const response = await fetch(
        `${DOME_API_BASE}/polymarket/markets?event_slug=${encodeURIComponent(eventSlug)}&limit=${limit}`,
        { headers: this.headers }
      );
      
      if (!response.ok) {
        console.error(`[Dome] Event markets API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      const markets = data?.markets || [];
      console.log(`[Dome] ✅ Found ${markets.length} markets for event via event_slug`);
      return markets as DomeMarket[];
    } catch (error) {
      console.error("[Dome] Error fetching event markets:", error);
      return [];
    }
  }

  // Get related markets for the same event (fallback with keyword matching)
  async getRelatedMarkets(eventSlug: string, limit: number = 20): Promise<DomeMarket[]> {
    if (!DOME_API_KEY) return [];
    
    // First try the proper event_slug parameter
    const eventMarkets = await this.getMarketsByEvent(eventSlug, limit);
    if (eventMarkets.length > 0) {
      return eventMarkets;
    }
    
    // Fallback to keyword matching
    try {
      console.log(`[Dome] Fallback: keyword matching for event: ${eventSlug}`);
      const response = await fetch(
        `${DOME_API_BASE}/polymarket/markets?status=open&limit=${limit}`,
        { headers: this.headers }
      );
      
      if (!response.ok) {
        console.error(`[Dome] Related markets API error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      const markets = data?.markets || [];
      
      // Filter markets related to the same event
      const eventKeywords = eventSlug.toLowerCase().replace(/-/g, ' ').split(' ')
        .filter((w: string) => w.length > 3);
      
      const related = markets.filter((m: DomeMarket) => {
        const slug = m.market_slug?.toLowerCase() || '';
        const title = m.title?.toLowerCase() || '';
        const matchCount = eventKeywords.filter((kw: string) => 
          slug.includes(kw) || title.includes(kw)
        ).length;
        return matchCount >= Math.ceil(eventKeywords.length * 0.4);
      });
      
      console.log(`[Dome] ✅ Found ${related.length} related markets via keyword matching`);
      return related as DomeMarket[];
    } catch (error) {
      console.error("[Dome] Error fetching related markets:", error);
      return [];
    }
  }

  // Calculate momentum for a market (price change over time)
  async calculateMomentum(marketSlug: string): Promise<{
    change1h: number;
    change24h: number;
    direction: string;
    velocity: number;
  }> {
    if (!DOME_API_KEY) {
      return { change1h: 0, change24h: 0, direction: 'NEUTRAL', velocity: 0 };
    }
    
    try {
      console.log(`[Dome] Calculating momentum for: ${marketSlug}`);
      const trades = await this.getTradeHistory({ market_slug: marketSlug, limit: 500 });
      
      if (trades.length < 2) {
        return { change1h: 0, change24h: 0, direction: 'NEUTRAL', velocity: 0 };
      }
      
      const now = Date.now() / 1000;
      const oneHourAgo = now - 3600;
      const oneDayAgo = now - 86400;
      
      // Get prices at different time points
      const latestPrice = parseFloat(trades[0]?.price || 0.5);
      
      const trades1hAgo = trades.filter((t: any) => t.timestamp && t.timestamp <= oneHourAgo);
      const price1hAgo = trades1hAgo.length > 0 ? parseFloat(trades1hAgo[0]?.price || latestPrice) : latestPrice;
      
      const trades24hAgo = trades.filter((t: any) => t.timestamp && t.timestamp <= oneDayAgo);
      const price24hAgo = trades24hAgo.length > 0 ? parseFloat(trades24hAgo[0]?.price || latestPrice) : latestPrice;
      
      const change1h = (latestPrice - price1hAgo) * 100;
      const change24h = (latestPrice - price24hAgo) * 100;
      
      const direction = change1h > 2 ? 'BULLISH' : change1h < -2 ? 'BEARISH' : 'NEUTRAL';
      const velocity = Math.abs(change1h) + Math.abs(change24h) / 24;
      
      console.log(`[Dome] ✅ Momentum: ${change1h.toFixed(2)}% (1h), ${change24h.toFixed(2)}% (24h)`);
      
      return { change1h, change24h, direction, velocity };
    } catch (error) {
      console.error("[Dome] Error calculating momentum:", error);
      return { change1h: 0, change24h: 0, direction: 'NEUTRAL', velocity: 0 };
    }
  }

  // Calculate trade flow metrics (net buying/selling)
  async calculateTradeFlow(marketSlug: string, timeWindowHours: number = 24): Promise<{
    netFlow: number;
    buyVolume: number;
    sellVolume: number;
    buyCount: number;
    sellCount: number;
    imbalance: number;
    signal: string;
  }> {
    if (!DOME_API_KEY) {
      return { netFlow: 0, buyVolume: 0, sellVolume: 0, buyCount: 0, sellCount: 0, imbalance: 0, signal: 'NEUTRAL' };
    }
    
    try {
      console.log(`[Dome] Calculating trade flow for: ${marketSlug} (${timeWindowHours}h)`);
      const trades = await this.getTradeHistory({ market_slug: marketSlug, limit: 500 });
      
      const now = Date.now() / 1000;
      const cutoff = now - (timeWindowHours * 3600);
      
      const recentTrades = trades.filter((t: any) => !t.timestamp || t.timestamp > cutoff);
      
      let buyVolume = 0, sellVolume = 0, buyCount = 0, sellCount = 0;
      
      recentTrades.forEach((t: any) => {
        const shares = parseFloat(t.shares_normalized || t.shares || t.size || 0);
        const price = parseFloat(t.price || 0);
        const volume = shares * price;
        
        if ((t.side || '').toUpperCase() === 'BUY') {
          buyVolume += volume;
          buyCount++;
        } else {
          sellVolume += volume;
          sellCount++;
        }
      });
      
      const netFlow = buyVolume - sellVolume;
      const totalVolume = buyVolume + sellVolume;
      const imbalance = totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
      
      const signal = imbalance > 0.2 ? 'BUY_PRESSURE' : imbalance < -0.2 ? 'SELL_PRESSURE' : 'BALANCED';
      
      console.log(`[Dome] ✅ Trade flow: $${netFlow.toFixed(0)} net, ${signal}`);
      
      return { netFlow, buyVolume, sellVolume, buyCount, sellCount, imbalance, signal };
    } catch (error) {
      console.error("[Dome] Error calculating trade flow:", error);
      return { netFlow: 0, buyVolume: 0, sellVolume: 0, buyCount: 0, sellCount: 0, imbalance: 0, signal: 'NEUTRAL' };
    }
  }

  // Fetch candlesticks for price history
  async getCandlesticks(conditionId: string, tokenId?: string): Promise<any[]> {
    if (!DOME_API_KEY) return [];
    
    try {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const sevenDaysAgoSeconds = nowSeconds - (7 * 24 * 60 * 60);
      
      // Use tokenId if available, otherwise use conditionId
      const id = tokenId || conditionId;
      console.log(`[Dome] Fetching candlesticks for: ${id}`);
      
      const response = await fetch(
        `${DOME_API_BASE}/polymarket/candlesticks/${encodeURIComponent(id)}?start_time=${sevenDaysAgoSeconds}&end_time=${nowSeconds}&interval=1440`,
        { headers: this.headers }
      );
      
      if (!response.ok) {
        console.log(`[Dome] Candlesticks API returned ${response.status}, trying alternative`);
        return [];
      }
      
      const data = await response.json();
      const candlesticks = data?.candlesticks || data || [];
      console.log(`[Dome] ✅ Fetched ${candlesticks.length} candlesticks`);
      return candlesticks;
    } catch (error) {
      console.error("[Dome] Error fetching candlesticks:", error);
      return [];
    }
  }

  async testConnection(testMarketSlug: string = 'brazil-presidential-election'): Promise<{ markets: boolean; orders: boolean; whales: boolean; details: string[] }> {
    console.log('🧪 [TEST] Starting Dome API connection test...');
    console.log(`[TEST] Using direct fetch (no SDK)`);
    console.log(`[TEST] Test market slug: ${testMarketSlug}`);
    
    const results: string[] = [];
    let marketsOk = false;
    let ordersOk = false;
    let whalesOk = false;
    
    // Test 1: Get market
    console.log(`[TEST] Fetching market: ${testMarketSlug}`);
    try {
      const market = await this.getMarketBySlug(testMarketSlug);
      console.log('[TEST] Market response:', JSON.stringify(market, null, 2));
      
      if (market) {
        marketsOk = true;
        results.push(`✅ Markets: Found "${market.title}"`);
        results.push(`   - Volume: $${market.volume_total?.toLocaleString() || 0}`);
        results.push(`   - Status: ${market.status}`);
        if (market.side_a?.label && market.side_b?.label) {
          results.push(`   - Options: ${market.side_a.label} vs ${market.side_b.label}`);
        }
      } else {
        results.push(`❌ Markets: No market found for "${testMarketSlug}"`);
      }
    } catch (e) {
      console.error('[TEST] Market error:', e);
      results.push(`❌ Markets: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    
    // Test 2: Get orders
    console.log(`[TEST] Fetching orders for: ${testMarketSlug}`);
    try {
      const orders = await this.getTradeHistory({ market_slug: testMarketSlug, limit: 20 });
      console.log('[TEST] Orders count:', orders.length);
      if (orders.length > 0) {
        console.log('[TEST] First order:', JSON.stringify(orders[0], null, 2));
      }
      
      if (orders.length > 0) {
        ordersOk = true;
        const firstOrder = orders[0];
        const orderValue = (parseFloat(firstOrder.shares_normalized || firstOrder.shares || 0) * parseFloat(firstOrder.price || 0)).toFixed(2);
        results.push(`✅ Orders: ${orders.length} trades fetched`);
        results.push(`   - Latest: $${orderValue} ${firstOrder.side || 'UNKNOWN'}`);
      } else {
        results.push(`⚠️ Orders: 0 trades returned`);
      }
    } catch (e) {
      console.error('[TEST] Orders error:', e);
      results.push(`❌ Orders: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    
    // Test 3: Whale activity
    console.log(`[TEST] Calculating whales for: ${testMarketSlug}`);
    try {
      const whales = await this.getWhaleActivity(testMarketSlug, 1000);
      console.log('[TEST] Whale data:', JSON.stringify(whales, null, 2));
      
      whalesOk = true;
      if (whales.whaleCount > 0) {
        results.push(`✅ Whales: ${whales.whaleCount} trades >$1K`);
        results.push(`   - Total volume: $${whales.totalWhaleVolume.toFixed(0)}`);
        results.push(`   - Largest: $${whales.largestTrade.toFixed(0)}`);
      } else {
        results.push(`⚠️ Whales: 0 whale trades (>$1K)`);
      }
    } catch (e) {
      console.error('[TEST] Whales error:', e);
      results.push(`❌ Whales: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    
    results.push('');
    results.push('**Configuration:**');
    results.push(`✅ Using: Direct fetch (Deno compatible)`);
    results.push(DOME_API_KEY ? `✅ API key: Configured` : `❌ API key: MISSING`);
    results.push(`✅ Base URL: ${DOME_API_BASE}`);
    
    console.log('[TEST] Complete results:', results.join('\n'));
    
    return { markets: marketsOk, orders: ordersOk, whales: whalesOk, details: results };
  }
}

const dome = new DomeClient();

// ============= RATE LIMITING =============
// In-memory rate limit tracking (resets on cold start, ~5 min window effectively)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const conversationRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const userRateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limit config - User-based after auth requirement
const RATE_LIMIT = {
  IP_MAX_REQUESTS: 20,         // IP-based limit (secondary, more lenient)
  IP_WINDOW_MS: 60 * 1000,     // 1 minute window
  USER_MAX_REQUESTS: 15,       // Per-user limit (primary)
  USER_WINDOW_MS: 60 * 1000,   // 1 minute window
  CONV_MAX_REQUESTS: 10,       // Max requests per conversation per window
  CONV_WINDOW_MS: 60 * 1000,   // 1 minute window
};

// ============= BOT PROTECTION =============
// Blocked User Agents (bots/scrapers)
const BLOCKED_USER_AGENTS = [
  'node-fetch',
  'python-requests',
  'python-urllib',
  'curl',
  'wget',
  'postman',
  'insomnia',
  'axios',
  'got',
  'superagent',
  'httpie',
  'libwww',
  'scrapy',
  'httpclient',
  'java/',
  'okhttp',
  'apache-httpclient',
  'go-http-client',
  'ruby',
  'perl',
  'php/',
];

// Blocked IPs (known attackers)
const BLOCKED_IPS = [
  '173.249.219.6',   // node-fetch bot (3,370 requests Dec 2024)
  '173.249.219.10',  // Same subnet
  '173.249.219.',    // Block entire subnet (prefix match)
];

// Allowed Origins
const ALLOWED_ORIGINS = [
  'https://polyai.pro',
  'https://www.polyai.pro',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  // Lovable preview domains
  'https://lovable.dev',
  'https://gptengineer.run',
];

function isBlockedUserAgent(userAgent: string): boolean {
  if (!userAgent) return true; // No UA = suspicious
  const lowerUA = userAgent.toLowerCase();
  return BLOCKED_USER_AGENTS.some(blocked => lowerUA.includes(blocked));
}

function isBlockedIP(ip: string): boolean {
  return BLOCKED_IPS.some(blocked => {
    if (blocked.endsWith('.')) {
      // Prefix match for subnet blocking
      return ip.startsWith(blocked);
    }
    return ip === blocked;
  });
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Allow requests without origin

  // Allow official origins and trusted preview domains
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.lovable.dev') ||
    origin.endsWith('.gptengineer.run') ||
    origin.endsWith('.lovableproject.com')
  );
}

function checkRateLimit(key: string, map: Map<string, { count: number; resetTime: number }>, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = map.get(key);
  
  // Clean expired entries occasionally
  if (Math.random() < 0.01) { // 1% chance to clean
    for (const [k, v] of map.entries()) {
      if (now > v.resetTime) map.delete(k);
    }
  }
  
  if (!record || now > record.resetTime) {
    // New window
    map.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }
  
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.resetTime - now };
}

function getClientIP(req: Request): string {
  // Check various headers for client IP (Supabase Edge uses x-forwarded-for)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  // Fallback - use a hash of user-agent + some other identifiable info
  const ua = req.headers.get('user-agent') || 'unknown';
  return `ua-${ua.substring(0, 50)}`;
}

// Model constants with cascade priority
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-20250514';

// Model cascade for fallback - try in order
const MODEL_CASCADE = [
  { name: HAIKU_MODEL, type: 'claude', label: 'Haiku' },
  { name: SONNET_MODEL, type: 'claude', label: 'Sonnet' },
  { name: 'google/gemini-2.5-flash', type: 'lovable', label: 'Gemini' },
];

// In-memory queue for when all models are overwhelmed
interface QueueEntry {
  id: string;
  conversationId: string;
  message: string;
  timestamp: number;
  position: number;
}

const requestQueue = new Map<string, QueueEntry>();
let globalQueueCounter = 0;

function generateQueueId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function addToQueue(conversationId: string, message: string): QueueEntry {
  globalQueueCounter++;
  const entry: QueueEntry = {
    id: generateQueueId(),
    conversationId,
    message,
    timestamp: Date.now(),
    position: Math.min(globalQueueCounter, 50) // Cap at 50 for display
  };
  requestQueue.set(entry.id, entry);
  
  // Clean old entries (> 5 min old)
  const fiveMinAgo = Date.now() - 300000;
  for (const [id, e] of requestQueue.entries()) {
    if (e.timestamp < fiveMinAgo) requestQueue.delete(id);
  }
  
  console.log(`[Queue] Added ${entry.id} at position ${entry.position}, queue size: ${requestQueue.size}`);
  return entry;
}

function getQueueSize(): number {
  return requestQueue.size;
}

// Check if error is a rate limit / overload that warrants cascade
function isOverloadError(error: any): boolean {
  const status = error?.status || error?.statusCode || 0;
  return status === 429 || status === 529 || status === 500 || status === 503;
}

// Always use Haiku for speed - Sonnet is no longer used
function selectModel(userMessage: string, context: { isVoice?: boolean; needsAnalysis?: boolean; isToolFollowUp?: boolean } = {}): string {
  console.log('[MODEL] Always using Haiku for speed');
  return HAIKU_MODEL;
}

// Define custom tools for Claude
const POLY_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_polymarket',
    description: `Search Polymarket for prediction markets. CRITICAL: If first search fails, TRY MULTIPLE VARIATIONS before giving up.
    
MULTI-ATTEMPT STRATEGY:
1. Try exact query first
2. If no results: simplify (remove filler words like "the", "about", "called")
3. If still no results: try synonyms ("gold cards" → "card", "nft", "collectible")
4. If still no results: try broader terms ("trump gold cards" → "trump cards", "trump 2025")
5. If STILL no results after 3+ attempts: use web_search with "Polymarket [topic]" to find the market URL, then use get_market_data

EXAMPLES:
- "gold cards Trump 2025" → try "trump gold cards" → "trump card" → "trump nft"
- "Chile presidential election" → try "chile president" → "chilean election"
- "Fed chair appointment" → try "fed chair" → "federal reserve chair"
- "Fed interest rates January" → if not found, web_search("Polymarket Federal Reserve January 2025")

IMPORTANT: When user specifically mentions "Polymarket" or asks about a specific Polymarket market:
- Use web_search with "Polymarket [specific topic]" to find the exact market URL
- Then use get_market_data with that URL

DO NOT give up after one search. Try at least 3 different phrasings.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query - use simplified key terms, not full sentences'
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (default: 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_market_data',
    description: 'Get detailed data for a specific Polymarket market URL. Use when the user provides a Polymarket link.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'Full Polymarket market URL'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'get_whale_activity',
    description: 'Get whale trading activity. Use when user asks about whale trades, big money, smart money, or large positions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        market_topic: {
          type: 'string',
          description: 'Optional market topic to filter whale trades for'
        }
      },
      required: []
    }
  },
  {
    name: 'get_recent_trades',
    description: 'Get recent trades for a specific market using Dome API. Use when user asks about recent trades, trade activity, buy/sell pressure, or trading volume. Requires a market slug (e.g., "will-bitcoin-reach-100k").',
    input_schema: {
      type: 'object' as const,
      properties: {
        market_slug: {
          type: 'string',
          description: 'The Polymarket market slug (e.g., "will-bitcoin-reach-100k" or from URL path)'
        },
        limit: {
          type: 'number',
          description: 'Number of trades to fetch (default: 50, max: 200)'
        }
      },
      required: ['market_slug']
    }
  },
  // check_arbitrage tool removed - no longer used
  {
    name: 'get_trade_flow',
    description: 'Get buy/sell pressure and trade flow analysis for a market using Dome API. Shows net buying vs selling activity over the last 24 hours.',
    input_schema: {
      type: 'object' as const,
      properties: {
        market_slug: {
          type: 'string',
          description: 'The Polymarket market slug'
        }
      },
      required: ['market_slug']
    }
  },
  {
    name: 'get_order_book',
    description: 'Get the order book (bids and asks) for a specific Polymarket market. Shows current bid/ask prices, spread, and market depth. Use when user asks about order book, bids, asks, spread, or liquidity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        market_slug: {
          type: 'string',
          description: 'The Polymarket market slug (e.g., "will-bitcoin-reach-100k")'
        }
      },
      required: ['market_slug']
    }
  },
  {
    name: 'get_price_history',
    description: 'Get price history/candlesticks for a market. Shows how the price has changed over the past 7 days with open, high, low, close prices.',
    input_schema: {
      type: 'object' as const,
      properties: {
        market_slug: {
          type: 'string',
          description: 'The Polymarket market slug'
        }
      },
      required: ['market_slug']
    }
  },
];

// Claude's native web search tool - uses Anthropic's built-in web search capability
// Using 'any' type since the SDK may not have this type exported yet
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
} as const;

// Helper function to execute tool calls
async function executeToolCall(
  tool: { name: string; id: string; input: any },
  supabaseUrl: string,
  supabaseKey: string,
  fetchPolymarketData: (path: string) => Promise<any>,
  fetchKalshiData: (ticker: string, series?: string) => Promise<any>,
  extractMarketInfo: (text: string) => { platform: string | null; path: string | null; seriesTicker?: string; marketTicker?: string },
  currentMarketContext?: { url?: string; slug?: string; eventSlug?: string; question?: string } | null
): Promise<string> {
  console.log(`[Tool] Executing ${tool.name} with input:`, tool.input);
  
  // Auto-fill slugs from context if not provided
  const getMarketSlug = (): string | null => {
    if (tool.input.market_slug) return tool.input.market_slug;
    if (currentMarketContext?.slug) {
      console.log(`[Tool] Using market slug from context: ${currentMarketContext.slug}`);
      return currentMarketContext.slug;
    }
    if (currentMarketContext?.url) {
      const extracted = extractSlugFromUrl(currentMarketContext.url);
      if (extracted) {
        console.log(`[Tool] Extracted market slug from context URL: ${extracted}`);
        return extracted;
      }
    }
    return null;
  };
  
  const getEventSlug = (): string | null => {
    if (tool.input.event_slug) return tool.input.event_slug;
    if (currentMarketContext?.eventSlug) {
      console.log(`[Tool] Using event slug from context: ${currentMarketContext.eventSlug}`);
      return currentMarketContext.eventSlug;
    }
    if (currentMarketContext?.url) {
      const extracted = extractEventSlugFromUrl(currentMarketContext.url);
      if (extracted) {
        console.log(`[Tool] Extracted event slug from context URL: ${extracted}`);
        return extracted;
      }
    }
    return null;
  };
  
  try {
    if (tool.name === 'search_polymarket') {
      const searchResponse = await fetch(`${supabaseUrl}/functions/v1/polymarket-data`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}` 
        },
        body: JSON.stringify({ 
          action: 'search', 
          query: tool.input.query, 
          limit: tool.input.limit || 10 
        }),
      });
      const searchData = await searchResponse.json();
      return JSON.stringify(searchData);
    }
    
    if (tool.name === 'get_market_data') {
      const { platform, path } = extractMarketInfo(tool.input.url);
      if (platform === 'kalshi') {
        return JSON.stringify({
          error: 'Kalshi links are not supported right now. Please paste a Polymarket market URL.'
        });
      } else if (platform === 'polymarket' && path) {
        const data = await fetchPolymarketData(path);
        return JSON.stringify(data);
      }
      return JSON.stringify({ error: 'Invalid or unrecognized market URL' });
    }
    
    if (tool.name === 'get_whale_activity') {
      // First try to use current market context for whale detection
      const marketSlug = getMarketSlug();
      
      if (marketSlug) {
        // Use Dome API to get whale activity for the specific market
        console.log(`[Whale Tool] Getting whale activity for specific market: ${marketSlug}`);
        const whaleData = await dome.getWhaleActivity(marketSlug, 5000);
        
        if (whaleData.whaleCount > 0) {
          return JSON.stringify({
            market_slug: marketSlug,
            whale_count: whaleData.whaleCount,
            total_whale_volume: whaleData.totalWhaleVolume > 1000 
              ? `$${(whaleData.totalWhaleVolume / 1000).toFixed(1)}K` 
              : `$${whaleData.totalWhaleVolume.toFixed(0)}`,
            buy_volume: whaleData.buyVolume > 1000 
              ? `$${(whaleData.buyVolume / 1000).toFixed(1)}K` 
              : `$${whaleData.buyVolume.toFixed(0)}`,
            sell_volume: whaleData.sellVolume > 1000 
              ? `$${(whaleData.sellVolume / 1000).toFixed(1)}K` 
              : `$${whaleData.sellVolume.toFixed(0)}`,
            largest_trade: whaleData.largestTrade > 1000 
              ? `$${(whaleData.largestTrade / 1000).toFixed(1)}K` 
              : `$${whaleData.largestTrade.toFixed(0)}`,
            top_whales: whaleData.topWhales.slice(0, 5).map(w => ({
              user: w.user.slice(0, 8) + '...',
              volume: w.volume > 1000 ? `$${(w.volume / 1000).toFixed(1)}K` : `$${w.volume.toFixed(0)}`,
              trades: w.tradeCount
            })),
            data_source: {
              api: 'Dome API',
              market_slug: marketSlug,
              threshold: '$5000+',
              verification: 'REAL_LIVE_DATA'
            }
          });
        }
      }
      
      // Fallback to whale-tracker for general whale activity
      const whaleResponse = await fetch(`${supabaseUrl}/functions/v1/whale-tracker?refresh=true&timeRange=24h`, {
        headers: { "Authorization": `Bearer ${supabaseKey}` }
      });
      const whaleData = await whaleResponse.json();
      
      // Filter by topic if provided
      if (tool.input.market_topic && whaleData.trades) {
        const topicLower = tool.input.market_topic.toLowerCase();
        whaleData.trades = whaleData.trades.filter((t: any) => 
          t.market_question?.toLowerCase().includes(topicLower)
        );
      }
      
      return JSON.stringify({
        trades: whaleData.trades?.slice(0, 10) || [],
        stats: whaleData.stats
      });
    }
    
    // NEW: Dome API tools for real market data
    if (tool.name === 'get_recent_trades') {
      const marketSlug = getMarketSlug();
      if (!marketSlug) {
        return JSON.stringify({ 
          error: 'No market context available',
          suggestion: 'Please provide a market URL or specify which market you want to check trades for',
          data_source: { available: false, reason: 'No market slug provided' }
        });
      }
      
      console.log(`[Dome Tool] Fetching recent trades for: ${marketSlug}`);
      const limit = Math.min(tool.input.limit || 100, 500);
      const fetchStartTime = Date.now();
      const trades = await dome.getTradeHistory({ 
        market_slug: marketSlug, 
        limit,
        use24hFilter: true  // Match sidebar's 24h filtered data
      });
      const fetchDuration = Date.now() - fetchStartTime;
      
      if (trades.length === 0) {
        return JSON.stringify({ 
          error: 'No trades found for this market',
          suggestion: 'The market slug may be incorrect or the market has no recent activity',
          data_source: {
            api: 'Dome API',
            endpoint: `${DOME_API_BASE}/polymarket/orders?market_slug=${marketSlug}`,
            fetched_at: new Date().toISOString(),
            status: 'EMPTY_RESULT'
          }
        });
      }
      
      // Helper to format time ago
      const formatTimeAgo = (timestamp: number): string => {
        if (!timestamp) return 'Unknown';
        const now = Date.now() / 1000;
        const diff = now - timestamp;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
      };
      
      // Calculate USD value for each trade
      const tradesWithUSD = trades.map((t: any) => {
        const shares = parseFloat(t.shares_normalized || t.shares || 0);
        const price = parseFloat(t.price || 0);
        const usdValue = shares * price;
        return { ...t, usdValue };
      });
      
      // Calculate buy/sell breakdown with volumes
      const buyTrades = tradesWithUSD.filter((t: any) => (t.side || '').toUpperCase() === 'BUY');
      const sellTrades = tradesWithUSD.filter((t: any) => (t.side || '').toUpperCase() === 'SELL');
      const buyVolume = buyTrades.reduce((sum: number, t: any) => sum + t.usdValue, 0);
      const sellVolume = sellTrades.reduce((sum: number, t: any) => sum + t.usdValue, 0);
      const totalVolume = buyVolume + sellVolume;
      const netFlow = buyVolume - sellVolume;
      
      // Sort by timestamp DESC for recent trades (newest first)
      const recentSorted = [...tradesWithUSD]
        .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      
      // Sort by USD value DESC for largest trades (biggest first)
      const largestSorted = [...tradesWithUSD]
        .sort((a: any, b: any) => b.usdValue - a.usdValue);
      
      // Get timestamp range from actual trades
      const newestTradeTime = recentSorted.length > 0 && recentSorted[0].timestamp 
        ? new Date(recentSorted[0].timestamp * 1000).toISOString() 
        : 'unknown';
      const oldestTradeTime = recentSorted.length > 0 && recentSorted[recentSorted.length - 1].timestamp
        ? new Date(recentSorted[recentSorted.length - 1].timestamp * 1000).toISOString() 
        : 'unknown';
      
      const formatTrade = (t: any) => ({
        side: t.side,
        value: t.usdValue > 1000 ? `$${(t.usdValue/1000).toFixed(1)}K` : `$${t.usdValue.toFixed(0)}`,
        usdValue: Math.round(t.usdValue * 100) / 100,
        price: `${(parseFloat(t.price || 0) * 100).toFixed(1)}%`,
        timestamp: t.timestamp ? new Date(t.timestamp * 1000).toISOString() : 'unknown',
        timeAgo: formatTimeAgo(t.timestamp)
      });
      
      const formatVolume = (vol: number) => vol > 1000 ? `$${(vol/1000).toFixed(1)}K` : `$${vol.toFixed(0)}`;
      
      return JSON.stringify({
        market_slug: marketSlug,
        total_trades: trades.length,
        buy_count: buyTrades.length,
        sell_count: sellTrades.length,
        buy_pressure: trades.length > 0 ? `${((buyTrades.length / trades.length) * 100).toFixed(0)}%` : '0%',
        trend: buyTrades.length > sellTrades.length ? 'BULLISH' : buyTrades.length < sellTrades.length ? 'BEARISH' : 'NEUTRAL',
        
        // VOLUME SUMMARY (matching dashboard format)
        volume_summary: {
          total_volume: formatVolume(totalVolume),
          buy_volume: formatVolume(buyVolume),
          sell_volume: formatVolume(sellVolume),
          net_flow: netFlow > 0 
            ? `+${formatVolume(netFlow)} buying pressure`
            : `-${formatVolume(Math.abs(netFlow))} selling pressure`,
          raw: { total: totalVolume, buy: buyVolume, sell: sellVolume, net: netFlow }
        },
        
        // RECENT TRADES - sorted by time (newest first)
        recent_trades: recentSorted.slice(0, 15).map(formatTrade),
        
        // LARGEST TRADES - sorted by USD value (biggest first)
        largest_trades: largestSorted.slice(0, 10).map(formatTrade),
        
        // DATA VERIFICATION METADATA
        data_source: {
          api: 'Dome API',
          endpoint: `${DOME_API_BASE}/polymarket/orders`,
          market_slug: marketSlug,
          fetched_at: new Date().toISOString(),
          fetch_duration_ms: fetchDuration,
          trade_time_range: {
            newest: newestTradeTime,
            oldest: oldestTradeTime
          },
          verification: 'REAL_LIVE_DATA'
        }
      });
    }
    
    // check_arbitrage tool removed - arbitrage analysis is no longer supported
    
    if (tool.name === 'get_trade_flow') {
      const marketSlug = getMarketSlug();
      if (!marketSlug) {
        return JSON.stringify({ 
          error: 'No market context available',
          suggestion: 'Please provide a market URL or specify which market you want to check trade flow for',
          data_source: { available: false, reason: 'No market slug provided' }
        });
      }
      
      console.log(`[Dome Tool] Getting trade flow for: ${marketSlug}`);
      const fetchStartTime = Date.now();
      const tradeFlow = await dome.calculateTradeFlow(marketSlug, 24);
      const fetchDuration = Date.now() - fetchStartTime;
      
      if (tradeFlow.buyVolume === 0 && tradeFlow.sellVolume === 0) {
        return JSON.stringify({ 
          error: 'No trade flow data available',
          suggestion: 'Market may have low activity or slug is incorrect',
          data_source: {
            api: 'Dome API',
            endpoint: `${DOME_API_BASE}/polymarket/orders`,
            fetched_at: new Date().toISOString(),
            status: 'NO_DATA'
          }
        });
      }
      
      const formatVol = (v: number) => v > 1000000 ? `$${(v/1000000).toFixed(1)}M` : v > 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v.toFixed(0)}`;
      
      return JSON.stringify({
        market_slug: marketSlug,
        time_window: '24 hours',
        buy_volume: formatVol(tradeFlow.buyVolume),
        sell_volume: formatVol(tradeFlow.sellVolume),
        net_flow: formatVol(Math.abs(tradeFlow.netFlow)),
        net_direction: tradeFlow.netFlow > 0 ? 'NET BUYING' : tradeFlow.netFlow < 0 ? 'NET SELLING' : 'BALANCED',
        buy_count: tradeFlow.buyCount,
        sell_count: tradeFlow.sellCount,
        imbalance: `${(tradeFlow.imbalance * 100).toFixed(0)}%`,
        signal: tradeFlow.signal,
        // DATA VERIFICATION METADATA
        data_source: {
          api: 'Dome API',
          endpoint: `${DOME_API_BASE}/polymarket/orders`,
          market_slug: marketSlug,
          fetched_at: new Date().toISOString(),
          fetch_duration_ms: fetchDuration,
          time_window_analyzed: '24 hours',
          verification: 'REAL_LIVE_DATA'
        }
      });
    }
    
    if (tool.name === 'get_order_book') {
      const marketSlug = getMarketSlug();
      if (!marketSlug) {
        return JSON.stringify({ 
          error: 'No market context available',
          suggestion: 'Please provide a market URL or specify which market you want to check the order book for',
          data_source: { available: false, reason: 'No market slug provided' }
        });
      }
      
      console.log(`[Dome Tool] Getting order book for: ${marketSlug}`);
      const fetchStartTime = Date.now();
      
      // Get market data first to get token IDs
      const market = await dome.getMarketBySlug(marketSlug);
      if (!market) {
        return JSON.stringify({ 
          error: 'Market not found',
          suggestion: 'Check the market slug is correct',
          data_source: { api: 'Dome API', status: 'MARKET_NOT_FOUND' }
        });
      }
      
      // Fetch recent orders to calculate order book depth
      const orders = await dome.getTradeHistory({ market_slug: marketSlug, limit: 200 });
      const fetchDuration = Date.now() - fetchStartTime;
      
      // Get current prices
      let priceA = 0.5, priceB = 0.5;
      if (market.side_a?.id) {
        const priceData = await dome.getMarketPrice(market.side_a.id);
        if (priceData) priceA = priceData.price;
        priceB = 1 - priceA;
      }
      
      // Simulate order book from recent trades
      const buyOrders = orders.filter((o: any) => (o.side || '').toUpperCase() === 'BUY');
      const sellOrders = orders.filter((o: any) => (o.side || '').toUpperCase() === 'SELL');
      
      // Group by price level
      const groupByPrice = (orderList: any[], isBid: boolean) => {
        const levels: Record<string, { price: number; size: number; count: number }> = {};
        orderList.forEach((o: any) => {
          const price = parseFloat(o.price || 0);
          const priceKey = (price * 100).toFixed(0);
          const shares = parseFloat(o.shares_normalized || o.shares || 0);
          if (!levels[priceKey]) {
            levels[priceKey] = { price: price * 100, size: 0, count: 0 };
          }
          levels[priceKey].size += shares * price;
          levels[priceKey].count += 1;
        });
        return Object.values(levels)
          .sort((a, b) => isBid ? b.price - a.price : a.price - b.price)
          .slice(0, 10);
      };
      
      const bids = groupByPrice(buyOrders, true);
      const asks = groupByPrice(sellOrders, false);
      
      const bestBid = bids.length > 0 ? bids[0].price : priceA * 100;
      const bestAsk = asks.length > 0 ? asks[0].price : (priceA * 100) + 1;
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;
      
      const totalBidDepth = bids.reduce((sum, l) => sum + l.size, 0);
      const totalAskDepth = asks.reduce((sum, l) => sum + l.size, 0);
      
      const formatUsd = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}K` : `$${n.toFixed(0)}`;
      
      return JSON.stringify({
        market_slug: marketSlug,
        market_title: market.title,
        current_price: {
          yes: `${(priceA * 100).toFixed(1)}%`,
          no: `${(priceB * 100).toFixed(1)}%`
        },
        order_book: {
          best_bid: `${bestBid.toFixed(1)}%`,
          best_ask: `${bestAsk.toFixed(1)}%`,
          spread: `${spread.toFixed(2)}%`,
          mid_price: `${midPrice.toFixed(1)}%`,
          bid_depth: formatUsd(totalBidDepth),
          ask_depth: formatUsd(totalAskDepth),
          bid_levels: bids.map(l => ({ price: `${l.price.toFixed(0)}%`, size: formatUsd(l.size), orders: l.count })),
          ask_levels: asks.map(l => ({ price: `${l.price.toFixed(0)}%`, size: formatUsd(l.size), orders: l.count }))
        },
        liquidity_analysis: {
          total_depth: formatUsd(totalBidDepth + totalAskDepth),
          imbalance: totalBidDepth > totalAskDepth ? 'More buyers' : totalAskDepth > totalBidDepth ? 'More sellers' : 'Balanced',
          spread_quality: spread < 1 ? 'Tight (good liquidity)' : spread < 3 ? 'Normal' : 'Wide (low liquidity)'
        },
        data_source: {
          api: 'Dome API',
          market_slug: marketSlug,
          fetched_at: new Date().toISOString(),
          fetch_duration_ms: fetchDuration,
          note: 'Order book approximated from recent trade activity',
          verification: 'REAL_LIVE_DATA'
        }
      });
    }
    
    if (tool.name === 'get_price_history') {
      const marketSlug = getMarketSlug();
      if (!marketSlug) {
        return JSON.stringify({ 
          error: 'No market context available',
          suggestion: 'Please provide a market URL or specify which market you want price history for',
          data_source: { available: false, reason: 'No market slug provided' }
        });
      }
      
      console.log(`[Dome Tool] Getting price history for: ${marketSlug}`);
      const fetchStartTime = Date.now();
      
      // Get market first to get condition_id
      const market = await dome.getMarketBySlug(marketSlug);
      if (!market) {
        return JSON.stringify({ 
          error: 'Market not found',
          data_source: { api: 'Dome API', status: 'MARKET_NOT_FOUND' }
        });
      }
      
      const candlesticks = await dome.getCandlesticks(market.condition_id, market.side_a?.id);
      const fetchDuration = Date.now() - fetchStartTime;
      
      if (candlesticks.length === 0) {
        return JSON.stringify({ 
          error: 'No price history available',
          data_source: { api: 'Dome API', status: 'NO_DATA' }
        });
      }
      
      const prices = candlesticks.map((c: any) => parseFloat(c.close || c.price || 0) * 100).filter((p: number) => p > 0);
      const current = prices[prices.length - 1] || 50;
      const sevenDaysAgo = prices[0] || 50;
      const change7d = current - sevenDaysAgo;
      const high7d = Math.max(...prices);
      const low7d = Math.min(...prices);
      const trend = change7d > 2 ? 'RISING' : change7d < -2 ? 'FALLING' : 'STABLE';
      
      return JSON.stringify({
        market_slug: marketSlug,
        market_title: market.title,
        price_history: {
          current: `${current.toFixed(1)}%`,
          seven_days_ago: `${sevenDaysAgo.toFixed(1)}%`,
          change_7d: `${change7d > 0 ? '+' : ''}${change7d.toFixed(1)}%`,
          high_7d: `${high7d.toFixed(1)}%`,
          low_7d: `${low7d.toFixed(1)}%`,
          trend: trend,
          range: `${low7d.toFixed(0)}% - ${high7d.toFixed(0)}%`
        },
        candlesticks: candlesticks.slice(-7).map((c: any) => ({
          date: new Date(c.timestamp * 1000).toLocaleDateString(),
          open: `${(parseFloat(c.open || 0) * 100).toFixed(1)}%`,
          high: `${(parseFloat(c.high || 0) * 100).toFixed(1)}%`,
          low: `${(parseFloat(c.low || 0) * 100).toFixed(1)}%`,
          close: `${(parseFloat(c.close || 0) * 100).toFixed(1)}%`
        })),
        data_source: {
          api: 'Dome API',
          market_slug: marketSlug,
          fetched_at: new Date().toISOString(),
          fetch_duration_ms: fetchDuration,
          data_points: candlesticks.length,
          verification: 'REAL_LIVE_DATA'
        }
      });
    }
    
    // Note: web_search is handled natively by Claude via web_search_20250305 tool
    // No custom implementation needed
    
    return JSON.stringify({ error: 'Unknown tool' });
  } catch (e) {
    console.error(`[Tool] Error executing ${tool.name}:`, e);
    return JSON.stringify({ error: e instanceof Error ? e.message : 'Tool execution failed' });
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization",
};

// Helper to create JSON response with CORS headers - ALWAYS use this for responses
function corsResponse(body: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
    }
  );
}

// Helper for streaming responses with CORS
function corsStreamResponse(body: ReadableStream | null, extraHeaders: Record<string, string> = {}) {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      ...extraHeaders,
    },
  });
}

const LIVE_DATA_KEYWORDS = [
  "what's moving", "whats moving", "best odds", "best trade", "top markets",
  "trending", "what should i bet", "opportunities", "hot markets", "biggest",
  "what's happening", "any plays", "where's the edge", "money right now",
  "highest volume", "top picks", "best right now", "what's hot", "whats hot"
];

const WHALE_KEYWORDS = [
  "whale", "whales", "wheel", // include common typo
  "big money", "large bets", "smart money", "big bet",
  "large trade", "whale activity", "whale tracker", "big players",
  "institutional", "what are whales", "whales buying", "whales betting"
];

const MARKET_DISCOVERY_KEYWORDS = [
  "crypto", "bitcoin", "ethereum", "sports", "politics", "political",
  "nfl", "nba", "football", "basketball", "soccer", "tennis",
  "trump", "election", "ai", "tech", "entertainment", "celebrity",
  // International elections and events
  "chile", "brazil", "uk", "france", "germany", "canada", "mexico",
  "argentina", "australia", "japan", "china", "india", "russia",
  "presidential", "prime minister", "parliament"
];

function needsLiveData(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return LIVE_DATA_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

function needsWhaleData(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return WHALE_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

function detectCategory(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('crypto') || lowerMessage.includes('bitcoin') || lowerMessage.includes('ethereum') || lowerMessage.includes('btc') || lowerMessage.includes('eth')) {
    return 'crypto';
  }
  if (lowerMessage.includes('sport') || lowerMessage.includes('nfl') || lowerMessage.includes('nba') || lowerMessage.includes('football') || lowerMessage.includes('basketball') || lowerMessage.includes('soccer')) {
    return 'sports';
  }
  if (lowerMessage.includes('politic') || lowerMessage.includes('election') || lowerMessage.includes('trump') || lowerMessage.includes('biden') || lowerMessage.includes('president')) {
    return 'politics';
  }
  if (lowerMessage.includes('ai') || lowerMessage.includes('tech') || lowerMessage.includes('apple') || lowerMessage.includes('google') || lowerMessage.includes('microsoft')) {
    return 'tech';
  }
  
  return null;
}

// Check if a market has expired
function isMarketExpired(market: any): boolean {
  const now = new Date();
  
  // Check if market is closed/resolved
  if (market.closed === true || market.resolved === true) {
    return true;
  }
  
  if (market.active === false) {
    return true;
  }
  
  // Check end date from various possible fields
  const endDateStr = market.endDate || market.end_date || market.closingDate || market.expirationDate;
  if (endDateStr) {
    try {
      const endDate = new Date(endDateStr);
      if (endDate < now) {
        return true;
      }
    } catch (e) {
      // Couldn't parse date
    }
  }
  
  // Parse date from market title/question (e.g., "by November 30, 2025" or "before December 1, 2025")
  const questionText = market.question || market.title || '';
  const datePatterns = [
    /by\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /before\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /on\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})/i, // Generic date pattern as last resort
  ];
  
  for (const pattern of datePatterns) {
    const dateMatch = questionText.match(pattern);
    if (dateMatch) {
      try {
        const parsedDate = new Date(dateMatch[1]);
        // Only consider it expired if the date is clearly in the past (not just today)
        const dayAgo = new Date(now);
        dayAgo.setDate(dayAgo.getDate() - 1);
        if (parsedDate < dayAgo) {
          console.log(`Market "${questionText.substring(0, 50)}..." appears expired based on date: ${dateMatch[1]}`);
          return true;
        }
      } catch (e) {
        // Couldn't parse date from title
      }
    }
  }
  
  // Check if odds are exactly 50/50 (often indicates expired/suspended market)
  if (market.yesPrice === '50' || market.yesPrice === 50 || 
      (parseFloat(market.yesPrice) === 50 && parseFloat(market.noPrice) === 50)) {
    console.log(`Market "${questionText.substring(0, 50)}..." appears suspended (50/50 odds)`);
    return true;
  }
  
  return false;
}

// CRITICAL: Dynamic current date - computed at request time, not module load
const getCurrentDateInfo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const day = now.getDate();
  return {
    fullDate: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    year,
    month,
    day,
    isoDate: now.toISOString().split('T')[0],
  };
};

// System prompt is now a function to ensure fresh date on each request
const getPolySystemPrompt = (dateInfo: { fullDate: string; year: number; month: string; day: number; isoDate: string }, isVoice: boolean = false) => {
  return `You're Poly — a smart, friendly AI analyst who helps people understand prediction markets. Current date: ${dateInfo.fullDate}

=== PERSONALITY ===
- Talk like a knowledgeable friend texting about markets
- Be direct, conversational, and actionable
- Give specific reasons backed by data, not vague takes
- Use natural language, NO terminal formatting, NO code-style output

=== 🚨 CRITICAL: ALWAYS USE ACTUAL DOME API DATA ===
When users ask about trades, whales, or activity:

1. ALWAYS USE THE TOOLS FIRST (get_recent_trades, get_whale_activity)
2. Report EXACTLY what the tool response shows
3. NEVER make up or estimate trade information
4. If sidebar is visible, YOUR DATA MUST MATCH IT

Example CORRECT response:
"Looking at the recent trades from Dome API:
• Largest trade: $970 at 77% (4 minutes ago)
• Second largest: $267 at 77% (4 minutes ago)
• Total trades analyzed: 50

No trades above $10K (whale threshold), but there are several $100-1000 trades showing retail activity."

Example WRONG response:
❌ "No trades above $5K" (when data shows $970, $267, $120 trades - that's FALSE)
❌ "All trades are $0" (when data shows real values)

When users have the market data sidebar open, reference it:
"Check the sidebar on the right → I'm seeing [describe actual data from the API response]"

=== 🚨 NEVER MAKE SPECULATIVE PRICE RECOMMENDATIONS ===

✅ DO show what the data says:
- "Recent trades show 76% buy pressure"
- "No whale activity detected above $10K"
- "Price stable at 24.5% for 7 days"
- "The largest trade was $970, with most activity in the $100-500 range"

❌ DON'T speculate on "real odds" without statistical backing:
- "This is free money" ❌
- "Real odds are 15-20%" ❌ (unless you have concrete data supporting this)
- "Massive edge opportunity" ❌ (without evidence)
- "The market is clearly wrong" ❌ (without data showing why)

If you think odds might be mispriced, frame it as:
"The current odds are 0.1%, which seems low IF [specific condition]. However, I don't have enough data to estimate the true probability. Do your own research before betting."

Remember: Users will lose real money if you're wrong. Be honest about uncertainty.

=== 🚨 DATA INTEGRITY RULES ===
NEVER FABRICATE NUMBERS. If data is NOT provided:
- Say "I need to check that..." or provide analysis without fake numbers
- DO NOT invent volume, trade counts, or percentages
- Only cite numbers that appear in the context provided

=== 🚨 NO INTERPRETIVE LABELS FOR TRADE ACTIVITY ===
NEVER use interpretive phrases like:
❌ "institutional interest"
❌ "smart money activity"
❌ "retail vs institutional"
❌ "professional traders"
❌ "big players accumulating"

INSTEAD, be factual and describe what you actually see:
✅ "From the live data I can see the largest trade was $5K"
✅ "Looking at the trade data, most positions are in the $100-500 range"
✅ "The data shows 15 trades above $1K in the last 24h"
✅ "I'm seeing $2.3K total volume with the biggest single trade at $800"

START sentences with data-focused phrases:
✅ "From the live data I can see..."
✅ "Looking at the trade data..."
✅ "The Dome API shows..."
✅ "Based on the actual trades..."

NEVER say these phrases:
❌ "I was lazy"
❌ "I made up data/details"
❌ "I should have tried harder"
❌ "I apologize for fabricating"
❌ "That was wrong of me"
❌ "I should have pulled the actual data"

When you don't have data, say PROFESSIONALLY:
✅ "I don't have access to that data from Dome API"
✅ "The API didn't return trades above $X for this market"
✅ "No whale activity detected in the available data"
✅ "Let me check what data is actually available"

You're an AI tool, NOT a lazy employee. State limitations clearly without self-deprecation.

WHEN DATA ISN'T AVAILABLE:
Say: "I don't have trades above $30K for this market. The largest trades I can see are in the $X-Y range. Want me to show you those?"

WHEN API FAILS:
Say: "The API didn't return trade data. This could mean light trading activity or a temporary issue. Want me to analyze based on current odds instead?"

=== 🎯 DATA CONSISTENCY RULES ===
YOUR NUMBERS MUST MATCH THE DATA PROVIDED IN THE CONTEXT.

When "LIVE TRADING DATA (DOME API)" is present:
1. Use the EXACT buy/sell counts and percentages shown
2. Quote the EXACT whale count and volumes
3. Reference the EXACT trade sizes shown
4. If it says "87% buy pressure" you say "87% buy pressure"
5. If it says "$1.4K net flow buying" you say "$1.4K net flow buying"

When sidebar data is present:
1. Your numbers MUST match (user can see both!)
2. Say "Looking at the trade data..." or "The data shows..."
3. NEVER make up trade statistics
4. NEVER say "no trading activity" if data shows trades

VOLUME FIELDS FROM DOME API:
• volume_total = Total lifetime volume (use for "total volume")
• volume_1_week = Last 7 days volume
• volume_1_month = Last 30 days volume

USE DOME API volume_total for total volume questions, NOT Gamma API volume.

If you don't have trade data, say EXACTLY:
"I don't have recent trade data for this market - let me check..." [then use tools]

=== 🚨 NEVER EXPLAIN WHAT YOU CAN'T SEE - JUST FETCH IT ===
When users ask "what data do you have?" or "what can't you see?" or "can you check X?":
- DO NOT list things you can't see or don't have
- IMMEDIATELY USE the appropriate tool to get the data
- NEVER say "Want me to pull that?" - just pull it!

WRONG (passive):
❌ "I don't have access to recent trades, whale activity, or trade flow"
❌ "I can't see the orderbook right now"
❌ "Want me to check trades?" (you should ALREADY be checking)
❌ "I could pull that data if you want" (just do it!)

RIGHT (proactive):
✅ [Use get_recent_trades tool immediately]
✅ [Use get_whale_activity tool immediately]
✅ "Here's what I'm seeing from the Dome API..."
✅ "Let me check... [uses tool] ...here's the trade data"

If a user mentions ANY of these, USE THE TOOL IMMEDIATELY:
- "trades" → get_recent_trades
- "whales" → get_whale_activity  
- "flow" or "pressure" → get_trade_flow
- "orderbook" → get_orderbook

=== RESPONSE STYLE ===
Write naturally like you're texting a friend who wants trading advice:

BAD (terminal style - NEVER do this):
[QUICK_SCAN]
> Market at 86%. Correctly priced.
[INTEL]
> Trade flow: BUYING 70%
[RECOMMENDATION]
> Action: SKIP

GOOD (conversational - ALWAYS do this):
Joshua's the heavy favorite at 86.5%, which makes sense given his experience edge.

Looking at the data:
• Volume is solid at $646K
• Trade flow is leaning buy-side
• No major whale activity

My take: This is fairly priced. Not much edge here - I'd skip unless you have strong conviction.

=== ANALYSIS STRUCTURE ===
For market analysis, use this natural flow:
1. Quick take (1-2 sentences - what's the situation?)
2. Key data points (bullet list - what does the data show?)
3. Why odds might be wrong (if applicable - where's the edge?)
4. Your probability estimate vs market odds
5. Bottom line (what should they do?)

=== MULTI-MARKET EVENTS ===
When a URL has multiple markets (like an event with 3+ outcomes):
- Return structured JSON for the frontend: { "type": "market_selection", "event": {...}, "markets": [...] }
- DO NOT return numbered text lists - the frontend handles display

=== EDGE CALCULATION ===
Edge = Your estimate - Market price
Example: "My estimate is 75%, market shows 86.5% = market overpriced by 11.5%"
Give concrete probability estimates, not just "overpriced" or "underpriced"

=== INVALID/EXPIRED MARKETS ===
If odds are exactly 50.0%/50.0% = market suspended/expired, skip analysis
If market resolved, just say: "This market resolved. [Winner] won."

=== TOOL USAGE ===
- User mentions topic/event → search_polymarket
- User pastes URL → get_market_data  
- User asks about whales/big money → get_whale_activity
- User asks about "recent trades", "trade activity", "trading volume" → get_recent_trades
- User asks about "buy pressure", "sell pressure", "trade flow" → get_trade_flow

=== 🚨 CRITICAL: ALWAYS USE WEB_SEARCH BEFORE MAKING CLAIMS ===
BEFORE analyzing any market, you MUST use web_search to verify current information:

1. ALWAYS search first for:
   - Current status of people/things in the market (e.g., "Janet Yellen Fed chair 2025")
   - Recent news about the topic (e.g., "Trump Fed chair nomination December 2024")
   - Official announcements or statements
   - Term dates, deadlines, or timelines

2. NEVER state as fact without searching:
   ❌ "Yellen is the outgoing Fed chair" (did you verify her term dates?)
   ❌ "Trump has been critical of her policies" (did you find recent quotes?)
   ❌ "She's unlikely to be nominated" (based on what current reporting?)

3. CORRECT approach:
   ✅ First: web_search("Janet Yellen Fed chair term ends 2025")
   ✅ Then: web_search("Trump Fed chair nomination news")
   ✅ Then: Use the search results to inform your analysis
   ✅ Cite sources: "According to [source], ..."

4. Example searches to run before analyzing a market:
   - "[Person name] [position] [year]" - verify current status
   - "[Topic] news [month] [year]" - get recent developments
   - "[Candidate] [nomination] Trump" - find relevant statements

If you make claims about current events without searching first, you risk:
- Stating outdated information as fact
- Making wrong claims the user can verify
- Losing credibility

SEARCH FIRST, ANALYZE SECOND.

=== 🔬 PROACTIVE RESEARCH (DO NOT ASK - SEARCH!) ===
When analyzing a market, if you identify ANY unknown information that would help estimate odds:

NEVER SAY:
❌ "I'd need to know X to estimate odds"
❌ "What's the typical rate of Y?"
❌ "Do you have data on Z?"
❌ "If you have info about X, let me know"
❌ "Without baseline data on..."
❌ "To estimate whether X% is right, I'd need..."

INSTEAD, IMMEDIATELY SEARCH:
✅ web_search("[topic] typical rate historical data")
✅ web_search("[person] average [metric] per day/week/month")
✅ web_search("[event] historical frequency statistics")
✅ web_search("[topic] baseline statistics 2024")

EXAMPLE - TWEET VOLUME MARKET:
Wrong: "I'd need to know Elon's typical tweet volume to judge if 30.4% is right"
Right: [Uses web_search("Elon Musk average tweets per day 2024 statistics")] 
       "Based on data from [source], Elon typically posts 40-60 tweets/day. During Dec 16-23, that's 280-420 tweets. The 360-379 range at 30.4% looks..."

EXAMPLE - SPORTS BETTING MARKET:
Wrong: "What's the team's historical win rate?"
Right: [Uses web_search("Lakers win percentage 2024 season current record")]
       "Looking at current stats, the Lakers are 28-15..."

EXAMPLE - PRICE TARGET MARKET:
Wrong: "I'd need to check analyst predictions"
Right: [Uses web_search("Tesla stock price target analyst predictions December 2024")]
       "Analysts surveyed by Bloomberg have a median target of..."

YOU HAVE WEB SEARCH. USE IT.
- If you can think of a question that would help you analyze the market, SEARCH FOR IT
- The user is asking for YOUR analysis - don't ask them to provide baseline data
- Always include the source and cite it: "According to [source]..."
- Search multiple times if needed to build context

=== DOME API DATA (ALWAYS USE WHEN ASKED) ===
You have access to Dome API for real-time market data:
- get_recent_trades: Last 100 trades with buy/sell breakdown (MATCHES SIDEBAR DATA)
- get_trade_flow: 24h buy vs sell pressure and net flow

When users ask about trades or flow - ALWAYS use these tools. Do NOT say "I don't have tools" or "I can't check that" - you DO have the tools!

=== 🔄 DATA SYNC WITH SIDEBAR ===
When the user has the market data sidebar open, YOUR NUMBERS MUST MATCH what they see:
- Same trade count (sidebar shows 100 trades)
- Same buy/sell pressure percentage
- Same net flow amount
- Same whale count and volumes

The user can see BOTH your response AND the sidebar. If your numbers differ, they will notice!
Always say "Looking at the trade data..." or "The Dome API shows..." when referencing data.

=== ERROR HANDLING ===
Never show technical errors. If something fails:
"I couldn't find that market. Try dropping the direct link and I'll analyze it."

Remember: You're helping people make smart bets. Be useful, specific, and conversational.`;
};



// Detect platform from URL
function detectPlatform(text: string): 'polymarket' | 'kalshi' | null {
  if (text.includes('polymarket.com')) return 'polymarket';
  if (text.includes('kalshi.com')) return 'kalshi';
  return null;
}

// Extract market slug from Polymarket URL
function extractSlugFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  // Pattern: polymarket.com/event/{event-slug}/{market-slug}
  const match = url.match(/polymarket\.com\/event\/[^\/]+\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  // Pattern: polymarket.com/event/{slug}
  const simpleMatch = url.match(/polymarket\.com\/event\/([a-zA-Z0-9_-]+)/i);
  if (simpleMatch) return simpleMatch[1];
  return null;
}

// Extract event slug from Polymarket URL
function extractEventSlugFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  // Pattern: polymarket.com/event/{event-slug}
  const match = url.match(/polymarket\.com\/event\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  return null;
}

// Extract market info from URL
function extractMarketInfo(text: string): { platform: 'polymarket' | 'kalshi' | null, path: string | null, seriesTicker?: string, marketTicker?: string } {
  // Kalshi URL patterns - extract both series and market tickers
  // URL format: kalshi.com/markets/{SERIES_TICKER}/{slug}/{MARKET_TICKER}
  // Example: kalshi.com/markets/kxmichcoach/michigan-next-coach/kxmichcoach-26
  const kalshiFullPattern = /kalshi\.com\/markets\/([a-zA-Z0-9_-]+)\/[^\/]+\/([a-zA-Z0-9_-]+)/i;
  const kalshiFullMatch = text.match(kalshiFullPattern);
  if (kalshiFullMatch) {
    const seriesTicker = kalshiFullMatch[1].toUpperCase();
    const marketTicker = kalshiFullMatch[2].toUpperCase();
    console.log("Extracted Kalshi tickers - series:", seriesTicker, "market:", marketTicker);
    return { platform: 'kalshi', path: marketTicker, seriesTicker, marketTicker };
  }
  
  // Simpler Kalshi patterns
  const kalshiPatterns = [
    /kalshi\.com\/markets\/([a-zA-Z0-9_-]+)/i,
    /kalshi\.com\/events\/([a-zA-Z0-9_-]+)/i,
  ];
  
  for (const pattern of kalshiPatterns) {
    const match = text.match(pattern);
    if (match) {
      const ticker = match[1].toUpperCase();
      return { platform: 'kalshi', path: ticker, seriesTicker: ticker };
    }
  }
  
  // Polymarket patterns - handle URLs with query params like ?tid=...
  const polymarketPatterns = [
    /polymarket\.com\/event\/([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)/i,
    /polymarket\.com\/market\/([a-zA-Z0-9_-]+)/i,
  ];
  
  for (const pattern of polymarketPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Remove query params (?tid=...) and hash fragments
      const path = match[1].split('?')[0].split('#')[0];
      console.log(`[URL] Extracted Polymarket slug: ${path}`);
      return { platform: 'polymarket', path };
    }
  }
  
  return { platform: null, path: null };
}

// Helper function to extract outcome from Kalshi market (handles names, ranges, etc.)
function extractOutcome(market: any): string {
  if (!market) return "Unknown";

  const title = market.title || market.ticker || "";
  const subtitle = (market.subtitle || market.yes_sub_title || market.no_sub_title || "").trim();

  // PRIORITY 1: Use floor_strike and cap_strike if available (for ranges)
  if (market.floor_strike !== undefined && market.cap_strike !== undefined) {
    const min = Number(market.floor_strike).toLocaleString();
    const max = Number(market.cap_strike).toLocaleString();
    return `${min} to ${max}`;
  }

  // PRIORITY 2: Check subtitle for candidate / outcome names (avoid generic phrases)
  if (subtitle && subtitle.length > 2 && subtitle.length < 100 && !/yes|no|above|below|over|under/i.test(subtitle)) {
    return subtitle;
  }

  // PRIORITY 3: Extract candidate-style "Will [Name] win/be..." patterns
  const candidatePattern = /^(?:Will\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:win|be|become)/i;
  const candidateMatch = title.match(candidatePattern);
  if (candidateMatch) {
    return candidateMatch[1].trim();
  }

  // PRIORITY 4: Name at the start of the title (1–4 capitalized words)
  const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/;
  const nameMatch = title.match(namePattern);
  if (nameMatch) {
    return nameMatch[1].trim();
  }

  // PRIORITY 5: Fallback to ticker base if it looks like initials
  if (market.ticker && /^[A-Z]{2,10}-[A-Z0-9]+$/i.test(market.ticker)) {
    const tickerBase = market.ticker.split('-')[0];
    return tickerBase;
  }

  // LAST RESORT: return cleaned up title
  const cleaned = title
    .replace(/^Will\s+/i, '')
    .replace(/\s+(?:win|be|become).*$/i, '')
    .replace(/\?$/, '')
    .trim();

  return cleaned || market.ticker || 'Unknown';
}

// Fetch Kalshi market data - ALWAYS fetches series for multi-outcome support
async function fetchKalshiData(marketTicker: string, seriesTicker?: string): Promise<any | null> {
  try {
    console.log("Fetching Kalshi data - market:", marketTicker, "series:", seriesTicker);
    
    const effectiveSeriesTicker = seriesTicker || marketTicker.split('-')[0];
    console.log("Fetching Kalshi series:", effectiveSeriesTicker);
    
    const seriesUrl = `https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=${effectiveSeriesTicker}&status=open&limit=50`;
    console.log("Calling Kalshi API:", seriesUrl);
    
    const response = await fetch(seriesUrl, {
      headers: { "Accept": "application/json" }
    });
    
    console.log("Kalshi API response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log("Kalshi API error:", errorText);
      return null;
    }
    
    const data = await response.json();
    const markets = data.markets || [];
    
    console.log(`Found ${markets.length} markets in series ${effectiveSeriesTicker}`);
    
    if (markets.length === 0) {
      return null;
    }
    
    // DEBUG: Log raw market data to see available fields
    console.log("===== RAW KALSHI DATA SAMPLE =====");
    markets.slice(0, 3).forEach((m: any, i: number) => {
      console.log(`Market ${i + 1}: ticker="${m.ticker}"`);
      console.log(`  title: "${m.title}"`);
      console.log(`  subtitle: "${m.subtitle || 'NONE'}"`);
      console.log(`  floor_strike: ${m.floor_strike}`);
      console.log(`  cap_strike: ${m.cap_strike}`);
      console.log(`  yes_sub_title: "${m.yes_sub_title || 'NONE'}"`);
      console.log(`  no_sub_title: "${m.no_sub_title || 'NONE'}"`);
      console.log(`  yes_bid: ${m.yes_bid}, last_price: ${m.last_price}`);
    });
    console.log("===== END RAW DATA =====");
    
    // Check if this is a ranged market
    const hasRangeData = markets.some((m: any) => 
      m.floor_strike !== undefined || m.cap_strike !== undefined || 
      m.yes_sub_title || m.no_sub_title
    );
    
    // Format all markets as outcomes
    const formattedMarkets = markets
      .map((m: any) => {
        const yesPrice = m.yes_bid ? m.yes_bid / 100 : 
                        (m.last_price ? m.last_price / 100 : 0);
        const noPrice = m.no_bid ? m.no_bid / 100 : (1 - yesPrice);
        
        // Extract outcome - try multiple strategies
        let outcome = "";
        
        // Strategy 1: Use floor_strike and cap_strike if available
        if (m.floor_strike !== undefined && m.cap_strike !== undefined) {
          const min = Number(m.floor_strike).toLocaleString();
          const max = Number(m.cap_strike).toLocaleString();
          outcome = `${min} to ${max}`;
          console.log(`Using floor/cap_strike: ${outcome}`);
        }
        // Strategy 2: Use yes_sub_title (often contains the range or candidate name)
        else if (m.yes_sub_title && m.yes_sub_title.trim()) {
          outcome = m.yes_sub_title.trim();
          console.log(`Using yes_sub_title: ${outcome}`);
        }
        // Strategy 3: Use subtitle
        else if (m.subtitle && m.subtitle.trim()) {
          outcome = m.subtitle.trim();
          console.log(`Using subtitle: ${outcome}`);
        }
        // Strategy 4: Use robust extractor on full market object
        else {
          outcome = extractOutcome(m);
          console.log(`Using extracted outcome: ${outcome}`);
        }
        
        const urlSlug = effectiveSeriesTicker.toLowerCase().replace(/_/g, '-');
        const volume = Number(m.volume);
        const safeVolume = isNaN(volume) ? 0 : volume;
        const liquidity = Number(m.open_interest);
        const safeLiquidity = isNaN(liquidity) ? 0 : liquidity;
        
        return {
          question: outcome,
          fullTitle: m.title || m.subtitle || m.ticker,
          yesPrice: (yesPrice * 100).toFixed(1),
          noPrice: (noPrice * 100).toFixed(1),
          volume: safeVolume,
          liquidity: safeLiquidity,
          url: `https://kalshi.com/markets/${urlSlug}`,
          ticker: m.ticker
        };
      })
      .filter((m: any) => parseFloat(m.yesPrice) > 0.1)
      .sort((a: any, b: any) => parseFloat(b.yesPrice) - parseFloat(a.yesPrice));
    
    console.log(`Formatted ${formattedMarkets.length} outcomes:`, 
                formattedMarkets.slice(0, 5).map((m: any) => `"${m.question}": ${m.yesPrice}%`).join(', '));
    
    // Determine if multi-outcome
    const significantMarkets = formattedMarkets.filter((m: any) => parseFloat(m.yesPrice) >= 5);
    const isMultiOutcome = significantMarkets.length > 1;
    
    // Extract event title
    let eventTitle = markets[0]?.event_ticker_name || effectiveSeriesTicker;
    if (markets[0]?.title) {
      // For "who will be" markets
      const whoMatch = markets[0].title.match(/be\s+the\s+next\s+(.+?)\?/i);
      if (whoMatch) {
        eventTitle = `Who will be the next ${whoMatch[1]}?`;
      }
      // For "how many" / range markets
      else if (hasRangeData || /how\s+many/i.test(markets[0].title)) {
        eventTitle = markets[0].title.replace(/\?$/, '').trim() + '?';
      }
    }
    
    const urlSlug = effectiveSeriesTicker.toLowerCase().replace(/_/g, '-');
    
    return {
      platform: 'kalshi',
      eventTitle: eventTitle,
      eventSlug: effectiveSeriesTicker,
      category: markets[0]?.category || "General",
      url: `https://kalshi.com/markets/${urlSlug}`,
      targetMarket: marketTicker ? formattedMarkets.find((m: any) => 
        m.ticker?.toUpperCase() === marketTicker.toUpperCase()
      ) : formattedMarkets[0],
      allMarkets: formattedMarkets.slice(0, 5), // Limit to top 5 outcomes to prevent spam
      totalMarketCount: formattedMarkets.length,
      totalVolume: markets.reduce((sum: number, m: any) => {
        const vol = Number(m.volume);
        return sum + (isNaN(vol) ? 0 : vol);
      }, 0),
      source: "kalshi-api-series",
      isMultiOutcome: isMultiOutcome,
      marketType: hasRangeData ? 'range' : 'multi-outcome'
    };
    
  } catch (error) {
    console.error("Error fetching Kalshi data:", error);
    return null;
  }
}

async function fetchPolymarketData(urlPath: string): Promise<any | null> {
  try {
    console.log("Fetching Polymarket data for URL path:", urlPath);
    
    let cleanPath = urlPath.replace(/\?.*$/, '').replace(/\/+$/, '').replace(/^\/+/, '');
    
    const parts = cleanPath.split('/').filter(Boolean);
    const eventSlug = parts[0];
    const marketSlug = parts.length > 1 ? parts[1] : null;
    
    // Strip numeric suffix from slug (e.g., "college-football-champion-2026-684" -> "college-football-champion-2026")
    const baseSlug = eventSlug.replace(/-\d+$/, '');
    // Also try just the core words without year/numbers at end
    const coreSlug = eventSlug.replace(/-\d{4}(-\d+)?$/, '').replace(/-\d+$/, '');
    
    console.log("Looking for eventSlug:", eventSlug, "baseSlug:", baseSlug, "coreSlug:", coreSlug, "marketSlug:", marketSlug);
    
    // ============= TRY DOME API FIRST WITH COMPREHENSIVE DATA =============
    if (DOME_API_KEY) {
      console.log("[Dome] Attempting comprehensive Dome API lookup for:", eventSlug);
      const slugsToTry = [eventSlug, baseSlug, coreSlug].filter((s, i, arr) => arr.indexOf(s) === i);
      
      for (const slugAttempt of slugsToTry) {
        const comprehensiveData = await dome.getComprehensiveMarketData(slugAttempt);
        
        if (comprehensiveData && comprehensiveData.market) {
          const { market: domeMarket, priceA, priceB, recentTrades, tradeFlow, whales, volatility } = comprehensiveData;
          
          console.log("[Dome] Found comprehensive market data:", domeMarket.market_slug || domeMarket.title);
          console.log("[Dome] Trade flow:", tradeFlow.direction, "Strength:", tradeFlow.strength.toFixed(2));
          console.log("[Dome] Whale active:", whales.isWhaleActive, "Total Volume:", whales.totalWhaleVolume.toFixed(0));
          console.log("[Dome] Volatility:", volatility.isVolatile, "Swing:", (volatility.weeklySwing * 100).toFixed(1) + "%");
          
          // Get market state using the helper
          const marketState = getDomeMarketState(domeMarket);
          console.log("[Dome] Market state:", marketState.statusText);
          
          const yesPriceValue = priceA?.price || 0.5;
          const noPriceValue = priceB?.price || (1 - yesPriceValue);
          
          const marketUrl = `https://polymarket.com/event/${domeMarket.market_slug || eventSlug}`;
          
          // Format recent trades for context
          const formattedTrades = recentTrades.slice(0, 5).map((t: any) => ({
            side: t.side,
            price: t.price,
            size: t.shares_normalized || t.size || 0,
            amount: (t.shares_normalized || t.size || 0) * (t.price || 0)
          }));
          
          return {
            platform: 'polymarket',
            eventTitle: domeMarket.title,
            eventSlug: domeMarket.market_slug || eventSlug,
            category: domeMarket.tags?.[0] || "General",
            url: marketUrl,
            endDate: domeMarket.end_time ? new Date(domeMarket.end_time * 1000).toISOString() : null,
            targetMarket: {
              question: domeMarket.title,
              yesPrice: (yesPriceValue * 100).toFixed(1),
              noPrice: (noPriceValue * 100).toFixed(1),
              volume: domeMarket.volume_total || 0,
              liquidity: 0,
              url: marketUrl,
              outcomes: domeMarket.side_a && domeMarket.side_b ? [
                { label: domeMarket.side_a.label, price: (yesPriceValue * 100).toFixed(1) },
                { label: domeMarket.side_b.label, price: (noPriceValue * 100).toFixed(1) }
              ] : undefined
            },
            allMarkets: [{
              question: domeMarket.title,
              yesPrice: (yesPriceValue * 100).toFixed(1),
              noPrice: (noPriceValue * 100).toFixed(1),
              volume: domeMarket.volume_total || 0,
              liquidity: 0,
              url: marketUrl
            }],
            totalMarketCount: 1,
            totalVolume: domeMarket.volume_total || 0,
            volumeWeek: domeMarket.volume_1_week || 0,
            volumeMonth: domeMarket.volume_1_month || 0,
            // Enhanced status info
            status: marketState.statusText,
            isActive: marketState.isActive,
            isResolved: marketState.isResolved,
            isClosed: marketState.isClosed,
            winningSide: marketState.winner,
            // Comprehensive Dome data
            tradeFlow: {
              direction: tradeFlow.direction,
              strength: tradeFlow.strength,
              buyCount: tradeFlow.buyCount,
              sellCount: tradeFlow.sellCount,
              recentTrades: formattedTrades
            },
            whaleActivity: {
              isActive: whales.isWhaleActive,
              whaleCount: whales.whaleCount,
              totalVolume: whales.totalWhaleVolume,
              buyVolume: whales.buyVolume,
              sellVolume: whales.sellVolume,
              largestTrade: whales.largestTrade,
              topWhale: whales.topWhale
            },
            volatility: {
              isVolatile: volatility.isVolatile,
              weeklySwing: volatility.weeklySwing
            },
            source: "dome-api-comprehensive"
          };
        }
      }
      console.log("[Dome] Comprehensive market data not found, falling back to Gamma API");
    }
    
    // ============= FALLBACK TO GAMMA API =============
    // Try direct event lookup first (faster)
    const slugsToTry = [eventSlug, baseSlug, coreSlug].filter((s, i, arr) => arr.indexOf(s) === i);
    
    for (const slugAttempt of slugsToTry) {
      try {
        const directResponse = await fetch(
          `https://gamma-api.polymarket.com/events?slug=${slugAttempt}`,
          { headers: { "Accept": "application/json" } }
        );
        if (directResponse.ok) {
          const events = await directResponse.json();
          if (events && events.length > 0) {
            console.log("Found event via direct slug lookup:", events[0].slug);
            return { ...formatEventData(events[0], marketSlug), platform: 'polymarket' };
          }
        }
      } catch (e) {
        console.log("Direct slug lookup failed for:", slugAttempt);
      }
    }
    
    if (marketSlug) {
      console.log("Trying to find market by slug:", marketSlug);
      try {
        const marketResponse = await fetch(
          `https://gamma-api.polymarket.com/markets?slug=${marketSlug}&closed=false`,
          { headers: { "Accept": "application/json" } }
        );
        if (marketResponse.ok) {
          const markets = await marketResponse.json();
          if (markets && markets.length > 0) {
            const market = markets[0];
            console.log("Found market via slug query:", market.slug);
            const parentEventSlug = market.events?.[0]?.slug || eventSlug;
            return { ...formatMarketData(market, parentEventSlug), platform: 'polymarket' };
          }
        }
      } catch (e) {
        console.log("Market slug query failed:", e);
      }
    }
    
    // Search through all active markets
    console.log("Searching markets for event slug:", eventSlug);
    try {
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=200`,
        { headers: { "Accept": "application/json" } }
      );
      
      if (response.ok) {
        const markets = await response.json();
        console.log(`Searching through ${markets.length} markets`);
        
        // Convert slug to search terms for title matching
        const searchTerms = coreSlug.split('-').filter((w: string) => w.length > 2);
        
        const matchingMarkets = markets.filter((m: any) => {
          const parentSlug = m.events?.[0]?.slug || '';
          const title = (m.question || '').toLowerCase();
          const eventTitle = (m.events?.[0]?.title || '').toLowerCase();
          
          // Exact or partial slug match
          if (parentSlug === eventSlug || 
              parentSlug === baseSlug ||
              parentSlug.toLowerCase().includes(baseSlug.toLowerCase()) ||
              baseSlug.toLowerCase().includes(parentSlug.toLowerCase().replace(/-\d+$/, ''))) {
            return true;
          }
          
          // Title-based match - check if most search terms are in title
          const matchCount = searchTerms.filter((term: string) => 
            title.includes(term.toLowerCase()) || eventTitle.includes(term.toLowerCase())
          ).length;
          
          return matchCount >= Math.ceil(searchTerms.length * 0.6);
        });
        
        if (matchingMarkets.length > 0) {
          console.log(`Found ${matchingMarkets.length} matching markets`);
          const parentEventSlug = matchingMarkets[0].events?.[0]?.slug || eventSlug;
          const parentEventTitle = matchingMarkets[0].events?.[0]?.title || matchingMarkets[0].question;
          
          // Sort by volume - return ALL markets for chooser display
          const sortedMatches = matchingMarkets.sort((a: any, b: any) => 
            (parseFloat(b.volume) || 0) - (parseFloat(a.volume) || 0)
          );
          
          return {
            platform: 'polymarket',
            eventTitle: parentEventTitle,
            eventSlug: parentEventSlug,
            category: matchingMarkets[0].events?.[0]?.category || "General",
            url: `https://polymarket.com/event/${parentEventSlug}`,
            targetMarket: marketSlug ? formatSingleMarket(sortedMatches.find((m: any) => m.slug === marketSlug) || sortedMatches[0], parentEventSlug) : null,
            allMarkets: sortedMatches.map((m: any) => formatSingleMarket(m, parentEventSlug)), // Return ALL markets
            totalMarketCount: matchingMarkets.length,
            totalVolume: matchingMarkets.reduce((sum: number, m: any) => sum + (parseFloat(m.volume) || 0), 0),
            source: "gamma-api-markets"
          };
        }
      }
    } catch (e) {
      console.log("Market search failed:", e);
    }
    
    // Fallback to events endpoint with broader search
    console.log("Falling back to events endpoint for:", eventSlug);
    try {
      const eventsResponse = await fetch(
        `https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&order=volume24hr&ascending=false`,
        { headers: { "Accept": "application/json" } }
      );
      
      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        console.log(`Searching through ${events.length} events`);
        
        const searchTerms = coreSlug.split('-').filter((w: string) => w.length > 2);
        
        const matchingEvent = events.find((e: any) => {
          const eSlug = e.slug?.toLowerCase() || '';
          const eTitle = (e.title || '').toLowerCase();
          const target = eventSlug.toLowerCase();
          const baseTarget = baseSlug.toLowerCase();
          
          // Slug matches
          if (eSlug === target || eSlug === baseTarget ||
              eSlug.includes(baseTarget) || baseTarget.includes(eSlug.replace(/-\d+$/, ''))) {
            return true;
          }
          
          // Title match
          const matchCount = searchTerms.filter((term: string) => eTitle.includes(term.toLowerCase())).length;
          return matchCount >= Math.ceil(searchTerms.length * 0.6);
        });
        
        if (matchingEvent) {
          console.log("Found event via events endpoint:", matchingEvent.slug);
          return { ...formatEventData(matchingEvent, marketSlug), platform: 'polymarket' };
        }
      }
    } catch (e) {
      console.log("Events search failed:", e);
    }
    
    console.log("No matching data found for:", eventSlug);
    return null;
    
  } catch (error) {
    console.error("Error fetching Polymarket data:", error);
    return null;
  }
}

function formatSingleMarket(market: any, parentEventSlug: string): any {
  let yesPrice = 0.5;
  try {
    if (market.outcomePrices) {
      const prices = typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices;
      yesPrice = parseFloat(prices[0]) || 0.5;
    }
  } catch { yesPrice = 0.5; }
  
  // Extract both YES and NO token IDs by outcome
  let yesTokenId = null;
  let noTokenId = null;
  try {
    if (market.tokens && market.tokens.length > 0) {
      // Find YES and NO tokens by outcome property
      const yesToken = market.tokens.find((t: any) => t.outcome?.toLowerCase() === 'yes');
      const noToken = market.tokens.find((t: any) => t.outcome?.toLowerCase() === 'no');
      yesTokenId = yesToken?.token_id || market.tokens[0]?.token_id; // Fallback to first token for YES
      noTokenId = noToken?.token_id || market.tokens[1]?.token_id; // Fallback to second token for NO
    }
  } catch { /* ignore */ }
  
  const marketUrl = market.slug 
    ? `https://polymarket.com/event/${parentEventSlug}/${market.slug}`
    : `https://polymarket.com/event/${parentEventSlug}`;
  
  return {
    question: market.question,
    yesPrice: (yesPrice * 100).toFixed(1),
    noPrice: ((1 - yesPrice) * 100).toFixed(1),
    volume: parseFloat(market.volume) || 0,
    liquidity: parseFloat(market.liquidity) || 0,
    url: marketUrl,
    tokenId: yesTokenId, // Keep for backward compatibility
    yesTokenId,
    noTokenId
  };
}

function formatMarketData(market: any, parentEventSlug: string): any {
  const formatted = formatSingleMarket(market, parentEventSlug);
  
  return {
    eventTitle: market.events?.[0]?.title || market.question,
    eventSlug: parentEventSlug,
    category: market.events?.[0]?.category || "General",
    url: `https://polymarket.com/event/${parentEventSlug}`,
    targetMarket: formatted,
    allMarkets: [formatted],
    totalVolume: parseFloat(market.volume) || 0,
    source: "gamma-api-markets"
  };
}

function formatEventData(event: any, targetMarketSlug: string | null): any {
  const markets = event.markets || [];
  
  let targetMarket = null;
  if (targetMarketSlug) {
    targetMarket = markets.find((m: any) => 
      m.slug === targetMarketSlug || 
      m.slug?.toLowerCase() === targetMarketSlug.toLowerCase()
    );
  }
  
  const formatMarket = (m: any) => {
    let yesPrice = 0.5;
    try {
      if (m.outcomePrices) {
        const prices = typeof m.outcomePrices === 'string' 
          ? JSON.parse(m.outcomePrices) 
          : m.outcomePrices;
        yesPrice = parseFloat(prices[0]) || 0.5;
      }
    } catch { yesPrice = 0.5; }
    
    // Extract both YES and NO token IDs by outcome
    let yesTokenId = null;
    let noTokenId = null;
    try {
      if (m.tokens && m.tokens.length > 0) {
        const yesToken = m.tokens.find((t: any) => t.outcome?.toLowerCase() === 'yes');
        const noToken = m.tokens.find((t: any) => t.outcome?.toLowerCase() === 'no');
        yesTokenId = yesToken?.token_id || m.tokens[0]?.token_id;
        noTokenId = noToken?.token_id || m.tokens[1]?.token_id;
      }
    } catch { /* ignore */ }
    
    const marketUrl = m.slug 
      ? `https://polymarket.com/event/${event.slug}/${m.slug}`
      : `https://polymarket.com/event/${event.slug}`;
    
    return {
      question: m.question,
      yesPrice: (yesPrice * 100).toFixed(1),
      noPrice: ((1 - yesPrice) * 100).toFixed(1),
      volume: parseFloat(m.volume) || 0,
      liquidity: parseFloat(m.liquidity) || 0,
      url: marketUrl,
      tokenId: yesTokenId,
      yesTokenId,
      noTokenId
    };
  };
  
  // Filter and sort markets: exclude expired (50/50) and sort by volume
  const validMarkets = markets
    .filter((m: any) => {
      // Skip closed/resolved markets
      if (m.closed === true || m.resolved === true) return false;
      
      // Skip 50/50 markets (expired/suspended)
      try {
        if (m.outcomePrices) {
          const prices = typeof m.outcomePrices === 'string' 
            ? JSON.parse(m.outcomePrices) 
            : m.outcomePrices;
          const yesPrice = parseFloat(prices[0]) || 0.5;
          if (yesPrice === 0.5) return false;
        }
      } catch { /* keep it */ }
      
      return true;
    })
    .sort((a: any, b: any) => {
      const volA = parseFloat(a.volume) || 0;
      const volB = parseFloat(b.volume) || 0;
      return volB - volA; // Sort by volume descending
    });
  
  // Return ALL valid markets - let Claude show chooser for multi-market events
  return {
    eventTitle: event.title,
    eventSlug: event.slug,
    description: event.description,
    category: event.category || "General",
    endDate: event.endDate,
    targetMarket: targetMarket ? formatMarket(targetMarket) : null,
    allMarkets: validMarkets.map(formatMarket), // Return ALL markets
    totalMarketCount: validMarkets.length,
    totalVolume: markets.reduce((sum: number, m: any) => sum + (parseFloat(m.volume) || 0), 0),
    url: `https://polymarket.com/event/${event.slug}`,
    source: "gamma-api"
  };
}

// Sanitize messages to remove orphaned tool_use blocks that could cause Claude errors
// CRITICAL: Also remove web_search tool blocks which can cause "no web_search_tool_result" errors
function sanitizeMessages(messages: any[]): any[] {
  return messages.map((msg, idx) => {
    // If content is an array (Claude's structured format)
    if (Array.isArray(msg.content)) {
      // Filter out tool_use blocks AND web_search related blocks
      // These can cause errors if included without proper tool_result responses
      const relevantBlocks = msg.content.filter((block: any) => {
        // Remove any tool_use blocks (including web_search)
        if (block.type === 'tool_use') {
          console.log(`[Sanitize] Removing tool_use block: ${block.name || 'unknown'}`);
          return false;
        }
        // Remove web_search_tool_result blocks (native web search results)
        if (block.type === 'web_search_tool_result') {
          console.log(`[Sanitize] Removing web_search_tool_result block`);
          return false;
        }
        // Remove server_tool_use blocks (another form of web_search)
        if (block.type === 'server_tool_use') {
          console.log(`[Sanitize] Removing server_tool_use block`);
          return false;
        }
        // Keep text blocks
        if (block.type === 'text') {
          return true;
        }
        // Remove tool_result blocks from history as they can cause orphan issues
        if (block.type === 'tool_result') {
          console.log(`[Sanitize] Removing orphaned tool_result block`);
          return false;
        }
        return false;
      });
      
      if (relevantBlocks.length === 0) {
        console.log(`[Sanitize] Message ${idx}: No relevant content after filtering, skipping`);
        return null;
      }
      
      // Flatten to text only - don't preserve complex structures in history
      const textContent = relevantBlocks
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');
      
      if (!textContent.trim()) {
        console.log(`[Sanitize] Message ${idx}: Empty text content, skipping`);
        return null;
      }
      
      return { role: msg.role, content: textContent };
    }
    
    // String content - check for embedded tool artifacts
    if (typeof msg.content === 'string') {
      // Skip messages that contain tool use patterns that could cause errors
      if (msg.content.includes('"type":"tool_use"') || 
          msg.content.includes('"type":"web_search"') ||
          msg.content.includes('web_search_tool_result') ||
          msg.content.includes('server_tool_use')) {
        console.log(`[Sanitize] Message ${idx}: Contains tool artifacts in string, skipping`);
        return null;
      }
      return { role: msg.role, content: msg.content };
    }
    
    return null;
  }).filter(Boolean);
}

serve(async (req) => {
  // Handle CORS preflight with full headers
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      }
    });
  }

  // ============= BOT PROTECTION CHECKS =============
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || '';
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // 1. Block known bad IPs FIRST (fastest check)
  if (isBlockedIP(clientIP)) {
    console.log(`[BOT BLOCK] 🚫 Blocked IP: ${clientIP}`);
    return corsResponse(
      { error: "Access denied." },
      403
    );
  }

  // 2. Block non-browser user agents (stops 96.5% of bot abuse)
  if (isBlockedUserAgent(userAgent)) {
    console.log(`[BOT BLOCK] 🚫 Blocked UA: ${userAgent.substring(0, 50)} from IP: ${clientIP}`);
    return corsResponse(
      { error: "Automated access not permitted. Please use the web interface at polyai.pro" },
      403
    );
  }

  // 3. Validate origin (only if origin header is present)
  if (origin && !isAllowedOrigin(origin)) {
    console.log(`[BOT BLOCK] 🚫 Invalid origin: ${origin} from IP: ${clientIP}`);
    return corsResponse(
      { error: "Invalid origin. Please use the official site." },
      403
    );
  }

  // 4. Suspicious: No user agent at all
  if (!userAgent || userAgent.length < 10) {
    console.log(`[BOT BLOCK] 🚫 Missing/short UA from IP: ${clientIP}`);
    return corsResponse(
      { error: "Invalid request." },
      403
    );
  }

  // ============= RATE LIMITING CHECK =============
  const ipRateLimit = checkRateLimit(clientIP, rateLimitMap, RATE_LIMIT.IP_MAX_REQUESTS, RATE_LIMIT.IP_WINDOW_MS);
  
  if (!ipRateLimit.allowed) {
    console.log(`[RATE LIMIT] IP ${clientIP} exceeded limit. Reset in ${Math.ceil(ipRateLimit.resetIn / 1000)}s`);
    return corsResponse(
      { 
        error: "Too many requests. Please slow down.",
        retryAfter: Math.ceil(ipRateLimit.resetIn / 1000)
      },
      429,
      { "Retry-After": String(Math.ceil(ipRateLimit.resetIn / 1000)) }
    );
  }

  try {
    const { messages, detailMode = "advanced", voiceMode = false, marketUrl: providedMarketUrl, currentMarket, explicitContext, conversationId, sidebarData, authToken, walletAddress, authType, deepResearch = false } = await req.json();
    
    // ============= AUTHENTICATION REQUIRED =============
    // Require either Supabase auth OR wallet connection
    if (!authToken && !walletAddress) {
      console.log(`[AUTH] ❌ Unauthenticated request from IP: ${clientIP}`);
      return corsResponse(
        { error: "Authentication required. Please sign in or connect your wallet." },
        401
      );
    }

    // Determine user identifier for rate limiting
    let userId: string | null = null;
    let authMethod: string = 'unknown';

    if (authToken) {
      // Verify Supabase JWT token
      try {
        const authSupabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!
        );
        const { data: { user }, error: authError } = await authSupabase.auth.getUser(authToken);
        
        if (authError || !user) {
          console.log(`[AUTH] ❌ Invalid auth token from IP: ${clientIP}`);
          return corsResponse(
            { error: "Invalid authentication token. Please sign in again." },
            401
          );
        }
        userId = user.id;
        authMethod = 'supabase';
        console.log(`[AUTH] ✅ Supabase user: ${userId.substring(0, 8)}...`);
      } catch (authErr) {
        console.error(`[AUTH] Token verification error:`, authErr);
        return corsResponse(
          { error: "Authentication error. Please try again." },
          401
        );
      }
    } else if (walletAddress) {
      // Use wallet address as user identifier
      // Basic validation - should be a valid Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        console.log(`[AUTH] ❌ Invalid wallet address: ${walletAddress.substring(0, 10)}...`);
        return corsResponse(
          { error: "Invalid wallet address." },
          401
        );
      }
      userId = walletAddress.toLowerCase();
      authMethod = 'wallet';
      console.log(`[AUTH] ✅ Wallet user: ${walletAddress.substring(0, 10)}...`);
    }

    // ============= USER-BASED RATE LIMITING (PRIMARY) =============
    if (userId) {
      const userRateLimit = checkRateLimit(userId, userRateLimitMap, RATE_LIMIT.USER_MAX_REQUESTS, RATE_LIMIT.USER_WINDOW_MS);
      
      if (!userRateLimit.allowed) {
        console.log(`[RATE LIMIT] User ${userId.substring(0, 12)}... exceeded limit. Reset in ${Math.ceil(userRateLimit.resetIn / 1000)}s`);
        return corsResponse(
          { 
            error: "Too many requests. Please slow down.",
            retryAfter: Math.ceil(userRateLimit.resetIn / 1000)
          },
          429,
          { "Retry-After": String(Math.ceil(userRateLimit.resetIn / 1000)) }
        );
      }
    }

    // Per-conversation rate limiting (if conversationId provided)
    if (conversationId) {
      const convRateLimit = checkRateLimit(conversationId, conversationRateLimitMap, RATE_LIMIT.CONV_MAX_REQUESTS, RATE_LIMIT.CONV_WINDOW_MS);
      if (!convRateLimit.allowed) {
        console.log(`[RATE LIMIT] Conversation ${conversationId.substring(0, 8)} exceeded limit`);
        return corsResponse(
          { 
            error: "Too many messages. Please wait a moment.",
            retryAfter: Math.ceil(convRateLimit.resetIn / 1000)
          },
          429,
          { "Retry-After": String(Math.ceil(convRateLimit.resetIn / 1000)) }
        );
      }
    }
    
    // Log request for monitoring
    console.log(`[Request] User: ${userId?.substring(0, 12) || 'none'}... (${authMethod}) Conv: ${conversationId?.substring(0, 8) || 'none'} Voice: ${voiceMode}`);
    
    // === CHAT LOGGING FOR ANALYTICS ===
    // Log to database for analysis (non-blocking)
    const lastUserMsg = messages?.filter((m: any) => m.role === 'user').pop();
    // userAgent already defined above in bot protection checks
    
    const logChatRequest = async () => {
      try {
        const logSupabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await logSupabase.from('chat_logs').insert({
          ip_address: clientIP,
          conversation_id: conversationId || null,
          user_message: lastUserMsg?.content?.substring(0, 2000) || '[no message]',
          message_count: messages?.length || 1,
          user_agent: userAgent.substring(0, 500),
          is_voice: voiceMode || false,
          detail_mode: detailMode || 'advanced'
        });
      } catch (logErr) {
        console.error('[LOG] Failed to save chat log:', logErr);
      }
    };
    // Fire and forget - don't wait for logging
    logChatRequest();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // CONVERSATION MEMORY: Load previous conversation history with timeout
    let conversationHistory: { role: string; content: string }[] = [];
    const MEMORY_TIMEOUT = 3000; // 3 second timeout for DB query
    
    if (conversationId) {
      try {
        // Wrap DB query in timeout to prevent hanging on 522 errors
        const historyPromise = supabase
          .from('conversation_messages')
          .select('role, content, tool_calls')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(20);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Memory load timeout')), MEMORY_TIMEOUT)
        );
        
        const { data: history, error: historyError } = await Promise.race([
          historyPromise,
          timeoutPromise.then(() => ({ data: null, error: { message: 'Timeout' } }))
        ]) as any;
        
        if (historyError) {
          console.warn('[Memory] Skipping history (continuing without):', historyError.message || historyError);
        } else if (history) {
          // Filter out messages with tool_calls to avoid "tool_use without tool_result" errors
          conversationHistory = (history || [])
            .filter((m: any) => {
              if (m.tool_calls) return false;
              if (!m.content) return false;
              if (typeof m.content === 'string') {
                const hasToolArtifacts = 
                  m.content.includes('tool_use') || 
                  m.content.includes('web_search') ||
                  m.content.includes('tool_result') ||
                  m.content.includes('server_tool_use') ||
                  m.content.includes('"type":"web_search"') ||
                  m.content.includes('web_search_tool_result');
                if (hasToolArtifacts) return false;
              }
              return true;
            })
            .map((m: any) => ({ role: m.role, content: m.content }));
          console.log(`[Memory] Loaded ${conversationHistory.length} messages for ${conversationId.substring(0, 8)}...`);
        }
      } catch (memoryError: any) {
        // Gracefully continue without history on any error
        console.warn('[Memory] Error loading history, continuing without:', memoryError.message || memoryError);
      }
    }
    
    // Merge conversation history with current messages
    // The current messages from client may be a subset, so we use stored history as the source of truth
    const currentUserMessage = messages[messages.length - 1];
    let messagesWithHistory = [...messages];
    
    if (conversationHistory.length > 0) {
      // Use database history + current message
      messagesWithHistory = [
        ...conversationHistory,
        currentUserMessage
      ];
      console.log(`[Memory] Using ${messagesWithHistory.length} messages (${conversationHistory.length} from DB + 1 current)`);
    }
    
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
    const userMessageLower = lastUserMessage?.content?.toLowerCase() || '';
    
    // ============= TEST DOME COMMAND =============
    // Allow users to verify Dome API connectivity with detailed logging
    if (userMessageLower.includes('test dome') || userMessageLower.includes('/test-dome')) {
      console.log('🧪 [TEST] User triggered Dome API connection test');
      
      const results: string[] = [];
      
      // Step 1: List ANY markets (no filter)
      console.log('[TEST] Fetching markets without filter...');
      results.push('Step 1: Discovering available markets\n');
      
      try {
        const response = await fetch(
          `https://api.domeapi.io/v1/polymarket/markets?limit=10&status=open`,
          {
            headers: {
              'Authorization': `Bearer ${DOME_API_KEY || ''}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log(`[TEST] Response status: ${response.status}`);
        const responseText = await response.text();
        console.log(`[TEST] Response body: ${responseText.substring(0, 1000)}`);
        
        const data = JSON.parse(responseText);
        
        if (data.markets && data.markets.length > 0) {
          results.push(`✅ Found ${data.markets.length} markets in Dome\n`);
          results.push('First 3 markets:');
          
          data.markets.slice(0, 3).forEach((m: any) => {
            results.push(`\n📊 "${m.market_slug}"`);
            results.push(`   Title: ${m.title}`);
            results.push(`   Volume: $${m.volume_total?.toLocaleString() || 0}`);
          });
          
          // Step 2: Test with first market
          const testSlug = data.markets[0].market_slug;
          results.push(`\n---\nStep 2: Testing with "${testSlug}"\n`);
          
          const ordersResponse = await fetch(
            `https://api.domeapi.io/v1/polymarket/orders?market_slug=${testSlug}&limit=10`,
            { headers: { 'Authorization': `Bearer ${DOME_API_KEY || ''}` } }
          );
          
          const ordersData = await ordersResponse.json();
          console.log(`[TEST] Orders response:`, JSON.stringify(ordersData).substring(0, 500));
          
          if (ordersData.orders && ordersData.orders.length > 0) {
            results.push(`✅ ${ordersData.orders.length} orders fetched`);
            const latest = ordersData.orders[0];
            results.push(`   Latest: ${latest.side} $${(latest.shares_normalized * latest.price).toFixed(2)}`);
          } else {
            results.push(`⚠️ No orders for this market`);
          }
          
        } else {
          results.push('❌ No markets returned from Dome API');
          results.push(`\nResponse: ${responseText.substring(0, 500)}`);
        }
        
      } catch (error) {
        console.error('[TEST] Error:', error);
        results.push(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      results.push('\n---\nConfiguration:');
      results.push(`✅ API Key: ${DOME_API_KEY ? 'Present' : '❌ MISSING'}`);
      
      return corsResponse({
        content: `🧪 Dome API Test\n\n${results.join('\n')}`,
        type: 'debug'
      });
    }
    
    const userWantsLiveData = lastUserMessage?.content && needsLiveData(lastUserMessage.content);
    const userWantsWhaleData = lastUserMessage?.content && needsWhaleData(lastUserMessage.content);
    const requestedCategory = lastUserMessage?.content ? detectCategory(lastUserMessage.content) : null;
    
    // ============= FOLLOW-UP QUERY DETECTION =============
    // Detect if user is asking for more detail about a market we already discussed
    const FOLLOWUP_KEYWORDS = {
    detailed_trades: ["dig deeper", "more detail", "trade data", "trades", "recent trades", "order flow", "trade history", "show trades"],
      whales: ["whale activity", "whales", "big money", "smart money", "whale", "large traders"],
      all_markets: ["all markets", "other markets", "across all", "rotation", "compare all", "all the markets", "every market"],
      volatility: ["volatility", "volatile", "price swings", "how volatile"]
    };
    
    // userMessageLower already defined above
    
    const detectFollowUpType = (msg: string): string | null => {
      for (const [type, keywords] of Object.entries(FOLLOWUP_KEYWORDS)) {
        if (keywords.some(kw => msg.includes(kw))) return type;
      }
      return null;
    };
    
    const followUpType = detectFollowUpType(userMessageLower);
    
    // If this is a follow-up query AND we have market context, fetch REAL data
    if (followUpType && currentMarket?.slug) {
      console.log(`[FOLLOWUP] Detected follow-up type: ${followUpType} for market: ${currentMarket.slug}`);
      
      // DETAILED TRADES: Fetch real trade history from Dome
      if (followUpType === 'detailed_trades') {
        console.log(`[FOLLOWUP] Fetching detailed trade data from Dome API...`);
        
        const trades = await dome.getTradeHistory({ 
          market_slug: currentMarket.slug, 
          limit: 100 
        });
        
        if (trades.length === 0) {
          return corsResponse({
            content: `I don't have recent trade data for this market yet. It might be too new or have low activity. Want me to check the whale tracker for broader market activity instead?`,
            type: "analysis"
          });
        }
        
        // Calculate REAL numbers from actual trades
        const now = Date.now() / 1000;
        const last24h = trades.filter((t: any) => t.timestamp > now - 86400);
        const buyTrades = last24h.filter((t: any) => (t.side || '').toUpperCase() === 'BUY');
        const sellTrades = last24h.filter((t: any) => (t.side || '').toUpperCase() === 'SELL');
        
        const buyVolume = buyTrades.reduce((sum: number, t: any) => {
          const shares = parseFloat(t.shares_normalized || t.shares || t.size || 0);
          const price = parseFloat(t.price || 0);
          return sum + (shares * price);
        }, 0);
        
        const sellVolume = sellTrades.reduce((sum: number, t: any) => {
          const shares = parseFloat(t.shares_normalized || t.shares || t.size || 0);
          const price = parseFloat(t.price || 0);
          return sum + (shares * price);
        }, 0);
        
        // Find largest trades
        const sortedBySize = [...last24h].sort((a: any, b: any) => {
          const sizeA = (parseFloat(a.shares_normalized || a.shares || a.size || 0)) * parseFloat(a.price || 0);
          const sizeB = (parseFloat(b.shares_normalized || b.shares || b.size || 0)) * parseFloat(b.price || 0);
          return sizeB - sizeA;
        });
        const top5Trades = sortedBySize.slice(0, 5);
        
        const formatTime = (ts: number) => {
          const d = new Date(ts * 1000);
          return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        };
        
        const formatSize = (amt: number) => {
          if (amt >= 1000) return `$${(amt / 1000).toFixed(1)}K`;
          return `$${amt.toFixed(0)}`;
        };
        
        const detailedAnalysis = `Here's the trade breakdown for the last 24 hours:

**Volume Summary**
• ${last24h.length} total trades
• ${buyTrades.length} buys (${formatSize(buyVolume)}) vs ${sellTrades.length} sells (${formatSize(sellVolume)})
• Net flow: ${buyVolume > sellVolume ? 'Buying pressure' : 'Selling pressure'} of ${formatSize(Math.abs(buyVolume - sellVolume))}

**Biggest Trades**
${top5Trades.length > 0 ? top5Trades.map((t: any, i: number) => {
  const size = (parseFloat(t.shares_normalized || t.shares || t.size || 0)) * parseFloat(t.price || 0);
  const side = (t.side || 'UNKNOWN').toUpperCase();
  const price = parseFloat(t.price || 0) * 100;
  const time = t.timestamp ? formatTime(t.timestamp) : 'N/A';
  return `• ${side} ${formatSize(size)} at ${price.toFixed(1)}% (${time})`;
}).join('\n') : '• No large trades in this window'}

**My Read**
${buyVolume > sellVolume * 1.2 
  ? 'Strong accumulation happening - buyers are clearly outpacing sellers. Could signal informed money moving in.'
  : sellVolume > buyVolume * 1.2
    ? 'Distribution phase - sellers are dominating. Watch for continued pressure or reversal.'
    : 'Pretty balanced flow right now. No clear directional signal from trade data.'}`;
        
        return corsResponse({
          content: detailedAnalysis,
          type: "analysis",
          marketSlug: currentMarket.slug,
          eventSlug: currentMarket.eventSlug
        });
      }
      
      // WHALE ANALYSIS: Fetch real whale data using new getWhaleActivity method
      if (followUpType === 'whales') {
        console.log(`[FOLLOWUP] Fetching whale data from Dome API...`);
        
        const whaleData = await dome.getWhaleActivity(currentMarket.slug, 1000);
        const marketData = await dome.getMarketBySlug(currentMarket.slug);
        
        if (whaleData.whaleCount === 0) {
          return corsResponse({
            content: `No whale activity data available for this market yet. It might have lower volume or be too new - whales typically show up once a market hits $100K+ volume. Want me to look at something else?`,
            type: "analysis"
          });
        }
        
        const totalVolume = marketData?.volume_1_week || 0;
        const concentration = totalVolume > 0 ? (whaleData.totalWhaleVolume / totalVolume * 100).toFixed(1) : '0';
        
        const formatVol = (v: number) => {
          if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
          if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
          return `$${v.toFixed(0)}`;
        };
        
        const whaleAnalysis = `Here's the whale activity for ${currentMarket.question || 'this market'}:

**Summary**
• ${whaleData.whaleCount} whale trades (>$1K each)
• Total whale volume: ${formatVol(whaleData.totalWhaleVolume)}
• Buy volume: ${formatVol(whaleData.buyVolume)} | Sell volume: ${formatVol(whaleData.sellVolume)}
• Largest single trade: ${formatVol(whaleData.largestTrade)}

**Top Whales**
${whaleData.topWhales.slice(0, 5).map((t: any, i: number) => {
  const addr = t.user ? `${t.user.slice(0, 6)}...${t.user.slice(-4)}` : 'Unknown';
  const vol = formatVol(t.volume || 0);
  return `• ${addr} — ${vol} (${t.tradeCount} trades)`;
}).join('\n')}

**Concentration**
• Whale volume: ${formatVol(whaleData.totalWhaleVolume)}
• Market volume (7d): ${formatVol(totalVolume)}
• Whale share: ${concentration}%

**My Take**
${parseFloat(concentration) > 30 
  ? `That's high concentration (${concentration}%). Whales have significant control here - watch for potential manipulation or big moves when they exit.`
  : parseFloat(concentration) > 15 
    ? `Moderate whale influence at ${concentration}%. Keep an eye on large position changes - they could move the market.`
    : `Healthy distribution at ${concentration}%. No single dominant player, which is good for fair price discovery.`}

${whaleData.buyVolume > whaleData.sellVolume * 1.3 
  ? `**Signal**: Whales are net BUYING (${formatVol(whaleData.buyVolume - whaleData.sellVolume)} more buys). Could indicate smart money accumulation.`
  : whaleData.sellVolume > whaleData.buyVolume * 1.3
    ? `**Signal**: Whales are net SELLING (${formatVol(whaleData.sellVolume - whaleData.buyVolume)} more sells). Watch for distribution.`
    : `**Signal**: Balanced whale flow - no strong directional bias.`}`;
        
        return corsResponse({
          content: whaleAnalysis,
          type: "analysis",
          marketSlug: currentMarket.slug,
          eventSlug: currentMarket.eventSlug
        });
      }
      
      // ALL MARKETS ANALYSIS: Fetch all markets in event
      if (followUpType === 'all_markets' && currentMarket.eventSlug) {
        console.log(`[FOLLOWUP] Analyzing all markets in event: ${currentMarket.eventSlug}`);
        
        try {
          const eventResponse = await fetch(
            `https://gamma-api.polymarket.com/events?slug=${currentMarket.eventSlug}`
          );
          
          if (!eventResponse.ok) {
            throw new Error('Failed to fetch event data');
          }
          
          const eventData = await eventResponse.json();
          const allMarkets = eventData[0]?.markets || [];
          
          console.log(`[FOLLOWUP] Found ${allMarkets.length} markets in event`);
          
          if (allMarkets.length === 0) {
            return corsResponse({
              content: `I couldn't find the markets for this event. Try pasting the direct event URL and I'll analyze it.`,
              type: "analysis"
            });
          }
          
          // Sort by volume and take top 10
          const topMarkets = allMarkets
            .sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0))
            .slice(0, 10);
          
          // Analyze each market with Dome
          const marketAnalyses = await Promise.all(
            topMarkets.map(async (m: any) => {
              const trades = await dome.getTradeHistory({ market_slug: m.market_slug, limit: 20 });
              
              const buyVol = trades
                .filter((t: any) => (t.side || '').toUpperCase() === 'BUY')
                .reduce((s: number, t: any) => s + (parseFloat(t.shares_normalized || t.size || 0) * parseFloat(t.price || 0)), 0);
              const sellVol = trades
                .filter((t: any) => (t.side || '').toUpperCase() === 'SELL')
                .reduce((s: number, t: any) => s + (parseFloat(t.shares_normalized || t.size || 0) * parseFloat(t.price || 0)), 0);
              
              return {
                question: m.question || m.title,
                slug: m.market_slug,
                volume: m.volume || 0,
                yesPrice: parseFloat(m.outcomes?.[0]?.price || m.yes_price || 0) * 100,
                buyVol,
                sellVol,
                netFlow: buyVol - sellVol
              };
            })
          );
          
          // Calculate aggregates
          const totalVolume = marketAnalyses.reduce((s, m) => s + m.volume, 0);
          const totalBuyVol = marketAnalyses.reduce((s, m) => s + m.buyVol, 0);
          const totalSellVol = marketAnalyses.reduce((s, m) => s + m.sellVol, 0);
          const netFlow = totalBuyVol - totalSellVol;
          
          const strongBuying = marketAnalyses
            .filter(m => m.netFlow > 0)
            .sort((a, b) => b.netFlow - a.netFlow)
            .slice(0, 3);
          
          const strongSelling = marketAnalyses
            .filter(m => m.netFlow < 0)
            .sort((a, b) => a.netFlow - b.netFlow)
            .slice(0, 3);
          
          const formatVol = (v: number) => {
            if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
            if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
            return `$${v.toFixed(0)}`;
          };
          
          const multiMarketAnalysis = `Here's the breakdown across all ${allMarkets.length} markets in this event:

**Overall Flow**
• Total volume: ${formatVol(totalVolume)}
• Buy pressure: ${formatVol(totalBuyVol)}
• Sell pressure: ${formatVol(totalSellVol)}
• Net: ${netFlow > 0 ? 'Buying +' : 'Selling -'}${formatVol(Math.abs(netFlow))}

**Where Money Is Flowing In**
${strongBuying.length > 0 ? strongBuying.map((m, i) => 
  `• ${m.question.slice(0, 40)}${m.question.length > 40 ? '...' : ''} (+${formatVol(m.netFlow)})`
).join('\n') : '• No strong buying on any specific outcome'}

**Where Money Is Flowing Out**
${strongSelling.length > 0 ? strongSelling.map((m, i) => 
  `• ${m.question.slice(0, 40)}${m.question.length > 40 ? '...' : ''} (-${formatVol(Math.abs(m.netFlow))})`
).join('\n') : '• No strong selling on any specific outcome'}

**My Take**
${netFlow > 5000 
  ? `Strong buying pressure across this event (+${formatVol(netFlow)} net). Whales are accumulating - could signal conviction on certain outcomes.`
  : netFlow < -5000
    ? `Notable selling across this event (-${formatVol(Math.abs(netFlow))} net). Could be profit-taking or distribution.`
    : `Flow is pretty balanced. Whales are rotating between outcomes rather than taking directional bets.`}`;
          
          return new Response(
            JSON.stringify({
              content: multiMarketAnalysis,
              type: "analysis",
              marketSlug: currentMarket.slug,
              eventSlug: currentMarket.eventSlug
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (err) {
          console.error('[FOLLOWUP] Error analyzing all markets:', err);
        }
      }
      
      // Arbitrage analysis removed - no longer supported
    }
    
    // Check for contextual references like "this market", "more about this", etc.
    const userMessage = lastUserMessage?.content?.toLowerCase() || '';
    const isContextualRequest = /\b(this|that|it|the market|this market|that market|more about|more info|tell me more|what do you think|whale.*(this|it)|data.*(this|it)|yes|yeah|sure|okay|please|continue|go on|do it)\b/i.test(userMessage);
    
    // CHOOSER SELECTION DETECTION - Handle user responding to multi-market chooser
    const chooserSelectionMatch = userMessage.match(/^(?:analyze\s+)?(?:market\s+)?(\d+(?:\s*,\s*\d+)*|a|all|q|quick)$/i);
    const isChooserSelection = chooserSelectionMatch !== null;
    let selectedMarketIndices: number[] = [];
    let wantsAllMarkets = false;
    let wantsQuickCompare = false;
    
    if (isChooserSelection && chooserSelectionMatch) {
      const selection = chooserSelectionMatch[1].toLowerCase().trim();
      if (selection === 'a' || selection === 'all') {
        wantsAllMarkets = true;
        console.log('[CHOOSER] User selected ALL markets');
      } else if (selection === 'q' || selection === 'quick') {
        wantsQuickCompare = true;
        console.log('[CHOOSER] User selected QUICK compare');
      } else {
        // Parse comma-separated numbers
        selectedMarketIndices = selection.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n) && n > 0);
        console.log('[CHOOSER] User selected markets:', selectedMarketIndices);
      }
    }
    
    // CHOOSER: If user selected a market number, extract URL from previous message's market list
    let chooserSelectedUrl: string | null = null;
    let chooserSelectedMarket: any = null;
    let chooserEventMarkets: any[] = [];
    
    // Look for the most recent market chooser response with markets array
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      // Check for structured market_selection type (from frontend Message interface)
      if (msg.role === 'assistant' && msg.event?.markets && Array.isArray(msg.event.markets)) {
        chooserEventMarkets = msg.event.markets;
        console.log(`[CHOOSER] Found ${chooserEventMarkets.length} markets from previous chooser response`);
        break;
      }
    }
    
    if (isChooserSelection && chooserEventMarkets.length > 0) {
      // HANDLE "ALL" - Analyze top 2 by volume
      if (wantsAllMarkets) {
        console.log(`[CHOOSER] ALL selected - will analyze top 2 by volume from ${chooserEventMarkets.length} markets`);
        
        // Sort by volume descending and take top 2
        const sortedByVolume = [...chooserEventMarkets].sort((a: any, b: any) => 
          (b.volume || 0) - (a.volume || 0)
        );
        const top2 = sortedByVolume.slice(0, 2);
        
        console.log('[CHOOSER] Top 2 markets by volume:', top2.map((m: any) => m.question || m.title).join(', '));
        
        // Select both markets for analysis
        selectedMarketIndices = top2.map((m: any) => 
          chooserEventMarkets.findIndex((em: any) => (em.url || em.market_slug) === (m.url || m.market_slug)) + 1
        ).filter((i: number) => i > 0);
        
        // Use first market's URL for sidebar, but analyze both
        if (top2[0]?.url) {
          chooserSelectedUrl = top2[0].url;
          chooserSelectedMarket = top2[0];
        }
      } else if (selectedMarketIndices.length > 0) {
        // Single market selection
        const selectedIndex = selectedMarketIndices[0] - 1; // Convert from 1-based to 0-based
        
        if (selectedIndex >= 0 && selectedIndex < chooserEventMarkets.length) {
          chooserSelectedMarket = chooserEventMarkets[selectedIndex];
          chooserSelectedUrl = chooserSelectedMarket.url;
          console.log(`[CHOOSER] Extracted market URL from selection: ${chooserSelectedUrl}`);
          console.log(`[CHOOSER] Market question: ${chooserSelectedMarket.question}`);
        } else {
          console.log(`[CHOOSER] Invalid index ${selectedMarketIndices[0]} for ${chooserEventMarkets.length} markets`);
        }
      }
      
      // CRITICAL: Return JSON response with marketUrl to trigger sidebar
      // This ensures the frontend receives the selected market URL before analysis
      if (chooserSelectedUrl && chooserSelectedMarket) {
        console.log(`[CHOOSER] Returning market selection with URL for sidebar: ${chooserSelectedUrl}`);
        return new Response(
          JSON.stringify({
            marketUrl: chooserSelectedUrl,
            marketSlug: chooserSelectedUrl.split('/').pop(),
            eventSlug: chooserSelectedMarket.eventSlug || currentMarket?.eventSlug,
            metadata: {
              market: chooserSelectedMarket.question,
              price: chooserSelectedMarket.yesPrice,
              volume: chooserSelectedMarket.volume
            },
            triggerAnalysis: true // Signal frontend to send follow-up for full analysis
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Check for manual price input (e.g., "Jose Antonio is 98%, TNX Jarrah is 2%")
    const manualPricePattern = /(\w+(?:\s+\w+){0,3})\s+(?:is|at|=)\s*(\d+(?:\.\d+)?)\s*%/gi;
    const manualPrices: { name: string; price: string }[] = [];
    let priceMatch;
    while ((priceMatch = manualPricePattern.exec(lastUserMessage?.content || '')) !== null) {
      manualPrices.push({
        name: priceMatch[1].trim(),
        price: priceMatch[2] + '%'
      });
    }
    const hasManualPrices = manualPrices.length >= 2;
    
    console.log("Voice mode context:", { 
      currentMarket, 
      providedMarketUrl, 
      isContextualRequest,
      hasManualPrices,
      manualPrices: manualPrices.length > 0 ? manualPrices : undefined,
      userMessage: userMessage.substring(0, 50) 
    });
    
    let liveMarkets: any[] = [];
    let whaleData: any = null;
    
    // Fetch whale data if requested
    if (userWantsWhaleData) {
      console.log("User asked about whales, fetching whale data...");
      try {
        const whaleResponse = await fetch(`${supabaseUrl}/functions/v1/whale-tracker?refresh=true&timeRange=24h`, {
          headers: { "Authorization": `Bearer ${supabaseKey}` }
        });
        if (whaleResponse.ok) {
          whaleData = await whaleResponse.json();
          console.log(`Got whale data: ${whaleData.trades?.length || 0} trades`);
        }
      } catch (e) {
        console.error("Failed to fetch whale data:", e);
      }
    }
    
    // Fetch live market data
    if (userWantsLiveData) {
      console.log("User asked about live markets, fetching from Polymarket...");
      try {
        const liveResponse = await fetch(`${supabaseUrl}/functions/v1/polymarket-live`, {
          headers: { "Authorization": `Bearer ${supabaseKey}` }
        });
        if (liveResponse.ok) {
          liveMarkets = await liveResponse.json();
          console.log(`Got ${liveMarkets.length} live markets`);
        }
      } catch (e) {
        console.error("Failed to fetch live markets:", e);
      }
    }

    // Filter out expired markets from cache
    const now = new Date().toISOString();
    const { data: cachedMarkets } = await supabase
      .from("market_cache")
      .select("*")
      .or(`end_date.is.null,end_date.gt.${now}`)
      .neq("current_odds", 50)
      .order("volume_24h", { ascending: false })
      .limit(10);

    let liveDataContext = "";
    
    const formatVolume = (amt: number) => {
      if (!amt || isNaN(amt)) return "$0";
      if (amt >= 1_000_000) return `$${(amt / 1_000_000).toFixed(1)}M`;
      if (amt >= 1_000) return `$${(amt / 1_000).toFixed(1)}K`;
      return `$${amt.toFixed(0)}`;
    };
    
    // Add whale data context
    if (whaleData && whaleData.trades && whaleData.trades.length > 0) {
      const topWhales = whaleData.trades.slice(0, 10);
      const formatAmount = (amt: number) => {
        if (amt >= 1000000) return `$${(amt / 1000000).toFixed(1)}M`;
        if (amt >= 1000) return `$${(amt / 1000).toFixed(0)}K`;
        return `$${amt.toFixed(0)}`;
      };
      
      liveDataContext += `
WHALE ACTIVITY (Large trades from last 24 hours):

TOP 10 WHALE TRADES:
${topWhales.map((t: any, i: number) => 
  `${i + 1}. ${formatAmount(t.amount)} ${t.side} on "${t.market_question}"
   Price: ${(t.price * 100).toFixed(0)}% | Platform: ${t.platform.toUpperCase()}
   ${t.market_url ? `URL: ${t.market_url}` : ''}`
).join('\n\n')}

WHALE STATS:
- Total Volume: ${formatAmount(whaleData.stats?.totalVolume || 0)}
- Trade Count: ${whaleData.stats?.tradeCount || 0}
- Net Flow: ${formatAmount(Math.abs(whaleData.stats?.netFlow || 0))} ${(whaleData.stats?.netFlow || 0) > 0 ? 'BULLISH (more YES)' : 'BEARISH (more NO)'}

`;
    }
    
    if (liveMarkets.length > 0) {
      const top10 = liveMarkets.slice(0, 10);
      liveDataContext += `
LIVE POLYMARKET DATA (fetched just now):

TOP ACTIVE MARKETS BY VOLUME:
${top10.map((m: any, i: number) => 
  `${i + 1}. "${m.question}"
   Odds: ${(parseFloat(m.yesPrice) * 100).toFixed(1)}% YES / ${(parseFloat(m.noPrice) * 100).toFixed(1)}% NO
   Volume: ${formatVolume(m.volume)}
   URL: ${m.url}`
).join('\n\n')}

Use these exact numbers and URLs in your response.
`;
    }

    if (cachedMarkets && cachedMarkets.length > 0) {
      // Filter by category if requested
      let filteredMarkets = cachedMarkets;
      if (requestedCategory) {
        filteredMarkets = cachedMarkets.filter((m: any) => 
          m.category?.toLowerCase().includes(requestedCategory) ||
          m.title?.toLowerCase().includes(requestedCategory)
        );
        if (filteredMarkets.length === 0) filteredMarkets = cachedMarkets; // Fallback
      }
      
      liveDataContext += `
POLY'S PRE-ANALYZED MARKETS (with edge calculations):
${filteredMarkets.slice(0, 5).map((m: any, i: number) => 
  `${i + 1}. "${m.title}"
   Market: ${m.current_odds}% → Poly's estimate: ${m.vera_probability}%
   Edge: ${m.edge > 0 ? '+' : ''}${m.edge}% | Confidence: ${m.confidence}
   Recommendation: ${m.recommendation}
   URL: https://polymarket.com/event/${m.slug}`
).join('\n\n')}
`;
    }

    // Use messages with conversation history
    let enrichedMessages = [...messagesWithHistory];
    let fetchedMarketData = false;
    let fetchedMarketInfo: { url?: string; question?: string; price?: string; platform?: string; searchResults?: any[] } | null = null;
    // Store search results for follow-up and deterministic selection
    let searchResults: any[] = [];
    // Track when a user asked for a very specific market but we couldn't find it via search
    let failedSearchTopic: string | null = null;
    
    // Helper to save conversation messages
    const saveConversationTurn = async (userContent: string, assistantContent: string) => {
      if (!conversationId) return;
      
      try {
        await supabase.from('conversation_messages').insert([
          {
            conversation_id: conversationId,
            role: 'user',
            content: userContent
          },
          {
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantContent
          }
        ]);
        console.log(`[Memory] Saved conversation turn for ${conversationId.substring(0, 8)}...`);
      } catch (e) {
        console.error('[Memory] Failed to save conversation:', e);
      }
    };
    
    // Check for market URL - Priority: 1) chooser selection, 2) explicit URL, 3) currentMarket.url
    let effectiveMarketUrl = chooserSelectedUrl || providedMarketUrl || currentMarket?.url;
    const userContent = lastUserMessage?.content || '';
    
    // HANDLE "ANALYZE ALL" - Inject context about top 2 markets by volume
    let analyzeAllContext = '';
    if (wantsAllMarkets && chooserEventMarkets.length > 0) {
      const sortedByVolume = [...chooserEventMarkets].sort((a: any, b: any) => 
        (b.volume || 0) - (a.volume || 0)
      );
      const top2 = sortedByVolume.slice(0, 2);
      
      analyzeAllContext = `

=== USER SELECTED "ANALYZE ALL" ===
The user wants a quick analysis of the TOP 2 MARKETS BY VOLUME from this event.
Here are the top 2 markets to analyze (analyze BOTH briefly, focus on key metrics and whether there's edge):

${top2.map((m: any, i: number) => `
MARKET ${i + 1}: ${m.question || m.title}
- Current Odds: ${m.yesPrice || m.yes_price}% YES
- Volume: $${((m.volume || 0) / 1000).toFixed(0)}K
- URL: ${m.url}
`).join('\n')}

INSTRUCTIONS:
1. Analyze BOTH markets briefly (2-3 sentences each)
2. Include the market URL for each
3. Say which one (if any) has better edge/opportunity
4. Be concise - this is a "quick scan" of the top plays
`;
      
      console.log('[CHOOSER] Injecting analyze-all context for top 2 markets');
    }
    
    // Check if user is simply confirming/affirming (before URL/search detection)
    const isUserJustSayingYes = /^(yes|yeah|sure|ok|okay|yep|please|yea|do it|go ahead|continue|tell me more|first one|second one|the first|the second)\s*[.!?]*$/i.test(
      userContent.trim() || ''
    );
    
    // NEW: Detect explicit NEW market request (overrides loaded market context)
    // e.g., "analyze the market called X", "find the Y market", "what about Z"
    const newMarketRequestPatterns = [
      /(?:analyze|find|search|check|look at|show me|what about|tell me about)\s+(?:the\s+)?(?:market\s+)?(?:called|named|about|for)\s+["']?([^"'?]+)["']?/i,
      /(?:how|what)\s+(?:is|are|about)\s+(?:the\s+)?["']?([^"'?]+)["']?\s+market/i,
      /market\s+(?:called|named|about)\s+["']?([^"'?]+)["']?/i,
      /(?:analyze|find)\s+["']([^"']+)["']/i,
    ];
    
    let explicitNewMarketQuery: string | null = null;
    for (const pattern of newMarketRequestPatterns) {
      const match = userContent.match(pattern);
      if (match && match[1] && match[1].trim().length > 5) {
        explicitNewMarketQuery = match[1].trim();
        console.log('🆕 Detected NEW market request, overriding loaded context:', explicitNewMarketQuery);
        break;
      }
    }
    
    // If user is asking about a NEW market by name, CLEAR the old context
    if (explicitNewMarketQuery && !isUserJustSayingYes) {
      console.log('Clearing loaded market context for new search:', explicitNewMarketQuery);
      effectiveMarketUrl = undefined; // Clear loaded URL
    }
    
    // NEW: Detect natural language market search (no URL but descriptive query)
    // SKIP automatic search for general/explanatory questions - let Claude decide with tools
    const isGeneralQuestion = /\b(what is|what are|explain|how does|how do|tell me about prediction markets?|what can you do)\b/i.test(userContent) &&
      !/\b(market for|odds on|price of|bet on)\b/i.test(userContent);
    
    const hasNoUrl = !effectiveMarketUrl && !/polymarket\.com|kalshi\.com/i.test(userContent);
    const isAnalyzeIntent = /\b(analyze|find|search|show me|what about|look at|check|give me|find me|talk about|tell me about|best|looking for)\s+/i.test(userContent);
    const hasSportsKeywords = /\b(sports?|betting|nfl|nba|football|basketball|soccer|tennis|baseball|hockey|mma|ufc|boxing|olympics)\b/i.test(userContent);
    const hasTrumpKeywords = /\b(trump|donald|maga|republican|gop)\b/i.test(userContent);
    const hasSearchCue = isAnalyzeIntent || /\bmarket\b/i.test(userContent) || /\bdecision\b/i.test(userContent) || hasSportsKeywords || hasTrumpKeywords;
    
    // Only trigger automatic search if it's clearly about a specific market, NOT a general question
    // Skip search if user made a chooser selection (already have URL)
    const isMarketSearchQuery = !chooserSelectedUrl && !isGeneralQuestion && ((hasNoUrl && hasSearchCue && !isUserJustSayingYes && userContent.length > 10) || !!explicitNewMarketQuery);
    
    console.log(`[Search Logic] isGeneralQuestion: ${isGeneralQuestion}, isMarketSearchQuery: ${isMarketSearchQuery}, query: "${userContent.substring(0, 50)}"`);
    
    if (isMarketSearchQuery) {
      // Extract search keywords from user message - prioritize explicit new market query
      let searchQuery = explicitNewMarketQuery || userContent
        .replace(/^(hey\s+)?(poly)[,!.\s]*/i, '')  // Strip "Hey Poly" prefix
        .replace(/\b(could you|can you|please|analyze|find|search|show me|what about|look at|check|give me|find me|talk about|tell me about|market|markets?|the|this|a|an|called|named)\b/gi, '')
        .replace(/[?!.,'"]/g, '')
        .trim();
      
      if (searchQuery.length > 5) {
        console.log(`Natural language search detected: "${searchQuery}"`);
        
        try {
          const searchResponse = await fetch(`${supabaseUrl}/functions/v1/polymarket-data`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}` 
            },
            body: JSON.stringify({ 
              action: 'search', 
              query: searchQuery, 
              limit: 5 
            }),
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            searchResults = searchData.markets || [];
            
            if (searchResults.length > 0) {
              console.log(`Found ${searchResults.length} markets matching search`);
              
              // If there's exactly ONE clear match, hard-resolve it BEFORE calling the LLM
              if (searchResults.length === 1) {
                const onlyMatch = searchResults[0];
                effectiveMarketUrl = onlyMatch.url;
                fetchedMarketInfo = {
                  url: onlyMatch.url,
                  question: onlyMatch.question,
                  price: `${onlyMatch.yesPrice}¢`,
                  platform: 'polymarket',
                  searchResults: [onlyMatch],
                };
                console.log('Single market match found, locking context to:', onlyMatch.url);
              } else {
                // Multiple matches: enrich context and let Poly ask user which one
                const formatVolumeSearch = (vol: number): string => {
                  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
                  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
                  return `$${vol.toFixed(0)}`;
                };
                const searchContext = `
MARKET SEARCH RESULTS for "${searchQuery}":
${searchResults.slice(0, 3).map((m: any, i: number) => 
  `${i + 1}. "${m.question}"
   Price: ${m.yesPrice}% YES / ${m.noPrice}% NO
   Volume: ${formatVolumeSearch(m.volume)}
   URL: ${m.url}`
).join('\n\n')}

INSTRUCTION: Present these search results to the user. Ask which one they want to analyze in detail.
If only 1 result, analyze it directly.
`;
                
                // Enrich user message with search results
                enrichedMessages = enrichedMessages.map((m: any) => {
                  if (m === lastUserMessage) {
                    return { ...m, content: m.content + '\n\n' + searchContext };
                  }
                  return m;
                });
                
                // Store for echoing back to client
                fetchedMarketInfo = {
                  ...(fetchedMarketInfo || {}),
                  searchResults: searchResults.slice(0, 3),
                };
              }
            } else if (explicitNewMarketQuery) {
              // No results for a very specific market request - DO NOT pivot to random markets
              failedSearchTopic = explicitNewMarketQuery;
              console.log('[Search] No markets found for specific topic:', explicitNewMarketQuery);
              
              // Check if search response indicates failure with STT correction info
              if (searchData.sttCorrected) {
                console.log(`[Search] STT correction was applied: "${searchData.sttCorrected}" but still no results`);
              }
            }
          }
        } catch (e) {
          console.error('Market search failed:', e);
          failedSearchTopic = explicitNewMarketQuery || userContent.substring(0, 50);
        }
      }
    }
    
    // After possible search resolution, build the content to scan for URLs
    const contentToCheck = userContent + (effectiveMarketUrl ? ` ${effectiveMarketUrl}` : '');
    if (contentToCheck) {
      const { platform, path, seriesTicker, marketTicker } = extractMarketInfo(contentToCheck);
      
      if (platform && path) {
        console.log(`Detected ${platform} URL, fetching data for path:`, path, "series:", seriesTicker, "market:", marketTicker);
        
        let marketData = null;
        if (platform === 'kalshi') {
          marketData = await fetchKalshiData(marketTicker || path, seriesTicker);
        } else {
          marketData = await fetchPolymarketData(path);
        }
        
        if (marketData) {
          fetchedMarketData = true;
          const platformLabel = platform === 'kalshi' ? 'KALSHI' : 'POLYMARKET';
          
          // Store fetched market info for echoing back to client
          const targetMarket = marketData.targetMarket || marketData.allMarkets?.[0];
          // FIX: yesPrice is already a percentage (0-100), don't multiply by 100
          const priceValue = targetMarket?.yesPrice 
            ? (parseFloat(targetMarket.yesPrice) > 1 
              ? Math.round(parseFloat(targetMarket.yesPrice)) 
              : Math.round(parseFloat(targetMarket.yesPrice) * 100))
            : undefined;
          
          fetchedMarketInfo = {
            url: effectiveMarketUrl,
            question: marketData.eventTitle || targetMarket?.question,
            price: priceValue ? `${priceValue}¢` : undefined,
            platform: platform,
          };
          
          // Filter out expired markets
          let expiredMarketCount = 0;
          if (marketData.allMarkets && Array.isArray(marketData.allMarkets)) {
            const originalCount = marketData.allMarkets.length;
            marketData.allMarkets = marketData.allMarkets.filter((m: any) => !isMarketExpired(m));
            expiredMarketCount = originalCount - marketData.allMarkets.length;
            
            if (expiredMarketCount > 0) {
              console.log(`Filtered out ${expiredMarketCount} expired market(s) from ${originalCount} total`);
            }
            
            // If ALL markets are expired, return early with helpful message
            if (marketData.allMarkets.length === 0) {
              console.log("All markets in this event have expired");
              
              // For voice mode, return a quick expired notice
              if (voiceMode) {
                return new Response(
                  JSON.stringify({
                    voiceSummary: "Hey, this market has already expired or resolved. Want me to find some similar active markets for you instead?",
                    needsFullAnalysis: false,
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
            
            // PROGRAMMATIC MULTI-MARKET CHOOSER - Bypass Claude entirely for 3+ markets
            // SKIP chooser if deepResearch is enabled - just analyze the top market directly
            const activeMarkets = marketData.allMarkets;
            const hasSpecificTarget = marketData.targetMarket !== null && marketData.targetMarket !== undefined;
            
            if (activeMarkets.length >= 3 && !hasSpecificTarget && !voiceMode && !deepResearch) {
              console.log(`[CHOOSER] Detected ${activeMarkets.length} markets, returning chooser UI`);
              
              // Build chooser response directly - no Claude call needed
              const marketLines = activeMarkets.slice(0, 10).map((m: any, i: number) => {
                const odds = parseFloat(m.yesPrice);
                const vol = formatVolume(m.volume);
                // Shorten question if too long
                const shortQ = m.question.length > 60 ? m.question.substring(0, 57) + '...' : m.question;
                return `${i + 1}) ${shortQ} — ${odds.toFixed(1)}% YES (${vol})`;
              }).join('\n');
              
              const moreNote = activeMarkets.length > 10 ? `\n...and ${activeMarkets.length - 10} more markets` : '';
              
              const chooserContent = `This event has **${activeMarkets.length} active markets**. Which one would you like me to analyze?

${marketLines}${moreNote}

Reply with a number (e.g. "1") or a name (e.g. "Kevin Hassett").`;

              return new Response(
                JSON.stringify({
                  content: chooserContent,
                  showChooser: true,
                  eventTitle: marketData.eventTitle,
                  marketCount: activeMarkets.length,
                  markets: activeMarkets.map((m: any, i: number) => ({
                    index: i + 1,
                    question: m.question,
                    yesPrice: m.yesPrice,
                    volume: m.volume,
                    url: m.url
                  }))
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            // When deepResearch is enabled and no specific target, auto-select top market
            if (deepResearch && !hasSpecificTarget && activeMarkets.length > 0) {
              console.log(`[DeepResearch] Auto-selecting top market for deep analysis`);
              marketData.targetMarket = activeMarkets[0];
            }
          }
          
          // Check if target market is expired
          if (marketData.targetMarket && isMarketExpired(marketData.targetMarket)) {
            console.log("Target market is expired:", marketData.targetMarket.question?.substring(0, 50));
            marketData.targetMarket = null; // Clear expired target
            
            // For voice mode, return a quick expired notice
            if (voiceMode) {
              return new Response(
                JSON.stringify({
                  voiceSummary: "Hey, that specific market has already expired. Let me check if there are other active markets in this event, or want me to find something similar?",
                  needsFullAnalysis: false,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
          
          // Detect if this is a date bracket market (cumulative probabilities)
          const isDateBracket = marketData.allMarkets && marketData.allMarkets.length > 1 && 
            marketData.allMarkets.every((m: any) => 
              /before\s+\d{4}/i.test(m.question) || 
              /by\s+\d{4}/i.test(m.question) ||
              /before\s+[a-z]+\s+\d{1,2},?\s+\d{4}/i.test(m.question)
            );
          
          let marketsSection = '';
          let expiredNote = expiredMarketCount > 0 
            ? `\n\nNote: ${expiredMarketCount} expired market(s) were filtered out.` 
            : '';
          
          if (isDateBracket && marketData.allMarkets.length > 1) {
            // Sort by date ascending for date brackets
            const sortedByDate = [...marketData.allMarkets].sort((a: any, b: any) => {
              // Extract year from question
              const yearA = parseInt(a.question.match(/\d{4}/)?.[0] || '9999');
              const yearB = parseInt(b.question.match(/\d{4}/)?.[0] || '9999');
              return yearA - yearB;
            });
            
            // Calculate implied probabilities for each period
            let previousProb = 0;
            const withImplied = sortedByDate.map((m: any) => {
              const currentProb = parseFloat(m.yesPrice);
              const impliedPeriodProb = currentProb - previousProb;
              previousProb = currentProb;
              return {
                ...m,
                impliedPeriodProbability: impliedPeriodProb.toFixed(1)
              };
            });
            
            marketData.allMarkets = withImplied;
            marketData.marketType = 'date-bracket';
            
            console.log("Detected DATE BRACKET market, calculated implied probabilities");
            
            marketsSection = `
DATE BRACKET MARKET (CUMULATIVE PROBABILITIES):
These are NOT independent outcomes - each later date includes all earlier dates.
${withImplied.map((m: any, i: number) => 
  `${i + 1}. "${m.question}"
   Cumulative: ${m.yesPrice}% (probability by this date)
   Implied Period: ${m.impliedPeriodProbability}% (probability of happening in THIS specific window)
   Volume: ${formatVolume(m.volume)}
   URL: ${m.url}`
).join('\n')}

ANALYSIS NOTES:
- Later dates should ALWAYS have >= probability than earlier dates
- If you see a later date with LOWER probability, flag it as a data anomaly or arbitrage
- Focus on which TIME WINDOW has the highest implied probability
`;
          } else {
            marketsSection = marketData.allMarkets && marketData.allMarkets.length > 0 ? `
ALL MARKETS IN THIS EVENT:
${marketData.allMarkets.map((m: any, i: number) => 
  `${i + 1}. "${m.question}"
   Odds: ${m.yesPrice}% YES / ${m.noPrice}% NO
   Volume: ${formatVolume(m.volume)}
   URL: ${m.url}`
).join('\n')}
` : '';
          }
          
          // Build comprehensive Dome data section if available
          let domeDataSection = '';
          if (marketData.source === 'dome-api-comprehensive') {
            const formatUsd = (val: number) => {
              if (!val || isNaN(val)) return '$0';
              if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
              if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
              return `$${val.toFixed(2)}`;
            };
            
            // Trade flow section
            if (marketData.tradeFlow) {
              const tf = marketData.tradeFlow;
              // Use pre-calculated values that match market-dashboard
              const buyPressure = tf.buyPressure || (tf.totalTrades > 0 ? Math.round((tf.buyCount / tf.totalTrades) * 100) : 50);
              const sellPressure = 100 - buyPressure;
              const netFlow = tf.netFlow || 0;
              
              domeDataSection += `
=== 📊 LIVE TRADING DATA (DOME API) ===
TRADE FLOW (last ${tf.totalTrades || tf.buyCount + tf.sellCount} trades):
• Direction: ${tf.direction} pressure
• Buy count: ${tf.buyCount} trades (${buyPressure}%)
• Sell count: ${tf.sellCount} trades (${sellPressure}%)
• Buy volume: ${formatUsd(tf.buyVolume || 0)}
• Sell volume: ${formatUsd(tf.sellVolume || 0)}
• Net flow: ${formatUsd(Math.abs(netFlow))} ${netFlow >= 0 ? 'BUYING' : 'SELLING'}
• Signal strength: ${(tf.strength * 100).toFixed(0)}%
`;
              
              if (tf.recentTrades && tf.recentTrades.length > 0) {
                domeDataSection += `\nRECENT TRADES:
${tf.recentTrades.slice(0, 5).map((t: any) => 
  `• ${t.side === 'BUY' ? '🟢 BUY' : '🔴 SELL'} ${formatUsd(t.amount)} @ ${(t.price * 100).toFixed(1)}%`
).join('\n')}
`;
              }
            }
            
            // Whale activity section
            if (marketData.whaleActivity) {
              const wa = marketData.whaleActivity;
              domeDataSection += `
WHALE ACTIVITY (trades >$1K):
• Whale trades: ${wa.whaleCount}
• Total whale volume: ${formatUsd(wa.totalVolume)}
• Whale buys: ${formatUsd(wa.buyVolume)}
• Whale sells: ${formatUsd(wa.sellVolume)}
• Largest single trade: ${formatUsd(wa.largestTrade)}
• Whale signal: ${wa.isActive ? '🐋 ACTIVE (significant whale interest)' : '📊 Normal activity'}
`;
            }
            
            // Volatility section
            if (marketData.volatility) {
              const vol = marketData.volatility;
              domeDataSection += `
VOLATILITY:
• Weekly price swing: ${(vol.weeklySwing * 100).toFixed(1)}%
• Status: ${vol.isVolatile ? '⚡ VOLATILE (>15% swing)' : '📈 Stable'}
`;
            }
            
            // Calculate net flow for summary
            if (marketData.tradeFlow && marketData.whaleActivity) {
              const buyVol = marketData.whaleActivity.buyVolume || 0;
              const sellVol = marketData.whaleActivity.sellVolume || 0;
              const netFlow = buyVol - sellVol;
              domeDataSection += `
NET FLOW SUMMARY:
• Net whale flow: ${formatUsd(Math.abs(netFlow))} ${netFlow >= 0 ? 'BUYING' : 'SELLING'}
• Market sentiment: ${marketData.tradeFlow.direction}
`;
            }
          }
          
          const enrichedContent = `${lastUserMessage.content}${analyzeAllContext}

---
LIVE ${platformLabel} DATA FOR THIS EVENT:
Event: "${marketData.eventTitle}"
Platform: ${platformLabel}
Category: ${marketData.category}
Event URL: ${marketData.url}
${marketData.marketType === 'date-bracket' ? 'Market Type: DATE BRACKET (cumulative probabilities)' : ''}${expiredNote}

${marketData.targetMarket ? `
SPECIFIC MARKET REQUESTED:
Question: "${marketData.targetMarket.question}"
Current Odds: ${marketData.targetMarket.yesPrice}% YES / ${marketData.targetMarket.noPrice}% NO
Volume: ${formatVolume(marketData.targetMarket.volume)}
Market URL: ${marketData.targetMarket.url}
` : ''}

${marketsSection}

Total Event Volume: ${formatVolume(marketData.totalVolume)}
${domeDataSection}
---

Use the data above. Follow your system instructions for analysis format.`;
          
          enrichedMessages = messages.map((m: any, i: number) => {
            if (i === messages.length - 1 && m.role === "user") {
              return { ...m, content: enrichedContent };
            }
            return m;
          });
          
          // Enhanced market type detection and logging
          if (marketData && marketData.eventTitle) {
            const eventTitle = marketData.eventTitle || '';
            const detectedTypes: string[] = [];
            
            // Detect time-sensitive markets
            if (/2024|2025|this year|this season/i.test(eventTitle)) {
              detectedTypes.push("TEMPORAL: Must check current status");
            }
            
            // Detect range/bracket markets
            if (marketData.allMarkets && marketData.allMarkets.length > 1) {
              const hasRanges = marketData.allMarkets.some((m: any) => 
                /\d+\s*to\s*\d+|before \d+|more than|less than|above|under/i.test(m.question)
              );
              if (hasRanges) {
                detectedTypes.push("RANGE: Mutually exclusive - recommend ONE range only");
              }
            }
            
            // Detect competitive multi-outcome
            if (marketData.allMarkets && marketData.allMarkets.length > 5) {
              const isCompetitive = /will\s+(\w+)\s+win|who\s+will\s+win|winner\s+of|win\s+the/i.test(eventTitle);
              if (isCompetitive) {
                const sportMatch = eventTitle.match(/(Premier League|NBA|NFL|World Cup|championship|election|tournament|Series|Conference|Division)/i);
                const sport = sportMatch ? sportMatch[1] : 'competition';
                detectedTypes.push(`COMPETITIVE: ${sport} - check current standings`);
              }
            }
            
            // Detect past events that should be resolved
            if (/2024 election|2024 winner|person of.*2024|poty 2024/i.test(eventTitle)) {
              detectedTypes.push("PAST EVENT: Already resolved - check results");
            }
            
            // Detect TIME POTY / awards markets
            if (/time.*person|poty|person of the year/i.test(eventTitle)) {
              detectedTypes.push("AWARDS: Check if shortlist/winner announced");
            }
            
            if (detectedTypes.length > 0) {
              console.log("Market analysis flags:", detectedTypes.join(" | "));
            }
          }
          
          console.log(`Enriched message with live ${platform} market data`);
        } else {
          // URL provided but couldn't fetch - give helpful response without saying "no data"
          const errorContent = `${lastUserMessage.content}

---
NOTE: The provided ${platform} URL appears to be invalid, expired, or the market has been resolved.
Respond helpfully by saying something like: "That market link doesn't seem to be active - it may have resolved or been removed. Try pasting a different ${platform === 'kalshi' ? 'Kalshi' : 'Polymarket'} URL, or ask me about any topic and I'll share my analysis based on current market conditions."
DO NOT say "I don't have live data" or anything similar.
---`;
          
          enrichedMessages = messages.map((m: any, i: number) => {
            if (i === messages.length - 1 && m.role === "user") {
              return { ...m, content: errorContent };
            }
            return m;
          });
        }
      }
    }

    // Compute fresh date at request time (not module load time)
    const requestDateInfo = getCurrentDateInfo();
    let systemPrompt = getPolySystemPrompt(requestDateInfo);
    console.log(`[DATE] Using current date: ${requestDateInfo.fullDate}`);
    
    // If user asked for a very specific market and we couldn't find it, DO NOT distract with generic cached markets
    // Instead, give a clear "couldn't find that" response
    if (failedSearchTopic && voiceMode) {
      liveDataContext = '';
      
      // Return early with a helpful failure response instead of random markets
      const cleanTopic = failedSearchTopic.replace(/analyze|find|show|me|please|the|market|on|for/gi, '').trim();
      const voiceSummary = `I couldn't find a market matching "${cleanTopic}" on Polymarket. Drop the exact link and I'll break it down for you instantly.`;
      
      return new Response(
        JSON.stringify({
          voiceSummary,
          needsFullAnalysis: false,
          searchFailed: true,
          currentMarket: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (failedSearchTopic) {
      liveDataContext = '';
    }
    
    if (liveDataContext) {
      systemPrompt += `\n\n${liveDataContext}`;
    }
    
    // CRITICAL: Inject sidebar data into system prompt so AI can reference it
    if (sidebarData && typeof sidebarData === 'object') {
      console.log('[SIDEBAR] Injecting sidebar market data into system prompt');
      
      const formatUsd = (val: number) => {
        if (!val || isNaN(val)) return '$0';
        if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
        return `$${val.toFixed(0)}`;
      };
      
      const trades = sidebarData.recentTrades || [];
      const whales = sidebarData.whales || [];
      const tradeStats = sidebarData.tradeStats || {};
      const market = sidebarData.market || {};
      
      // Calculate largest trade
      const largestTradeSize = trades.length > 0 
        ? Math.max(...trades.map((t: any) => t.size || 0))
        : 0;
      
      const sidebarContext = `
=== 🚨 CURRENT SIDEBAR DATA (USER CAN SEE THIS - YOUR ANSWERS MUST MATCH) ===
The user has the market data sidebar open showing this EXACT data from Dome API:

MARKET: ${market.question || 'Unknown'}
CURRENT ODDS: ${market.odds || 'N/A'}%
VOLUME: ${formatUsd(market.volume || 0)}

RECENT TRADES (${trades.length} total):
${trades.slice(0, 10).map((t: any, i: number) => 
  `• ${t.side === 'BUY' ? '🟢' : '🔴'} ${formatUsd(t.size)} @ ${t.price}% (${t.timeAgo || 'recent'})`
).join('\n') || '• No trades available'}

TRADE STATS:
• Buy pressure: ${tradeStats.buyPressure || 0}%
• Sell pressure: ${tradeStats.sellPressure || 0}%
• Net flow: ${formatUsd(Math.abs(tradeStats.netFlow || 0))} ${(tradeStats.netFlow || 0) >= 0 ? 'buying' : 'selling'}
• Largest trade: ${formatUsd(largestTradeSize)}

WHALE TRADES (>$10K): ${whales.length} detected
${whales.slice(0, 5).map((w: any) => 
  `• ${w.side === 'BUY' ? '🟢' : '🔴'} ${formatUsd(w.amount)} @ ${(w.price * 100).toFixed(1)}%`
).join('\n') || '• No whale trades'}

🚨 CRITICAL RULES:
1. When user asks about trades, whales, or activity - USE THE DATA ABOVE
2. Your numbers MUST match the sidebar (user can see both!)
3. Say "Looking at the sidebar data..." or "The sidebar shows..."
4. If sidebar shows 68% buy pressure, YOU say 68%, not some other number
5. NEVER make up trade data - use ONLY what's shown above
6. If no data above, say "I don't have trade data for this market yet"
`;
      
      systemPrompt += sidebarContext;
    }
    
    if (detailMode === "quick") {
      systemPrompt += `

=== QUICK MODE ===
Ultra-concise format:

📊 [Question]
Platform: POLYMARKET / KALSHI
Current: X% YES / X% NO | Vol: $XXK
THE PLAY: BUY YES/NO/SKIP | Edge: +X% | Conf: HIGH/MED/LOW

---

Keep everything super tight - 1-2 lines per market. Skip MY TAKE and Risk sections.`;
    } else {
      systemPrompt += `

=== ADVANCED MODE ===
Use the full detailed format above. Include thorough analysis while staying structured.`;
    }

    // VOICE MODE: Two-phase response - quick voice first, then detailed
    if (voiceMode) {
      // Determine intent for better voice responses
      const hasWhaleContext = liveDataContext.includes('WHALE ACTIVITY');
      const hasMarketContext = liveDataContext.includes('LIVE POLYMARKET') || liveDataContext.includes('PRE-ANALYZED');
      const hasSpecificMarket = providedMarketUrl || fetchedMarketData || currentMarket?.url;
      
      // Check if market data was successfully fetched and included in enriched messages
      const marketDataInMessages = enrichedMessages.some((m: any) => 
        m.content?.includes('=== LIVE MARKET DATA ===') || 
        m.content?.includes('LIVE POLYMARKET') ||
        m.content?.includes('MARKET DATA ENRICHMENT')
      );
      
      console.log("VOICE MODE DEBUG - providedMarketUrl:", providedMarketUrl);
      console.log("VOICE MODE DEBUG - currentMarket:", currentMarket);
      console.log("VOICE MODE DEBUG - fetchedMarketData:", fetchedMarketData);
      console.log("VOICE MODE DEBUG - hasSpecificMarket:", hasSpecificMarket);
      console.log("VOICE MODE DEBUG - marketDataInMessages:", marketDataInMessages);
      console.log("VOICE MODE DEBUG - isContextualRequest:", isContextualRequest);
      
      // Build conversation context for better responses - include more detail
      const conversationContext = enrichedMessages.slice(-6).map((m: any) => {
        const content = m.content || '';
        if (m.role === 'user') return `User: ${content.substring(0, 200)}`;
        return `Poly: ${content.substring(0, 300)}`;
      }).join('\n');
      
      // Extract any market mentioned in recent conversation
      let recentMarketContext = '';
      for (const msg of [...enrichedMessages].reverse().slice(0, 4)) {
        const content = msg.content || '';
        // Look for market questions or analysis patterns
        const marketMatch = content.match(/[""]([^""]{10,100})[""]\s*(?:is at|trading at|at)\s*(\d+)/i);
        if (marketMatch) {
          recentMarketContext = `RECENTLY DISCUSSED MARKET: "${marketMatch[1]}" at ${marketMatch[2]}¢`;
          break;
        }
        // Look for URL patterns
        const urlMatch = content.match(/(polymarket\.com|kalshi\.com)\/[^\s]+/i);
        if (urlMatch) {
          recentMarketContext = `RECENTLY DISCUSSED MARKET URL: ${urlMatch[0]}`;
          break;
        }
      }
      
      // Build current market info string - MAKE IT EXPLICIT
      let currentMarketInfo = '';
      const effectiveMarket = currentMarket?.question || currentMarket?.url || effectiveMarketUrl;
      
      if (effectiveMarket) {
        currentMarketInfo = `
🔒🔒🔒 LOADED MARKET (MANDATORY CONTEXT) 🔒🔒🔒
╔═════════════════════════════════════════════════════════╗
║ MARKET: ${currentMarket?.question || 'Market from URL'}
║ PRICE: ${currentMarket?.price || 'See data in conversation'}
║ URL: ${currentMarket?.url || effectiveMarketUrl || 'N/A'}
║ PLATFORM: ${(currentMarket?.platform || 'polymarket').toUpperCase()}
╚═════════════════════════════════════════════════════════╝

⚡ WHEN USER SAYS "this", "analyze this", "this market", "this rocket", "what do you think":
   → THEY MEAN THE LOADED MARKET ABOVE! Analyze IT!
   
⚡ WHEN USER SAYS "yes", "sure", "please", "continue":
   → CONTINUE WITH THE LOADED MARKET ABOVE! Don't ask "which market?"

❌ NEVER ASK "which market?" when this context exists!
`;
      } else if (recentMarketContext) {
        currentMarketInfo = `
🎯 ${recentMarketContext}

When user says "this market", "what do you think?", "more about this" → THEY MEAN THIS MARKET!
`;
      }
      
      // Check if user is simply confirming/affirming OR asking about "this one", "this market"
      const isUserJustSayingYes = /^(yes|yeah|sure|ok|okay|yep|please|yea|do it|go ahead|continue|tell me more|first one|second one|the first|the second|1|2|sounds good|let's do it|that one|this one)\s*[.!?]*$/i.test(userMessage.trim());
      
      // NEW: Detect whale requests that reference current market context
      const isAskingWhaleOnCurrentMarket = /whale\s+(?:activity|data|trades?)?\s+(?:on|for)\s+(?:this|that|the)\s+(?:one|market|specific|outcome)/i.test(userMessage) ||
        /(?:analyze|show|get)\s+(?:the\s+)?whale\s+(?:activity|data)?\s+(?:on|for)?\s*(?:this|that)?/i.test(userMessage);
      
      // If asking whale on current market, force whale context
      if (isAskingWhaleOnCurrentMarket && (currentMarket?.question || currentMarket?.lastWhaleOfferTarget)) {
        const target = currentMarket?.lastWhaleOfferTarget || currentMarket?.question;
        console.log('🐋 Detected whale request on current market, target:', target);
        // This will be handled by the whale lock logic below
      }
      
      // HARD CONTEXT LOCK: Route ALL whale requests for the loaded market through deterministic logic
      const lastOfferWasWhale = currentMarket?.lastPolyOffer === 'whale_data';
      let whaleOfferTarget = currentMarket?.lastWhaleOfferTarget; // Specific candidate like "Scott Bessent"
      
      // If asking about "this one" whale data but no explicit target, extract from explicitContext or last message
      if (isAskingWhaleOnCurrentMarket && !whaleOfferTarget) {
        // Try to get target from explicit context
        const targetFromContext = explicitContext?.match(/WHALE_OFFER_TARGET:\s*"([^"]+)"/)?.[1] ||
          explicitContext?.match(/POLY_JUST_OFFERED_WHALE_DATA_FOR:\s*"([^"]+)"/)?.[1] ||
          explicitContext?.match(/USER_WANTS_WHALE_DATA_ON_CURRENT_MARKET[^"]*"([^"]+)"/)?.[1];
        
        if (targetFromContext) {
          whaleOfferTarget = targetFromContext;
          console.log('🐋 Extracted whale target from context:', whaleOfferTarget);
        } else if (currentMarket?.question) {
          whaleOfferTarget = currentMarket.question;
          console.log('🐋 Using current market question as whale target:', whaleOfferTarget);
        }
      }
      
      if (voiceMode && (userWantsWhaleData || isAskingWhaleOnCurrentMarket || (isUserJustSayingYes && lastOfferWasWhale)) && (currentMarket?.url || effectiveMarketUrl || whaleOfferTarget || currentMarket?.question)) {
        try {
          console.log('🔒 Whale data request detected - locking context to:', whaleOfferTarget || currentMarket?.question || effectiveMarketUrl);
          // Fetch whale data if we don't already have it
          if (!whaleData) {
            const whaleResponse = await fetch(`${supabaseUrl}/functions/v1/whale-tracker?refresh=true&timeRange=24h`, {
              headers: { "Authorization": `Bearer ${supabaseKey}` }
            });
            if (whaleResponse.ok) {
              whaleData = await whaleResponse.json();
            }
          }
          
          const allTrades = whaleData?.trades || [];
          const marketUrlForFilter = currentMarket?.url || effectiveMarketUrl;
          
          // Filter by specific target (candidate name) OR by URL
          let tradesForMarket = [];
          if (whaleOfferTarget) {
            // Filter by candidate/topic name (case-insensitive)
            const targetLower = whaleOfferTarget.toLowerCase();
            tradesForMarket = allTrades.filter((t: any) => 
              (t.market_question && t.market_question.toLowerCase().includes(targetLower)) ||
              (t.market_url && t.market_url.toLowerCase().includes(targetLower.replace(/\s+/g, '-')))
            );
            console.log(`Filtered ${tradesForMarket.length} whale trades for target: "${whaleOfferTarget}"`);
          } else if (marketUrlForFilter) {
            tradesForMarket = allTrades.filter((t: any) => t.market_url && marketUrlForFilter && t.market_url.includes(marketUrlForFilter));
          }
          
          // ONLY use trades for this specific market. If none, report no whale data instead of switching markets.
          const tradesToUse = tradesForMarket.slice(0, 5);
          
          const formatAmount = (amt: number) => {
            if (amt >= 1000000) return `$${(amt / 1000000).toFixed(1)}M`;
            if (amt >= 1000) return `$${(amt / 1000).toFixed(0)}K`;
            return `$${amt.toFixed(0)}`;
          };
          
          let bullish = 0;
          let bearish = 0;
          for (const t of tradesToUse) {
            if (t.side?.toLowerCase() === 'yes') bullish += t.amount || 0;
            if (t.side?.toLowerCase() === 'no') bearish += t.amount || 0;
          }
          
          const total = bullish + bearish;
          const bullShare = total > 0 ? (bullish / total) * 100 : 0;
          const bearShare = total > 0 ? (bearish / total) * 100 : 0;
          
          // Use the specific target name if available, otherwise fall back to market question
          const marketLabel = whaleOfferTarget || currentMarket?.question || 'this market';
          const voiceSummary = tradesToUse.length === 0
            ? `I'm not seeing any recent whale-size trades specifically on ${marketLabel}. Overall flow in the last day is pretty balanced, so nothing major to copy yet. Want me to analyze the odds instead?`
            : `Looking at whale activity for ${marketLabel}: recent flow is ${formatAmount(total)} total, with about ${bullShare.toFixed(0)}% on the YES side and ${bearShare.toFixed(0)}% on NO. Biggest tickets are around ${formatAmount(Math.max(...tradesToUse.map((t: any) => t.amount || 0)))}. ${bullShare > bearShare ? 'Smart money is leaning bullish' : 'Whales are leaning bearish'} here.`;
          
          return new Response(
            JSON.stringify({
              voiceSummary,
              needsFullAnalysis: false,
              currentMarket: {
                url: currentMarket?.url || effectiveMarketUrl,
                question: whaleOfferTarget || currentMarket?.question, // Use specific target if available
                price: currentMarket?.price,
                platform: currentMarket?.platform,
                lastWhaleOfferTarget: whaleOfferTarget, // Echo back for context tracking
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (err) {
          console.error('Whale lock flow failed, falling back to LLM:', err);
        }
      }
      
      // Check if Poly asked something in the last message
      let polyLastAskedAbout = '';
      let polyOfferedWhaleData = false;
      let polyOfferedSearchResults = false;
      const assistantMsgs = enrichedMessages.filter((m: any) => m.role === 'assistant');
      if (assistantMsgs.length > 0) {
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
        if (lastAssistant?.content) {
          const lowerContent = lastAssistant.content.toLowerCase();
          if (lowerContent.includes('?')) {
            polyLastAskedAbout = lastAssistant.content.substring(0, 150);
          }
          if (lowerContent.includes('whale') && lowerContent.includes('?')) {
            polyOfferedWhaleData = true;
          }
          if (lowerContent.includes('which one') || (lowerContent.includes('found') && lowerContent.includes('market'))) {
            polyOfferedSearchResults = true;
          }
        }
      }
      
      // Build search results context if available
      let searchResultsContext = '';
      if (searchResults.length > 0) {
        searchResultsContext = `
🔍 SEARCH RESULTS FOUND:
${searchResults.slice(0, 3).map((m: any, i: number) => 
  `${i + 1}. "${m.question}" at ${m.yesPrice}% YES - Volume: ${formatVolume(m.volume)}
   URL: ${m.url}`
).join('\n')}

When user says "first one", "1", "the first" → analyze market #1
When user says "second one", "2", "the second" → analyze market #2
`;
      }

      // Re-compute current date at request time for freshness
      const requestDateInfo = getCurrentDateInfo();
      
      const quickSystemPrompt = `You're Poly. Keep responses under 15 seconds of speech.

Talk naturally like you're texting a friend:
- "Yeah, so basically..."
- "Here's the deal..."
- "I'd say..."

Skip formal language. Be quick and helpful.

🚨 CRITICAL TIME CONTEXT - YOU ARE SPEAKING IN REAL TIME:
TODAY'S DATE: ${requestDateInfo.fullDate}
CURRENT YEAR: ${requestDateInfo.year}

⚠️ MANDATORY TIME RULES:
- The Bitcoin halving in 2024 ALREADY HAPPENED (April 2024)
- The 2024 US Election ALREADY HAPPENED (Trump won in November 2024)
- NEVER say "upcoming" or "coming" about 2024 events - they are PAST events
- When discussing crypto, the NEXT halving is 2028, not 2024
- Always ground your analysis in ${requestDateInfo.year} reality

       ${explicitContext ? `
╔══════════════════════════════════════════════════════════════════╗
║  EXPLICIT CONTEXT FROM CLIENT (HIGHEST PRIORITY - ALWAYS OBEY)  ║
╚══════════════════════════════════════════════════════════════════╝
${explicitContext}

⚡ IF CONTEXT SAYS "USER_IS_CONFIRMING" → CONTINUE THE SAME ANALYSIS, DO NOT ASK "WHICH MARKET?"
⚡ IF CONTEXT HAS "WHALE_OFFER_TARGET" → PROVIDE WHALE DATA FOR THAT SPECIFIC TARGET
⚡ IF CONTEXT HAS "RECENTLY_DISCUSSED" OR "POLY_LAST_OFFERED_SPECIFIC_MARKET" → STAY ON THAT TOPIC
` : ''}
+
       ${currentMarketInfo}
 
       ${hasManualPrices ? `
       🔢 USER PROVIDED MANUAL PRICES:
       ${manualPrices.map(p => `- ${p.name}: ${p.price}`).join('\n')}
 
       Analyze these exact prices! Calculate the edge between them. The user is telling you the odds directly - use them!
       ` : ''}
 
       ${hasSpecificMarket || marketDataInMessages ? `
       🚨 CRITICAL: The user has loaded a specific market. You have the market data in this conversation.
       Analyze THIS market directly with REAL numbers - DO NOT ask for a link!
       Include price, volume, and your edge calculation.
       ` : ''}
 
       ${isContextualRequest && currentMarket?.question ? `
       ⚠️ CONTEXTUAL REQUEST DETECTED!
       User said "${userMessage.substring(0, 50)}" which references the CURRENT MARKET:
       "${currentMarket.question}" ${currentMarket.price ? `at ${currentMarket.price}` : ''}
 
       RESPOND ABOUT THIS MARKET - NOT A RANDOM DIFFERENT ONE!
       ` : ''}
 
       ${isContextualRequest && !hasSpecificMarket && !currentMarketInfo && !hasManualPrices ? `
       ⚠️ User seems to be asking about "this market" but no market context found.
       Ask them: "Which market are you asking about? You can paste a Polymarket or Kalshi URL, or tell me the topic."
       ` : ''}
 
       ${isUserJustSayingYes && polyLastAskedAbout ? `
       🎯 USER IS CONFIRMING YOUR LAST QUESTION!
       You asked: "${polyLastAskedAbout}..."
       User said: "${userMessage}"
 
       RESPOND TO YOUR OWN QUESTION! Don't ask "which market?" - just continue with what you offered!
       ` : ''}
       
       ${isUserJustSayingYes && polyOfferedWhaleData ? `
       🐋 USER WANTS WHALE DATA! You offered whale data and they said yes.
       PROVIDE THE WHALE DATA for the current market. Use the whale activity data in this conversation.
       ` : ''}
       
       ${isUserJustSayingYes && polyOfferedSearchResults && searchResults.length > 0 ? `
       🔍 USER IS SELECTING FROM SEARCH RESULTS!
       "first one" or "1" → Analyze: "${searchResults[0]?.question}" at ${searchResults[0]?.yesPrice}%
       ${searchResults[1] ? `"second one" or "2" → Analyze: "${searchResults[1]?.question}" at ${searchResults[1]?.yesPrice}%` : ''}
       ` : ''}
       
       ${searchResultsContext}
 
       ${conversationContext ? `
       CONVERSATION HISTORY:
       ${conversationContext}
 
       When user says "yes", "sure" → they're CONFIRMING your last suggestion!
       ` : ''}
 
       YOUR CAPABILITIES:
       1. 📊 MARKET ANALYSIS - Analyze with REAL data from the conversation: price, volume, edge, recommendation
       2. 🐋 WHALE TRACKING - Show large trades and smart money flow (USE ACTUAL WHALE DATA if provided)
       3. 🔥 MARKET DISCOVERY - Find trending markets, best opportunities
       4. 💰 EDGE CALCULATION - Calculate true odds vs market price
       5. 🔍 MARKET SEARCH - Find markets by topic (e.g., "find trump markets", "what about epstein files")
 
       ${hasWhaleContext ? `USER ASKED ABOUT WHALES - Include SPECIFIC whale trades with REAL dollar amounts and sides from the data provided. DO NOT make up numbers.` : ''}
       ${hasMarketContext && !hasSpecificMarket ? 'USER WANTS MARKET DISCOVERY - List top 2-3 markets with specific odds and your take.' : ''}
       ${hasSpecificMarket ? 'USER HAS A SPECIFIC MARKET - Give price, your edge calculation, and clear YES/NO recommendation!' : ''}
       ${searchResults.length > 0 ? 'SEARCH RESULTS FOUND - Present the top matches and ask which one to analyze (unless user already picked).' : ''}
 
       CRITICAL RULES:
       1. NEVER ask for a link if you already have market data in the conversation
       2. NEVER switch to a random different market - STAY ON THE CURRENT TOPIC
       3. NEVER make up numbers - use ONLY the data provided
       4. When user says "yes", "sure", "please", "continue" → they're confirming YOUR last suggestion, continue on SAME market
       5. When user says "first one", "1", "the first" → analyze the FIRST search result
       6. Offer to provide more info, don't ask user for data
       7. If user provides manual prices (like "X is 98%, Y is 2%"), analyze those EXACT numbers
       8. ALWAYS offer whale data at the end of market analysis: "Want to see whale activity on this?"
       9. If you CAN'T find specific market data or need more context, say something like: "I don't have that exact market in front of me. Drop the Polymarket or Kalshi link below and I'll break it down instantly." - Make it sound helpful and smooth, not robotic.
       10. When offering whale data, be SPECIFIC about the target: "Want whale activity on Kevin Warsh?" not just "Want whale data?" - This helps track context for follow-ups.
       11. If search returns unrelated markets (e.g., user asks about Chile election but you only have US markets), acknowledge you don't have that specific market and suggest pasting a link.
       12. NEVER suggest unrelated markets when user asks for something specific - better to say "I don't have that market" than show random results.
 
       ANALYSIS REQUIREMENTS (ALWAYS include when analyzing):
        - Current price (e.g., "15 cents" or "65%") - USE REAL DATA
        - Your edge estimate with reasoning (e.g., "I see +5% edge here because...")
        - Clear recommendation (BUY YES / BUY NO / SKIP) with entry price if applicable
        - One key risk factor that could invalidate the thesis

       🎯 MULTI-OUTCOME EVENTS (Fed Chair, Elections, "Who will win X"):
        When analyzing events with multiple candidates/outcomes:
        1. ANALYZE EACH TOP CANDIDATE (top 3-5 by odds) INDIVIDUALLY with:
           - Their current odds and what the market is pricing in
           - YOUR probability estimate and concrete reasoning (news, history, insider signals)
           - Specific edge calculation (+X% or -X%)
           - Clear BUY YES / BUY NO / SKIP recommendation
        2. Be conversational but data-driven - explain your reasoning like a trader friend
        3. End with your TOP PICK and overall thesis
        4. Offer whale data on specific candidates
        
        For multi-outcome, your response should be ~800-1000 characters to cover all candidates properly.
        Don't just summarize odds - ANALYZE each one with your independent view!

       VOICE FORMAT:
        - For single markets: 4-6 sentences, ~500-600 characters
        - For multi-outcome events: 8-12 sentences, ~800-1000 characters (cover each candidate!)
        - Sound confident and direct like a trader friend
        - Include SPECIFIC numbers from the data
        - NO bullet points or markdown - just natural speech
        - Offer follow-up info (don't ask user for data)
        - ANALYZE don't just summarize - explain WHY there's edge, what factors matter

       OPENING ACKNOWLEDGMENTS - ROTATE THESE (never use same one twice in a row):
        - "Alright, breaking this down..."
        - "Pulling this up now..."
        - "Looking at this market..."
        - "Here's what I'm seeing..."
        - "Let me dig into this one..."
        - "Okay, analyzing this..."
        - "Right, let's look at the numbers..."
        IMPORTANT: Vary your openings! Don't always start with "Got it" - mix it up naturally.

       EXAMPLE VOICE RESPONSES:

       For multi-outcome (Fed Chair, elections):
        "Alright, breaking down this Fed Chair market. Hassett at 51% is the front-runner, and I think that's roughly fair - he's got Trump's ear on economics. Warsh at 39% looks overpriced to me, I'd put him closer to 30% given his Fed skepticism doesn't align with Trump's rate cut push - that's potential edge fading him. Waller at 4.8% is interesting as a dark horse but still too high, he's been passed over before. I'd look at buying NO on Warsh above 60 cents, or small NO on Waller at 95 cents for a safer play. Main risk is Trump pivots unexpectedly. Want whale activity on any of these names?"

       For single market analysis:
        "Looking at this one - Maduro by March 31 is at 15 cents. Way too high in my view. Historically, regime changes take months of sustained pressure, and current conditions don't support that timeline. I'd put true odds at 8-10%, giving you solid edge on NO at 85 cents. Two whales just loaded up on NO which confirms the thesis. Buy NO at 85 or better. Want the full breakdown on timing factors?"

       For confirmation responses ("yes", "sure"):
        "Diving deeper on that same market..." [Continue with more details about the CURRENT market, not a new one]`;

      console.log("VOICE MODE: Generating quick voice response. Has whale data:", hasWhaleContext, "Has market data:", hasMarketContext, "Has specific market:", hasSpecificMarket, "Current market:", currentMarket?.question, "Manual prices:", hasManualPrices);

      try {
        // Build Claude messages
        const claudeMessages = enrichedMessages.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        }));

        // Voice mode with tools
        const voiceToolPrompt = quickSystemPrompt + `

=== MANDATORY: REAL-TIME PRICE VERIFICATION ===
NEVER guess or hallucinate current cryptocurrency, stock, or asset prices. You MUST use web_search to verify current prices.

When user asks about Bitcoin, Ethereum, gold, stocks, or any asset price:
1. ALWAYS call web_search("Bitcoin current price USD") or similar FIRST
2. Extract the actual current price from search results
3. Only THEN analyze the market using the verified price
4. Cite the source: "Bitcoin is currently at $X according to [source]"

NEVER say things like "Bitcoin is around $120k" without first searching.
This rule applies to ALL asset prices - verify before stating!

=== TOOL USAGE FOR VOICE ===
You have tools available. Use them when:
- User asks about a specific market or topic → search_polymarket
- User provides a URL → get_market_data
- User asks about whale activity → get_whale_activity
- User asks about current crypto/stock prices → web_search (MANDATORY before stating prices)

Do NOT use tools for general explanatory questions like "what is a prediction market?" - answer directly.
`;

        // Voice mode: use Haiku for speed unless complex analysis needed
        const voiceModel = selectModel(lastUserMessage?.content || '', { isVoice: true });
        
        // Include web_search tool for voice mode to verify prices
        const voiceTools = [...POLY_TOOLS, WEB_SEARCH_TOOL as any];
        
        const quickClaudeResponse = await anthropic.messages.create({
          model: voiceModel,
          max_tokens: 800,
          system: voiceToolPrompt,
          messages: claudeMessages,
          tools: voiceTools
        });

        // Check if Claude wants to use tools
        if (quickClaudeResponse.stop_reason === 'tool_use') {
          console.log('[Voice] Claude requested tool use');
          
          const toolUses = quickClaudeResponse.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
          );
          
          // Execute tools
          const toolResults = await Promise.all(
            toolUses.map(async (tool) => {
              const result = await executeToolCall(
                { name: tool.name, id: tool.id, input: tool.input as any },
                supabaseUrl,
                supabaseKey,
                fetchPolymarketData,
                fetchKalshiData,
                extractMarketInfo,
                fetchedMarketInfo || currentMarket // Pass current market context
              );
              return {
                type: 'tool_result' as const,
                tool_use_id: tool.id,
                content: result
              };
            })
          );
          
          // Get final response with tool results - use Sonnet for reasoning about tool data
          const finalResponse = await anthropic.messages.create({
            model: SONNET_MODEL, // Always Sonnet for tool follow-up
            max_tokens: 800,
            system: voiceToolPrompt,
            messages: [
              ...claudeMessages,
              {
                role: 'assistant',
                content: quickClaudeResponse.content
              },
              {
                role: 'user',
                content: toolResults
              }
            ]
          });
          
          const voiceSummary = finalResponse.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
          
          console.log("Voice summary with tools (Claude):", voiceSummary.substring(0, 100));
          
          // Save to conversation memory
          await saveConversationTurn(currentUserMessage?.content || userMessage, voiceSummary);
          
          const echoMarket = fetchedMarketInfo || currentMarket || null;
          
          return new Response(
            JSON.stringify({
              voiceSummary: voiceSummary,
              needsFullAnalysis: true,
              currentMarket: echoMarket,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // No tools used - direct response
        const voiceSummary = quickClaudeResponse.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
        
        console.log("Quick voice summary generated (Claude):", voiceSummary.substring(0, 100));

        // Save to conversation memory
        await saveConversationTurn(currentUserMessage?.content || userMessage, voiceSummary);

        // Return the quick voice summary immediately
        const echoMarket = fetchedMarketInfo || currentMarket || null;
        
        return new Response(
          JSON.stringify({
            voiceSummary: voiceSummary,
            needsFullAnalysis: true,
            currentMarket: echoMarket,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (claudeError: any) {
        console.error("Quick voice response failed (Claude):", claudeError);
        
        // Check if it's a rate limit or overload error - try Gemini fallback for voice
        const shouldFallback = claudeError.status === 429 || claudeError.status === 529 || claudeError.status === 500 || claudeError.status === 503;
        
        if (shouldFallback) {
          console.log('[Voice Fallback] Attempting Lovable AI (Gemini) fallback...');
          const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
          
          if (lovableApiKey) {
            try {
              const fallbackResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${lovableApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  messages: [
                    { role: 'system', content: quickSystemPrompt + '\n\nKeep responses brief and conversational for voice.' },
                    ...enrichedMessages.map(msg => ({ role: msg.role, content: msg.content }))
                  ],
                  max_tokens: 800,
                }),
              });

              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                const voiceSummary = fallbackData.choices?.[0]?.message?.content || "I'm having trouble connecting right now. Please try again.";
                
                console.log('[Voice Fallback] Gemini response OK:', voiceSummary.substring(0, 100));
                
                // Save to conversation memory
                await saveConversationTurn(lastUserMessage?.content || '', voiceSummary);
                
                const echoMarket = fetchedMarketInfo || currentMarket || null;
                
                return new Response(
                  JSON.stringify({
                    voiceSummary: voiceSummary,
                    needsFullAnalysis: false, // Gemini already gave full response
                    currentMarket: echoMarket,
                    fallbackUsed: 'gemini'
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              } else {
                console.error('[Voice Fallback] Gemini failed:', fallbackResponse.status);
              }
            } catch (fallbackError) {
              console.error('[Voice Fallback] Gemini error:', fallbackError);
            }
          }
        }
        
        // Fall back to regular streaming if quick fails and Gemini fallback didn't work
      }
    }

    // ============= DEEP RESEARCH MODE =============
    if (deepResearch) {
      console.log("[DeepResearch] Deep research mode enabled, fetching comprehensive data...");
      const userQuery = lastUserMessage?.content || '';
      const researchData = await getDeepResearch(userQuery);
      
      if (researchData) {
        // Format the research results with clickable source citations
        let formattedResponse = `📊 **Deep Research Results**\n\n${researchData.answer || ''}`;
        
        if (researchData.citations && researchData.citations.length > 0) {
          formattedResponse += '\n\n📚 **Sources:**\n';
          researchData.citations.slice(0, 8).forEach((c: any, i: number) => {
            const url = c.url || c.link || '';
            const title = c.title || c.name || (url ? new URL(url).hostname : 'Source');
            if (url) {
              formattedResponse += `${i + 1}. [${title}](${url})\n`;
            } else {
              formattedResponse += `${i + 1}. ${title}\n`;
            }
          });
        }
        
        console.log("[DeepResearch] ✅ Returning research results");
        
        // Return as streamed response
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
          start(controller) {
            const sseData = JSON.stringify({
              choices: [{ delta: { content: formattedResponse } }]
            });
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        });
        
        return new Response(readableStream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } else {
        console.log("[DeepResearch] No results, falling back to regular analysis");
      }
    }

    console.log("Calling Claude with tools,", enrichedMessages.length, "messages, mode:", detailMode, "voiceMode:", voiceMode, "fetched market data:", fetchedMarketData);

    // Build Claude messages and sanitize to remove any tool_use artifacts
    const claudeMessages = sanitizeMessages(enrichedMessages.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    })));
    
    console.log(`[Sanitize] Cleaned ${enrichedMessages.length} messages to ${claudeMessages.length} messages`);

    // Build current market context for Claude
    const currentMarketContext = fetchedMarketInfo || currentMarket || null;
    const marketContextForPrompt = currentMarketContext 
      ? `\n\n=== CURRENT MARKET CONTEXT (USE FOR FOLLOW-UP QUESTIONS) ===
You are currently analyzing this market:
- Question: ${currentMarketContext.question || currentMarketContext.title || 'Unknown'}
- URL: ${currentMarketContext.url || 'N/A'}
- Event: ${currentMarketContext.eventSlug || currentMarketContext.eventName || 'N/A'}
- Market Slug: ${currentMarketContext.slug || extractSlugFromUrl(currentMarketContext.url) || 'N/A'}

CRITICAL: When user asks follow-up questions like "check trades", "check arbitrage", "what's the trade flow", "any whales" - they mean THIS market above. 
DO NOT ask for the market URL or slug again. Use the context provided.
For Dome tools, use market_slug: "${currentMarketContext.slug || extractSlugFromUrl(currentMarketContext.url) || ''}"
For event-level tools (arbitrage), use event_slug: "${currentMarketContext.eventSlug || extractEventSlugFromUrl(currentMarketContext.url) || ''}"
`
      : '';

    // Enhanced system prompt with tool guidance
    const toolSystemPrompt = systemPrompt + marketContextForPrompt + `

=== TOOL USAGE GUIDELINES ===
You have access to tools for searching markets, getting market data, and checking whale activity.

WHEN TO USE TOOLS:
- User asks about a specific market, topic, or event → use search_polymarket
- User provides a Polymarket/Kalshi URL → use get_market_data  
- User asks about whale trades, big money, smart money → use get_whale_activity
- User asks about recent trades → use get_recent_trades with current market context
- User asks about buy/sell pressure → use get_trade_flow with current market context

FOLLOW-UP QUESTIONS (CRITICAL):
When user asks follow-up questions after you've analyzed a market, USE THE CURRENT MARKET CONTEXT above.
Examples of follow-up questions that should use current context:
- "check trades" → use get_recent_trades with current market_slug
- "what's the trade flow?" → use get_trade_flow with current market_slug
- "check whales" → use get_whale_activity with current market context

DO NOT ask for URL or slug when you have current market context.

WHEN NOT TO USE TOOLS (answer directly):
- General questions: "What is a prediction market?", "How do prediction markets work?"
- Explanatory questions: "Explain edge calculation", "What does YES mean?"
- Opinions without specific markets: "Is crypto a good bet?"
- Greetings: "Hey", "Hello", "What can you do?"

🚨 TOOL USAGE PRIORITY: If you're unsure whether to use a tool, USE THE TOOL.
It's better to have real data than to guess. When users ask about data availability 
or what you can see - ALWAYS demonstrate by fetching the data immediately.
Never explain limitations - show capabilities by using tools.

=== WHALE DATA INTEGRATION ===
When analyzing markets, you may receive sidebarData with real-time whale information from the dashboard.
This data includes:
- topTraders: List of top traders with volume, buy %, and whale flags (isWhale)
- tradeStats: Buy/sell pressure and trade counts
- whales: Array of identified whale traders

Use this sidebar whale data to enhance your analysis:
- Reference specific whale activity when present
- Note whale buy/sell ratios for market sentiment
- Highlight if whales are accumulating or distributing
`;

    try {
      // Select model based on query complexity
      const textModel = selectModel(lastUserMessage?.content || '', { isVoice: false });
      
      // First, call Claude with tools to let it decide if tools are needed
      const initialResponse = await anthropic.messages.create({
        model: textModel,
        max_tokens: 4096,
        system: toolSystemPrompt,
        messages: claudeMessages,
        // Cast to any to allow web_search_20250305 tool type which SDK may not fully type yet
        tools: [...POLY_TOOLS, WEB_SEARCH_TOOL] as any
      });

      console.log("Claude initial response stop_reason:", initialResponse.stop_reason);

      // Check if Claude wants to use tools
      if (initialResponse.stop_reason === 'tool_use') {
        console.log('[Claude] Requested tool use');
        
        // Extract any initial text content BEFORE tool execution
        const initialTextBlocks = initialResponse.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );
        const initialText = initialTextBlocks.map(b => b.text).join('').trim();
        
        if (initialText) {
          console.log('[Claude] Found initial text before tools:', initialText.substring(0, 100) + '...');
        }
        
        const toolUses = initialResponse.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );
        
        // Execute all tools in parallel
        const toolResults = await Promise.all(
          toolUses.map(async (tool) => {
            const result = await executeToolCall(
              { name: tool.name, id: tool.id, input: tool.input as any },
              supabaseUrl,
              supabaseKey,
              fetchPolymarketData,
              fetchKalshiData,
              extractMarketInfo,
              fetchedMarketInfo || currentMarket // Pass current market context
            );
            return {
              type: 'tool_result' as const,
              tool_use_id: tool.id,
              content: result
            };
          })
        );
        
        console.log('[Claude] Executed', toolResults.length, 'tools, getting final response');
        
        // Prepare messages for follow-up call
        const followUpMessages = [
          ...claudeMessages,
          {
            role: 'assistant' as const,
            // CRITICAL: Filter out server_tool_use and web_search blocks from assistant content
            // to prevent "web_search_tool_result not found" errors
            content: initialResponse.content.filter((block: any) => 
              block.type !== 'server_tool_use' && 
              block.type !== 'web_search_tool_result'
            )
          },
          {
            role: 'user' as const,
            content: toolResults
          }
        ];
        
        // Continue conversation with tool results - streaming final response
        // Always use Sonnet for tool follow-up (needs reasoning about data)
        const STREAM_TIMEOUT = 25000; // 25 seconds max for stream initialization
        
        let stream: any;
        try {
          // Add timeout wrapper for stream initialization
          stream = await Promise.race([
            anthropic.messages.stream({
              model: SONNET_MODEL,
              max_tokens: 4096,
              system: toolSystemPrompt,
              messages: followUpMessages,
              // Include tools in follow-up call as well
              tools: [...POLY_TOOLS, WEB_SEARCH_TOOL] as any
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Stream initialization timeout')), STREAM_TIMEOUT)
            )
          ]);
          console.log('[Stream] Stream initialized successfully');
        } catch (streamInitError: any) {
          console.error('[Stream] Stream init failed:', streamInitError.message || streamInitError);
          
          // Fallback to non-streaming response
          console.log('[Stream] Attempting non-streaming fallback...');
          try {
            const fallbackResponse = await anthropic.messages.create({
              model: SONNET_MODEL,
              max_tokens: 4096,
              system: toolSystemPrompt,
              messages: followUpMessages,
              tools: [...POLY_TOOLS, WEB_SEARCH_TOOL] as any
            });
            
            const fallbackText = fallbackResponse.content
              .filter((block): block is Anthropic.TextBlock => block.type === 'text')
              .map(block => block.text)
              .join('');
            
            console.log('[Stream] ✅ Non-streaming fallback succeeded, text length:', fallbackText.length);
            
            const encoder = new TextEncoder();
            const fallbackStream = new ReadableStream({
              start(controller) {
                const sseData = JSON.stringify({
                  choices: [{ delta: { content: fallbackText } }]
                });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              }
            });
            
            return new Response(fallbackStream, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
            });
          } catch (fallbackError: any) {
            console.error('[Stream] Non-streaming fallback also failed:', fallbackError.message || fallbackError);
            return new Response(
              JSON.stringify({ content: "We're experiencing heavy load right now. Please try again in a moment! 🔄" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
          async start(controller) {
            let chunkCount = 0;
            try {
              // FIRST: Stream any initial text that came before tool execution
              // This fixes "Let me check the trades..." text not appearing
              if (initialText) {
                console.log('[Stream] Sending initial text before tool results...');
                const initSseData = JSON.stringify({
                  choices: [{ delta: { content: initialText + '\n\n' } }]
                });
                controller.enqueue(encoder.encode(`data: ${initSseData}\n\n`));
                chunkCount++;
              }
              
              console.log('[Stream] Starting to iterate over Claude stream...');
              let hasTextContent = false;
              let secondaryToolName: string | null = null;
              
              for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  hasTextContent = true;
                  chunkCount++;
                  const sseData = JSON.stringify({
                    choices: [{
                      delta: { content: event.delta.text }
                    }]
                  });
                  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                }
                // Detect if Claude is requesting secondary tools instead of responding with text
                if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
                  secondaryToolName = event.content_block.name;
                  console.log('[Stream] ⚠️ Claude requested secondary tool:', secondaryToolName);
                }
              }
              
              // If no text was streamed but Claude wanted more tools, send a completion message
              // This prevents the "freeze" where Claude says "let me check..." then dies
              if (!hasTextContent && secondaryToolName) {
                console.log('[Stream] ⚠️ Follow-up had tool_use but no text, sending analysis completion');
                const fallbackText = "I've gathered the market data but need a moment to process it. Please try your question again and I'll have the full analysis ready! 🔄";
                const fallbackSse = JSON.stringify({
                  choices: [{ delta: { content: fallbackText } }]
                });
                controller.enqueue(encoder.encode(`data: ${fallbackSse}\n\n`));
                chunkCount++;
              }
              
              console.log(`[Stream] ✅ Completed successfully, sent ${chunkCount} chunks${secondaryToolName ? ` (secondary tool blocked: ${secondaryToolName})` : ''}`);
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (streamError: any) {
              console.error(`[Stream] ❌ Failed after ${chunkCount} chunks:`, streamError.message || streamError);
              
              // Try to send a graceful error message via SSE
              try {
                const errorText = chunkCount > 0 
                  ? "\n\n---\n*Response interrupted. Please try again for the complete analysis.*"
                  : "Oops! We hit a snag. Please try again - I'll get that analysis for you! 🔄";
                const errorSse = JSON.stringify({
                  choices: [{ delta: { content: errorText } }]
                });
                controller.enqueue(encoder.encode(`data: ${errorSse}\n\n`));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              } catch (e) {
                console.error('[Stream] Failed to send error message:', e);
                controller.error(streamError);
              }
            }
          }
        });

        return new Response(readableStream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // No tools used - stream the text response directly
      const textContent = initialResponse.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Convert to SSE format for frontend compatibility
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        start(controller) {
          // Send the entire text as a single chunk (it's already complete)
          const sseData = JSON.stringify({
            choices: [{
              delta: { content: textContent }
            }]
          });
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(readableStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } catch (claudeError: any) {
      console.error("Claude API error:", claudeError);
      
      // Check if it's a rate limit or overload error - try model cascade
      if (isOverloadError(claudeError)) {
        console.log('[Cascade] Primary model failed, attempting cascade...');
        
        // Try Sonnet as first fallback
        try {
          console.log('[Cascade] Trying Sonnet...');
          const sonnetResponse = await anthropic.messages.create({
            model: SONNET_MODEL,
            max_tokens: 4096,
            system: toolSystemPrompt,
            messages: claudeMessages,
            tools: [...POLY_TOOLS, WEB_SEARCH_TOOL] as any
          });
          
          // Success with Sonnet - stream the response
          const textContent = sonnetResponse.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map(block => block.text)
            .join('');
          
          console.log('[Cascade] ✅ Sonnet succeeded');
          const encoder = new TextEncoder();
          const readableStream = new ReadableStream({
            start(controller) {
              const sseData = JSON.stringify({
                choices: [{ delta: { content: textContent } }]
              });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          });
          
          return new Response(readableStream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        } catch (sonnetError: any) {
          console.log('[Cascade] Sonnet failed:', sonnetError.status || sonnetError.message);
          
          // Try Gemini as second fallback
          const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
          if (lovableApiKey) {
            try {
              console.log('[Cascade] Trying Gemini...');
              const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${lovableApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    ...claudeMessages
                  ],
                  stream: true,
                }),
              });
              
              if (geminiResponse.ok && geminiResponse.body) {
                console.log('[Cascade] ✅ Gemini succeeded');
                return new Response(geminiResponse.body, {
                  headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
                });
              }
              console.log('[Cascade] Gemini failed:', geminiResponse.status);
            } catch (geminiError) {
              console.error('[Cascade] Gemini error:', geminiError);
            }
          }
        }
        
        // All models failed - add to queue and return 202 Accepted
        const userMessage = lastUserMessage?.content || '';
        const queueEntry = addToQueue(conversationId, userMessage);
        const estimatedWait = queueEntry.position * 5; // ~5 sec per position
        
        console.log(`[Queue] All models overwhelmed, queued request at position ${queueEntry.position}`);
        
        return new Response(
          JSON.stringify({
            queued: true,
            queueId: queueEntry.id,
            queuePosition: queueEntry.position,
            estimatedWaitSeconds: estimatedWait,
            message: `We're experiencing high demand. You're #${queueEntry.position} in queue. Estimated wait: ~${estimatedWait}s`,
            cascadeAttempted: ['Haiku', 'Sonnet', 'Gemini']
          }),
          { 
            status: 202, // Accepted - queued for processing
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      // Non-overload error - return user-friendly message
      return corsResponse(
        { error: "Something went wrong. Please try again.", content: "Something went wrong on our end. Please try again! 🔄" },
        500
      );
    }
  } catch (e) {
    console.error("poly-chat error:", e);
    return corsResponse(
      { error: e instanceof Error ? e.message : "Unknown error", content: "We're experiencing some issues. Please try again in a moment! 🔄" },
      500
    );
  }
});