import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DFLOW_API_KEY = Deno.env.get('DFLOW_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const DFLOW_BASE_URL = 'https://c.prediction-markets-api.dflow.net/api/v1';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Timeout helper to prevent endless loading
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

interface MarketData {
  platform: 'polymarket' | 'kalshi';
  title: string;
  slug: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
  url: string;
  tokenId?: string;
  ticker?: string;
  eventTitle?: string;
}

interface FetchAttempt {
  url: string;
  status: number;
  bodyPreview: string;
  note: string;
}

interface SearchAttempt {
  query: string;
  url: string;
  status: number;
  eventCount: number;
  marketCount: number;
}

interface DebugInfo {
  reasoning?: string;
  candidateTitles?: string[];
  kalshiSearchUrl?: string;
  polymarketSearchUrl?: string;
  kalshiResponse?: any;
  polymarketResponse?: any;
  sourceApiResponse?: any;
  allSourceMarkets?: MarketData[];
  allCandidateMarkets?: MarketData[];
  aiInput?: string;
  aiOutput?: string;
  kalshiFetchAttempts?: FetchAttempt[];
  polymarketTokenIdNotes?: string[];
  parsedUrlInfo?: any;
  searchQueries?: string[];
  kalshiSearchAttempts?: SearchAttempt[];
  polymarketSearchAttempts?: SearchAttempt[];
}

// Parse URL to detect platform and extract identifiers
function parseMarketUrl(url: string): { platform: 'polymarket' | 'kalshi'; slug: string; seriesTicker?: string; marketTicker?: string } | null {
  try {
    const parsed = new URL(url);
    
    if (parsed.hostname.includes('polymarket.com')) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'event' && pathParts[1]) {
        return { platform: 'polymarket', slug: pathParts[1] };
      }
    }
    
    if (parsed.hostname.includes('kalshi.com')) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      // Handle: /markets/kxvenezuelaleader/who-will-be.../kxvenezuelaleader-26dec31
      if (pathParts[0] === 'markets' && pathParts[1]) {
        const seriesTicker = pathParts[1].toUpperCase();
        // If there's a specific market ticker at the end (e.g., kxvenezuelaleader-26dec31)
        if (pathParts.length >= 4 && pathParts[3]) {
          const marketTicker = pathParts[3].toUpperCase();
          return { platform: 'kalshi', slug: marketTicker, seriesTicker, marketTicker };
        }
        return { platform: 'kalshi', slug: seriesTicker, seriesTicker };
      }
      if (pathParts[0] === 'events' && pathParts[1]) {
        const seriesTicker = pathParts[1].toUpperCase();
        return { platform: 'kalshi', slug: seriesTicker, seriesTicker };
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Safely parse tokenIds from Polymarket
function parseTokenIds(clobTokenIds: any): string[] {
  if (!clobTokenIds) return [];
  if (Array.isArray(clobTokenIds)) return clobTokenIds;
  if (typeof clobTokenIds === 'string') {
    try {
      const parsed = JSON.parse(clobTokenIds);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      console.log(`[TokenId] Failed to parse clobTokenIds string: ${clobTokenIds.slice(0, 100)}`);
    }
  }
  return [];
}

// Fetch Polymarket event data via Gamma API
async function fetchPolymarketData(slug: string): Promise<{ primaryMarket: MarketData | null; allMarkets: MarketData[]; rawResponse: any; tokenIdNotes: string[] }> {
  const tokenIdNotes: string[] = [];
  try {
    console.log(`[Polymarket] Fetching event via Gamma: ${slug}`);
    
    const response = await fetch(`${GAMMA_API_BASE}/events?slug=${encodeURIComponent(slug)}`);
    const rawText = await response.text();
    let rawResponse: any;
    
    try {
      rawResponse = JSON.parse(rawText);
    } catch {
      console.error(`[Polymarket] Invalid JSON response`);
      return { primaryMarket: null, allMarkets: [], rawResponse: rawText.slice(0, 500), tokenIdNotes };
    }

    if (!response.ok) {
      console.error(`[Polymarket] Failed to fetch event: ${response.status}`);
      return { primaryMarket: null, allMarkets: [], rawResponse, tokenIdNotes };
    }

    const events = rawResponse;
    console.log(`[Polymarket] Gamma returned ${events?.length || 0} events`);
    
    if (!events || events.length === 0) {
      console.error(`[Polymarket] No event found for slug: ${slug}`);
      return { primaryMarket: null, allMarkets: [], rawResponse, tokenIdNotes };
    }

    const event = events[0];
    const markets = event.markets || [];
    const allMarkets: MarketData[] = [];
    
    for (const market of markets) {
      let yesPrice = 0.5;
      let noPrice = 0.5;
      
      if (market.outcomePrices) {
        try {
          const prices = typeof market.outcomePrices === 'string' 
            ? JSON.parse(market.outcomePrices) 
            : market.outcomePrices;
          yesPrice = parseFloat(prices[0]) || 0.5;
          noPrice = parseFloat(prices[1]) || 0.5;
        } catch {
          console.log(`[Polymarket] Could not parse outcomePrices for ${market.question}`);
        }
      }

      // Properly parse tokenIds
      const tokenIds = parseTokenIds(market.clobTokenIds);
      const tokenId = tokenIds[0] || market.conditionId || undefined;
      
      if (tokenIds.length === 0 && market.clobTokenIds) {
        tokenIdNotes.push(`Market "${market.question?.slice(0,50)}": clobTokenIds was "${String(market.clobTokenIds).slice(0,50)}", parsed to empty`);
      } else if (tokenId) {
        tokenIdNotes.push(`Market "${market.question?.slice(0,50)}": tokenId = ${tokenId.slice(0,20)}...`);
      }

      allMarkets.push({
        platform: 'polymarket',
        title: market.question || market.title || '',
        eventTitle: event.title,
        slug: event.slug || slug,
        yesPrice,
        noPrice,
        volume: parseFloat(market.volume) || parseFloat(event.volume) || 0,
        url: `https://polymarket.com/event/${event.slug || slug}`,
        tokenId
      });
    }

    const primaryMarket = allMarkets.length > 0 ? {
      platform: 'polymarket' as const,
      title: event.title || allMarkets[0]?.title || slug,
      slug: event.slug || slug,
      yesPrice: allMarkets[0]?.yesPrice || 0.5,
      noPrice: allMarkets[0]?.noPrice || 0.5,
      volume: parseFloat(event.volume) || 0,
      url: `https://polymarket.com/event/${event.slug || slug}`,
      tokenId: allMarkets[0]?.tokenId
    } : null;

    console.log(`[Polymarket] Found ${allMarkets.length} markets in event`);
    return { primaryMarket, allMarkets, rawResponse, tokenIdNotes };
  } catch (error) {
    console.error(`[Polymarket] Error fetching data:`, error);
    return { primaryMarket: null, allMarkets: [], rawResponse: { error: String(error) }, tokenIdNotes };
  }
}

// Fetch Kalshi market data via DFlow API - with proper nested markets fallback
async function fetchKalshiData(ticker: string, seriesTicker?: string): Promise<{ primaryMarket: MarketData | null; allMarkets: MarketData[]; rawResponse: any; fetchAttempts: FetchAttempt[] }> {
  const fetchAttempts: FetchAttempt[] = [];
  
  try {
    console.log(`[Kalshi] Fetching market: ${ticker}, series: ${seriesTicker || 'N/A'}`);
    
    // Step 1: Try fetching by market ticker first
    const marketUrl = `${DFLOW_BASE_URL}/markets/${ticker}`;
    console.log(`[Kalshi] Attempt 1 - Market URL: ${marketUrl}`);
    
    const response = await fetch(marketUrl, {
      headers: {
        'x-api-key': DFLOW_API_KEY || '',
        'Content-Type': 'application/json'
      }
    });

    const rawText = await response.text();
    let rawResponse: any;
    
    try {
      rawResponse = JSON.parse(rawText);
    } catch {
      fetchAttempts.push({ url: marketUrl, status: response.status, bodyPreview: rawText.slice(0, 300), note: 'Invalid JSON' });
      rawResponse = rawText.slice(0, 500);
    }

    fetchAttempts.push({ 
      url: marketUrl, 
      status: response.status, 
      bodyPreview: JSON.stringify(rawResponse).slice(0, 300), 
      note: response.ok ? 'Success' : 'Not found' 
    });

    if (response.ok) {
      console.log(`[Kalshi] Market data received directly`);
      const market = rawResponse.market || rawResponse;
      const allMarkets: MarketData[] = [{
        platform: 'kalshi',
        title: market.title || market.subtitle || ticker,
        slug: market.ticker || ticker,
        yesPrice: market.yes_price || market.last_price || 0.5,
        noPrice: market.no_price || (1 - (market.yes_price || market.last_price || 0.5)),
        volume: market.volume || market.volume_24h,
        url: `https://kalshi.com/markets/${market.ticker || ticker}`,
        ticker: market.ticker || ticker
      }];
      return { primaryMarket: allMarkets[0], allMarkets, rawResponse, fetchAttempts };
    }

    // Step 2: Fetch events with nested markets using seriesTickers (plural!)
    const eventSeriesTicker = seriesTicker || ticker.split('-')[0];
    const eventsUrl = `${DFLOW_BASE_URL}/events?withNestedMarkets=true&seriesTickers=${eventSeriesTicker}&status=active&limit=5`;
    console.log(`[Kalshi] Attempt 2 - Events with nested markets: ${eventsUrl}`);
    
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        'x-api-key': DFLOW_API_KEY || '',
        'Content-Type': 'application/json'
      }
    });
    
    const eventsText = await eventsResponse.text();
    let eventsData: any;
    
    try {
      eventsData = JSON.parse(eventsText);
    } catch {
      fetchAttempts.push({ url: eventsUrl, status: eventsResponse.status, bodyPreview: eventsText.slice(0, 300), note: 'Invalid JSON' });
      eventsData = null;
    }
    
    fetchAttempts.push({ 
      url: eventsUrl, 
      status: eventsResponse.status, 
      bodyPreview: JSON.stringify(eventsData).slice(0, 500), 
      note: eventsResponse.ok ? 'Success' : 'Failed' 
    });

    if (eventsResponse.ok && eventsData) {
      const events = eventsData.events || eventsData.data || eventsData || [];
      const allMarkets: MarketData[] = [];
      let primaryMarket: MarketData | null = null;
      
      for (const event of events.slice(0, 5)) {
        const eventMarkets = event.markets || [];
        for (const market of eventMarkets) {
          const marketData: MarketData = {
            platform: 'kalshi',
            title: market.title || market.subtitle || '',
            eventTitle: event.title,
            slug: market.ticker || '',
            yesPrice: market.yes_price || market.last_price || 0.5,
            noPrice: market.no_price || (1 - (market.yes_price || market.last_price || 0.5)),
            volume: market.volume,
            url: `https://kalshi.com/markets/${market.ticker}`,
            ticker: market.ticker
          };
          allMarkets.push(marketData);
          
          // Match the primary market by ticker
          if (market.ticker?.toUpperCase() === ticker.toUpperCase()) {
            primaryMarket = marketData;
          }
        }
      }
      
      console.log(`[Kalshi] Found ${allMarkets.length} markets from events endpoint`);
      
      if (allMarkets.length > 0) {
        return { 
          primaryMarket: primaryMarket || allMarkets[0], 
          allMarkets, 
          rawResponse: { originalError: rawResponse, eventsResponse: eventsData },
          fetchAttempts
        };
      }
    }

    // Step 3: Try search as last resort
    const searchUrl = `${DFLOW_BASE_URL}/search?q=${encodeURIComponent(eventSeriesTicker)}`;
    console.log(`[Kalshi] Attempt 3 - Search fallback: ${searchUrl}`);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'x-api-key': DFLOW_API_KEY || '',
        'Content-Type': 'application/json'
      }
    });
    
    const searchText = await searchResponse.text();
    let searchData: any;
    
    try {
      searchData = JSON.parse(searchText);
    } catch {
      fetchAttempts.push({ url: searchUrl, status: searchResponse.status, bodyPreview: searchText.slice(0, 300), note: 'Invalid JSON' });
      return { primaryMarket: null, allMarkets: [], rawResponse: { originalError: rawResponse, searchError: searchText.slice(0, 500) }, fetchAttempts };
    }
    
    fetchAttempts.push({ 
      url: searchUrl, 
      status: searchResponse.status, 
      bodyPreview: JSON.stringify(searchData).slice(0, 500), 
      note: searchResponse.ok ? 'Success - but may lack nested markets' : 'Failed' 
    });
    
    if (!searchResponse.ok) {
      return { primaryMarket: null, allMarkets: [], rawResponse: { originalError: rawResponse, searchError: searchData }, fetchAttempts };
    }
    
    // Search results may not have nested markets - need to fetch each event
    const searchEvents = searchData.events || searchData.data || searchData || [];
    const allMarkets: MarketData[] = [];
    
    // For each event from search, fetch full event data with markets
    for (const event of searchEvents.slice(0, 3)) {
      const eventTicker = event.ticker || event.event_ticker;
      if (!eventTicker) continue;
      
      const eventDetailUrl = `${DFLOW_BASE_URL}/events?withNestedMarkets=true&seriesTickers=${eventTicker}&limit=1`;
      console.log(`[Kalshi] Fetching event details: ${eventDetailUrl}`);
      
      try {
        const eventDetailResp = await fetch(eventDetailUrl, {
          headers: {
            'x-api-key': DFLOW_API_KEY || '',
            'Content-Type': 'application/json'
          }
        });
        
        if (eventDetailResp.ok) {
          const eventDetailData = await eventDetailResp.json();
          const detailEvents = eventDetailData.events || eventDetailData.data || eventDetailData || [];
          
          for (const detailEvent of detailEvents) {
            const eventMarkets = detailEvent.markets || [];
            for (const market of eventMarkets) {
              allMarkets.push({
                platform: 'kalshi',
                title: market.title || market.subtitle || '',
                eventTitle: detailEvent.title,
                slug: market.ticker || '',
                yesPrice: market.yes_price || market.last_price || 0.5,
                noPrice: market.no_price || (1 - (market.yes_price || market.last_price || 0.5)),
                volume: market.volume,
                url: `https://kalshi.com/markets/${market.ticker}`,
                ticker: market.ticker
              });
            }
          }
        }
      } catch (e) {
        console.log(`[Kalshi] Failed to fetch event details for ${eventTicker}:`, e);
      }
    }
    
    console.log(`[Kalshi] Total markets from search+fetch: ${allMarkets.length}`);
    
    return { 
      primaryMarket: allMarkets.find(m => m.ticker?.toUpperCase() === ticker.toUpperCase()) || allMarkets[0] || null, 
      allMarkets, 
      rawResponse: { originalError: rawResponse, searchResponse: searchData },
      fetchAttempts
    };
  } catch (error) {
    console.error(`[Kalshi] Error fetching data:`, error);
    return { primaryMarket: null, allMarkets: [], rawResponse: { error: String(error) }, fetchAttempts };
  }
}

// Call Claude API for AI tasks
async function callClaude(systemPrompt: string, userMessage: string, maxTokens: number = 500): Promise<string | null> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Claude] API error: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error(`[Claude] Error:`, error);
    return null;
  }
}

// Generate multiple search queries using Claude to maximize match chances
async function generateSearchQueries(title: string, description?: string): Promise<string[]> {
  console.log(`[AI] Generating search queries for: ${title}`);
  
  const context = description ? `Title: "${title}"\nDescription excerpt: "${description.slice(0, 500)}"` : `Title: "${title}"`;
  
  const systemPrompt = `You are a search query optimizer for prediction markets. Given a market title (and optionally description), generate 5-8 alternative search queries that would find this exact market on another platform.

Rules:
- Generate queries using SYNONYMS (e.g., "leader" -> "head of state", "president")
- Try different date formats (e.g., "2026", "end of 2026", "Dec 2026")
- Include country/entity focused queries
- Include person name focused queries if applicable
- Each query should be 1-4 words maximum
- Return ONLY a JSON array of strings, nothing else

Example output: ["Venezuela leader 2026", "Venezuela head of state", "Venezuela president 2026", "Maduro 2026", "Venezuela"]`;

  const result = await callClaude(systemPrompt, context, 150);
  
  const queries: string[] = [];
  
  if (result) {
    try {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) {
        queries.push(...parsed.map((q: string) => q.trim()).filter((q: string) => q.length > 0));
      }
    } catch {
      // If JSON parse fails, try to extract individual queries
      const lines = result.split('\n').map(l => l.trim().replace(/^["'\-\d.]+\s*/, '').replace(/["',]+$/, ''));
      queries.push(...lines.filter(l => l.length > 2 && l.length < 50));
    }
  }
  
  // Always add heuristic fallbacks
  const words = title.split(/\s+/).filter(w => w.length > 3 && !['will', 'the', 'be', 'of', 'in', 'on', 'at', 'to', 'end', 'leader', 'president'].includes(w.toLowerCase()));
  
  // Country/entity + year pattern
  const yearMatch = title.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : '';
  
  // Add simple fallbacks if not already present
  if (words.length > 0) {
    const firstWord = words[0];
    if (!queries.some(q => q.toLowerCase() === firstWord.toLowerCase())) {
      queries.push(firstWord);
    }
    if (year && !queries.some(q => q.toLowerCase() === `${firstWord} ${year}`.toLowerCase())) {
      queries.push(`${firstWord} ${year}`);
    }
    // Try "head of state" variant for political markets
    if (title.toLowerCase().includes('leader')) {
      const headOfState = title.replace(/leader/gi, 'head of state').split(/\s+/).filter(w => w.length > 2).slice(0, 4).join(' ');
      if (!queries.some(q => q.toLowerCase().includes('head of state'))) {
        queries.push(`${firstWord} head of state`);
      }
    }
  }
  
  // Deduplicate
  const uniqueQueries = [...new Set(queries.map(q => q.toLowerCase()))].map(q => 
    queries.find(orig => orig.toLowerCase() === q) || q
  );
  
  console.log(`[AI] Generated ${uniqueQueries.length} search queries:`, uniqueQueries);
  return uniqueQueries.slice(0, 8); // Limit to 8 queries
}

// Search Polymarket via Gamma API - single query
async function searchPolymarket(query: string): Promise<{ markets: MarketData[]; rawResponse: any; url: string; status: number }> {
  const url = `${GAMMA_API_BASE}/events?_q=${encodeURIComponent(query)}&active=true&closed=false&limit=10`;
  
  try {
    console.log(`[Polymarket] Searching via Gamma: ${query}`);
    
    const response = await fetch(url);
    const rawText = await response.text();
    let rawResponse: any;
    
    try {
      rawResponse = JSON.parse(rawText);
    } catch {
      console.error(`[Polymarket] Invalid JSON search response`);
      return { markets: [], rawResponse: rawText.slice(0, 1000), url, status: response.status };
    }

    if (!response.ok) {
      console.error(`[Polymarket] Search failed: ${response.status}`);
      return { markets: [], rawResponse, url, status: response.status };
    }

    const events = rawResponse;
    console.log(`[Polymarket] Gamma search found ${events?.length || 0} results`);

    if (!events || !Array.isArray(events)) {
      return { markets: [], rawResponse, url, status: response.status };
    }

    const markets: MarketData[] = [];
    
    // Increase limits for multi-outcome markets (was 5/5, now 10/50)
    for (const event of events.slice(0, 10)) {
      const eventMarkets = event.markets || [];
      for (const market of eventMarkets.slice(0, 50)) {
        let yesPrice = 0.5;
        let noPrice = 0.5;
        
        if (market.outcomePrices) {
          try {
            const prices = typeof market.outcomePrices === 'string' 
              ? JSON.parse(market.outcomePrices) 
              : market.outcomePrices;
            yesPrice = parseFloat(prices[0]) || 0.5;
            noPrice = parseFloat(prices[1]) || 0.5;
          } catch {
            // Keep defaults
          }
        }
        
        // Properly parse tokenIds
        const tokenIds = parseTokenIds(market.clobTokenIds);
        const tokenId = tokenIds[0] || market.conditionId || undefined;
        
        markets.push({
          platform: 'polymarket',
          title: market.question || event.title || '',
          eventTitle: event.title,
          slug: event.slug || event.id || '',
          yesPrice,
          noPrice,
          volume: parseFloat(market.volume) || parseFloat(event.volume) || 0,
          url: `https://polymarket.com/event/${event.slug || event.id}`,
          tokenId
        });
      }
    }

    return { markets, rawResponse, url, status: response.status };
  } catch (error) {
    console.error(`[Polymarket] Search error:`, error);
    return { markets: [], rawResponse: { error: String(error) }, url, status: 0 };
  }
}

// Search Polymarket with multiple queries - SEQUENTIAL to prioritize first query results
async function searchPolymarketMulti(queries: string[]): Promise<{ 
  markets: MarketData[]; 
  rawResponse: any; 
  searchAttempts: SearchAttempt[];
  primaryUrl: string;
}> {
  const searchAttempts: SearchAttempt[] = [];
  const allMarkets: MarketData[] = [];
  const seenTokenIds = new Set<string>(); // Use tokenId for reliable dedup
  
  console.log(`[Polymarket] Multi-search with ${queries.length} queries:`, queries);
  
  // Run queries SEQUENTIALLY to prioritize earlier (more relevant) queries
  for (const query of queries.slice(0, 6)) {
    try {
      const result = await searchPolymarket(query);
      const eventCount = Array.isArray(result.rawResponse) ? result.rawResponse.length : 0;
      let marketCount = 0;
      
      for (const market of result.markets) {
        // Use tokenId for deduplication (more reliable than slug+title)
        const key = market.tokenId || `${market.slug}-${market.title}`;
        if (!seenTokenIds.has(key)) {
          seenTokenIds.add(key);
          allMarkets.push(market);
          marketCount++;
        }
      }
      
      searchAttempts.push({
        query,
        url: result.url,
        status: result.status,
        eventCount,
        marketCount
      });
      
      console.log(`[Polymarket] Query "${query}": ${eventCount} events, ${marketCount} new markets`);
      
      // If we found enough relevant markets, stop early to avoid unrelated results
      if (allMarkets.length >= 30) {
        console.log(`[Polymarket] Stopping early with ${allMarkets.length} markets`);
        break;
      }
    } catch (error) {
      console.error(`[Polymarket] Query "${query}" failed:`, error);
      searchAttempts.push({
        query,
        url: '',
        status: 0,
        eventCount: 0,
        marketCount: 0
      });
    }
  }
  
  console.log(`[Polymarket] Total unique markets from all queries: ${allMarkets.length}`);
  
  return { 
    markets: allMarkets, 
    rawResponse: { searchAttempts },
    searchAttempts,
    primaryUrl: searchAttempts[0]?.url || ''
  };
}

// Search Kalshi with multiple queries and union results
async function searchKalshiMulti(queries: string[]): Promise<{ 
  markets: MarketData[]; 
  rawResponse: any; 
  searchAttempts: SearchAttempt[];
  primaryQuery: string;
}> {
  const searchAttempts: SearchAttempt[] = [];
  const allMarkets: MarketData[] = [];
  const seenTickers = new Set<string>();
  
  console.log(`[Kalshi] Multi-search with ${queries.length} queries:`, queries);
  
  for (const query of queries) {
    const url = `${DFLOW_BASE_URL}/search?q=${encodeURIComponent(query)}`;
    
    try {
      console.log(`[Kalshi] Searching: "${query}"`);
      
      const response = await fetch(url, {
        headers: {
          'x-api-key': DFLOW_API_KEY || '',
          'Content-Type': 'application/json'
        }
      });

      let rawResponse: any = {};
      let eventCount = 0;
      let marketCount = 0;
      
      if (response.ok) {
        const rawText = await response.text();
        try {
          rawResponse = JSON.parse(rawText);
          // DFlow search returns { events: [...] }
          const events = Array.isArray(rawResponse) ? rawResponse : (rawResponse.events || rawResponse.data || []);
          eventCount = events.length;
          
          console.log(`[Kalshi] Search "${query}" returned ${eventCount} events, raw keys: ${Object.keys(rawResponse || {}).join(', ')}`);
          
          // Process events - check for nested markets
          for (const event of events.slice(0, 8)) {
            let eventMarkets = event.markets || [];
            const eventTicker = event.event_ticker || event.ticker || event.series_ticker || event.seriesTicker;
            
            console.log(`[Kalshi] Event "${event.title?.substring(0, 50)}..." ticker=${eventTicker}, has ${eventMarkets.length} inline markets`);
            
            // If no nested markets, fetch them using various approaches
            if (eventMarkets.length === 0 && eventTicker) {
              // Try 1: Fetch by event_ticker directly 
              try {
                const eventUrl = `${DFLOW_BASE_URL}/events/${eventTicker}?withNestedMarkets=true`;
                console.log(`[Kalshi] Fetching event details: ${eventUrl}`);
                const eventResp = await fetch(eventUrl, {
                  headers: { 'x-api-key': DFLOW_API_KEY || '' }
                });
                if (eventResp.ok) {
                  const eventData = await eventResp.json();
                  // Response could be { event: {...} } or direct event object
                  const eventObj = eventData.event || eventData;
                  if (eventObj?.markets && eventObj.markets.length > 0) {
                    eventMarkets = eventObj.markets;
                    console.log(`[Kalshi] Got ${eventMarkets.length} markets via /events/${eventTicker}`);
                  }
                }
              } catch (e) {
                console.log(`[Kalshi] /events/${eventTicker} failed:`, e);
              }
              
              // Skip additional fallback - too slow for multi-query
            }
            
            for (const market of eventMarkets.slice(0, 10)) {
              const ticker = market.ticker || market.market_ticker || '';
              if (ticker && !seenTickers.has(ticker)) {
                seenTickers.add(ticker);
                const yesPrice = market.yes_price ?? market.yes_ask ?? market.last_price ?? 0.5;
                const noPrice = market.no_price ?? market.no_ask ?? (1 - yesPrice);
                allMarkets.push({
                  platform: 'kalshi',
                  title: market.title || market.subtitle || market.question || '',
                  eventTitle: event.title,
                  slug: ticker,
                  yesPrice,
                  noPrice,
                  volume: market.volume || market.volume_24h,
                  url: `https://kalshi.com/markets/${ticker}`,
                  ticker
                });
                marketCount++;
              }
            }
          }
        } catch (parseError) {
          console.log(`[Kalshi] Invalid JSON for query "${query}":`, parseError);
        }
      }
      
      searchAttempts.push({
        query,
        url,
        status: response.status,
        eventCount,
        marketCount
      });
      
      console.log(`[Kalshi] Query "${query}": ${eventCount} events, ${marketCount} new markets`);
      
    } catch (error) {
      console.error(`[Kalshi] Search error for "${query}":`, error);
      searchAttempts.push({
        query,
        url,
        status: 0,
        eventCount: 0,
        marketCount: 0
      });
    }
  }
  
  console.log(`[Kalshi] Total unique markets from all queries: ${allMarkets.length}`);
  
  return { 
    markets: allMarkets, 
    rawResponse: { searchAttempts },
    searchAttempts,
    primaryQuery: queries[0] || ''
  };
}

// AI analysis to determine if markets match and calculate arbitrage
async function analyzeArbitrage(source: MarketData, candidates: MarketData[]): Promise<{
  matchedMarket: MarketData | null;
  arbitrage: any;
  reasoning: string;
  aiInput: string;
  aiOutput: string;
}> {
  if (candidates.length === 0) {
    return { matchedMarket: null, arbitrage: null, reasoning: 'No candidate markets found', aiInput: '', aiOutput: '' };
  }

  console.log(`[AI] Analyzing ${candidates.length} candidates for arbitrage`);

  const candidateList = candidates.map((c, i) => 
    `${i + 1}. "${c.title}" (Event: ${c.eventTitle || 'N/A'}) - YES: ${(c.yesPrice * 100).toFixed(1)}¢, NO: ${(c.noPrice * 100).toFixed(1)}¢`
  ).join('\n');

  const systemPrompt = `You are an expert at matching prediction markets across platforms and identifying arbitrage opportunities.

Your task:
1. Determine which candidate market (if any) is the SAME event as the source
2. If a match is found, calculate if there's an arbitrage opportunity
3. Return structured JSON

IMPORTANT: Markets are the SAME if they resolve to the same outcome. Look for:
- Same person/entity being asked about
- Same timeframe or date
- Same specific question about a binary outcome

Arbitrage calculation:
- If Source YES price < Target NO price (or vice versa), there's potential arb
- Total cost = Best YES price + Best NO price across platforms
- If total cost < $1.00, profit = $1.00 - total cost
- Profit % = (profit / total cost) * 100

Response must be valid JSON only, no other text:
{
  "matchIndex": number | null,
  "confidence": number (0-100),
  "isSameMarket": boolean,
  "reasoning": "brief explanation",
  "arbitrage": {
    "exists": boolean,
    "buyYesOn": "platform name",
    "buyYesPrice": number (0-1),
    "buyNoOn": "platform name", 
    "buyNoPrice": number (0-1),
    "totalCost": number,
    "profit": number,
    "profitPercent": number,
    "strategy": "detailed trading instruction"
  } | null
}`;

  const userMessage = `SOURCE MARKET (${source.platform}):
Title: "${source.title}"
Event: "${source.eventTitle || 'N/A'}"
YES Price: ${(source.yesPrice * 100).toFixed(1)}¢
NO Price: ${(source.noPrice * 100).toFixed(1)}¢

CANDIDATE MARKETS (${candidates[0]?.platform}):
${candidateList}

Analyze which candidate (if any) matches the source, and calculate arbitrage opportunity.`;

  const result = await callClaude(systemPrompt, userMessage, 600);
  
  if (!result) {
    return { matchedMarket: null, arbitrage: null, reasoning: 'AI analysis failed', aiInput: userMessage, aiOutput: '' };
  }

  console.log(`[AI] Analysis result:`, result.slice(0, 500));

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { matchedMarket: null, arbitrage: null, reasoning: 'Could not parse AI response', aiInput: userMessage, aiOutput: result };
  }

  try {
    const analysis = JSON.parse(jsonMatch[0]);
    
    if (!analysis.isSameMarket || analysis.matchIndex === null || analysis.matchIndex === undefined) {
      return { 
        matchedMarket: null, 
        arbitrage: null, 
        reasoning: analysis.reasoning || 'No matching market found',
        aiInput: userMessage,
        aiOutput: result
      };
    }

    const matchedMarket = candidates[analysis.matchIndex - 1] || candidates[0];
    
    let arbitrage = null;
    const sourceYes = source.yesPrice;
    const sourceNo = source.noPrice;
    const targetYes = matchedMarket.yesPrice;
    const targetNo = matchedMarket.noPrice;

    const bestYesPrice = Math.min(sourceYes, targetYes);
    const bestNoPrice = Math.min(sourceNo, targetNo);
    const totalCost = bestYesPrice + bestNoPrice;

    if (totalCost < 1) {
      const profit = 1 - totalCost;
      const profitPercent = (profit / totalCost) * 100;

      arbitrage = {
        exists: true,
        confidence: analysis.confidence || 80,
        buyYesOn: sourceYes <= targetYes ? source.platform : matchedMarket.platform,
        buyYesPlatform: sourceYes <= targetYes ? source.platform : matchedMarket.platform,
        buyYesPrice: bestYesPrice,
        buyYesTokenId: sourceYes <= targetYes ? source.tokenId : matchedMarket.tokenId,
        buyYesTicker: sourceYes <= targetYes ? source.ticker : matchedMarket.ticker,
        buyNoOn: sourceNo <= targetNo ? source.platform : matchedMarket.platform,
        buyNoPlatform: sourceNo <= targetNo ? source.platform : matchedMarket.platform,
        buyNoPrice: bestNoPrice,
        buyNoTokenId: sourceNo <= targetNo ? source.tokenId : matchedMarket.tokenId,
        buyNoTicker: sourceNo <= targetNo ? source.ticker : matchedMarket.ticker,
        totalCost: totalCost,
        guaranteedPayout: 1,
        netProfit: profit,
        profitPercent: profitPercent,
        strategy: `Buy YES on ${sourceYes <= targetYes ? source.platform : matchedMarket.platform} at ${(bestYesPrice * 100).toFixed(1)}¢ + Buy NO on ${sourceNo <= targetNo ? source.platform : matchedMarket.platform} at ${(bestNoPrice * 100).toFixed(1)}¢`,
        reasoning: analysis.reasoning
      };
    } else {
      arbitrage = {
        exists: false,
        confidence: analysis.confidence || 80,
        totalCost,
        reasoning: `Total cost ${(totalCost * 100).toFixed(1)}¢ exceeds $1.00 payout`
      };
    }

    return {
      matchedMarket,
      arbitrage,
      reasoning: analysis.reasoning,
      aiInput: userMessage,
      aiOutput: result
    };
  } catch (error) {
    console.error(`[AI] JSON parse error:`, error);
    return { matchedMarket: null, arbitrage: null, reasoning: 'Failed to parse analysis', aiInput: userMessage, aiOutput: result };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const debug: DebugInfo = {};
  const startTime = Date.now();
  const MAX_REQUEST_TIME = 45000; // 45 second timeout

  try {
    const { url } = await req.json();
    console.log(`[ArbitrageFinder] Processing URL: ${url}`);

    if (!url) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No URL provided',
        debug 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const parsed = parseMarketUrl(url);
    if (!parsed) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid market URL. Please provide a Polymarket or Kalshi market URL.',
        debug: { ...debug, parsedUrl: null, inputUrl: url }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    debug.parsedUrlInfo = parsed;
    console.log(`[ArbitrageFinder] Detected ${parsed.platform} with slug: ${parsed.slug}, series: ${parsed.seriesTicker || 'N/A'}`);

    let sourceMarket: MarketData | null = null;
    let allSourceMarkets: MarketData[] = [];
    
    if (parsed.platform === 'polymarket') {
      const result = await fetchPolymarketData(parsed.slug);
      sourceMarket = result.primaryMarket;
      allSourceMarkets = result.allMarkets;
      debug.sourceApiResponse = result.rawResponse;
      debug.allSourceMarkets = result.allMarkets;
      debug.polymarketTokenIdNotes = result.tokenIdNotes;
    } else {
      const result = await fetchKalshiData(parsed.slug, parsed.seriesTicker);
      sourceMarket = result.primaryMarket;
      allSourceMarkets = result.allMarkets;
      debug.sourceApiResponse = result.rawResponse;
      debug.allSourceMarkets = result.allMarkets;
      debug.kalshiFetchAttempts = result.fetchAttempts;
    }

    if (!sourceMarket && allSourceMarkets.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Could not fetch market data. The market may not exist or the API may be unavailable.',
        debug
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use first market if primary not found
    if (!sourceMarket && allSourceMarkets.length > 0) {
      sourceMarket = allSourceMarkets[0];
    }

    console.log(`[ArbitrageFinder] Source market: ${sourceMarket?.title}, Total markets: ${allSourceMarkets.length}`);

    // Use EVENT-level title for better cross-platform matching
    let eventTitle: string;
    if (parsed.platform === 'kalshi') {
      // For Kalshi, get the event title from eventsResponse
      eventTitle = debug.sourceApiResponse?.eventsResponse?.events?.[0]?.title || sourceMarket!.eventTitle || sourceMarket!.title;
    } else {
      // For Polymarket, get the event title from the first event
      eventTitle = debug.sourceApiResponse?.[0]?.title || sourceMarket!.eventTitle || sourceMarket!.title;
    }
    console.log(`[ArbitrageFinder] Using event title for search: "${eventTitle}"`);

    // Generate multiple search queries for better matching
    const description = debug.sourceApiResponse?.description || debug.sourceApiResponse?.[0]?.description;
    const searchQueries = await generateSearchQueries(eventTitle, description);
    debug.searchQueries = searchQueries;

    let searchResults: MarketData[] = [];
    if (parsed.platform === 'polymarket') {
      // Use multi-query search for Kalshi
      const result = await searchKalshiMulti(searchQueries);
      searchResults = result.markets;
      debug.kalshiSearchUrl = result.searchAttempts[0]?.url || '';
      debug.kalshiResponse = result.rawResponse;
      debug.allCandidateMarkets = result.markets;
      debug.kalshiSearchAttempts = result.searchAttempts;
    } else {
      // For Kalshi->Polymarket, use multi-query search
      const result = await searchPolymarketMulti(searchQueries);
      searchResults = result.markets;
      debug.polymarketSearchUrl = result.primaryUrl;
      debug.polymarketResponse = result.rawResponse;
      debug.allCandidateMarkets = result.markets;
      (debug as any).polymarketSearchAttempts = result.searchAttempts;
    }

    debug.candidateTitles = searchResults.map(r => `${r.title} (YES: ${(r.yesPrice*100).toFixed(1)}¢)`);
    console.log(`[ArbitrageFinder] Found ${searchResults.length} candidates`);
    
    // Log first 5 candidates for debugging
    console.log(`[ArbitrageFinder] Passing to AI - Source: "${sourceMarket!.title}", Candidates (first 5):`);
    searchResults.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i+1}. "${c.title}" (event: ${c.eventTitle || 'N/A'})`);
    });
    
    // Check timeout before expensive AI call
    if (Date.now() - startTime > MAX_REQUEST_TIME - 15000) {
      console.log(`[ArbitrageFinder] Timeout warning - skipping AI analysis`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Request timeout - too many markets to process. Try a simpler market.',
        debug
      }), {
        status: 408,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { matchedMarket, arbitrage, reasoning, aiInput, aiOutput } = await analyzeArbitrage(sourceMarket!, searchResults);
    
    debug.reasoning = reasoning;
    debug.aiInput = aiInput;
    debug.aiOutput = aiOutput;

    return new Response(JSON.stringify({
      success: true,
      sourceMarket,
      sourceMarkets: allSourceMarkets,
      matchedMarket,
      arbitrage,
      searchQuery: searchQueries[0] || '',
      searchQueries,
      searchResultsCount: searchResults.length,
      debug
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ArbitrageFinder] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      debug
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
