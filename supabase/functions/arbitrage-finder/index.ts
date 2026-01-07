import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOME_API_KEY = Deno.env.get('DOME_API_KEY');
const DFLOW_API_KEY = Deno.env.get('DFLOW_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const DOME_BASE_URL = 'https://api.domeapi.io/v1';
const DFLOW_BASE_URL = 'https://a.prediction-markets-api.dflow.net/api/v1';
const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface MarketData {
  platform: 'polymarket' | 'kalshi';
  title: string;
  slug: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
  url: string;
}

// Parse URL to detect platform and extract identifier
function parseMarketUrl(url: string): { platform: 'polymarket' | 'kalshi'; slug: string } | null {
  try {
    const parsed = new URL(url);
    
    if (parsed.hostname.includes('polymarket.com')) {
      // Format: polymarket.com/event/slug or polymarket.com/event/slug/submarket
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'event' && pathParts[1]) {
        return { platform: 'polymarket', slug: pathParts[1] };
      }
    }
    
    if (parsed.hostname.includes('kalshi.com')) {
      // Format: kalshi.com/markets/ticker or kalshi.com/events/event-slug
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'markets' && pathParts[1]) {
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

// Fetch Polymarket event data via Dome API
async function fetchPolymarketData(slug: string): Promise<MarketData | null> {
  try {
    console.log(`[Polymarket] Fetching event: ${slug}`);
    
    const response = await fetch(`${DOME_BASE_URL}/polymarket/events/${slug}`, {
      headers: {
        'Authorization': `Bearer ${DOME_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[Polymarket] Failed to fetch event: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[Polymarket] Event data:`, JSON.stringify(data).slice(0, 500));

    // Extract primary market from event
    const event = data.event || data;
    const markets = event.markets || [];
    const primaryMarket = markets[0] || {};
    
    const yesPrice = primaryMarket.outcomePrices?.[0] || primaryMarket.yes_price || primaryMarket.bestBid || 0.5;
    const noPrice = primaryMarket.outcomePrices?.[1] || primaryMarket.no_price || primaryMarket.bestAsk || 0.5;

    return {
      platform: 'polymarket',
      title: event.title || primaryMarket.question || slug,
      slug: slug,
      yesPrice: typeof yesPrice === 'number' ? yesPrice : parseFloat(yesPrice) || 0.5,
      noPrice: typeof noPrice === 'number' ? noPrice : parseFloat(noPrice) || 0.5,
      volume: event.volume || primaryMarket.volume,
      url: `https://polymarket.com/event/${slug}`
    };
  } catch (error) {
    console.error(`[Polymarket] Error fetching data:`, error);
    return null;
  }
}

// Fetch Kalshi market data via DFlow API
async function fetchKalshiData(ticker: string): Promise<MarketData | null> {
  try {
    console.log(`[Kalshi] Fetching market: ${ticker}`);
    
    // Try getting market by ticker
    const response = await fetch(`${DFLOW_BASE_URL}/markets/${ticker.toUpperCase()}`, {
      headers: {
        'Authorization': `Bearer ${DFLOW_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[Kalshi] Failed to fetch market: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[Kalshi] Market data:`, JSON.stringify(data).slice(0, 500));

    const market = data.market || data;
    
    return {
      platform: 'kalshi',
      title: market.title || market.subtitle || ticker,
      slug: market.ticker || ticker,
      yesPrice: market.yes_price || market.last_price || 0.5,
      noPrice: market.no_price || (1 - (market.yes_price || market.last_price || 0.5)),
      volume: market.volume || market.volume_24h,
      url: `https://kalshi.com/markets/${ticker}`
    };
  } catch (error) {
    console.error(`[Kalshi] Error fetching data:`, error);
    return null;
  }
}

// Generate optimal search query using AI
async function generateSearchQuery(title: string): Promise<string> {
  try {
    console.log(`[AI] Generating search query for: ${title}`);
    
    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a search query optimizer for prediction markets. Given a market title, generate the most effective 1-3 word search query that would find this exact market on another platform.

Rules:
- Extract ONLY key entities: names, teams, dates, specific numbers
- Remove generic words: will, be, the, to, in, on, at, of
- Keep proper nouns and identifiers
- For sports: include team names
- For politics: include person names
- For crypto: include token symbols
- Return ONLY the search query, nothing else
- Maximum 3 words`
          },
          {
            role: 'user',
            content: title
          }
        ],
        max_tokens: 20
      })
    });

    if (!response.ok) {
      console.error(`[AI] Search query generation failed: ${response.status}`);
      // Fallback: extract first 2-3 significant words
      return title.split(' ').slice(0, 3).join(' ');
    }

    const data = await response.json();
    const query = data.choices?.[0]?.message?.content?.trim() || title.split(' ').slice(0, 3).join(' ');
    console.log(`[AI] Generated search query: ${query}`);
    return query;
  } catch (error) {
    console.error(`[AI] Error generating search query:`, error);
    return title.split(' ').slice(0, 3).join(' ');
  }
}

// Search Polymarket via Dome API
async function searchPolymarket(query: string): Promise<MarketData[]> {
  try {
    console.log(`[Polymarket] Searching: ${query}`);
    
    const response = await fetch(`${DOME_BASE_URL}/polymarket/events?search=${encodeURIComponent(query)}&limit=10`, {
      headers: {
        'Authorization': `Bearer ${DOME_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[Polymarket] Search failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const events = data.events || data.data || data || [];
    console.log(`[Polymarket] Found ${events.length} results`);

    return events.slice(0, 5).map((event: any) => {
      const markets = event.markets || [];
      const primaryMarket = markets[0] || {};
      const yesPrice = primaryMarket.outcomePrices?.[0] || primaryMarket.yes_price || 0.5;
      
      return {
        platform: 'polymarket' as const,
        title: event.title || primaryMarket.question || '',
        slug: event.slug || event.id || '',
        yesPrice: typeof yesPrice === 'number' ? yesPrice : parseFloat(yesPrice) || 0.5,
        noPrice: 1 - (typeof yesPrice === 'number' ? yesPrice : parseFloat(yesPrice) || 0.5),
        volume: event.volume,
        url: `https://polymarket.com/event/${event.slug || event.id}`
      };
    });
  } catch (error) {
    console.error(`[Polymarket] Search error:`, error);
    return [];
  }
}

// Search Kalshi via DFlow API
async function searchKalshi(query: string): Promise<MarketData[]> {
  try {
    console.log(`[Kalshi] Searching: ${query}`);
    
    const response = await fetch(`${DFLOW_BASE_URL}/events?status=active&search=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${DFLOW_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[Kalshi] Search failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const events = data.events || data.data || data || [];
    console.log(`[Kalshi] Found ${events.length} events`);

    // Flatten all markets from events
    const markets: MarketData[] = [];
    for (const event of events.slice(0, 5)) {
      const eventMarkets = event.markets || [];
      for (const market of eventMarkets.slice(0, 2)) {
        markets.push({
          platform: 'kalshi',
          title: market.title || event.title || '',
          slug: market.ticker || '',
          yesPrice: market.yes_price || market.last_price || 0.5,
          noPrice: market.no_price || (1 - (market.yes_price || market.last_price || 0.5)),
          volume: market.volume,
          url: `https://kalshi.com/markets/${market.ticker}`
        });
      }
    }

    return markets.slice(0, 5);
  } catch (error) {
    console.error(`[Kalshi] Search error:`, error);
    return [];
  }
}

// AI analysis to determine if markets match and calculate arbitrage
async function analyzeArbitrage(source: MarketData, candidates: MarketData[]): Promise<{
  matchedMarket: MarketData | null;
  arbitrage: any;
  reasoning: string;
}> {
  if (candidates.length === 0) {
    return { matchedMarket: null, arbitrage: null, reasoning: 'No candidate markets found' };
  }

  try {
    console.log(`[AI] Analyzing ${candidates.length} candidates for arbitrage`);

    const candidateList = candidates.map((c, i) => 
      `${i + 1}. "${c.title}" - YES: ${(c.yesPrice * 100).toFixed(1)}¢, NO: ${(c.noPrice * 100).toFixed(1)}¢`
    ).join('\n');

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at matching prediction markets across platforms and identifying arbitrage opportunities.

Your task:
1. Determine which candidate market (if any) is the SAME event as the source
2. If a match is found, calculate if there's an arbitrage opportunity
3. Return structured JSON

Arbitrage calculation:
- If Source YES price < Target NO price (or vice versa), there's potential arb
- Total cost = Best YES price + Best NO price across platforms
- If total cost < $1.00, profit = $1.00 - total cost
- Profit % = (profit / total cost) * 100

Response must be valid JSON:
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
}`
          },
          {
            role: 'user',
            content: `SOURCE MARKET (${source.platform}):
Title: "${source.title}"
YES Price: ${(source.yesPrice * 100).toFixed(1)}¢
NO Price: ${(source.noPrice * 100).toFixed(1)}¢

CANDIDATE MARKETS (${candidates[0]?.platform}):
${candidateList}

Analyze which candidate (if any) matches the source, and calculate arbitrage opportunity.`
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      console.error(`[AI] Analysis failed: ${response.status}`);
      return { matchedMarket: null, arbitrage: null, reasoning: 'AI analysis failed' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`[AI] Analysis result:`, content.slice(0, 500));

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { matchedMarket: null, arbitrage: null, reasoning: 'Could not parse AI response' };
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    if (!analysis.isSameMarket || analysis.matchIndex === null || analysis.matchIndex === undefined) {
      return { 
        matchedMarket: null, 
        arbitrage: null, 
        reasoning: analysis.reasoning || 'No matching market found' 
      };
    }

    const matchedMarket = candidates[analysis.matchIndex - 1] || candidates[0];
    
    // Recalculate arbitrage with actual prices if AI found one
    let arbitrage = null;
    if (analysis.arbitrage?.exists) {
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
          buyNoOn: sourceNo <= targetNo ? source.platform : matchedMarket.platform,
          buyNoPlatform: sourceNo <= targetNo ? source.platform : matchedMarket.platform,
          buyNoPrice: bestNoPrice,
          totalCost: totalCost,
          guaranteedPayout: 1,
          netProfit: profit,
          profitPercent: profitPercent,
          strategy: `Buy YES on ${sourceYes <= targetYes ? source.platform : matchedMarket.platform} at ${(bestYesPrice * 100).toFixed(1)}¢ + Buy NO on ${sourceNo <= targetNo ? source.platform : matchedMarket.platform} at ${(bestNoPrice * 100).toFixed(1)}¢`,
          reasoning: analysis.reasoning
        };
      }
    }

    return {
      matchedMarket,
      arbitrage,
      reasoning: analysis.reasoning
    };
  } catch (error) {
    console.error(`[AI] Analysis error:`, error);
    return { matchedMarket: null, arbitrage: null, reasoning: 'Analysis error occurred' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log(`[ArbitrageFinder] Processing URL: ${url}`);

    if (!url) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No URL provided' 
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
        error: 'Invalid market URL. Please provide a Polymarket or Kalshi market URL.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ArbitrageFinder] Detected ${parsed.platform} with slug: ${parsed.slug}`);

    // Fetch source market data
    let sourceMarket: MarketData | null = null;
    if (parsed.platform === 'polymarket') {
      sourceMarket = await fetchPolymarketData(parsed.slug);
    } else {
      sourceMarket = await fetchKalshiData(parsed.slug);
    }

    if (!sourceMarket) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Could not fetch market data. The market may not exist or the API may be unavailable.' 
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
      searchResults = await searchKalshi(searchQuery);
    } else {
      searchResults = await searchPolymarket(searchQuery);
    }

    console.log(`[ArbitrageFinder] Found ${searchResults.length} candidates`);

    // Analyze for arbitrage
    const { matchedMarket, arbitrage, reasoning } = await analyzeArbitrage(sourceMarket, searchResults);

    return new Response(JSON.stringify({
      success: true,
      sourceMarket,
      matchedMarket,
      arbitrage,
      searchQuery,
      searchResultsCount: searchResults.length,
      debug: {
        reasoning,
        candidateTitles: searchResults.map(r => r.title)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ArbitrageFinder] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
