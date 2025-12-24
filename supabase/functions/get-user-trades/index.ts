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

function generateL2Headers(
  method: string,
  path: string,
  body: string,
  apiCreds: { apiKey: string; secret: string; passphrase: string }
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + body;

  // Important: Polymarket expects standard base64 HMAC output (not base64url)
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
    const { apiCreds, filters, walletAddress } = await req.json();

    // Validate wallet address
    if (!walletAddress) {
      return json(400, { error: "Missing wallet address" });
    }

    // Validate API credentials
    if (!apiCreds?.secret || !apiCreds?.apiKey || !apiCreds?.passphrase) {
      return json(400, { error: "Missing API credentials (apiKey, secret, passphrase)" });
    }

    // Build query parameters - filter by maker address to get user's trades
    const params = new URLSearchParams();
    params.set("maker", walletAddress.toLowerCase());
    if (filters?.market) params.set("market", filters.market);
    if (filters?.before) params.set("before", filters.before);
    if (filters?.after) params.set("after", filters.after);
    if (filters?.id) params.set("id", filters.id);

    const queryString = params.toString();
    const path = `/data/trades?${queryString}`;
    const url = `${CLOB_HOST}${path}`;

    console.log("[Get User Trades] Fetching trades for wallet:", walletAddress);
    console.log("[Get User Trades] Path:", path);

    // Generate L2 authentication headers
    const l2Headers = generateL2Headers("GET", path, "", apiCreds);
    // Set the POLY_ADDRESS header to the user's wallet address
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

    const takerPath = `/data/trades?${takerParams.toString()}`;
    const takerL2Headers = generateL2Headers("GET", takerPath, "", apiCreds);
    takerL2Headers["POLY-ADDRESS"] = walletAddress.toLowerCase();

    const takerResponse = await fetch(`${CLOB_HOST}${takerPath}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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
