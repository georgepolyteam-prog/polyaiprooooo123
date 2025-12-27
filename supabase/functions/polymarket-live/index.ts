import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Builder API key for Polymarket tracking
const BUILDER_API_KEY = Deno.env.get('BUILDER_API_KEY');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Fetching live events from Polymarket with Builder API key...");
    
    // Use CLOB API with Builder key for proper tracking
    const headers: HeadersInit = {
      "Accept": "application/json",
      "Content-Type": "application/json",
    };
    
    // Add Builder API key if available
    if (BUILDER_API_KEY) {
      headers["Authorization"] = `Bearer ${BUILDER_API_KEY}`;
      console.log("Using Builder API key for tracking");
    } else {
      console.log("Warning: No BUILDER_API_KEY found, falling back to gamma-api");
    }
    
    // Try CLOB API first, fallback to gamma-api
    let events;
    try {
      const clobUrl = "https://clob.polymarket.com/markets?active=true&limit=100";
      const response = await fetch(clobUrl, { headers });
      
      if (response.ok) {
        const markets = await response.json();
        console.log(`Fetched ${markets.length} markets from CLOB API`);
        
        // CLOB returns markets directly, transform to match expected format
        const formatted = markets
          .filter((m: any) => {
            if (!m.tokens || m.tokens.length === 0) return false;
            
            const yesToken = m.tokens.find((t: any) => t.outcome === 'Yes');
            const yesPrice = yesToken ? parseFloat(yesToken.price || 0) : 0;
            const volume = parseFloat(m.volume || 0);
            
            // Filter: decent volume and not extreme odds
            if (volume < 10000) return false;
            if (yesPrice > 0.95 || yesPrice < 0.05) return false;
            
            // Skip expired markets
            if (m.end_date_iso) {
              const endDate = new Date(m.end_date_iso);
              if (endDate < new Date()) return false;
            }
            
            return true;
          })
          .map((m: any) => {
            const yesToken = m.tokens?.find((t: any) => t.outcome === 'Yes');
            const noToken = m.tokens?.find((t: any) => t.outcome === 'No');
            const yesPrice = yesToken ? parseFloat(yesToken.price || 0) : 0;
            const noPrice = noToken ? parseFloat(noToken.price || 0) : 1 - yesPrice;
            
            // Extract event slug from market_slug or condition_id
            const eventSlug = m.market_slug || m.condition_id?.slice(0, 20);
            
            return {
              id: m.condition_id || m.id,
              condition_id: m.condition_id,
              question: m.question,
              slug: m.market_slug,
              eventSlug: eventSlug,
              url: `https://polymarket.com/event/${m.market_slug}`,
              yesPrice,
              noPrice,
              volume: parseFloat(m.volume || 0),
              volume24hr: parseFloat(m.volume_24h || m.volume || 0),
              liquidity: parseFloat(m.liquidity || 0),
              endDate: m.end_date_iso,
              category: m.category || "General",
              image: m.image,
              tokenId: yesToken?.token_id,
            };
          })
          .sort((a: any, b: any) => b.volume24hr - a.volume24hr)
          .slice(0, 50);
        
        return new Response(JSON.stringify(formatted), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } catch (clobError) {
      console.log("CLOB API failed, falling back to gamma-api:", clobError);
    }
    
    // Fallback to gamma-api (original implementation)
    const url = "https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&order=volume24hr&ascending=false";
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });
    
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }
    
    events = await response.json();
    console.log(`Fetched ${events.length} events from Polymarket gamma-api`);
    
    // Flatten events into individual markets with CORRECT URLs
    const formatted: any[] = [];
    
    for (const event of events) {
      const eventSlug = event.slug;
      
      if (!event.markets || event.markets.length === 0) continue;
      
      for (const market of event.markets) {
        // Skip if no prices or volume data
        if (!market.outcomePrices) continue;
        
        // Parse prices - can be JSON string or array
        let prices: number[] = [];
        try {
          prices = typeof market.outcomePrices === 'string' 
            ? JSON.parse(market.outcomePrices)
            : market.outcomePrices;
        } catch {
          const priceStr = String(market.outcomePrices);
          prices = priceStr.split(",").map((p: string) => parseFloat(p.replace(/[\[\]"]/g, "")));
        }
        
        const yesPrice = prices[0] || 0;
        const volume = parseFloat(market.volume) || 0;
        const volume24hr = parseFloat(market.volume24hr || market.volume) || 0;
        
        // Filter: decent volume (>$10k) and not extreme odds
        if (volume < 10000) continue;
        if (yesPrice > 0.95 || yesPrice < 0.05) continue;
        
        // FILTER: Skip expired unresolved markets
        const endDate = market.endDate || event.endDate;
        const now = new Date();
        if (endDate) {
          const deadline = new Date(endDate);
          if (deadline < now) {
            console.log(`Skipping expired market: ${market.question}`);
            continue;
          }
        }
        
        // FILTER: Skip 50/50 markets with low volume (likely inactive/expired)
        const is5050 = yesPrice >= 0.49 && yesPrice <= 0.51;
        if (is5050 && volume < 50000) {
          console.log(`Skipping inactive 50/50 market: ${market.question}`);
          continue;
        }
        
        // Extract token ID from clobTokenIds
        let tokenId;
        if (market.clobTokenIds) {
          try {
            const tokenIds = typeof market.clobTokenIds === 'string' 
              ? JSON.parse(market.clobTokenIds) 
              : market.clobTokenIds;
            tokenId = tokenIds[0]; // YES token
          } catch {}
        }
        
        formatted.push({
          id: market.id,
          condition_id: market.conditionId || market.condition_id,
          question: market.question,
          slug: market.slug,
          eventSlug: eventSlug,
          // CORRECT URL FORMAT: /event/{eventSlug}/{marketSlug}
          url: `https://polymarket.com/event/${eventSlug}/${market.slug}`,
          yesPrice: yesPrice,
          noPrice: prices[1] || (1 - yesPrice),
          volume: volume,
          volume24hr: volume24hr,
          liquidity: parseFloat(market.liquidity) || 0,
          endDate: market.endDate || event.endDate,
          category: event.category || market.category || "General",
          image: market.image || event.image,
          tokenId,
        });
      }
    }
    
    // Sort by 24hr volume (most active first)
    formatted.sort((a, b) => b.volume24hr - a.volume24hr);
    
    // Return top 50
    const top50 = formatted.slice(0, 50);
    
    console.log(`Returning ${top50.length} filtered markets with correct URLs`);
    
    return new Response(JSON.stringify(top50), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("polymarket-live error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
