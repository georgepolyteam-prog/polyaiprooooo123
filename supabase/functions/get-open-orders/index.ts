import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Edge function to fetch open orders from Polymarket CLOB API.
 * 
 * This requires L2 authentication headers (HMAC signature).
 * We generate the signature here and make the API call server-side
 * to avoid CORS issues.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOB_HOST = "https://clob.polymarket.com";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Generate L2 HMAC headers for Polymarket CLOB API
 * CRITICAL: Must match Polymarket SDK behavior exactly:
 * 1. Decode secret from base64 before use as HMAC key
 * 2. Sign only the path (without query params)
 * 3. Message format: timestamp + METHOD + path (NO body for GET)
 * 4. Output as URL-safe base64
 */
function generateL2Headers(
  method: string,
  pathOnly: string, // path WITHOUT query params
  address: string,
  apiCreds: { apiKey: string; secret: string; passphrase: string }
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Message format: timestamp + method + path (no query params, no body for GET)
  const message = timestamp + method.toUpperCase() + pathOnly;
  
  console.log(`[HMAC] Signing message: "${message}"`);

  // CRITICAL: Decode the secret from base64 before use as HMAC key
  const secretBuffer = Buffer.from(apiCreds.secret, "base64");

  // Generate HMAC-SHA256 and convert to URL-safe base64
  const signature = createHmac("sha256", secretBuffer)
    .update(message)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return {
    "POLY-ADDRESS": address.toLowerCase(),
    "POLY-SIGNATURE": signature,
    "POLY-TIMESTAMP": timestamp,
    "POLY-API-KEY": apiCreds.apiKey,
    "POLY-PASSPHRASE": apiCreds.passphrase,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiCreds, walletAddress, market } = await req.json();

    // Validate wallet address
    if (!walletAddress) {
      return json(400, { error: "Missing wallet address" });
    }

    // Validate API credentials
    if (!apiCreds?.secret || !apiCreds?.apiKey || !apiCreds?.passphrase) {
      return json(400, { error: "Missing API credentials (apiKey, secret, passphrase)" });
    }

    console.log("[Get Open Orders] Fetching orders for wallet:", walletAddress);

    // CRITICAL: Sign only the path, query params are added to URL but NOT signed
    const pathOnly = "/data/orders";
    
    // Build query parameters for open orders
    const params = new URLSearchParams();
    params.set("state", "LIVE"); // Only get live (open) orders
    params.set("maker", walletAddress.toLowerCase()); // Filter by user
    if (market) params.set("market", market);

    const queryString = params.toString();
    const fullUrl = `${CLOB_HOST}${pathOnly}?${queryString}`;

    console.log("[Get Open Orders] Full URL:", fullUrl);
    console.log("[Get Open Orders] Signing path only:", pathOnly);

    // Generate L2 authentication headers (signing pathOnly, not query params)
    const l2Headers = generateL2Headers("GET", pathOnly, walletAddress, apiCreds);

    // Make the API request
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
      
      // Try alternative endpoint if first fails
      if (response.status === 401 || response.status === 404) {
        console.log("[Get Open Orders] Trying alternative endpoint /orders...");
        return await tryAlternativeEndpoint(walletAddress, apiCreds, market);
      }
      
      return json(response.status, { 
        error: `Polymarket API error: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    const orders = Array.isArray(data) ? data : (data.orders || data.data || []);
    
    console.log("[Get Open Orders] Fetched", orders.length, "open orders");

    // Filter orders owned by the user (safety check)
    const userOrders = orders.filter((o: { owner?: string; maker?: string }) => {
      const owner = (o.owner || o.maker || '').toLowerCase();
      return owner === walletAddress.toLowerCase();
    });

    console.log("[Get Open Orders] User's orders:", userOrders.length);

    return json(200, { orders: userOrders });
  } catch (error: unknown) {
    console.error("[Get Open Orders] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message });
  }
});

/**
 * Try alternative /orders endpoint if /data/orders fails
 */
async function tryAlternativeEndpoint(
  walletAddress: string,
  apiCreds: { apiKey: string; secret: string; passphrase: string },
  market?: string
): Promise<Response> {
  try {
    const pathOnly = "/orders";
    
    const params = new URLSearchParams();
    params.set("state", "LIVE");
    params.set("maker", walletAddress.toLowerCase());
    if (market) params.set("market", market);

    const queryString = params.toString();
    const fullUrl = `${CLOB_HOST}${pathOnly}?${queryString}`;

    console.log("[Get Open Orders] Alt URL:", fullUrl);
    console.log("[Get Open Orders] Alt signing path:", pathOnly);

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
      console.error("[Get Open Orders] Alt endpoint error:", response.status, errorText);
      return json(response.status, { 
        error: `Polymarket API error: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    const orders = Array.isArray(data) ? data : (data.orders || data.data || []);
    
    console.log("[Get Open Orders] Alt endpoint returned", orders.length, "orders");

    const userOrders = orders.filter((o: { owner?: string; maker?: string }) => {
      const owner = (o.owner || o.maker || '').toLowerCase();
      return owner === walletAddress.toLowerCase();
    });

    return json(200, { orders: userOrders });
  } catch (error: unknown) {
    console.error("[Get Open Orders] Alt endpoint error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message });
  }
}
