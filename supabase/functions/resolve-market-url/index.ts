import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for resolved URLs (persists during function instance lifetime)
const urlCache = new Map<string, { eventSlug: string; marketSlug: string; fullUrl: string; timestamp: number }>();
const CACHE_TTL_MS = 3600000; // 1 hour

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { marketSlug, conditionId } = await req.json();

    if (!marketSlug && !conditionId) {
      return new Response(
        JSON.stringify({ error: 'Either marketSlug or conditionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cacheKey = marketSlug || conditionId;
    
    // Check cache first
    const cached = urlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`Cache hit for ${cacheKey}`);
      return new Response(
        JSON.stringify({
          eventSlug: cached.eventSlug,
          marketSlug: cached.marketSlug,
          fullUrl: cached.fullUrl,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Gamma API query
    let gammaUrl: string;
    if (marketSlug) {
      gammaUrl = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(marketSlug)}`;
    } else {
      gammaUrl = `https://gamma-api.polymarket.com/markets?condition_id=${encodeURIComponent(conditionId)}`;
    }

    console.log(`Querying Gamma API: ${gammaUrl}`);

    const response = await fetch(gammaUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VeraAI/1.0'
      }
    });

    if (!response.ok) {
      console.error(`Gamma API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to resolve market URL from Gamma API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markets = await response.json();
    
    if (!Array.isArray(markets) || markets.length === 0) {
      console.log('No markets found, trying events endpoint...');
      
      // Try events endpoint as fallback
      const eventsUrl = `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(marketSlug || '')}`;
      const eventsResponse = await fetch(eventsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VeraAI/1.0'
        }
      });
      
      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        if (Array.isArray(events) && events.length > 0) {
          const event = events[0];
          const eventSlug = event.slug || marketSlug;
          const resolvedMarketSlug = event.markets?.[0]?.slug || marketSlug;
          
          const fullUrl = `https://polymarket.com/event/${eventSlug}${resolvedMarketSlug && resolvedMarketSlug !== eventSlug ? '/' + resolvedMarketSlug : ''}`;
          
          // Cache the result
          urlCache.set(cacheKey, {
            eventSlug,
            marketSlug: resolvedMarketSlug,
            fullUrl,
            timestamp: Date.now()
          });
          
          return new Response(
            JSON.stringify({
              eventSlug,
              marketSlug: resolvedMarketSlug,
              fullUrl,
              cached: false
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Last resort: assume marketSlug is the event slug
      const fullUrl = `https://polymarket.com/event/${marketSlug}`;
      return new Response(
        JSON.stringify({
          eventSlug: marketSlug,
          marketSlug: marketSlug,
          fullUrl,
          cached: false,
          warning: 'Could not verify URL, using marketSlug as eventSlug'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const market = markets[0];
    
    // Extract event slug from market data
    // Gamma API returns event info in different fields depending on the endpoint
    let eventSlug = market.event_slug || market.eventSlug;
    const resolvedMarketSlug = market.slug || market.market_slug || marketSlug;
    
    // If no event slug, try to get it from the events relationship
    if (!eventSlug && market.events && Array.isArray(market.events) && market.events.length > 0) {
      eventSlug = market.events[0].slug;
    }
    
    // If still no event slug, query the events endpoint with condition_id
    if (!eventSlug && (market.condition_id || conditionId)) {
      console.log('Fetching event slug from events endpoint...');
      const cid = market.condition_id || conditionId;
      const eventsUrl = `https://gamma-api.polymarket.com/events?active=true&limit=100`;
      const eventsResponse = await fetch(eventsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VeraAI/1.0'
        }
      });
      
      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        // Find event that contains this market
        for (const event of events) {
          if (event.markets?.some((m: any) => m.condition_id === cid || m.slug === resolvedMarketSlug)) {
            eventSlug = event.slug;
            break;
          }
        }
      }
    }
    
    // Fallback: use market slug as event slug if we couldn't find it
    if (!eventSlug) {
      console.log('Could not find event slug, using market slug');
      eventSlug = resolvedMarketSlug;
    }

    // Build the full URL - format: /event/{eventSlug}/{marketSlug}
    // Only include marketSlug in path if it's different from eventSlug
    const fullUrl = eventSlug === resolvedMarketSlug 
      ? `https://polymarket.com/event/${eventSlug}`
      : `https://polymarket.com/event/${eventSlug}/${resolvedMarketSlug}`;

    console.log(`Resolved URL: ${fullUrl}`);

    // Cache the result
    urlCache.set(cacheKey, {
      eventSlug,
      marketSlug: resolvedMarketSlug,
      fullUrl,
      timestamp: Date.now()
    });

    return new Response(
      JSON.stringify({
        eventSlug,
        marketSlug: resolvedMarketSlug,
        fullUrl,
        cached: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error resolving market URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to resolve market URL';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
