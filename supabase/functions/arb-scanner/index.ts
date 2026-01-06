import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DOME_API_URL = "https://api.domeapi.io/v1";

// ============ Interfaces ============

interface PolymarketMarket {
  condition_id?: string;
  market_slug?: string;
  question?: string;
  title?: string;
  description?: string;
  end_date_iso?: string;
  end_date?: string;
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
  ticker?: string;
  title?: string;
  subtitle?: string;
  expiration_time?: string;
  category?: string;
  volume?: number;
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
  polyTokenId: string;
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

// ============ Logging Helper ============

function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${timestamp}] [arb-scanner] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] [arb-scanner] ${message}`);
  }
}

// ============ Fetch All Markets ============

async function fetchPolymarketMarkets(apiKey: string, limit = 100): Promise<{ markets: PolymarketMarket[]; error?: string }> {
  try {
    const url = `${DOME_API_URL}/polymarket/markets?status=open&limit=${limit}`;
    log(`Fetching Polymarket markets from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    log(`Polymarket response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Polymarket API error: ${errorText}`);
      return { markets: [], error: `Polymarket API returned ${response.status}: ${errorText}` };
    }
    
    const data = await response.json();
    log(`Polymarket raw response type: ${typeof data}`);
    log(`Polymarket raw response keys: ${Object.keys(data || {})}`);
    
    // Handle different response formats
    let markets: PolymarketMarket[] = [];
    if (Array.isArray(data)) {
      markets = data;
    } else if (data?.markets && Array.isArray(data.markets)) {
      markets = data.markets;
    } else if (data?.data && Array.isArray(data.data)) {
      markets = data.data;
    }
    
    log(`Polymarket parsed ${markets.length} markets`);
    
    // Log first market structure for debugging
    if (markets.length > 0) {
      log(`Polymarket sample market keys: ${Object.keys(markets[0])}`);
      log(`Polymarket sample market:`, markets[0]);
    }
    
    return { markets };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Polymarket fetch error: ${errorMessage}`);
    return { markets: [], error: errorMessage };
  }
}

async function fetchKalshiMarkets(apiKey: string, limit = 100): Promise<{ markets: KalshiMarket[]; error?: string }> {
  try {
    const url = `${DOME_API_URL}/kalshi/markets?status=open&limit=${limit}`;
    log(`Fetching Kalshi markets from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    log(`Kalshi response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Kalshi API error: ${errorText}`);
      return { markets: [], error: `Kalshi API returned ${response.status}: ${errorText}` };
    }
    
    const data = await response.json();
    log(`Kalshi raw response type: ${typeof data}`);
    log(`Kalshi raw response keys: ${Object.keys(data || {})}`);
    
    // Handle different response formats
    let markets: KalshiMarket[] = [];
    if (Array.isArray(data)) {
      markets = data;
    } else if (data?.markets && Array.isArray(data.markets)) {
      markets = data.markets;
    } else if (data?.data && Array.isArray(data.data)) {
      markets = data.data;
    }
    
    log(`Kalshi parsed ${markets.length} markets`);
    
    // Log first market structure for debugging
    if (markets.length > 0) {
      log(`Kalshi sample market keys: ${Object.keys(markets[0])}`);
      log(`Kalshi sample market:`, markets[0]);
    }
    
    return { markets };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Kalshi fetch error: ${errorMessage}`);
    return { markets: [], error: errorMessage };
  }
}

// ============ Orderbook Fetching ============

async function fetchPolymarketOrderbook(tokenId: string, apiKey: string): Promise<Orderbook | null> {
  try {
    const url = `${DOME_API_URL}/polymarket/orderbooks?token_id=${tokenId}`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      log(`Polymarket orderbook failed for ${tokenId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      bids: Array.isArray(data.bids) ? data.bids : [],
      asks: Array.isArray(data.asks) ? data.asks : [],
    };
  } catch (error) {
    log(`Polymarket orderbook error for ${tokenId}: ${error}`);
    return null;
  }
}

async function fetchKalshiOrderbook(ticker: string, apiKey: string): Promise<Orderbook | null> {
  try {
    const url = `${DOME_API_URL}/kalshi/orderbooks?ticker=${ticker}`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      log(`Kalshi orderbook failed for ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      bids: Array.isArray(data.bids) ? data.bids : [],
      asks: Array.isArray(data.asks) ? data.asks : [],
    };
  } catch (error) {
    log(`Kalshi orderbook error for ${ticker}: ${error}`);
    return null;
  }
}

// ============ Fuzzy String Matching ============

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(text: string): string[] {
  const stopWords = new Set([
    'will', 'the', 'be', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
    'is', 'it', 'by', 'with', 'as', 'this', 'that', 'before', 'after', 'during'
  ]);
  
  return normalizeText(text)
    .split(' ')
    .filter(word => word.length > 1 && !stopWords.has(word));
}

function calculateTitleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;
  
  const tokens1 = getTokens(title1);
  const tokens2 = getTokens(title2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  // Count matching tokens
  let matches = 0;
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (t1 === t2) {
        matches++;
        break;
      }
      // Partial match (one contains the other)
      if (t1.length > 3 && t2.length > 3) {
        if (t1.includes(t2) || t2.includes(t1)) {
          matches += 0.5;
          break;
        }
      }
    }
  }
  
  // Jaccard-like similarity
  const union = new Set([...tokens1, ...tokens2]).size;
  const similarity = (matches / union) * 100;
  
  return Math.min(100, similarity);
}

function detectCategory(title1: string, title2: string): string {
  const combined = `${title1} ${title2}`.toLowerCase();
  
  if (/trump|biden|elect|vote|congress|senate|president|democrat|republican/.test(combined)) {
    return 'politics';
  }
  if (/bitcoin|btc|ethereum|eth|crypto|solana|sol/.test(combined)) {
    return 'crypto';
  }
  if (/nfl|nba|mlb|nhl|super bowl|world series|championship|game|team/.test(combined)) {
    return 'sports';
  }
  if (/interest rate|fed|inflation|gdp|stock|market/.test(combined)) {
    return 'finance';
  }
  
  return 'general';
}

// ============ Find Matching Markets ============

function findMatchingMarkets(
  polymarkets: PolymarketMarket[],
  kalshiMarkets: KalshiMarket[],
  minSimilarity: number,
  debug: boolean
): MatchedPair[] {
  const matches: MatchedPair[] = [];
  const usedKalshi = new Set<string>();
  
  log(`Starting matching: ${polymarkets.length} Poly x ${kalshiMarkets.length} Kalshi`);
  
  let comparisonCount = 0;
  
  for (const poly of polymarkets) {
    const polyTitle = poly.question || poly.title || '';
    if (!polyTitle) continue;
    
    // Get YES token ID
    let polyTokenId = '';
    if (poly.tokens && poly.tokens.length > 0) {
      const yesToken = poly.tokens.find(t => t.outcome?.toLowerCase() === 'yes') || poly.tokens[0];
      polyTokenId = yesToken?.token_id || '';
    }
    if (!polyTokenId && poly.condition_id) {
      polyTokenId = poly.condition_id;
    }
    
    if (!polyTokenId) {
      if (debug) log(`Skipping Poly market (no token): ${polyTitle.substring(0, 50)}`);
      continue;
    }
    
    let bestMatch: { kalshi: KalshiMarket; score: number } | null = null;
    
    for (const kalshi of kalshiMarkets) {
      const kalshiTicker = kalshi.ticker || '';
      if (!kalshiTicker || usedKalshi.has(kalshiTicker)) continue;
      
      const kalshiTitle = kalshi.title || '';
      if (!kalshiTitle) continue;
      
      comparisonCount++;
      
      const similarity = calculateTitleSimilarity(polyTitle, kalshiTitle);
      
      if (debug && similarity > 50) {
        log(`Potential match (${similarity.toFixed(0)}%): "${polyTitle.substring(0, 40)}" vs "${kalshiTitle.substring(0, 40)}"`);
      }
      
      if (similarity >= minSimilarity && (!bestMatch || similarity > bestMatch.score)) {
        bestMatch = { kalshi, score: similarity };
      }
    }
    
    if (bestMatch) {
      usedKalshi.add(bestMatch.kalshi.ticker!);
      matches.push({
        polymarket: poly,
        kalshi: bestMatch.kalshi,
        matchScore: Math.round(bestMatch.score),
        matchReason: `${Math.round(bestMatch.score)}% title similarity`,
        polyTokenId,
      });
      
      log(`MATCHED: "${polyTitle.substring(0, 50)}" <-> "${bestMatch.kalshi.title?.substring(0, 50)}" (${bestMatch.score.toFixed(0)}%)`);
    }
  }
  
  log(`Completed ${comparisonCount} comparisons, found ${matches.length} matches`);
  
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

// ============ Calculate Arbitrage ============

function calculateArbitrage(
  pair: MatchedPair,
  polyOrderbook: Orderbook,
  kalshiOrderbook: Orderbook
): ArbOpportunity | null {
  const polyBestBid = polyOrderbook.bids[0];
  const polyBestAsk = polyOrderbook.asks[0];
  const kalshiBestBid = kalshiOrderbook.bids[0];
  const kalshiBestAsk = kalshiOrderbook.asks[0];
  
  const opportunities: ArbOpportunity[] = [];
  const category = detectCategory(
    pair.polymarket.question || pair.polymarket.title || '',
    pair.kalshi.title || ''
  );
  
  // Scenario 1: Buy on Kalshi (ask), Sell on Polymarket (bid)
  if (kalshiBestAsk && polyBestBid) {
    const buyPrice = kalshiBestAsk.price * 100;
    const sellPrice = polyBestBid.price * 100;
    
    if (sellPrice > buyPrice) {
      const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
      opportunities.push({
        id: `${pair.kalshi.ticker}-${pair.polymarket.market_slug || pair.polymarket.condition_id}`,
        matchKey: pair.polymarket.market_slug || pair.polymarket.condition_id || '',
        eventTitle: pair.polymarket.question || pair.polymarket.title || pair.kalshi.title || 'Unknown',
        category,
        spreadPercent: Number(spread.toFixed(2)),
        buyPlatform: 'kalshi',
        sellPlatform: 'polymarket',
        buyPrice: Math.round(buyPrice),
        sellPrice: Math.round(sellPrice),
        buyTicker: pair.kalshi.ticker || '',
        sellTicker: pair.polymarket.market_slug || pair.polymarket.condition_id || '',
        buyVolume: kalshiBestAsk.size,
        sellVolume: polyBestBid.size,
        estimatedProfit: Number(Math.max(0, spread - 2).toFixed(2)),
        expiresAt: pair.polymarket.end_date_iso || pair.polymarket.end_date || pair.kalshi.expiration_time || null,
        updatedAt: Date.now(),
        matchScore: pair.matchScore,
        matchReason: pair.matchReason,
      });
    }
  }
  
  // Scenario 2: Buy on Polymarket (ask), Sell on Kalshi (bid)
  if (polyBestAsk && kalshiBestBid) {
    const buyPrice = polyBestAsk.price * 100;
    const sellPrice = kalshiBestBid.price * 100;
    
    if (sellPrice > buyPrice) {
      const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
      opportunities.push({
        id: `${pair.polymarket.market_slug || pair.polymarket.condition_id}-${pair.kalshi.ticker}`,
        matchKey: pair.polymarket.market_slug || pair.polymarket.condition_id || '',
        eventTitle: pair.polymarket.question || pair.polymarket.title || pair.kalshi.title || 'Unknown',
        category,
        spreadPercent: Number(spread.toFixed(2)),
        buyPlatform: 'polymarket',
        sellPlatform: 'kalshi',
        buyPrice: Math.round(buyPrice),
        sellPrice: Math.round(sellPrice),
        buyTicker: pair.polymarket.market_slug || pair.polymarket.condition_id || '',
        sellTicker: pair.kalshi.ticker || '',
        buyVolume: polyBestAsk.size,
        sellVolume: kalshiBestBid.size,
        estimatedProfit: Number(Math.max(0, spread - 2).toFixed(2)),
        expiresAt: pair.polymarket.end_date_iso || pair.polymarket.end_date || pair.kalshi.expiration_time || null,
        updatedAt: Date.now(),
        matchScore: pair.matchScore,
        matchReason: pair.matchReason,
      });
    }
  }
  
  // Return best opportunity
  if (opportunities.length === 0) return null;
  return opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent)[0];
}

// ============ Main Handler ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  log("=== ARB SCANNER START ===");

  try {
    const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
    if (!DOME_API_KEY) {
      log("ERROR: DOME_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          opportunities: [], 
          error: "API key not configured",
          debug: { step: "init", message: "DOME_API_KEY missing" }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    log("DOME_API_KEY present");

    // Parse params
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
        log("Request body:", body);
      } catch (e) {
        log("Failed to parse body, using defaults");
        body = {};
      }
    }

    const minSpread = parseFloat(String(body.minSpread || "1"));
    const minSimilarity = parseFloat(String(body.minSimilarity || "80"));
    const category = String(body.category || "all");
    const debug = Boolean(body.debug);
    const limit = parseInt(String(body.limit || "100"));
    
    log(`Params: minSpread=${minSpread}%, minSimilarity=${minSimilarity}%, category=${category}, debug=${debug}, limit=${limit}`);

    // Step 1: Fetch markets from both platforms
    log("Step 1: Fetching markets from both platforms...");
    
    const [polyResult, kalshiResult] = await Promise.all([
      fetchPolymarketMarkets(DOME_API_KEY, limit),
      fetchKalshiMarkets(DOME_API_KEY, limit),
    ]);
    
    const debugInfo: Record<string, unknown> = {
      polymarketCount: polyResult.markets.length,
      kalshiCount: kalshiResult.markets.length,
      polymarketError: polyResult.error || null,
      kalshiError: kalshiResult.error || null,
    };
    
    if (polyResult.markets.length === 0 && kalshiResult.markets.length === 0) {
      log("No markets from either platform");
      return new Response(
        JSON.stringify({ 
          opportunities: [], 
          message: "No markets available from either platform",
          debug: debugInfo,
          stats: {
            polymarketCount: 0,
            kalshiCount: 0,
            matchedPairs: 0,
            opportunitiesFound: 0,
            elapsedMs: Date.now() - startTime,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Find matching markets
    log("Step 2: Finding matching markets...");
    
    const matchedPairs = findMatchingMarkets(
      polyResult.markets,
      kalshiResult.markets,
      minSimilarity,
      debug
    );
    
    debugInfo.matchedPairs = matchedPairs.length;
    debugInfo.topMatches = matchedPairs.slice(0, 5).map(p => ({
      poly: (p.polymarket.question || p.polymarket.title || '').substring(0, 50),
      kalshi: (p.kalshi.title || '').substring(0, 50),
      score: p.matchScore,
    }));
    
    if (matchedPairs.length === 0) {
      log("No matching markets found");
      return new Response(
        JSON.stringify({ 
          opportunities: [], 
          message: "No matching markets found between platforms",
          debug: debugInfo,
          stats: {
            polymarketCount: polyResult.markets.length,
            kalshiCount: kalshiResult.markets.length,
            matchedPairs: 0,
            opportunitiesFound: 0,
            elapsedMs: Date.now() - startTime,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Fetch orderbooks and calculate arbitrage
    log("Step 3: Fetching orderbooks and calculating spreads...");
    
    const opportunities: ArbOpportunity[] = [];
    let orderbooksFetched = 0;
    let orderbookErrors = 0;
    
    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 5;
    for (let i = 0; i < matchedPairs.length; i += BATCH_SIZE) {
      const batch = matchedPairs.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(async (pair) => {
          try {
            const [polyOb, kalshiOb] = await Promise.all([
              fetchPolymarketOrderbook(pair.polyTokenId, DOME_API_KEY),
              fetchKalshiOrderbook(pair.kalshi.ticker || '', DOME_API_KEY),
            ]);
            
            orderbooksFetched++;
            
            if (!polyOb || !kalshiOb) {
              orderbookErrors++;
              return null;
            }
            
            return calculateArbitrage(pair, polyOb, kalshiOb);
          } catch (e) {
            orderbookErrors++;
            log(`Orderbook error for pair: ${e}`);
            return null;
          }
        })
      );
      
      for (const opp of results) {
        if (opp && opp.spreadPercent >= minSpread) {
          // Apply category filter
          if (category === 'all' || opp.category === category) {
            opportunities.push(opp);
            log(`Found opportunity: ${opp.eventTitle.substring(0, 50)} - ${opp.spreadPercent}% spread`);
          }
        }
      }
    }
    
    // Sort by spread
    opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
    
    debugInfo.orderbooksFetched = orderbooksFetched;
    debugInfo.orderbookErrors = orderbookErrors;
    debugInfo.opportunitiesFound = opportunities.length;
    
    const elapsedMs = Date.now() - startTime;
    log(`=== ARB SCANNER COMPLETE === ${opportunities.length} opportunities found in ${elapsedMs}ms`);

    return new Response(
      JSON.stringify({ 
        opportunities, 
        count: opportunities.length,
        debug: debug ? debugInfo : undefined,
        stats: {
          polymarketCount: polyResult.markets.length,
          kalshiCount: kalshiResult.markets.length,
          matchedPairs: matchedPairs.length,
          opportunitiesFound: opportunities.length,
          elapsedMs,
        },
        category,
        minSpread,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    log(`FATAL ERROR: ${errorMessage}`);
    if (errorStack) log(`Stack: ${errorStack}`);
    
    // Return 200 with empty opportunities instead of 500
    return new Response(
      JSON.stringify({ 
        opportunities: [], 
        error: errorMessage,
        debug: {
          step: "fatal",
          message: errorMessage,
          stack: errorStack,
        },
        stats: {
          polymarketCount: 0,
          kalshiCount: 0,
          matchedPairs: 0,
          opportunitiesFound: 0,
          elapsedMs: Date.now() - startTime,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
