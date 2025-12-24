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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventSlugs } = await req.json();
    
    if (!eventSlugs || !Array.isArray(eventSlugs)) {
      return new Response(
        JSON.stringify({ error: "eventSlugs array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Market Previews] Fetching ${eventSlugs.length} markets via Dome API`);

    if (!DOME_API_KEY) {
      console.log("[Market Previews] No Dome API key, falling back to Gamma API");
    }

    const results = await Promise.all(
      eventSlugs.map(async (slug: string) => {
        try {
          // Use Gamma API to get event structure (same as market-dashboard)
          const gammaResponse = await fetch(
            `https://gamma-api.polymarket.com/events?slug=${slug}`
          );
          
          if (!gammaResponse.ok) {
            console.log(`[Market Previews] Gamma API failed for ${slug}: ${gammaResponse.status}`);
            return null;
          }
          
          const events = await gammaResponse.json();
          const event = events?.[0];
          
          if (!event) {
            console.log(`[Market Previews] No event found for ${slug}`);
            return null;
          }

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

          if (!topMarket) {
            console.log(`[Market Previews] No markets in event ${slug}`);
            return null;
          }

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
              console.log(`[Market Previews] ${slug}: live price from Dome = ${odds}%`);
            }
          }
          
          // Fallback to Gamma API price
          if (odds === null && topMarket.outcomePrices) {
            try {
              const prices = typeof topMarket.outcomePrices === 'string'
                ? JSON.parse(topMarket.outcomePrices)
                : topMarket.outcomePrices;
              odds = Math.round(parseFloat(prices[0]) * 100);
              console.log(`[Market Previews] ${slug}: fallback price from Gamma = ${odds}%`);
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

          console.log(`[Market Previews] ${slug}: raw=${rawMarkets.length}, filtered=${marketCount}, odds=${odds}%, isMulti=${isMultiMarket}`);

          return {
            slug,
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
