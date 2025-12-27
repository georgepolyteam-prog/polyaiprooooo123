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

// Fetch current price from Dome API market-price endpoint
async function fetchCurrentPrice(tokenId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${DOME_API_BASE}/polymarket/market-price/${encodeURIComponent(tokenId)}`,
      { headers: getHeaders() }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.price || null;
  } catch {
    return null;
  }
}

// Fetch market by condition_id from Gamma API - now also fetches EVENT image (fixes wrong images)
async function fetchByConditionId(conditionId: string): Promise<any | null> {
  try {
    // Step 1: Fetch market data
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`
    );
    if (!response.ok) return null;
    const markets = await response.json();
    const market = markets?.[0];
    if (!market) return null;

    console.log(`[Market Previews] conditionId=${conditionId}, market.slug=${market.slug}, eventSlug candidates:`, {
      eventSlug: market.eventSlug,
      event_slug: market.event_slug,
      groupSlug: market.groupSlug
    });

    // Step 2: Try to get event slug from the market
    const eventSlug = market.eventSlug || market.event_slug || market.groupSlug || market.groupItemTitle;
    
    let eventImage: string | null = null;
    let eventIcon: string | null = null;
    
    // Step 3: If we have an event slug, fetch event data for the correct image
    if (eventSlug) {
      try {
        const eventResponse = await fetch(
          `https://gamma-api.polymarket.com/events?slug=${eventSlug}`
        );
        if (eventResponse.ok) {
          const events = await eventResponse.json();
          const event = events?.[0];
          if (event) {
            eventImage = event.image;
            eventIcon = event.icon;
            console.log(`[Market Previews] Fetched event for ${conditionId}: image=${event.image}, icon=${event.icon}`);
          }
        }
      } catch (e) {
        console.log(`[Market Previews] Failed to fetch event for ${eventSlug}:`, e);
      }
    }

    // Step 4: Find best image - PREFER EVENT IMAGE (same as Markets/Chat pages)
    let image = null;
    const possibleImages = [
      eventImage,      // Event image first (most reliable, what Markets/Chat use)
      eventIcon,       // Event icon 
      market.image,    // Market image (can be stale/wrong)
      market.icon      // Market icon
    ];
    
    for (const img of possibleImages) {
      if (img && typeof img === 'string' && img.startsWith('http')) {
        image = img;
        break;
      }
    }

    console.log(`[Market Previews] Final image for ${conditionId}: ${image} (source: ${
      image === eventImage ? 'event.image' : 
      image === eventIcon ? 'event.icon' : 
      image === market.image ? 'market.image' : 
      image === market.icon ? 'market.icon' : 'none'
    })`);

    return {
      slug: market.market_slug || market.slug,
      conditionId: conditionId,
      title: market.question || market.title,
      image,
    };
  } catch (e) {
    console.error(`[Market Previews] Error fetching conditionId ${conditionId}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { eventSlugs, conditionIds } = body;
    
    // Support both eventSlugs and conditionIds
    const hasEventSlugs = eventSlugs && Array.isArray(eventSlugs) && eventSlugs.length > 0;
    const hasConditionIds = conditionIds && Array.isArray(conditionIds) && conditionIds.length > 0;
    
    if (!hasEventSlugs && !hasConditionIds) {
      return new Response(
        JSON.stringify({ error: "eventSlugs or conditionIds array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Market Previews] Fetching eventSlugs=${eventSlugs?.length || 0}, conditionIds=${conditionIds?.length || 0}`);

    const results: any[] = [];

    // Fetch by condition IDs (faster, more reliable for trade data)
    if (hasConditionIds) {
      const conditionResults = await Promise.all(
        conditionIds.slice(0, 20).map(async (conditionId: string) => {
          // Skip if it looks like a slug (no 0x prefix)
          if (!conditionId.startsWith('0x')) return null;
          return fetchByConditionId(conditionId);
        })
      );
      
      for (const result of conditionResults) {
        if (result) results.push(result);
      }
    }

    // Fetch by event slugs
    if (hasEventSlugs) {
      const slugResults = await Promise.all(
        eventSlugs.slice(0, 20).map(async (slug: string) => {
          // Skip if it looks like a condition_id (0x prefix)
          if (slug.startsWith('0x')) return null;
          
          try {
            // Use Gamma API to get event structure
            const gammaResponse = await fetch(
              `https://gamma-api.polymarket.com/events?slug=${slug}`
            );
            
            if (!gammaResponse.ok) {
              // Try as market slug instead
              const marketResponse = await fetch(
                `https://gamma-api.polymarket.com/markets?slug=${slug}`
              );
              if (!marketResponse.ok) return null;
              
              const markets = await marketResponse.json();
              const market = markets?.[0];
              if (!market) return null;
              
              let image = null;
              const possibleImages = [market.image, market.icon];
              for (const img of possibleImages) {
                if (img && typeof img === 'string' && img.startsWith('http')) {
                  image = img;
                  break;
                }
              }
              
              return {
                slug,
                conditionId: market.condition_id || market.conditionId,
                title: market.question || market.title,
                image,
              };
            }
            
            const events = await gammaResponse.json();
            const event = events?.[0];
            
            if (!event) return null;

            const rawMarkets = event.markets || [];
            
            // Filter out closed, resolved, or inactive markets
            const activeMarkets = rawMarkets.filter((market: any) => {
              if (market.closed === true || market.closed === 'true') return false;
              if (market.resolved === true || market.resolved === 'true') return false;
              if (market.acceptingOrders === false) return false;
              
              // Skip expired markets
              if (market.endDate) {
                try {
                  const endDate = new Date(market.endDate);
                  if (endDate < new Date()) return false;
                } catch { /* ignore parse errors */ }
              }
              return true;
            });

            // Deduplicate by conditionId
            const seenConditionIds = new Set<string>();
            const uniqueMarkets = activeMarkets.filter((market: any) => {
              if (market.conditionId) {
                if (seenConditionIds.has(market.conditionId)) return false;
                seenConditionIds.add(market.conditionId);
              }
              return true;
            });

            const marketCount = uniqueMarkets.length || 1;
            const isMultiMarket = marketCount > 1;

            // Sort markets by volume to get the most active one
            const sortedMarkets = [...uniqueMarkets].sort(
              (a: any, b: any) => parseFloat(b.volume || 0) - parseFloat(a.volume || 0)
            );
            const topMarket = sortedMarkets[0] || rawMarkets[0];

            if (!topMarket) return null;

            // Find YES token by outcome property
            const tokens = topMarket.tokens || [];
            const yesToken = tokens.find((t: any) => 
              t.outcome?.toLowerCase() === 'yes' || 
              t.token_label?.toLowerCase() === 'yes' ||
              t.label?.toLowerCase() === 'yes'
            ) || tokens[0];

            // Get live price from Dome API if available
            let odds: number | null = null;
            
            if (DOME_API_KEY && yesToken?.token_id) {
              const livePrice = await fetchCurrentPrice(yesToken.token_id);
              if (livePrice !== null) {
                odds = Math.round(livePrice * 100);
              }
            }
            
            // Fallback to Gamma API price
            if (odds === null && topMarket.outcomePrices) {
              try {
                const prices = typeof topMarket.outcomePrices === 'string'
                  ? JSON.parse(topMarket.outcomePrices)
                  : topMarket.outcomePrices;
                odds = Math.round(parseFloat(prices[0]) * 100);
              } catch { /* ignore */ }
            }

            // Get total event volume
            const volume = event.volume ? parseFloat(event.volume) : null;

            // Find best image
            let image = null;
            const possibleImages = [
              event.image,
              topMarket?.image,
              event.icon,
              topMarket?.icon,
            ];
            
            for (const img of possibleImages) {
              if (img && typeof img === 'string' && img.startsWith('http')) {
                image = img;
                break;
              }
            }

            return {
              slug,
              conditionId: topMarket.conditionId || topMarket.condition_id,
              title: event.title,
              subtitle: isMultiMarket 
                ? `${marketCount} outcomes` 
                : topMarket?.question?.slice(0, 50),
              odds,
              volume,
              image,
              isMultiMarket,
              marketCount,
            };
          } catch (err) {
            console.error(`[Market Previews] Error fetching ${slug}:`, err);
            return null;
          }
        })
      );
      
      for (const result of slugResults) {
        if (result) results.push(result);
      }
    }

    console.log(`[Market Previews] Returning ${results.length} results`);

    return new Response(
      JSON.stringify({ markets: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Market Previews] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
