import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Edge function to fetch open orders from Polymarket CLOB API.
 * Enriches orders with market titles for better UX.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOB_HOST = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Generate L2 HMAC headers for Polymarket CLOB API
 */
function generateL2Headers(
  method: string,
  pathOnly: string,
  address: string,
  apiCreds: { apiKey: string; secret: string; passphrase: string }
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + pathOnly;
  
  console.log(`[HMAC] Signing message: "${message}"`);

  const secretBuffer = Buffer.from(apiCreds.secret, "base64");
  const signature = createHmac("sha256", secretBuffer)
    .update(message)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return {
    "POLY_ADDRESS": address.toLowerCase(),
    "POLY_SIGNATURE": signature,
    "POLY_TIMESTAMP": timestamp,
    "POLY_API_KEY": apiCreds.apiKey,
    "POLY_PASSPHRASE": apiCreds.passphrase,
  };
}

/**
 * Fetch market info from Gamma API to get title for a token
 * Tries multiple endpoints for better coverage
 * IMPORTANT: Token IDs are very long (78 chars) - must use full ID for accurate lookups
 */
async function fetchMarketInfo(tokenId: string, conditionId?: string): Promise<{ title?: string; outcome?: string } | null> {
  console.log('[Get Open Orders] Looking up market info for token:', tokenId);
  console.log('[Get Open Orders] Condition ID:', conditionId || 'not provided');
  
  try {
    // Try 1: Direct token endpoint - most reliable for specific token lookups
    let response = await fetch(`${GAMMA_API}/tokens/${tokenId}`);
    if (response.ok) {
      const token = await response.json();
      if (token && (token.question || token.market_question)) {
        console.log('[Get Open Orders] Found market via tokens endpoint:', token.question?.slice(0, 50) || token.market_question?.slice(0, 50));
        return {
          title: token.question || token.market_question,
          outcome: token.outcome,
        };
      }
    }

    // Try 2: Markets endpoint with asset_id - may return multiple markets
    response = await fetch(`${GAMMA_API}/markets?asset_id=${tokenId}`);
    if (response.ok) {
      const markets = await response.json();
      if (markets && markets.length > 0) {
        // Find the market that actually contains this token ID
        const matchingMarket = markets.find((m: { clobTokenIds?: string[] }) => 
          m.clobTokenIds?.includes(tokenId)
        );
        
        if (matchingMarket) {
          console.log('[Get Open Orders] Found matching market via markets endpoint:', matchingMarket.question?.slice(0, 50));
          return {
            title: matchingMarket.question || matchingMarket.title || matchingMarket.groupItemTitle,
            outcome: matchingMarket.outcome || (matchingMarket.groupItemTitle?.includes('Yes') ? 'Yes' : matchingMarket.groupItemTitle?.includes('No') ? 'No' : undefined),
          };
        }
        
        console.log('[Get Open Orders] Markets endpoint returned results but none matched token ID exactly');
      }
    }

    // Try 3: Events endpoint by token
    response = await fetch(`${GAMMA_API}/events?token_id=${tokenId}`);
    if (response.ok) {
      const events = await response.json();
      if (events && events.length > 0) {
        const event = events[0];
        const matchingMarket = event.markets?.find((m: { clobTokenIds?: string[] }) => 
          m.clobTokenIds?.includes(tokenId)
        );
        if (matchingMarket) {
          console.log('[Get Open Orders] Found market via events endpoint:', matchingMarket.question?.slice(0, 50));
          return {
            title: matchingMarket.question || event.title,
            outcome: matchingMarket.outcome,
          };
        }
        console.log('[Get Open Orders] Events endpoint returned but no matching market found');
      }
    }

    // Try 4: If we have a condition ID, try looking it up
    if (conditionId && conditionId.startsWith('0x')) {
      console.log('[Get Open Orders] Trying condition_id lookup:', conditionId.slice(0, 20));
      
      // Try markets endpoint with condition_id
      response = await fetch(`${GAMMA_API}/markets?condition_id=${conditionId}`);
      if (response.ok) {
        const markets = await response.json();
        if (markets && markets.length > 0) {
          const market = markets[0];
          console.log('[Get Open Orders] Found market via condition_id:', market.question?.slice(0, 50));
          return {
            title: market.question || market.title || market.groupItemTitle,
            outcome: market.outcome,
          };
        }
      }
      
      // Try events endpoint with condition_id
      response = await fetch(`${GAMMA_API}/events?condition_id=${conditionId}`);
      if (response.ok) {
        const events = await response.json();
        if (events && events.length > 0 && events[0].markets?.length > 0) {
          const market = events[0].markets[0];
          console.log('[Get Open Orders] Found market via events condition_id:', market.question?.slice(0, 50));
          return {
            title: market.question || events[0].title,
            outcome: market.outcome,
          };
        }
      }
    }

    console.log('[Get Open Orders] No market info found for token:', tokenId);
    return null;
  } catch (e) {
    console.error('[Get Open Orders] Failed to fetch market info:', e);
    return null;
  }
}

/**
 * Check if a string looks like a hex hash (condition ID, tx hash, etc.)
 */
function isHexHash(str: string): boolean {
  return str.startsWith('0x') && str.length >= 40;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiCreds, walletAddress, market } = await req.json();

    if (!walletAddress) {
      return json(400, { error: "Missing wallet address" });
    }

    if (!apiCreds?.secret || !apiCreds?.apiKey || !apiCreds?.passphrase) {
      return json(400, { error: "Missing API credentials (apiKey, secret, passphrase)" });
    }

    console.log("[Get Open Orders] Fetching orders for wallet:", walletAddress);

    const pathOnly = "/data/orders";
    
    const params = new URLSearchParams();
    params.set("state", "LIVE");
    params.set("maker", walletAddress.toLowerCase());
    if (market) params.set("market", market);

    const queryString = params.toString();
    const fullUrl = `${CLOB_HOST}${pathOnly}?${queryString}`;

    console.log("[Get Open Orders] Full URL:", fullUrl);

    const l2Headers = generateL2Headers("GET", pathOnly, walletAddress, apiCreds);

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...l2Headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Get Open Orders] API error:", response.status, errorText);
      
      return json(response.status, { 
        error: `Polymarket API error: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    const orders = Array.isArray(data) ? data : (data.orders || data.data || []);
    
    console.log("[Get Open Orders] Fetched", orders.length, "open orders");

    // Enrich orders with market titles
    const enrichedOrders = await Promise.all(
      orders.map(async (order: { asset_id?: string; market?: string; outcome?: string; [key: string]: unknown }) => {
        const tokenId = order.asset_id;
        const conditionId = order.market; // order.market is the condition ID
        if (!tokenId) return order;
        
        const marketInfo = await fetchMarketInfo(tokenId, conditionId);
        
        // Determine the final title - NEVER show a hex hash
        let finalTitle = marketInfo?.title;
        if (!finalTitle) {
          // Check if order.market is a hex hash (condition ID) - don't use it as title
          if (conditionId && isHexHash(conditionId)) {
            finalTitle = 'Unknown Market';
          } else {
            finalTitle = conditionId || 'Unknown Market';
          }
        }
        
        return {
          ...order,
          market_title: finalTitle,
          outcome: marketInfo?.outcome || order.outcome,
        };
      })
    );

    console.log("[Get Open Orders] Enriched orders with market titles");
    
    return json(200, { orders: enrichedOrders });
  } catch (error: unknown) {
    console.error("[Get Open Orders] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message });
  }
});

