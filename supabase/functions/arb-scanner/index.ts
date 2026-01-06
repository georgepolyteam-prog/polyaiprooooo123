import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DOME_API_URL = "https://api.domeapi.io/v1";

// ============ Interfaces ============

interface PolymarketMarket {
  condition_id: string;
  market_slug: string;
  question: string;
  description?: string;
  end_date_iso?: string;
  tokens?: Array<{
    token_id: string;
    outcome: string;
    price?: number;
  }>;
  volume?: number;
  liquidity?: number;
  category?: string;
  tags?: string[];
}

interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  expiration_time?: string;
  category?: string;
  volume?: number;
  open_interest?: number;
  yes_bid?: number;
  yes_ask?: number;
}

interface OrderbookLevel {
  price: number;
  size: number;
}

interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

interface MatchedPair {
  polymarket: PolymarketMarket;
  kalshi: KalshiMarket;
  matchScore: number;
  matchReason: string;
}

interface ArbOpportunity {
  id: string;
  matchKey: string;
  eventTitle: string;
  category: string;
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
  matchScore: number;
  matchReason: string;
}

// ============ Fetch All Markets ============

async function fetchAllPolymarketMarkets(apiKey: string, maxMarkets = 500): Promise<PolymarketMarket[]> {
  const allMarkets: PolymarketMarket[] = [];
  let offset = 0;
  const limit = 100;
  
  while (offset < maxMarkets) {
    try {
      const url = `${DOME_API_URL}/polymarket/markets?status=open&limit=${limit}&offset=${offset}`;
      console.log(`[arb-scanner] Fetching Polymarket markets: offset=${offset}`);
      
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        console.log(`[arb-scanner] Polymarket markets fetch failed: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      const markets = data.markets || data || [];
      
      if (!Array.isArray(markets) || markets.length === 0) {
        break;
      }
      
      allMarkets.push(...markets);
      offset += limit;
      
      // Check if there are more
      if (markets.length < limit) {
        break;
      }
    } catch (error) {
      console.error("[arb-scanner] Error fetching Polymarket markets:", error);
      break;
    }
  }
  
  console.log(`[arb-scanner] Fetched ${allMarkets.length} Polymarket markets total`);
  return allMarkets;
}

async function fetchAllKalshiMarkets(apiKey: string, maxMarkets = 500): Promise<KalshiMarket[]> {
  const allMarkets: KalshiMarket[] = [];
  let offset = 0;
  const limit = 100;
  
  while (offset < maxMarkets) {
    try {
      const url = `${DOME_API_URL}/kalshi/markets?status=open&limit=${limit}&offset=${offset}`;
      console.log(`[arb-scanner] Fetching Kalshi markets: offset=${offset}`);
      
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        console.log(`[arb-scanner] Kalshi markets fetch failed: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      const markets = data.markets || data || [];
      
      if (!Array.isArray(markets) || markets.length === 0) {
        break;
      }
      
      allMarkets.push(...markets);
      offset += limit;
      
      if (markets.length < limit) {
        break;
      }
    } catch (error) {
      console.error("[arb-scanner] Error fetching Kalshi markets:", error);
      break;
    }
  }
  
  console.log(`[arb-scanner] Fetched ${allMarkets.length} Kalshi markets total`);
  return allMarkets;
}

// ============ Orderbook Fetching ============

async function fetchPolymarketOrderbook(tokenId: string, apiKey: string): Promise<Orderbook | null> {
  try {
    const response = await fetch(`${DOME_API_URL}/polymarket/orderbooks?token_id=${tokenId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return {
      bids: data.bids || [],
      asks: data.asks || [],
    };
  } catch {
    return null;
  }
}

async function fetchKalshiOrderbook(ticker: string, apiKey: string): Promise<Orderbook | null> {
  try {
    const response = await fetch(`${DOME_API_URL}/kalshi/orderbooks?ticker=${ticker}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return {
      bids: data.bids || [],
      asks: data.asks || [],
    };
  } catch {
    return null;
  }
}

// ============ Fuzzy Matching Logic ============

// Common words to remove for better matching
const STOP_WORDS = new Set([
  'will', 'the', 'be', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
  'is', 'it', 'by', 'with', 'as', 'this', 'that', 'what', 'when', 'where', 'who',
  'how', 'which', 'their', 'its', 'his', 'her', 'before', 'after', 'during', 'between'
]);

// Entity aliases for common variations
const ENTITY_ALIASES: Record<string, string[]> = {
  'trump': ['donald trump', 'donald j trump', 'djt'],
  'biden': ['joe biden', 'joseph biden'],
  'bitcoin': ['btc', 'bitcoin'],
  'ethereum': ['eth', 'ethereum'],
  'elon musk': ['elon', 'musk'],
  'super bowl': ['superbowl', 'sb'],
  'nfl': ['national football league'],
  'nba': ['national basketball association'],
  'mlb': ['major league baseball'],
  'fed': ['federal reserve', 'fomc'],
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
    .join(' ')
    .trim();
}

function tokenize(text: string): Set<string> {
  return new Set(normalizeTitle(text).split(/\s+/).filter(t => t.length > 0));
}

function calculateTokenSimilarity(tokens1: Set<string>, tokens2: Set<string>): number {
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  let matches = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      matches++;
    } else {
      // Check for partial matches (one token contains another)
      for (const t2 of tokens2) {
        if (token.includes(t2) || t2.includes(token)) {
          matches += 0.5;
          break;
        }
      }
    }
  }
  
  const unionSize = new Set([...tokens1, ...tokens2]).size;
  return (matches / unionSize) * 100;
}

function extractEntities(text: string): Set<string> {
  const normalized = text.toLowerCase();
  const entities = new Set<string>();
  
  // Check for known entity aliases
  for (const [canonical, aliases] of Object.entries(ENTITY_ALIASES)) {
    if (normalized.includes(canonical) || aliases.some(a => normalized.includes(a))) {
      entities.add(canonical);
    }
  }
  
  // Extract numbers (dates, percentages, prices)
  const numbers = normalized.match(/\d+(\.\d+)?/g) || [];
  numbers.forEach(n => entities.add(n));
  
  // Extract years (2024, 2025, 2026)
  const years = normalized.match(/20\d{2}/g) || [];
  years.forEach(y => entities.add(y));
  
  return entities;
}

function calculateDateProximity(date1?: string, date2?: string): number {
  if (!date1 || !date2) return 50; // Neutral score if dates missing
  
  try {
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();
    
    if (isNaN(d1) || isNaN(d2)) return 50;
    
    const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
    
    if (diffDays <= 1) return 100; // Same day
    if (diffDays <= 7) return 80;  // Same week
    if (diffDays <= 30) return 50; // Same month
    if (diffDays <= 90) return 20; // Same quarter
    return 0;
  } catch {
    return 50;
  }
}

function calculateMatchScore(poly: PolymarketMarket, kalshi: KalshiMarket): { score: number; reason: string } {
  const polyTitle = poly.question || '';
  const kalshiTitle = kalshi.title || '';
  
  const polyTokens = tokenize(polyTitle);
  const kalshiTokens = tokenize(kalshiTitle);
  
  // 1. Token similarity (50% weight)
  const tokenSimilarity = calculateTokenSimilarity(polyTokens, kalshiTokens);
  
  // 2. Entity matching (30% weight)
  const polyEntities = extractEntities(polyTitle);
  const kalshiEntities = extractEntities(kalshiTitle);
  let entityScore = 0;
  let matchedEntities: string[] = [];
  
  for (const entity of polyEntities) {
    if (kalshiEntities.has(entity)) {
      entityScore += 100 / Math.max(polyEntities.size, kalshiEntities.size);
      matchedEntities.push(entity);
    }
  }
  
  // 3. Date proximity (20% weight)
  const dateScore = calculateDateProximity(poly.end_date_iso, kalshi.expiration_time);
  
  // Calculate weighted score
  const score = Math.min(100, (tokenSimilarity * 0.5) + (entityScore * 0.3) + (dateScore * 0.2));
  
  // Generate reason
  let reason = '';
  if (matchedEntities.length > 0) {
    reason = `Matched: ${matchedEntities.slice(0, 3).join(', ')}`;
  } else if (tokenSimilarity > 50) {
    reason = 'Title similarity';
  } else if (dateScore > 70) {
    reason = 'Date proximity';
  } else {
    reason = 'Partial match';
  }
  
  return { score, reason };
}

function findMatchingMarkets(
  polymarkets: PolymarketMarket[],
  kalshiMarkets: KalshiMarket[],
  minMatchScore = 60
): MatchedPair[] {
  const matches: MatchedPair[] = [];
  const usedKalshi = new Set<string>();
  
  console.log(`[arb-scanner] Finding matches between ${polymarkets.length} Poly and ${kalshiMarkets.length} Kalshi markets`);
  
  for (const poly of polymarkets) {
    let bestMatch: MatchedPair | null = null;
    let bestScore = 0;
    
    for (const kalshi of kalshiMarkets) {
      // Skip if already matched
      if (usedKalshi.has(kalshi.ticker)) continue;
      
      const { score, reason } = calculateMatchScore(poly, kalshi);
      
      if (score >= minMatchScore && score > bestScore) {
        bestScore = score;
        bestMatch = {
          polymarket: poly,
          kalshi: kalshi,
          matchScore: Math.round(score),
          matchReason: reason,
        };
      }
    }
    
    if (bestMatch) {
      matches.push(bestMatch);
      usedKalshi.add(bestMatch.kalshi.ticker);
    }
  }
  
  // Sort by match score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  console.log(`[arb-scanner] Found ${matches.length} matched pairs`);
  return matches;
}

// ============ Category Detection ============

function detectCategory(poly: PolymarketMarket, kalshi: KalshiMarket): string {
  const text = `${poly.question || ''} ${kalshi.title || ''} ${poly.category || ''} ${kalshi.category || ''}`.toLowerCase();
  
  if (/politic|elect|vote|trump|biden|congress|senate|president|governor/.test(text)) {
    return 'politics';
  }
  if (/bitcoin|btc|ethereum|eth|crypto|sol|xrp|doge/.test(text)) {
    return 'crypto';
  }
  if (/nfl|nba|mlb|nhl|soccer|football|basketball|baseball|hockey|super bowl|world cup|olympics/.test(text)) {
    return 'sports';
  }
  if (/fed|interest rate|inflation|gdp|stock|s&p|nasdaq|dow|earnings/.test(text)) {
    return 'finance';
  }
  if (/oscar|grammy|emmy|movie|film|celebrity|entertainment|music/.test(text)) {
    return 'entertainment';
  }
  if (/weather|temperature|hurricane|storm/.test(text)) {
    return 'weather';
  }
  
  return 'general';
}

function filterByCategory(markets: MatchedPair[], category: string): MatchedPair[] {
  if (category === 'all') return markets;
  
  return markets.filter(pair => {
    const detectedCategory = detectCategory(pair.polymarket, pair.kalshi);
    return detectedCategory === category;
  });
}

// ============ Arbitrage Calculation ============

function calculateArbitrage(
  kalshiOrderbook: Orderbook,
  polyOrderbook: Orderbook,
  pair: MatchedPair
): ArbOpportunity | null {
  const kalshiBestBid = kalshiOrderbook.bids[0];
  const kalshiBestAsk = kalshiOrderbook.asks[0];
  const polyBestBid = polyOrderbook.bids[0];
  const polyBestAsk = polyOrderbook.asks[0];
  
  if (!kalshiBestBid && !kalshiBestAsk && !polyBestBid && !polyBestAsk) {
    return null;
  }
  
  const category = detectCategory(pair.polymarket, pair.kalshi);
  
  // Scenario 1: Buy on Kalshi, Sell on Polymarket
  let buyKalshiSellPoly: ArbOpportunity | null = null;
  if (kalshiBestAsk && polyBestBid) {
    const buyPrice = kalshiBestAsk.price * 100;
    const sellPrice = polyBestBid.price * 100;
    const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
    
    if (spread > 0) {
      const estimatedProfit = spread - 2; // 1% fee per platform
      buyKalshiSellPoly = {
        id: `${pair.kalshi.ticker}-${pair.polymarket.market_slug}`,
        matchKey: pair.polymarket.market_slug || pair.polymarket.condition_id,
        eventTitle: pair.polymarket.question || pair.kalshi.title,
        category,
        spreadPercent: Number(spread.toFixed(2)),
        buyPlatform: 'kalshi',
        sellPlatform: 'polymarket',
        buyPrice: Math.round(buyPrice),
        sellPrice: Math.round(sellPrice),
        buyTicker: pair.kalshi.ticker,
        sellTicker: pair.polymarket.market_slug || pair.polymarket.condition_id,
        buyVolume: kalshiBestAsk.size,
        sellVolume: polyBestBid.size,
        estimatedProfit: Number(Math.max(0, estimatedProfit).toFixed(2)),
        expiresAt: pair.polymarket.end_date_iso || pair.kalshi.expiration_time || null,
        updatedAt: Date.now(),
        matchScore: pair.matchScore,
        matchReason: pair.matchReason,
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
        id: `${pair.polymarket.market_slug}-${pair.kalshi.ticker}`,
        matchKey: pair.polymarket.market_slug || pair.polymarket.condition_id,
        eventTitle: pair.polymarket.question || pair.kalshi.title,
        category,
        spreadPercent: Number(spread.toFixed(2)),
        buyPlatform: 'polymarket',
        sellPlatform: 'kalshi',
        buyPrice: Math.round(buyPrice),
        sellPrice: Math.round(sellPrice),
        buyTicker: pair.polymarket.market_slug || pair.polymarket.condition_id,
        sellTicker: pair.kalshi.ticker,
        buyVolume: polyBestAsk.size,
        sellVolume: kalshiBestBid.size,
        estimatedProfit: Number(Math.max(0, estimatedProfit).toFixed(2)),
        expiresAt: pair.polymarket.end_date_iso || pair.kalshi.expiration_time || null,
        updatedAt: Date.now(),
        matchScore: pair.matchScore,
        matchReason: pair.matchReason,
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

// ============ Main Handler ============

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

    // Parse params
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const category = String(body.category || url.searchParams.get("category") || "all");
    const minSpread = parseFloat(String(body.minSpread || url.searchParams.get("minSpread") || "1"));
    const maxMarkets = parseInt(String(body.maxMarkets || url.searchParams.get("maxMarkets") || "200"));
    const minMatchScore = parseInt(String(body.minMatchScore || url.searchParams.get("minMatchScore") || "60"));

    console.log(`[arb-scanner] Universal scan: category=${category}, minSpread=${minSpread}%, maxMarkets=${maxMarkets}`);

    // Step 1: Fetch all open markets from both platforms in parallel
    const [polymarkets, kalshiMarkets] = await Promise.all([
      fetchAllPolymarketMarkets(DOME_API_KEY, maxMarkets),
      fetchAllKalshiMarkets(DOME_API_KEY, maxMarkets),
    ]);

    if (polymarkets.length === 0 || kalshiMarkets.length === 0) {
      console.log(`[arb-scanner] Insufficient markets: Poly=${polymarkets.length}, Kalshi=${kalshiMarkets.length}`);
      return new Response(
        JSON.stringify({ 
          opportunities: [], 
          message: "Insufficient markets from one or both platforms",
          stats: {
            polymarketCount: polymarkets.length,
            kalshiCount: kalshiMarkets.length,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Find matching pairs using fuzzy matching
    const allMatchedPairs = findMatchingMarkets(polymarkets, kalshiMarkets, minMatchScore);
    
    // Step 3: Filter by category if specified
    const matchedPairs = filterByCategory(allMatchedPairs, category);
    
    console.log(`[arb-scanner] Matched pairs after category filter: ${matchedPairs.length}`);

    if (matchedPairs.length === 0) {
      return new Response(
        JSON.stringify({ 
          opportunities: [], 
          message: "No matching markets found between platforms",
          stats: {
            polymarketCount: polymarkets.length,
            kalshiCount: kalshiMarkets.length,
            matchedPairs: 0,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Fetch orderbooks and calculate arbitrage (process in batches)
    const opportunities: ArbOpportunity[] = [];
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < Math.min(matchedPairs.length, maxMarkets); i += BATCH_SIZE) {
      const batch = matchedPairs.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(async (pair) => {
          const yesTokenId = pair.polymarket.tokens?.[0]?.token_id || pair.polymarket.condition_id;
          
          if (!yesTokenId) {
            console.log(`[arb-scanner] No token ID for ${pair.polymarket.market_slug}`);
            return null;
          }
          
          const [kalshiOrderbook, polyOrderbook] = await Promise.all([
            fetchKalshiOrderbook(pair.kalshi.ticker, DOME_API_KEY),
            fetchPolymarketOrderbook(yesTokenId, DOME_API_KEY),
          ]);

          if (!kalshiOrderbook || !polyOrderbook) {
            return null;
          }

          return calculateArbitrage(kalshiOrderbook, polyOrderbook, pair);
        })
      );
      
      for (const opp of results) {
        if (opp && opp.spreadPercent >= minSpread) {
          opportunities.push(opp);
        }
      }
    }

    // Sort by spread percentage descending
    opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);

    console.log(`[arb-scanner] Found ${opportunities.length} arbitrage opportunities`);

    // Optionally store in database
    if (opportunities.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        for (const opp of opportunities.slice(0, 50)) { // Limit DB writes
          const { error } = await supabase.from("arb_opportunities").upsert({
            match_key: opp.matchKey,
            event_title: opp.eventTitle,
            sport: opp.category, // Using 'sport' column for backward compatibility
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
        stats: {
          polymarketCount: polymarkets.length,
          kalshiCount: kalshiMarkets.length,
          matchedPairs: matchedPairs.length,
          opportunitiesFound: opportunities.length,
        },
        category,
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
