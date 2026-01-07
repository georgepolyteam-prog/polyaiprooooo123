import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DFLOW_API_KEY = Deno.env.get('DFLOW_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
// Production DFlow endpoint (c. prefix)
const DFLOW_BASE_URL = 'https://c.prediction-markets-api.dflow.net/api/v1';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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
}

// Parse URL to detect platform and extract identifier
function parseMarketUrl(url: string): { platform: 'polymarket' | 'kalshi'; slug: string } | null {
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
        // If there's a specific market ticker at the end, use that
        if (pathParts.length >= 3 && pathParts[3]) {
          return { platform: 'kalshi', slug: pathParts[3] };
        }
        return { platform: 'kalshi', slug: pathParts[1] };
      }
      if (pathParts[0] === 'events' && pathParts[1]) {
        return { platform: 'kalshi', slug: pathParts[1] };
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Fetch Polymarket event data via Gamma API - returns ALL markets
async function fetchPolymarketData(slug: string): Promise<{ primaryMarket: MarketData | null; allMarkets: MarketData[]; rawResponse: any }> {
  try {
    console.log(`[Polymarket] Fetching event via Gamma: ${slug}`);
    
    const response = await fetch(`${GAMMA_API_BASE}/events?slug=${encodeURIComponent(slug)}`);
    const rawText = await response.text();
    let rawResponse: any;
    
    try {
      rawResponse = JSON.parse(rawText);
    } catch {
      console.error(`[Polymarket] Invalid JSON response`);
      return { primaryMarket: null, allMarkets: [], rawResponse: rawText.slice(0, 500) };
    }

    if (!response.ok) {
      console.error(`[Polymarket] Failed to fetch event: ${response.status}`);
      return { primaryMarket: null, allMarkets: [], rawResponse };
    }

    const events = rawResponse;
    console.log(`[Polymarket] Gamma returned ${events?.length || 0} events`);
    
    if (!events || events.length === 0) {
      console.error(`[Polymarket] No event found for slug: ${slug}`);
      return { primaryMarket: null, allMarkets: [], rawResponse };
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

      allMarkets.push({
        platform: 'polymarket',
        title: market.question || market.title || '',
        eventTitle: event.title,
        slug: event.slug || slug,
        yesPrice,
        noPrice,
        volume: parseFloat(market.volume) || parseFloat(event.volume) || 0,
        url: `https://polymarket.com/event/${event.slug || slug}`,
        tokenId: market.clobTokenIds?.[0] || market.conditionId
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
    return { primaryMarket, allMarkets, rawResponse };
  } catch (error) {
    console.error(`[Polymarket] Error fetching data:`, error);
    return { primaryMarket: null, allMarkets: [], rawResponse: { error: String(error) } };
  }
}

// Fetch Kalshi market data via DFlow API - returns ALL markets from event
async function fetchKalshiData(ticker: string): Promise<{ primaryMarket: MarketData | null; allMarkets: MarketData[]; rawResponse: any }> {
  try {
    console.log(`[Kalshi] Fetching market: ${ticker}`);
    
    // Try fetching by market ticker first
    const marketUrl = `${DFLOW_BASE_URL}/markets/${ticker.toUpperCase()}`;
    console.log(`[Kalshi] URL: ${marketUrl}`);
    
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
      console.error(`[Kalshi] Invalid JSON response`);
      return { primaryMarket: null, allMarkets: [], rawResponse: rawText.slice(0, 500) };
    }

    if (!response.ok) {
      console.error(`[Kalshi] Failed to fetch market: ${response.status}`, rawResponse);
      
      // Try searching for the event instead
      const eventTicker = ticker.split('-')[0]; // e.g., kxvenezuelaleader-26dec31 -> kxvenezuelaleader
      console.log(`[Kalshi] Trying event search for: ${eventTicker}`);
      
      const searchUrl = `${DFLOW_BASE_URL}/search?q=${encodeURIComponent(eventTicker)}`;
      console.log(`[Kalshi] Search URL: ${searchUrl}`);
      
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
        return { primaryMarket: null, allMarkets: [], rawResponse: { originalError: rawResponse, searchError: searchText.slice(0, 500) } };
      }
      
      if (!searchResponse.ok) {
        return { primaryMarket: null, allMarkets: [], rawResponse: { originalError: rawResponse, searchError: searchData } };
      }
      
      // Process search results
      const events = searchData.events || searchData.data || searchData || [];
      const allMarkets: MarketData[] = [];
      
      for (const event of events.slice(0, 3)) {
        const eventMarkets = event.markets || [];
        for (const market of eventMarkets) {
          allMarkets.push({
            platform: 'kalshi',
            title: market.title || market.subtitle || '',
            eventTitle: event.title,
            slug: market.ticker || '',
            yesPrice: market.yes_price || market.last_price || 0.5,
            noPrice: market.no_price || (1 - (market.yes_price || market.last_price || 0.5)),
            volume: market.volume,
            url: `https://kalshi.com/markets/${market.ticker}`,
            ticker: market.ticker
          });
        }
      }
      
      return { 
        primaryMarket: allMarkets[0] || null, 
        allMarkets, 
        rawResponse: { originalError: rawResponse, searchResponse: searchData } 
      };
    }

    console.log(`[Kalshi] Market data received`);

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

    return { primaryMarket: allMarkets[0], allMarkets, rawResponse };
  } catch (error) {
    console.error(`[Kalshi] Error fetching data:`, error);
    return { primaryMarket: null, allMarkets: [], rawResponse: { error: String(error) } };
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

// Generate optimal search query using Claude
async function generateSearchQuery(title: string): Promise<string> {
  console.log(`[AI] Generating search query for: ${title}`);
  
  const systemPrompt = `You are a search query optimizer for prediction markets. Given a market title, generate the most effective 1-3 word search query that would find this exact market on another platform.

Rules:
- Extract ONLY key entities: names, teams, dates, specific numbers
- Remove generic words: will, be, the, to, in, on, at, of
- Keep proper nouns and identifiers
- For sports: include team names
- For politics: include person names and countries
- For crypto: include token symbols
- Return ONLY the search query, nothing else
- Maximum 3 words`;

  const result = await callClaude(systemPrompt, title, 20);
  
  if (result) {
    console.log(`[AI] Generated search query: ${result}`);
    return result.trim();
  }
  
  // Fallback: extract first 2-3 significant words
  return title.split(' ').filter(w => w.length > 3).slice(0, 3).join(' ');
}

// Search Polymarket via Gamma API
async function searchPolymarket(query: string): Promise<{ markets: MarketData[]; rawResponse: any; url: string }> {
  const url = `${GAMMA_API_BASE}/events?_q=${encodeURIComponent(query)}&active=true&closed=false&limit=10`;
  
  try {
    console.log(`[Polymarket] Searching via Gamma: ${query}`);
    console.log(`[Polymarket] URL: ${url}`);
    
    const response = await fetch(url);
    const rawText = await response.text();
    let rawResponse: any;
    
    try {
      rawResponse = JSON.parse(rawText);
    } catch {
      console.error(`[Polymarket] Invalid JSON search response`);
      return { markets: [], rawResponse: rawText.slice(0, 1000), url };
    }

    if (!response.ok) {
      console.error(`[Polymarket] Search failed: ${response.status}`);
      return { markets: [], rawResponse, url };
    }

    const events = rawResponse;
    console.log(`[Polymarket] Gamma search found ${events?.length || 0} results`);

    if (!events || !Array.isArray(events)) {
      return { markets: [], rawResponse, url };
    }

    const markets: MarketData[] = [];
    
    for (const event of events.slice(0, 5)) {
      const eventMarkets = event.markets || [];
      for (const market of eventMarkets.slice(0, 3)) {
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
        
        markets.push({
          platform: 'polymarket',
          title: market.question || event.title || '',
          eventTitle: event.title,
          slug: event.slug || event.id || '',
          yesPrice,
          noPrice,
          volume: parseFloat(market.volume) || parseFloat(event.volume) || 0,
          url: `https://polymarket.com/event/${event.slug || event.id}`,
          tokenId: market.clobTokenIds?.[0] || market.conditionId
        });
      }
    }

    return { markets, rawResponse, url };
  } catch (error) {
    console.error(`[Polymarket] Search error:`, error);
    return { markets: [], rawResponse: { error: String(error) }, url };
  }
}

// Search Kalshi via DFlow API using /search endpoint
async function searchKalshi(query: string): Promise<{ markets: MarketData[]; rawResponse: any; url: string }> {
  const url = `${DFLOW_BASE_URL}/search?q=${encodeURIComponent(query)}`;
  
  try {
    console.log(`[Kalshi] Searching: ${query}`);
    console.log(`[Kalshi] URL: ${url}`);
    
    const response = await fetch(url, {
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
      console.error(`[Kalshi] Invalid JSON search response`);
      return { markets: [], rawResponse: rawText.slice(0, 1000), url };
    }

    if (!response.ok) {
      console.error(`[Kalshi] Search failed: ${response.status}`, rawResponse);
      return { markets: [], rawResponse, url };
    }

    const events = rawResponse.events || rawResponse.data || rawResponse || [];
    console.log(`[Kalshi] Found ${events.length} events`);

    const markets: MarketData[] = [];
    for (const event of events.slice(0, 5)) {
      const eventMarkets = event.markets || [];
      for (const market of eventMarkets.slice(0, 5)) {
        markets.push({
          platform: 'kalshi',
          title: market.title || market.subtitle || '',
          eventTitle: event.title,
          slug: market.ticker || '',
          yesPrice: market.yes_price || market.last_price || 0.5,
          noPrice: market.no_price || (1 - (market.yes_price || market.last_price || 0.5)),
          volume: market.volume,
          url: `https://kalshi.com/markets/${market.ticker}`,
          ticker: market.ticker
        });
      }
    }

    console.log(`[Kalshi] Total markets found: ${markets.length}`);
    return { markets, rawResponse, url };
  } catch (error) {
    console.error(`[Kalshi] Search error:`, error);
    return { markets: [], rawResponse: { error: String(error) }, url };
  }
}

// AI analysis to determine if markets match and calculate arbitrage using Claude
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

  // Parse JSON from response
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
    
    // Recalculate arbitrage with actual prices if AI found one
    let arbitrage = null;
    const sourceYes = source.yesPrice;
    const sourceNo = source.noPrice;
    const targetYes = matchedMarket.yesPrice;
    const targetNo = matchedMarket.noPrice;

    // Find best prices
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
      // No arbitrage opportunity exists
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

    // Parse the URL
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

    console.log(`[ArbitrageFinder] Detected ${parsed.platform} with slug: ${parsed.slug}`);

    // Fetch source market data
    let sourceMarket: MarketData | null = null;
    let allSourceMarkets: MarketData[] = [];
    
    if (parsed.platform === 'polymarket') {
      const result = await fetchPolymarketData(parsed.slug);
      sourceMarket = result.primaryMarket;
      allSourceMarkets = result.allMarkets;
      debug.sourceApiResponse = result.rawResponse;
      debug.allSourceMarkets = result.allMarkets;
    } else {
      const result = await fetchKalshiData(parsed.slug);
      sourceMarket = result.primaryMarket;
      allSourceMarkets = result.allMarkets;
      debug.sourceApiResponse = result.rawResponse;
      debug.allSourceMarkets = result.allMarkets;
    }

    if (!sourceMarket) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Could not fetch market data. The market may not exist or the API may be unavailable.',
        debug
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ArbitrageFinder] Source market: ${sourceMarket.title}`);

    // Generate search query
    const searchQuery = await generateSearchQuery(sourceMarket.title);

    // Search the OTHER platform
    let searchResults: MarketData[] = [];
    if (parsed.platform === 'polymarket') {
      const result = await searchKalshi(searchQuery);
      searchResults = result.markets;
      debug.kalshiSearchUrl = result.url;
      debug.kalshiResponse = result.rawResponse;
      debug.allCandidateMarkets = result.markets;
    } else {
      const result = await searchPolymarket(searchQuery);
      searchResults = result.markets;
      debug.polymarketSearchUrl = result.url;
      debug.polymarketResponse = result.rawResponse;
      debug.allCandidateMarkets = result.markets;
    }

    debug.candidateTitles = searchResults.map(r => `${r.title} (YES: ${(r.yesPrice*100).toFixed(1)}¢)`);
    console.log(`[ArbitrageFinder] Found ${searchResults.length} candidates`);

    // Analyze for arbitrage
    const { matchedMarket, arbitrage, reasoning, aiInput, aiOutput } = await analyzeArbitrage(sourceMarket, searchResults);
    
    debug.reasoning = reasoning;
    debug.aiInput = aiInput;
    debug.aiOutput = aiOutput;

    return new Response(JSON.stringify({
      success: true,
      sourceMarket,
      sourceMarkets: allSourceMarkets,
      matchedMarket,
      arbitrage,
      searchQuery,
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
