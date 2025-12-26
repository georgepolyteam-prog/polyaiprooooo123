import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Edge function to fetch user trades from Polymarket CLOB API.
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
    const { apiCreds, filters, walletAddress } = await req.json();

    // Validate wallet address
    if (!walletAddress) {
      return json(400, { error: "Missing wallet address" });
    }

    // Validate API credentials
    if (!apiCreds?.secret || !apiCreds?.apiKey || !apiCreds?.passphrase) {
      return json(400, { error: "Missing API credentials (apiKey, secret, passphrase)" });
    }

    console.log("[Get User Trades] Fetching trades for wallet:", walletAddress);

    // CRITICAL: Sign only the path, query params are added to URL but NOT signed
    const pathOnly = "/data/trades";
    
    // Build query parameters - filter by maker address to get user's trades
    const params = new URLSearchParams();
    params.set("maker", walletAddress.toLowerCase());
    if (filters?.market) params.set("market", filters.market);
    if (filters?.before) params.set("before", filters.before);
    if (filters?.after) params.set("after", filters.after);
    if (filters?.id) params.set("id", filters.id);

    const queryString = params.toString();
    const fullUrl = `${CLOB_HOST}${pathOnly}?${queryString}`;

    console.log("[Get User Trades] Full URL:", fullUrl);
    console.log("[Get User Trades] Signing path only:", pathOnly);

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
      console.error("[Get User Trades] API error:", response.status, errorText);
      return json(response.status, { 
        error: `Polymarket API error: ${response.status}`,
        details: errorText 
      });
    }

    const makerTrades = await response.json();
    console.log("[Get User Trades] Fetched", Array.isArray(makerTrades) ? makerTrades.length : 0, "maker trades");

    // Also fetch trades where user is taker
    const takerParams = new URLSearchParams();
    takerParams.set("taker", walletAddress.toLowerCase());
    if (filters?.before) takerParams.set("before", filters.before);
    if (filters?.after) takerParams.set("after", filters.after);

    const takerFullUrl = `${CLOB_HOST}${pathOnly}?${takerParams.toString()}`;
    const takerL2Headers = generateL2Headers("GET", pathOnly, walletAddress, apiCreds);

    const takerResponse = await fetch(takerFullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...takerL2Headers,
      },
    });

    let takerTrades: unknown[] = [];
    if (takerResponse.ok) {
      takerTrades = await takerResponse.json();
      console.log("[Get User Trades] Fetched", Array.isArray(takerTrades) ? takerTrades.length : 0, "taker trades");
    }

    // Combine and deduplicate trades by id
    const allTrades = [...(makerTrades || []), ...(takerTrades || [])];
    const uniqueTrades = Array.from(
      new Map(allTrades.map((t: { id: string }) => [t.id, t])).values()
    ) as Array<{ id: string; match_time?: string }>;

    // Sort by match_time descending
    uniqueTrades.sort((a, b) => {
      const timeA = parseInt(a.match_time || "0");
      const timeB = parseInt(b.match_time || "0");
      return timeB - timeA;
    });

    console.log("[Get User Trades] Total unique trades:", uniqueTrades.length);

    return json(200, { trades: uniqueTrades });
  } catch (error: unknown) {
    console.error("[Get User Trades] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message });
  }
});
