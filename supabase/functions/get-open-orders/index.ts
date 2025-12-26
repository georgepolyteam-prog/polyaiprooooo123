import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

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

function generateL2Headers(
  method: string,
  path: string,
  body: string,
  apiCreds: { apiKey: string; secret: string; passphrase: string }
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + body;

  // Polymarket expects standard base64 HMAC output
  const signature = createHmac("sha256", apiCreds.secret).update(message).digest("base64");

  return {
    "POLY-ADDRESS": "", // set per request
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

    // Build query parameters for open orders
    const params = new URLSearchParams();
    params.set("state", "LIVE"); // Only get live (open) orders
    if (market) params.set("market", market);

    const queryString = params.toString();
    const path = `/data/orders?${queryString}`;
    const url = `${CLOB_HOST}${path}`;

    console.log("[Get Open Orders] Fetching orders for wallet:", walletAddress);
    console.log("[Get Open Orders] Path:", path);

    // Generate L2 authentication headers
    const l2Headers = generateL2Headers("GET", path, "", apiCreds);
    l2Headers["POLY-ADDRESS"] = walletAddress.toLowerCase();

    // Make the API request
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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

    const orders = await response.json();
    console.log("[Get Open Orders] Fetched", Array.isArray(orders) ? orders.length : 0, "open orders");

    // Filter orders owned by the user (the API should return only user's orders with auth)
    const userOrders = Array.isArray(orders) 
      ? orders.filter((o: { owner?: string; maker?: string }) => {
          const owner = (o.owner || o.maker || '').toLowerCase();
          return owner === walletAddress.toLowerCase();
        })
      : [];

    console.log("[Get Open Orders] User's orders:", userOrders.length);

    return json(200, { orders: userOrders });
  } catch (error: unknown) {
    console.error("[Get Open Orders] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message });
  }
});
