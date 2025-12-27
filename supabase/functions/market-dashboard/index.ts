import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
const DOME_API_BASE = "https://api.domeapi.io/v1";

function getHeaders(): Record<string, string> {
  if (DOME_API_KEY) {
    return { "Authorization": `Bearer ${DOME_API_KEY}`, "Content-Type": "application/json" };
  }
  return { "Content-Type": "application/json" };
}

// Extract slugs from Polymarket URL - now also extracts tid (token ID) query param
function extractSlugsFromUrl(url: string): { eventSlug: string | null; marketSlug: string | null; tokenId: string | null } {
  try {
    // Normalize URL - add https:// if missing
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    const urlObj = new URL(normalizedUrl);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Get tid (token ID) from query params - this identifies the specific market in multi-market events
    const tokenId = urlObj.searchParams.get('tid') || null;
    
    // Format: /event/event-slug or /event/event-slug/market-slug
    if (pathParts[0] === 'event' && pathParts[1]) {
      return {
        eventSlug: pathParts[1],
        marketSlug: pathParts[2] || null,
        tokenId
      };
    }
    
    // Sports URL format: /sports/category/games/week/N/event-slug
    // e.g., /sports/honor-of-kings/games/week/1/hok-rw-wb-2025-12-27
    // or /sports/nfl/conference-championship-2025-afc
    if (pathParts[0] === 'sports' && pathParts.length >= 2) {
      // The last segment is typically the event slug
      const sportsSlug = pathParts[pathParts.length - 1];
      console.log(`[URL] Sports URL detected - extracted slug: ${sportsSlug}`);
      return {
        eventSlug: sportsSlug,
        marketSlug: null,
        tokenId
      };
    }
    
    return { eventSlug: null, marketSlug: null, tokenId };
  } catch {
    return { eventSlug: null, marketSlug: null, tokenId: null };
  }
}

// Fetch market data from Dome API - uses the SPECIFIC market slug, not event slug
async function fetchMarketData(marketSlug: string) {
  console.log(`[Dome] Fetching market: ${marketSlug}`);
  const response = await fetch(
    `${DOME_API_BASE}/polymarket/markets?market_slug=${encodeURIComponent(marketSlug)}&limit=1`,
    { headers: getHeaders() }
  );
  
  if (!response.ok) {
    console.error(`[Dome] Market fetch error: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  return data?.markets?.[0] || null;
}

// Helper to try fetching orderbook for a single token
async function tryFetchOrderbookForToken(tokenId: string): Promise<any | null> {
  try {
    // Use the /book endpoint for live orderbook
    const bookUrl = `${DOME_API_BASE}/polymarket/book?token_id=${encodeURIComponent(tokenId)}`;
    const response = await fetch(bookUrl, { headers: getHeaders() });
    
    if (response.ok) {
      const data = await response.json();
      if (data?.bids?.length > 0 || data?.asks?.length > 0) {
        return data;
      }
    }
    
    // Fallback to orderbooks endpoint
    const nowMs = Date.now();
    const fiveMinAgoMs = nowMs - (5 * 60 * 1000);
    const url = `${DOME_API_BASE}/polymarket/orderbooks?token_id=${encodeURIComponent(tokenId)}&start_time=${fiveMinAgoMs}&end_time=${nowMs}&limit=1`;
    const fallbackResponse = await fetch(url, { headers: getHeaders() });
    
    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json();
      const snapshot = data?.snapshots?.[0];
      if (snapshot?.bids?.length > 0 || snapshot?.asks?.length > 0) {
        return snapshot;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Invert orderbook data (swap bids/asks and invert prices for NO -> YES conversion)
function invertOrderbook(orderbook: any): any {
  const invertPrice = (items: any[]) => items.map((item: any) => ({
    ...item,
    price: (1 - parseFloat(item.price)).toString()
  }));
  
  return {
    bids: invertPrice(orderbook.asks || []), // NO asks become YES bids
    asks: invertPrice(orderbook.bids || [])  // NO bids become YES asks
  };
}

// NEW: Fallback to Polymarket CLOB API for orderbook
async function fetchOrderbookFromPolymarket(tokenId: string): Promise<any | null> {
  try {
    console.log(`[ORDERBOOK] Trying Polymarket CLOB API for token: ${tokenId.slice(0, 30)}...`);
    const response = await fetch(
      `https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`,
      { headers: { "Content-Type": "application/json" } }
    );
    
    if (!response.ok) {
      console.log(`[ORDERBOOK] Polymarket CLOB API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data?.bids?.length > 0 || data?.asks?.length > 0) {
      console.log(`[ORDERBOOK] ✅ Got orderbook from Polymarket CLOB API (bids: ${data.bids?.length || 0}, asks: ${data.asks?.length || 0})`);
      return data;
    }
    console.log(`[ORDERBOOK] Polymarket CLOB API returned empty orderbook`);
    return null;
  } catch (e) {
    console.error(`[ORDERBOOK] Polymarket CLOB API error:`, e);
    return null;
  }
}

// Fetch order book - tries YES token first, then NO token with price inversion
// Falls back to Polymarket CLOB API if DOME returns no data
async function fetchOrderbook(yesTokenId: string, noTokenId?: string, currentPrice?: number) {
  console.log(`[ORDERBOOK] Starting fetch for YES token: ${yesTokenId.slice(0, 30)}...`);
  console.log(`[ORDERBOOK] Expected YES price around: ${currentPrice ? (currentPrice * 100).toFixed(1) + '%' : 'unknown'}`);
  
  try {
    // Try YES token first via DOME
    let orderbook = await tryFetchOrderbookForToken(yesTokenId);
    let source = 'DOME YES';
    
    // If YES failed and we have NO token, try that with price inversion via DOME
    if (!orderbook && noTokenId) {
      console.log(`[ORDERBOOK] YES token failed, trying NO token: ${noTokenId.slice(0, 30)}...`);
      const noOrderbook = await tryFetchOrderbookForToken(noTokenId);
      
      if (noOrderbook) {
        orderbook = invertOrderbook(noOrderbook);
        source = 'DOME NO (inverted)';
        console.log(`[ORDERBOOK] Using inverted NO token orderbook`);
      }
    }
    
    // If DOME failed completely, try Polymarket CLOB API as fallback
    if (!orderbook) {
      console.log(`[ORDERBOOK] DOME failed, trying Polymarket CLOB API...`);
      orderbook = await fetchOrderbookFromPolymarket(yesTokenId);
      source = 'Polymarket CLOB YES';
      
      // If YES failed via CLOB, try NO token with inversion
      if (!orderbook && noTokenId) {
        console.log(`[ORDERBOOK] CLOB YES failed, trying CLOB NO token...`);
        const noOrderbook = await fetchOrderbookFromPolymarket(noTokenId);
        if (noOrderbook) {
          orderbook = invertOrderbook(noOrderbook);
          source = 'Polymarket CLOB NO (inverted)';
        }
      }
    }
    
    if (!orderbook) {
      console.log(`[ORDERBOOK] No orderbook data available from any source`);
      return null;
    }
    
    // Log what we got
    const bestBid = parseFloat(orderbook.bids?.[0]?.price || 0);
    const bestAsk = parseFloat(orderbook.asks?.[0]?.price || 0);
    console.log(`[ORDERBOOK] ${source} book - bids: ${orderbook.bids?.length || 0}, asks: ${orderbook.asks?.length || 0}`);
    console.log(`[ORDERBOOK] Prices - Best bid: ${(bestBid * 100).toFixed(1)}%, Best ask: ${(bestAsk * 100).toFixed(1)}%`);
    
    // Validate the data makes sense for this market's YES price
    if (currentPrice) {
      const midPrice = (bestBid + bestAsk) / 2;
      const priceDiff = Math.abs(midPrice - currentPrice);
      
      // If prices are way off (more than 25%), it might be stale data
      if (priceDiff > 0.25) {
        console.log(`[ORDERBOOK] WARNING: Orderbook mid ${(midPrice * 100).toFixed(1)}% differs significantly from market price ${(currentPrice * 100).toFixed(1)}%`);
      }
    }
    
    return orderbook;
  } catch (e) {
    console.error(`[ORDERBOOK] Exception:`, e);
    return null;
  }
}

// Fetch trade history - IMPORTANT: Only use ONE of market_slug, token_id, or condition_id
// Timestamps are in SECONDS for the orders endpoint
// use24hFilter: When true, only fetches trades from the last 24 hours
async function fetchTrades(marketSlug: string, limit: number = 1000, use24hFilter: boolean = true) {
  console.log(`[Dome] Fetching trades for: ${marketSlug} (24h filter: ${use24hFilter})`);
  
  let url = `${DOME_API_BASE}/polymarket/orders?market_slug=${encodeURIComponent(marketSlug)}&limit=${limit}`;
  
  // Add 24h time filter - timestamps in SECONDS (not milliseconds!)
  if (use24hFilter) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const oneDayAgoSeconds = nowSeconds - 86400;
    url += `&start_time=${oneDayAgoSeconds}&end_time=${nowSeconds}`;
    console.log(`[Dome] 24h filter: ${new Date(oneDayAgoSeconds * 1000).toISOString()} to ${new Date(nowSeconds * 1000).toISOString()}`);
  }
  
  const response = await fetch(url, { headers: getHeaders() });
  
  if (!response.ok) {
    console.error(`[Dome] Trades fetch error: ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  const orders = data?.orders || [];
  
  console.log(`[Dome] ✅ Fetched ${orders.length} trades${use24hFilter ? ' (24h)' : ''}`);
  return orders;
}

// Fetch markets from the SAME event only (via Gamma API, not keyword matching)
async function fetchEventMarkets(eventSlug: string): Promise<any[]> {
  console.log(`[Arbitrage] Fetching markets for event: ${eventSlug}`);
  try {
    const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${eventSlug}`);
    if (!response.ok) {
      console.log(`[Arbitrage] Gamma API error: ${response.status}`);
      return [];
    }
    
    const events = await response.json();
    const event = events?.[0];
    
    if (event?.markets && event.markets.length > 1) {
      console.log(`[Arbitrage] Found ${event.markets.length} markets in event: ${event.title}`);
      return event.markets;
    }
    
    console.log(`[Arbitrage] Single market event or no markets found`);
    return [];
  } catch (e) {
    console.error(`[Arbitrage] Error fetching event markets:`, e);
    return [];
  }
}

// Fetch current price from Dome API market-price endpoint
async function fetchCurrentPrice(tokenId: string): Promise<number | null> {
  try {
    console.log(`[Price] Fetching current price for token: ${tokenId.slice(0, 20)}...`);
    const response = await fetch(
      `${DOME_API_BASE}/polymarket/market-price/${encodeURIComponent(tokenId)}`,
      { headers: getHeaders() }
    );
    if (!response.ok) {
      console.log(`[Price] Market-price endpoint failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    console.log(`[Price] Got price: ${data?.price}`);
    return data?.price || null;
  } catch (e) {
    console.error(`[Price] Error fetching current price:`, e);
    return null;
  }
}

// Fetch historical price at a specific time for momentum calculation
async function fetchHistoricalPrice(tokenId: string, atTimeSeconds: number): Promise<number | null> {
  try {
    const response = await fetch(
      `${DOME_API_BASE}/polymarket/market-price/${encodeURIComponent(tokenId)}?at_time=${atTimeSeconds}`,
      { headers: getHeaders() }
    );
    if (!response.ok) {
      console.log(`[Price] Historical price fetch failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data?.price || null;
  } catch (e) {
    console.error(`[Price] Error fetching historical price:`, e);
    return null;
  }
}

// Fetch candlesticks for proper OHLC price history - uses YES token ID to get correct outcome
async function fetchCandlesticks(conditionId: string, yesTokenId?: string): Promise<any[]> {
  try {
    // Candlesticks use SECONDS for timestamps
    const nowSeconds = Math.floor(Date.now() / 1000);
    const sevenDaysAgoSeconds = nowSeconds - (7 * 24 * 60 * 60);
    
    console.log(`[Candlesticks] Fetching for condition: ${conditionId.slice(0, 20)}..., yesTokenId: ${yesTokenId?.slice(0, 20)}...`);
    const response = await fetch(
      `${DOME_API_BASE}/polymarket/candlesticks/${encodeURIComponent(conditionId)}?start_time=${sevenDaysAgoSeconds}&end_time=${nowSeconds}&interval=1440`,
      { headers: getHeaders() }
    );
    
    if (!response.ok) {
      console.log(`[Candlesticks] Endpoint failed: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    // Candlesticks format: [[candle_data, {token_id}], [candle_data, {token_id}], ...]
    // Find the candlestick group that matches YES token_id
    if (yesTokenId && data.candlesticks?.length > 0) {
      for (const group of data.candlesticks) {
        const tokenMetadata = group[1];
        if (tokenMetadata?.token_id === yesTokenId) {
          console.log(`[Candlesticks] Found YES token candlesticks (${group[0]?.length || 0} candles)`);
          return group[0] || [];
        }
      }
      console.log(`[Candlesticks] YES token not found in candlesticks, using first group`);
    }
    
    // Fallback to first outcome
    const candleData = data.candlesticks?.[0]?.[0] || [];
    console.log(`[Candlesticks] Got ${candleData.length} candles (fallback)`);
    return candleData;
  } catch (e) {
    console.error(`[Candlesticks] Error:`, e);
    return [];
  }
}

// Format time ago
function formatTimeAgo(timestamp: number | string): string {
  const time = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime();
  const now = Date.now();
  const diff = now - time;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { marketUrl, yesTokenId: passedYesTokenId, noTokenId: passedNoTokenId } = await req.json();
    
    if (!marketUrl) {
      return new Response(
        JSON.stringify({ error: "Market URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!DOME_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Dome API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { eventSlug, marketSlug, tokenId: urlTokenId } = extractSlugsFromUrl(marketUrl);
    console.log(`[Dashboard] URL parsed - Event: ${eventSlug}, Market: ${marketSlug}, TokenId: ${urlTokenId?.slice(0, 30) || 'none'}...`);

    if (!eventSlug) {
      return new Response(
        JSON.stringify({ error: "Invalid Polymarket URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fetchStartTime = Date.now();

    // CRITICAL: If this is an EVENT-ONLY URL (no specific market), we need to figure out which market to show
    // Priority: 1) Use tid (token ID) from URL, 2) Ask user to select if multiple markets, 3) Use first market if single
    if (!marketSlug) {
      console.log(`[Dashboard] Event-only URL detected, checking for multi-market event`);
      
      // Check how many markets this event has via Gamma API
      const gammaResponse = await fetch(
        `https://gamma-api.polymarket.com/events?slug=${eventSlug}`
      );
      
      if (gammaResponse.ok) {
        const events = await gammaResponse.json();
        const event = events?.[0];
        
        // If we have a tokenId in the URL, find the matching market and use it directly
        if (urlTokenId && event?.markets) {
          console.log(`[Dashboard] Looking for market with token ID: ${urlTokenId.slice(0, 30)}...`);
          
          for (const m of event.markets) {
            const tokens = m.tokens || [];
            const matchingToken = tokens.find((t: any) => t.token_id === urlTokenId);
            
            if (matchingToken) {
              console.log(`[Dashboard] ✅ Found market for token: ${m.slug} (${m.question})`);
              
              // Fetch live price from Dome API for this specific token
              const livePrice = await fetchCurrentPrice(urlTokenId);
              console.log(`[Dashboard] Live price for token: ${livePrice}`);
              
              // Determine if this is YES or NO token and get correct price
              const isYesToken = matchingToken.outcome?.toLowerCase() === 'yes' || 
                matchingToken.token_label?.toLowerCase() === 'yes' ||
                matchingToken.label?.toLowerCase() === 'yes';
              
              let yesPrice = 0.5;
              if (livePrice !== null) {
                yesPrice = isYesToken ? livePrice : (1 - livePrice);
              } else {
                // Fallback to static price
                try {
                  const prices = typeof m.outcomePrices === 'string' 
                    ? JSON.parse(m.outcomePrices) 
                    : m.outcomePrices;
                  yesPrice = parseFloat(prices[0]) || 0.5;
                } catch { /* ignore */ }
              }
              
              // Find YES and NO tokens
              const yesToken = tokens.find((t: any) => 
                t.outcome?.toLowerCase() === 'yes' || 
                t.token_label?.toLowerCase() === 'yes' ||
                t.label?.toLowerCase() === 'yes'
              ) || tokens[0];
              const noToken = tokens.find((t: any) => 
                t.outcome?.toLowerCase() === 'no' || 
                t.token_label?.toLowerCase() === 'no' ||
                t.label?.toLowerCase() === 'no'
              ) || tokens[1];
              
              // Extract market metadata
              const marketMetadata = {
                description: m.description || null,
                resolutionSource: m.resolutionSource || null,
                tags: (m.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
                endDate: m.endDate || null
              };
              
              // Build the market object directly and skip to data fetching
              const tokenMatchedMarket = {
                title: m.question,
                market_slug: m.slug,
                volume_total: parseFloat(m.volume) || 0,
                status: m.closed ? 'closed' : 'open',
                side_a: { id: yesToken?.token_id, label: 'Yes' },
                side_b: { id: noToken?.token_id, label: 'No' },
                currentPrice: yesPrice,
                condition_id: m.conditionId || null,
                start_time: new Date(m.startDate || Date.now()).getTime() / 1000,
                end_time: m.endDate ? new Date(m.endDate).getTime() / 1000 : null,
                metadata: marketMetadata
              };
              
              console.log(`[Dashboard] Token-matched market ready - YES: ${yesToken?.token_id?.slice(0, 20)}..., NO: ${noToken?.token_id?.slice(0, 20)}...`);
              
              // Return immediately to main processing with this market
              // We'll process this like we found the market via Dome API
              const fetchStartTimeInner = Date.now();
              
              // Fetch trades and event markets for this specific market
              const [matchedTrades, matchedEventMarkets] = await Promise.all([
                fetchTrades(m.slug, 1000, true),
                fetchEventMarkets(eventSlug)
              ]);
              
              // Continue with the full data processing for this market
              // This is duplicated code, but ensures we process the correct market
              const effectiveYesTokenId = yesToken?.token_id;
              const effectiveNoTokenId = noToken?.token_id;
              
              let orderbook = null;
              let verifiedPrice: number | null = null;
              if (effectiveYesTokenId) {
                verifiedPrice = await fetchCurrentPrice(effectiveYesTokenId);
                if (verifiedPrice !== null) {
                  console.log(`[Dashboard] Verified price from Dome: ${(verifiedPrice * 100).toFixed(1)}%`);
                  tokenMatchedMarket.currentPrice = verifiedPrice;
                }
                orderbook = await fetchOrderbook(effectiveYesTokenId, effectiveNoTokenId, verifiedPrice || tokenMatchedMarket.currentPrice);
              }
              
              // Process trades (simplified version - full processing happens in main flow)
              const processedTrades = matchedTrades.slice(0, 50).map((t: any) => {
                const shares = parseFloat(t.shares_normalized || t.shares || 0);
                const price = parseFloat(t.price || 0);
                const usdValue = shares * price;
                let outcome = 'UNKNOWN';
                if (t.token_id === effectiveYesTokenId) outcome = 'YES';
                else if (t.token_id === effectiveNoTokenId) outcome = 'NO';
                return {
                  id: t.id || t.order_hash || Math.random().toString(36),
                  side: (t.side || 'UNKNOWN').toUpperCase(),
                  outcome,
                  size: usdValue,
                  price: price * 100,
                  timestamp: t.timestamp ? new Date(t.timestamp * 1000).toISOString() : new Date().toISOString(),
                  timeAgo: t.timestamp ? formatTimeAgo(t.timestamp) : 'Unknown',
                  wallet: t.user || t.taker || '0x' + Math.random().toString(16).slice(2, 10),
                  shares,
                  rawPrice: price
                };
              }).filter((t: any) => t.size >= 0.10 && t.rawPrice >= 0.001);
              
              // Calculate basic stats
              const volume24h = matchedTrades.reduce((sum: number, t: any) => {
                const shares = parseFloat(t.shares_normalized || t.shares || 0);
                const price = parseFloat(t.price || 0);
                return sum + (shares * price);
              }, 0);
              
              // Return the response for this token-matched market
              return new Response(
                JSON.stringify({
                  market: {
                    question: tokenMatchedMarket.title,
                    odds: Math.round(tokenMatchedMarket.currentPrice * 100),
                    volume: tokenMatchedMarket.volume_total,
                    status: tokenMatchedMarket.status,
                    endDate: tokenMatchedMarket.end_time ? new Date(tokenMatchedMarket.end_time * 1000).toISOString() : null,
                    yesTokenId: effectiveYesTokenId,
                    noTokenId: effectiveNoTokenId,
                    conditionId: tokenMatchedMarket.condition_id,
                    metadata: tokenMatchedMarket.metadata,
                    marketSlug: m.slug
                  },
                  whales: [],
                  orderbook: orderbook ? {
                    bids: (orderbook.bids || []).slice(0, 10).map((b: any) => ({
                      price: parseFloat(b.price) * 100,
                      size: parseFloat(b.size || b.amount || 0)
                    })),
                    asks: (orderbook.asks || []).slice(0, 10).map((a: any) => ({
                      price: parseFloat(a.price) * 100,
                      size: parseFloat(a.size || a.amount || 0)
                    }))
                  } : null,
                  priceHistory: [],
                  recentTrades: processedTrades,
                  tradeStats: {
                    volume24h,
                    buyPressure: 50,
                    sellPressure: 50,
                    totalTrades: matchedTrades.length,
                    uniqueTraders: new Set(matchedTrades.map((t: any) => t.user || t.taker)).size,
                    avgTradeSize: volume24h / Math.max(matchedTrades.length, 1)
                  },
                  arbitrage: null,
                  fetchTime: Date.now() - fetchStartTimeInner
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
        
        if (event && event.markets && event.markets.length > 1 && !urlTokenId) {
          console.log(`[Dashboard] Multi-market event with ${event.markets.length} markets - returning list for selection`);
          
          // Parse market data for each market
          const marketsList = event.markets.map((m: any, idx: number) => {
            let yesPrice = 0.5;
            try {
              const prices = typeof m.outcomePrices === 'string' 
                ? JSON.parse(m.outcomePrices) 
                : m.outcomePrices;
              yesPrice = parseFloat(prices[0]) || 0.5;
            } catch { /* ignore */ }
            
            return {
              id: idx,
              market_slug: m.slug,
              question: m.question,
              yes_price: yesPrice,
              volume: parseFloat(m.volume) || 0,
            };
          });
          
          return new Response(
            JSON.stringify({
              needsMarketSelection: true,
              eventSlug,
              eventTitle: event.title,
              eventUrl: `https://polymarket.com/event/${eventSlug}`,
              marketCount: event.markets.length,
              markets: marketsList,
              message: `This event has ${event.markets.length} markets. Please select a specific market to see detailed data.`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Single market event - use the first market
        if (event?.markets?.[0]) {
          const targetMarket = event.markets[0];
          let yesPrice = 0.5;
          try {
            const prices = typeof targetMarket.outcomePrices === 'string'
              ? JSON.parse(targetMarket.outcomePrices)
              : targetMarket.outcomePrices;
            yesPrice = parseFloat(prices[0]) || 0.5;
          } catch { /* ignore */ }
          
          // Continue with this single market
          console.log(`[Dashboard] Single market event, using: ${targetMarket.slug}`);
        }
      }
    }

    // Fetch market data - now we know we have a specific market slug
    let market = null;
    let effectiveSlug = marketSlug || eventSlug;
    
    // Try market slug first
    if (marketSlug) {
      market = await fetchMarketData(marketSlug);
    }
    if (!market) {
      market = await fetchMarketData(eventSlug);
      if (market) effectiveSlug = eventSlug;
    }

    if (!market) {
      // Try Gamma API as fallback
      console.log(`[Dashboard] Dome market not found, trying Gamma API`);
      const gammaResponse = await fetch(
        `https://gamma-api.polymarket.com/events?slug=${eventSlug}`
      );
      
      if (gammaResponse.ok) {
        const events = await gammaResponse.json();
        if (events?.[0]) {
          const event = events[0];
          
          // Priority: 1) Find market by urlTokenId, 2) Find by marketSlug, 3) Use first market
          let targetMarket = null;
          
          // If we have a token ID from URL, find the market containing that token
          if (urlTokenId && event.markets) {
            for (const m of event.markets) {
              const tokens = m.tokens || [];
              if (tokens.some((t: any) => t.token_id === urlTokenId)) {
                targetMarket = m;
                console.log(`[Dashboard] Found market by token ID: ${m.slug}`);
                break;
              }
            }
          }
          
          // Fallback to marketSlug or first market
          if (!targetMarket) {
            targetMarket = marketSlug 
              ? event.markets?.find((m: any) => m.slug === marketSlug) 
              : event.markets?.[0];
          }
          
          if (targetMarket) {
            let yesPrice = 0.5;
            try {
              const prices = typeof targetMarket.outcomePrices === 'string'
                ? JSON.parse(targetMarket.outcomePrices)
                : targetMarket.outcomePrices;
              yesPrice = parseFloat(prices[0]) || 0.5;
            } catch { /* ignore */ }

            // CRITICAL: Find YES token by outcome property, not by array index!
            // Polymarket token order varies - tokens[0] is NOT always YES
            // Check multiple possible field names for robustness
            const tokens = targetMarket.tokens || [];
            const yesToken = tokens.find((t: any) => 
              t.outcome?.toLowerCase() === 'yes' || 
              t.token_label?.toLowerCase() === 'yes' ||
              t.label?.toLowerCase() === 'yes' ||
              t.outcome_label?.toLowerCase() === 'yes'
            ) || tokens[0];
            const noToken = tokens.find((t: any) => 
              t.outcome?.toLowerCase() === 'no' || 
              t.token_label?.toLowerCase() === 'no' ||
              t.label?.toLowerCase() === 'no' ||
              t.outcome_label?.toLowerCase() === 'no'
            ) || tokens[1];
            
            console.log(`[Dashboard] Token fields: ${JSON.stringify(tokens[0])?.slice(0, 200)}`);
            console.log(`[Dashboard] Token detection - YES: ${yesToken?.outcome} (${yesToken?.token_id?.slice(0, 20)}...), NO: ${noToken?.outcome}`);

            // If we have urlTokenId, fetch live price from Dome API for accuracy
            if (urlTokenId) {
              const livePrice = await fetchCurrentPrice(urlTokenId);
              if (livePrice !== null) {
                // Check if urlTokenId is YES or NO token to interpret price correctly
                const isYesToken = yesToken?.token_id === urlTokenId;
                yesPrice = isYesToken ? livePrice : (1 - livePrice);
                console.log(`[Dashboard] Live price from Dome: ${livePrice}, isYesToken: ${isYesToken}, yesPrice: ${yesPrice}`);
              }
            }

            // Extract market metadata for MarketInfoCard
            const marketMetadata = {
              description: targetMarket.description || null,
              resolutionSource: targetMarket.resolutionSource || null,
              tags: (targetMarket.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
              endDate: targetMarket.endDate || null
            };

            market = {
              title: targetMarket.question,
              market_slug: targetMarket.slug,
              volume_total: parseFloat(targetMarket.volume) || 0,
              status: targetMarket.closed ? 'closed' : 'open',
              side_a: { id: yesToken?.token_id, label: 'Yes' },
              side_b: { id: noToken?.token_id, label: 'No' },
              currentPrice: yesPrice,
              start_time: new Date(targetMarket.startDate || Date.now()).getTime() / 1000,
              end_time: targetMarket.endDate ? new Date(targetMarket.endDate).getTime() / 1000 : null,
              metadata: marketMetadata
            };
            effectiveSlug = targetMarket.slug;
          }
        }
      }
    }

    if (!market) {
      return new Response(
        JSON.stringify({ error: "Market not found. Please check the URL and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Dashboard] Market found: ${market.title}`);

    // Fetch all data in parallel - use 24h filter for accurate volume/trader stats
    const [trades, eventMarkets] = await Promise.all([
      fetchTrades(effectiveSlug, 1000, true), // 24h filtered trades
      fetchEventMarkets(eventSlug)
    ]);

    // Prefer condition id from market object; fallback to first trade
    const conditionId =
      (market as any)?.condition_id ||
      (market as any)?.conditionId ||
      trades[0]?.condition_id ||
      null;
    console.log(`[Dashboard] Condition ID: ${conditionId ? String(conditionId).slice(0, 20) : 'null'}...`);

    // Fetch orderbook if we have a token ID
    // Prioritize passed token IDs from frontend (already resolved from polymarket-data)
    const effectiveYesTokenId = passedYesTokenId || market.side_a?.id;
    const effectiveNoTokenId = passedNoTokenId || market.side_b?.id;
    console.log(`[Dashboard] Token IDs - Passed YES: ${passedYesTokenId ? 'yes' : 'no'}, Passed NO: ${passedNoTokenId ? 'yes' : 'no'}`);
    console.log(`[Dashboard] Effective YES: ${effectiveYesTokenId?.slice(0, 30)}..., NO: ${effectiveNoTokenId?.slice(0, 30)}...`);
    
    // Get verified price first, then orderbook with price validation
    let orderbook = null;
    let verifiedPrice: number | null = null;
    if (effectiveYesTokenId) {
      // First get verified current price
      verifiedPrice = await fetchCurrentPrice(effectiveYesTokenId);
      
      if (verifiedPrice !== null) {
        console.log(`[Dashboard] Verified price from Dome: ${(verifiedPrice * 100).toFixed(1)}%`);
        market.currentPrice = verifiedPrice;
      }
      
      // Then fetch orderbook - pass both YES and NO token IDs for fallback
      orderbook = await fetchOrderbook(effectiveYesTokenId, effectiveNoTokenId, verifiedPrice || market.currentPrice);
    }

    // Process ALL trades with USD values - FILTER OUT DUST TRADES (<$1)
    console.log(`[TRADES] Processing ${trades.length} raw trades`);
    
    // === EXTRACT TOKEN IDs EARLY for YES/NO outcome detection ===
    // Use effective token IDs (passed from frontend or from market data)
    const yesTokenId = effectiveYesTokenId;
    const noTokenId = effectiveNoTokenId;
    console.log(`[TOKENS] YES token: ${yesTokenId?.slice(0, 30)}..., NO token: ${noTokenId?.slice(0, 30)}...`);
    
    // First, deduplicate trades by ID/hash to avoid showing same trade twice
    const seenIds = new Set<string>();
    const uniqueRawTrades = trades.filter((t: any) => {
      const key = t.id || t.order_hash || t.tx_hash;
      if (!key || seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    });
    console.log(`[TRADES] Deduplicated ${trades.length} -> ${uniqueRawTrades.length} unique trades`);
    
    const allTrades = uniqueRawTrades.slice(0, 100).map((t: any) => {
      const shares = parseFloat(t.shares_normalized || t.shares || 0);
      const price = parseFloat(t.price || 0);
      const usdValue = shares * price;
      
      // Determine outcome (YES/NO) based on token_id
      let outcome = 'UNKNOWN';
      if (t.token_id === yesTokenId) outcome = 'YES';
      else if (t.token_id === noTokenId) outcome = 'NO';
      
      return {
        id: t.id || t.order_hash || Math.random().toString(36),
        side: (t.side || 'UNKNOWN').toUpperCase(),
        outcome,
        size: usdValue,
        price: price * 100,
        timestamp: t.timestamp ? new Date(t.timestamp * 1000).toISOString() : new Date().toISOString(),
        timeAgo: t.timestamp ? formatTimeAgo(t.timestamp) : 'Unknown',
        wallet: t.user || t.taker || '0x' + Math.random().toString(16).slice(2, 10),
        shares,
        rawPrice: price
      };
    });

    // Filter out dust trades (< $0.10) and invalid prices (< 0.1%)
    // Lowered from $1 to $0.10 to include retail trades ($0.20-$0.80)
    // THEN SORT BY TIMESTAMP DESC (newest first)
    const recentTrades = allTrades
      .filter((t: any) => t.size >= 0.10 && t.rawPrice >= 0.001)
      .sort((a: any, b: any) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA; // Newest first
      });
    
    // Log filtering results
    const dustTradesRemoved = allTrades.length - recentTrades.length;
    console.log(`[TRADES] Filtered ${allTrades.length} -> ${recentTrades.length} valid trades (removed ${dustTradesRemoved} dust trades), sorted newest first`);

    // Log first few trades for debugging
    if (recentTrades.length > 0) {
      console.log(`[TRADES] First 3 valid trades:`, recentTrades.slice(0, 3).map((t: any) => ({
        size: `$${t.size.toFixed(2)}`,
        shares: t.shares.toFixed(4),
        price: `${(t.rawPrice * 100).toFixed(1)}%`,
        side: t.side
      })));
    }
    
    // Find largest trade from VALID trades only
    const largestTrade = recentTrades.length > 0 
      ? Math.max(...recentTrades.map((t: any) => t.size))
      : 0;
    console.log(`[TRADES] Largest valid trade: $${largestTrade.toFixed(2)}`);

    // === CALCULATE YES/NO VOLUME BY TOKEN ID (not by BUY/SELL side) ===
    // yesTokenId and noTokenId already defined above
    let yesVolume24h = 0;
    let noVolume24h = 0;

    // Process from uniqueRawTrades to get accurate YES/NO volume by token_id
    uniqueRawTrades.forEach((t: any) => {
      const shares = parseFloat(t.shares_normalized || t.shares || 0);
      const price = parseFloat(t.price || 0);
      const usdValue = shares * price;
      
      // Filter by token_id to separate YES vs NO volume
      if (t.token_id === yesTokenId) {
        yesVolume24h += usdValue;
      } else if (t.token_id === noTokenId) {
        noVolume24h += usdValue;
      }
    });

    const totalVolume24h = yesVolume24h + noVolume24h;
    console.log(`[VOLUME] YES token: $${yesVolume24h.toFixed(2)}, NO token: $${noVolume24h.toFixed(2)}, Total 24h: $${totalVolume24h.toFixed(2)}`);

    // === COUNT UNIQUE TRADERS IN 24h ===
    const uniqueTraders24h = new Set(uniqueRawTrades.map((t: any) => t.user).filter(Boolean));
    const traderCount24h = uniqueTraders24h.size;
    console.log(`[TRADERS] Unique traders in 24h: ${traderCount24h}`);

    // Calculate trade stats from valid trades only
    const buyTrades = recentTrades.filter((t: any) => t.side === 'BUY');
    const sellTrades = recentTrades.filter((t: any) => t.side === 'SELL');
    const totalTrades = recentTrades.length;
    
    const buyVolume = buyTrades.reduce((sum: number, t: any) => sum + t.size, 0);
    const sellVolume = sellTrades.reduce((sum: number, t: any) => sum + t.size, 0);
    
    // Get top 10 largest trades sorted by size
    const largestTrades = [...recentTrades]
      .sort((a: any, b: any) => b.size - a.size)
      .slice(0, 10)
      .map((t: any) => ({
        id: t.id,
        side: t.side,
        size: t.size,
        price: t.price,
        timeAgo: t.timeAgo
      }));
    
    const tradeStats = {
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      buyVolume,
      sellVolume,
      buyPressure: totalTrades > 0 ? (buyTrades.length / totalTrades) * 100 : 50,
      sellPressure: totalTrades > 0 ? (sellTrades.length / totalTrades) * 100 : 50,
      netFlow: buyVolume - sellVolume,
      totalCount: totalTrades,
      largestTrade,
      largestTrades,
      // NEW: 24h volume by token (YES/NO)
      yesVolume24h,
      noVolume24h,
      totalVolume24h,
      uniqueTraders24h: traderCount24h
    };
    
    console.log(`[TRADES] Stats: buy=${tradeStats.buyCount}, sell=${tradeStats.sellCount}, pressure=${tradeStats.buyPressure.toFixed(0)}%`);

    // === TOP TRADERS / WHALE DETECTION (from 24h filtered data) ===
    // Aggregate trades by wallet address, tracking YES/NO volume separately by token_id
    const traderVolumes = new Map<string, {
      volume: number;
      yesVolume: number;
      noVolume: number;
      buys: number;
      sells: number;
      trades: number;
      buyVolume: number;
      sellVolume: number;
      lastTradeTime: string;
    }>();

    // Use uniqueRawTrades (24h filtered) for accurate trader stats
    uniqueRawTrades.forEach((t: any) => {
      const wallet = t.user || 'unknown';
      const shares = parseFloat(t.shares_normalized || t.shares || 0);
      const price = parseFloat(t.price || 0);
      const usdValue = shares * price;
      
      // Skip dust trades
      if (usdValue < 0.10 || price < 0.001) return;
      
      const current = traderVolumes.get(wallet) || {
        volume: 0, yesVolume: 0, noVolume: 0, buys: 0, sells: 0, trades: 0, 
        buyVolume: 0, sellVolume: 0, 
        lastTradeTime: t.timestamp ? new Date(t.timestamp * 1000).toISOString() : new Date().toISOString()
      };
      
      current.volume += usdValue;
      current.trades++;
      
      // Track YES vs NO volume per trader by token_id
      if (t.token_id === yesTokenId) {
        current.yesVolume += usdValue;
      } else if (t.token_id === noTokenId) {
        current.noVolume += usdValue;
      }
      
      // Track buy/sell for buy percentage
      const side = (t.side || '').toUpperCase();
      if (side === 'BUY') {
        current.buys++;
        current.buyVolume += usdValue;
      } else {
        current.sells++;
        current.sellVolume += usdValue;
      }
      
      // Track most recent trade
      const tradeTime = t.timestamp ? new Date(t.timestamp * 1000).toISOString() : new Date().toISOString();
      if (new Date(tradeTime) > new Date(current.lastTradeTime)) {
        current.lastTradeTime = tradeTime;
      }
      
      traderVolumes.set(wallet, current);
    });

    // Sort traders by 24h volume descending
    const sortedTraders = Array.from(traderVolumes.entries())
      .map(([wallet, stats]) => ({ wallet, ...stats }))
      .sort((a, b) => b.volume - a.volume);

    // Adaptive threshold: min $500 or 10% of largest trader
    const topTraderVolume = sortedTraders[0]?.volume || 0;
    const whaleThreshold = Math.max(500, topTraderVolume * 0.1);

    // Top 10 traders with whale flag (now based on 24h volume)
    const topTraders = sortedTraders.slice(0, 10).map(t => ({
      wallet: t.wallet,
      volume: t.volume,
      yesVolume: t.yesVolume,
      noVolume: t.noVolume,
      buyPercent: t.trades > 0 ? Math.round((t.buys / t.trades) * 100) : 50,
      trades: t.trades,
      isWhale: t.volume >= whaleThreshold,
      lastTradeTime: t.lastTradeTime
    }));

    // Count actual whales (above threshold)
    const whaleCount = topTraders.filter(t => t.isWhale).length;
    const whaleVolume = topTraders.filter(t => t.isWhale).reduce((sum, t) => sum + t.volume, 0);
    const totalTopTraderVolume = topTraders.reduce((sum, t) => sum + t.volume, 0);

    console.log(`[TOP TRADERS] ${sortedTraders.length} unique traders (24h), threshold: $${whaleThreshold.toFixed(0)}`);
    console.log(`[TOP TRADERS] ${whaleCount} whales (>= $${whaleThreshold.toFixed(0)}), total whale volume: $${whaleVolume.toFixed(0)}`);

    // Legacy whaleTrades for backwards compatibility
    const whaleTrades = topTraders.filter(t => t.isWhale).map(t => ({
      id: t.wallet,
      wallet: t.wallet,
      side: t.buyPercent >= 50 ? 'BUY' : 'SELL',
      amount: t.volume,
      price: 0,
      timestamp: t.lastTradeTime,
      timeAgo: formatTimeAgo(t.lastTradeTime)
    }));

    // Process orderbook - sort bids highest first, asks lowest first
    // Also validate that orderbook prices make sense for this market
    const currentPriceForValidation = verifiedPrice || market.currentPrice || 0.5;
    
    const rawBids = (orderbook?.bids || []).map((b: any) => ({
      price: parseFloat(b.price) * 100,
      size: parseFloat(b.size || b.quantity || 0)
    })).filter((b: any) => b.size > 0 && b.price > 0 && b.price < 100);
    
    const rawAsks = (orderbook?.asks || []).map((a: any) => ({
      price: parseFloat(a.price) * 100,
      size: parseFloat(a.size || a.quantity || 0)
    })).filter((a: any) => a.size > 0 && a.price > 0 && a.price < 100);
    
    // Check if orderbook prices are reasonable (within 85% tolerance for extreme priced markets)
    // If not, the orderbook data is likely stale or for the wrong token
    const expectedPricePct = currentPriceForValidation * 100;
    const validBids = rawBids.filter((b: any) => Math.abs(b.price - expectedPricePct) < 85);
    const validAsks = rawAsks.filter((a: any) => Math.abs(a.price - expectedPricePct) < 85);
    
    const orderbookValid = validBids.length > 0 || validAsks.length > 0;
    
    if (!orderbookValid && rawBids.length > 0) {
      console.log(`[ORDERBOOK] WARNING: Orderbook prices don't match market! Expected ~${expectedPricePct.toFixed(1)}%, got bids around ${rawBids[0]?.price.toFixed(1)}%`);
      console.log(`[ORDERBOOK] Discarding stale/wrong orderbook data`);
    }
    
    const processedOrderbook = {
      bids: (orderbookValid ? validBids : [])
        .sort((a: any, b: any) => b.price - a.price) // Highest first
        .slice(0, 10),
      asks: (orderbookValid ? validAsks : [])
        .sort((a: any, b: any) => a.price - b.price) // Lowest first
        .slice(0, 10),
      spread: 0,
      bidTotal: 0,
      askTotal: 0
    };

    // Calculate spread from best bid and best ask (now first element after sorting)
    if (processedOrderbook.bids.length && processedOrderbook.asks.length) {
      const bestBid = processedOrderbook.bids[0].price;  // Highest bid
      const bestAsk = processedOrderbook.asks[0].price;  // Lowest ask
      processedOrderbook.spread = bestAsk - bestBid;
      console.log(`[ORDERBOOK] Final: Best bid: ${bestBid.toFixed(1)}%, Best ask: ${bestAsk.toFixed(1)}%, Spread: ${processedOrderbook.spread.toFixed(2)}%`);
    } else if (rawBids.length === 0 && rawAsks.length === 0) {
      console.log(`[ORDERBOOK] No orderbook data available`);
    }
    processedOrderbook.bidTotal = processedOrderbook.bids.reduce((sum: number, b: any) => sum + b.size, 0);
    processedOrderbook.askTotal = processedOrderbook.asks.reduce((sum: number, a: any) => sum + a.size, 0);

    // Fetch candlesticks for proper OHLC price history
    let priceHistory: Array<{ date: string; price: number; open?: number; high?: number; low?: number; close?: number }> = [];
    let priceChange = 0;

    if (conditionId) {
      const candlesticks = await fetchCandlesticks(conditionId, market.side_a?.id);
      
      if (candlesticks.length > 0) {
        const toPct = (v: any) => {
          const n = typeof v === 'string' ? parseFloat(v) : Number(v);
          if (!Number.isFinite(n)) return 0;
          // Dome candlesticks may return dollars (0-1) OR already-in-percent values; normalize.
          const pct = n <= 1.5 ? n * 100 : n;
          return Math.max(0, Math.min(100, pct));
        };

        priceHistory = candlesticks
          .filter((c: any) => (c?.price?.close_dollars ?? 0) > 0)
          .map((c: any) => ({
            date: new Date(c.end_period_ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            price: toPct(c.price.close_dollars),
            open: toPct(c.price.open_dollars),
            high: toPct(c.price.high_dollars),
            low: toPct(c.price.low_dollars),
            close: toPct(c.price.close_dollars)
          }));
        
        // Calculate 7-day change
        if (priceHistory.length >= 2) {
          const oldPrice = priceHistory[0].price;
          const newPrice = priceHistory[priceHistory.length - 1].price;
          priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
        }
        
        console.log(`[PRICE] Got ${priceHistory.length} candlesticks, 7d change: ${priceChange.toFixed(1)}%`);
      }
    }

    // Fallback to current price if no candlesticks
    if (priceHistory.length === 0 && market?.currentPrice) {
      const currentPricePercent = (market.currentPrice || 0.5) * 100;
      priceHistory.push({
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: currentPricePercent
      });
      console.log(`[PRICE] No candlesticks, using current price: ${currentPricePercent.toFixed(1)}%`);
    }
    
    console.log(`[PRICE] Generated ${priceHistory.length} price history data points`);

    // Calculate arbitrage for multi-market events
    let arbitrage = {
      isMultiMarket: false,
      marketCount: 1,
      totalProbability: 0,
      hasArbitrage: false,
      markets: [] as Array<{ question: string; odds: number }>
    };

    if (eventMarkets.length > 1) {
      let totalProb = 0;
      const arbMarkets: Array<{ question: string; odds: number }> = [];
      
      for (const m of eventMarkets) {
        // Get YES price from Gamma API market data (outcomePrices)
        let yesPrice = 0.5;
        try {
          const prices = typeof m.outcomePrices === 'string'
            ? JSON.parse(m.outcomePrices)
            : m.outcomePrices;
          yesPrice = parseFloat(prices?.[0]) || 0.5;
        } catch { /* ignore */ }
        
        totalProb += yesPrice;
        arbMarkets.push({
          question: m.question || m.title,
          odds: yesPrice * 100
        });
      }
      
      console.log(`[Arbitrage] Total probability: ${(totalProb * 100).toFixed(1)}% across ${eventMarkets.length} markets`);

      // Only show arbitrage if total probability is reasonable (50-200%)
      // This filters out broken calculations from unrelated markets
      const totalProbPercent = totalProb * 100;
      const isReasonable = totalProbPercent > 50 && totalProbPercent < 200;
      
      arbitrage = {
        isMultiMarket: isReasonable,
        marketCount: eventMarkets.length,
        totalProbability: totalProbPercent,
        hasArbitrage: isReasonable && Math.abs(totalProb - 1) > 0.03, // >3% deviation
        markets: arbMarkets.slice(0, 10)
      };
      
      if (!isReasonable) {
        console.log(`[Arbitrage] Hiding arbitrage - total prob ${totalProbPercent.toFixed(1)}% is unreasonable`);
      }
    }

    const fetchDuration = Date.now() - fetchStartTime;

    // Fetch historical prices for momentum calculation (1h and 24h ago)
    let priceChange1h = 0;
    let priceChange24h = 0;
    const currentPriceDecimal = market.currentPrice || 0.5;
    
    if (market.side_a?.id) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const [price1hAgo, price24hAgo] = await Promise.all([
        fetchHistoricalPrice(market.side_a.id, nowSeconds - 3600),      // 1 hour ago
        fetchHistoricalPrice(market.side_a.id, nowSeconds - 86400)      // 24 hours ago
      ]);
      
      if (price1hAgo && price1hAgo > 0) {
        priceChange1h = ((currentPriceDecimal - price1hAgo) / price1hAgo) * 100;
        console.log(`[Momentum] 1h: ${(price1hAgo * 100).toFixed(1)}% -> ${(currentPriceDecimal * 100).toFixed(1)}% = ${priceChange1h >= 0 ? '+' : ''}${priceChange1h.toFixed(1)}%`);
      }
      if (price24hAgo && price24hAgo > 0) {
        priceChange24h = ((currentPriceDecimal - price24hAgo) / price24hAgo) * 100;
        console.log(`[Momentum] 24h: ${(price24hAgo * 100).toFixed(1)}% -> ${(currentPriceDecimal * 100).toFixed(1)}% = ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(1)}%`);
      }
    }

    // Calculate liquidity from orderbook depth (more accurate than market.liquidity)
    const orderbookLiquidity = processedOrderbook.bidTotal + processedOrderbook.askTotal;
    console.log(`[Liquidity] Orderbook depth: ${orderbookLiquidity.toFixed(0)} (bids: ${processedOrderbook.bidTotal.toFixed(0)}, asks: ${processedOrderbook.askTotal.toFixed(0)})`);

    // Build response
    const response = {
      market: {
        question: market.title,
        odds: (() => {
          const raw = (market as any).currentPrice ?? parseFloat((market as any).price);
          const n = Number.isFinite(raw) ? raw : 0.5;
          const p = n > 1.5 ? n / 100 : n;
          return p * 100;
        })(),
        volume: market.volume_total || 0,
        liquidity: orderbookLiquidity || market.liquidity || 0,
        createdDate: market.start_time 
          ? new Date(market.start_time * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : 'Unknown',
        endDate: market.end_time 
          ? new Date(market.end_time * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : null,
        status: market.status === 'open' ? 'Active' : 'Closed',
        url: marketUrl,
        // Token IDs for trading
        tokenId: market.side_a?.id || null,        // YES token ID
        noTokenId: market.side_b?.id || null,      // NO token ID
        conditionId: conditionId || null,
        // Market metadata for MarketInfoCard
        description: market.metadata?.description || null,
        resolutionSource: market.metadata?.resolutionSource || null,
        tags: market.metadata?.tags || []
      },
      whales: whaleTrades,
      // New: Top traders with aggregated wallet data
      topTraders,
      topTraderStats: {
        uniqueTraders: sortedTraders.length,
        whaleCount,
        whaleVolume,
        totalTopTraderVolume,
        whaleThreshold
      },
      orderbook: processedOrderbook,
      priceHistory,
      priceChange,
      priceChange1h,
      priceChange24h,
      recentTrades,
      tradeStats,
      arbitrage,
      dataSource: {
        api: 'Dome API',
        endpoint: DOME_API_BASE,
        fetchedAt: new Date().toISOString(),
        fetchDurationMs: fetchDuration,
        verification: 'REAL_LIVE_DATA'
      }
    };

    console.log(`[Dashboard] Response built in ${fetchDuration}ms`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Dashboard] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch market data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});