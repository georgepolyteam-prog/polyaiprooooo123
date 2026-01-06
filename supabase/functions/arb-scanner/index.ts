import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DOME_API_URL = "https://api.domeapi.io/v1";

interface MatchingMarket {
  kalshi_ticker: string;
  polymarket_slug: string;
  polymarket_token_id?: string;
  event_title: string;
  sport: string;
  expires_at?: string;
}

interface OrderbookLevel {
  price: number;
  size: number;
}

interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

interface ArbOpportunity {
  id: string;
  matchKey: string;
  eventTitle: string;
  sport: string;
  spreadPercent: number;
  buyPlatform: 'kalshi' | 'polymarket';
  sellPlatform: 'kalshi' | 'polymarket';
  buyPrice: number;
  sellPrice: number;
  buyTicker: string;
  sellTicker: string;
  buyVolume: number;
  sellVolume: number;
  estimatedProfit: number;
  expiresAt: string | null;
  updatedAt: number;
}

// Fetch orderbook from Dome API for Polymarket
async function fetchPolymarketOrderbook(tokenId: string, apiKey: string): Promise<Orderbook | null> {
  try {
    const response = await fetch(`${DOME_API_URL}/polymarket/orderbooks?token_id=${tokenId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      console.log(`[arb-scanner] Failed to fetch Polymarket orderbook: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      bids: data.bids || [],
      asks: data.asks || [],
    };
  } catch (error) {
    console.error("[arb-scanner] Error fetching Polymarket orderbook:", error);
    return null;
  }
}

// Fetch orderbook from Dome API for Kalshi
async function fetchKalshiOrderbook(ticker: string, apiKey: string): Promise<Orderbook | null> {
  try {
    const response = await fetch(`${DOME_API_URL}/kalshi/orderbooks?ticker=${ticker}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      console.log(`[arb-scanner] Failed to fetch Kalshi orderbook: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      bids: data.bids || [],
      asks: data.asks || [],
    };
  } catch (error) {
    console.error("[arb-scanner] Error fetching Kalshi orderbook:", error);
    return null;
  }
}

// Fetch matching markets from Dome API
async function fetchMatchingMarkets(sport: string, apiKey: string, date?: string): Promise<MatchingMarket[]> {
  try {
    let url = `${DOME_API_URL}/matching-markets/sports/${sport}`;
    if (date) {
      url += `?date=${date}`;
    }
    
    console.log(`[arb-scanner] Fetching matching markets from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      console.log(`[arb-scanner] Failed to fetch matching markets: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const markets = data.markets;
    
    console.log(`[arb-scanner] Raw response type: ${typeof markets}`);
    
    if (!markets || typeof markets !== 'object') {
      console.log(`[arb-scanner] No markets found or unexpected format`);
      return [];
    }
    
    // If markets is already an array, use as-is
    if (Array.isArray(markets)) {
      console.log(`[arb-scanner] Found ${markets.length} matching markets (array)`);
      return markets;
    }
    
    // Object format: { "match-key": [platformData, ...] }
    const results: MatchingMarket[] = [];
    
    for (const [matchKey, platforms] of Object.entries(markets)) {
      if (!Array.isArray(platforms)) continue;
      
      let polymarketData: any = null;
      let kalshiData: any = null;
      
      for (const platform of platforms as any[]) {
        if (platform.platform === 'polymarket') {
          polymarketData = platform;
        } else if (platform.platform === 'kalshi') {
          kalshiData = platform;
        }
      }
      
      // Only include if both platforms are present
      if (polymarketData && kalshiData) {
        results.push({
          kalshi_ticker: kalshiData.ticker || kalshiData.kalshi_ticker,
          polymarket_slug: polymarketData.market_slug || matchKey,
          polymarket_token_id: polymarketData.token_id,
          event_title: polymarketData.title || kalshiData.title || matchKey,
          sport: sport,
          expires_at: polymarketData.end_date || kalshiData.expiration_time,
        });
      }
    }
    
    console.log(`[arb-scanner] Parsed ${results.length} matching market pairs from object`);
    return results;
    
  } catch (error) {
    console.error("[arb-scanner] Error fetching matching markets:", error);
    return [];
  }
}

// Calculate arbitrage opportunity between two orderbooks
function calculateArbitrage(
  kalshiOrderbook: Orderbook,
  polyOrderbook: Orderbook,
  market: MatchingMarket
): ArbOpportunity | null {
  // Get best prices
  const kalshiBestBid = kalshiOrderbook.bids[0];
  const kalshiBestAsk = kalshiOrderbook.asks[0];
  const polyBestBid = polyOrderbook.bids[0];
  const polyBestAsk = polyOrderbook.asks[0];
  
  if (!kalshiBestBid && !kalshiBestAsk && !polyBestBid && !polyBestAsk) {
    return null;
  }
  
  // Check for arbitrage: Buy low on one platform, sell high on another
  // Scenario 1: Buy on Kalshi, Sell on Polymarket
  let buyKalshiSellPoly: ArbOpportunity | null = null;
  if (kalshiBestAsk && polyBestBid) {
    const buyPrice = kalshiBestAsk.price * 100; // Convert to cents
    const sellPrice = polyBestBid.price * 100;
    const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
    
    if (spread > 0) {
      const estimatedProfit = spread - 2; // Assume 1% fee per platform
      buyKalshiSellPoly = {
        id: `${market.kalshi_ticker}-${market.polymarket_slug}`,
        matchKey: market.polymarket_slug,
        eventTitle: market.event_title,
        sport: market.sport,
        spreadPercent: Number(spread.toFixed(2)),
        buyPlatform: 'kalshi',
        sellPlatform: 'polymarket',
        buyPrice: Math.round(buyPrice),
        sellPrice: Math.round(sellPrice),
        buyTicker: market.kalshi_ticker,
        sellTicker: market.polymarket_slug,
        buyVolume: kalshiBestAsk.size,
        sellVolume: polyBestBid.size,
        estimatedProfit: Number(Math.max(0, estimatedProfit).toFixed(2)),
        expiresAt: market.expires_at || null,
        updatedAt: Date.now(),
      };
    }
  }
  
  // Scenario 2: Buy on Polymarket, Sell on Kalshi
  let buyPolySellKalshi: ArbOpportunity | null = null;
  if (polyBestAsk && kalshiBestBid) {
    const buyPrice = polyBestAsk.price * 100;
    const sellPrice = kalshiBestBid.price * 100;
    const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
    
    if (spread > 0) {
      const estimatedProfit = spread - 2;
      buyPolySellKalshi = {
        id: `${market.polymarket_slug}-${market.kalshi_ticker}`,
        matchKey: market.polymarket_slug,
        eventTitle: market.event_title,
        sport: market.sport,
        spreadPercent: Number(spread.toFixed(2)),
        buyPlatform: 'polymarket',
        sellPlatform: 'kalshi',
        buyPrice: Math.round(buyPrice),
        sellPrice: Math.round(sellPrice),
        buyTicker: market.polymarket_slug,
        sellTicker: market.kalshi_ticker,
        buyVolume: polyBestAsk.size,
        sellVolume: kalshiBestBid.size,
        estimatedProfit: Number(Math.max(0, estimatedProfit).toFixed(2)),
        expiresAt: market.expires_at || null,
        updatedAt: Date.now(),
      };
    }
  }
  
  // Return the better opportunity
  if (buyKalshiSellPoly && buyPolySellKalshi) {
    return buyKalshiSellPoly.spreadPercent > buyPolySellKalshi.spreadPercent 
      ? buyKalshiSellPoly 
      : buyPolySellKalshi;
  }
  
  return buyKalshiSellPoly || buyPolySellKalshi;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
    if (!DOME_API_KEY) {
      console.error("[arb-scanner] DOME_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Dome API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const sport = url.searchParams.get("sport") || "nfl";
    const minSpread = parseFloat(url.searchParams.get("minSpread") || "1");
    const date = url.searchParams.get("date") || undefined;

    console.log(`[arb-scanner] Scanning for ${sport} arb opportunities, minSpread: ${minSpread}%`);

    // Fetch matching markets
    const matchingMarkets = await fetchMatchingMarkets(sport, DOME_API_KEY, date);
    
    if (matchingMarkets.length === 0) {
      console.log("[arb-scanner] No matching markets found");
      return new Response(
        JSON.stringify({ opportunities: [], message: "No matching markets found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const opportunities: ArbOpportunity[] = [];

    // Process each matching market
    for (const market of matchingMarkets) {
      console.log(`[arb-scanner] Processing market: ${market.event_title}`);
      
      // Fetch orderbooks in parallel
      const [kalshiOrderbook, polyOrderbook] = await Promise.all([
        fetchKalshiOrderbook(market.kalshi_ticker, DOME_API_KEY),
        market.polymarket_token_id 
          ? fetchPolymarketOrderbook(market.polymarket_token_id, DOME_API_KEY)
          : Promise.resolve(null),
      ]);

      if (!kalshiOrderbook || !polyOrderbook) {
        console.log(`[arb-scanner] Missing orderbook data for ${market.event_title}`);
        continue;
      }

      const opportunity = calculateArbitrage(kalshiOrderbook, polyOrderbook, market);
      
      if (opportunity && opportunity.spreadPercent >= minSpread) {
        opportunities.push(opportunity);
        console.log(`[arb-scanner] Found opportunity: ${opportunity.eventTitle} - ${opportunity.spreadPercent}% spread`);
      }
    }

    // Sort by spread percentage descending
    opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);

    console.log(`[arb-scanner] Found ${opportunities.length} arbitrage opportunities`);

    // Optionally store in database for history
    if (opportunities.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        for (const opp of opportunities) {
          const { error } = await supabase.from("arb_opportunities").upsert({
            match_key: opp.matchKey,
            event_title: opp.eventTitle,
            sport: opp.sport,
            kalshi_ticker: opp.buyPlatform === 'kalshi' ? opp.buyTicker : opp.sellTicker,
            polymarket_slug: opp.buyPlatform === 'polymarket' ? opp.buyTicker : opp.sellTicker,
            spread_percent: opp.spreadPercent,
            buy_platform: opp.buyPlatform,
            buy_price: opp.buyPrice,
            sell_platform: opp.sellPlatform,
            sell_price: opp.sellPrice,
            buy_volume: opp.buyVolume,
            sell_volume: opp.sellVolume,
            expires_at: opp.expiresAt,
            is_active: true,
          }, {
            onConflict: 'match_key',
          });
          if (error) {
            console.error("[arb-scanner] Error upserting opportunity:", error);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        opportunities, 
        count: opportunities.length,
        sport,
        minSpread,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[arb-scanner] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
