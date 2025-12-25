import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOME_API_URL = "https://api.domeapi.io/v1/polymarket/placeOrder";

interface SignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
  signature: string;
}

interface PlaceOrderRequest {
  signedOrder: SignedOrder;
  orderType?: "GTC" | "FAK" | "FOK";
  credentials: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  };
  clientOrderId?: string;
}

interface DomeOrderResponse {
  orderID?: string;
  takingAmount?: string;
  makingAmount?: string;
  status?: string;
  transactionsHashes?: string[];
  errorMsg?: string;
  error?: string;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body: PlaceOrderRequest = await req.json();
    console.log("[DOME-PLACE-ORDER] Received order request");

    // Validate required fields
    if (!body.signedOrder) {
      console.error("[DOME-PLACE-ORDER] Missing signedOrder");
      return json(400, { error: "Missing signedOrder" });
    }

    if (!body.credentials?.apiKey || !body.credentials?.apiSecret || !body.credentials?.apiPassphrase) {
      console.error("[DOME-PLACE-ORDER] Missing API credentials");
      return json(400, { error: "Missing API credentials (apiKey, apiSecret, apiPassphrase)" });
    }

    const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
    if (!DOME_API_KEY) {
      console.error("[DOME-PLACE-ORDER] DOME_API_KEY not configured");
      return json(500, { error: "DOME_API_KEY not configured on server" });
    }

    const clientOrderId = body.clientOrderId || crypto.randomUUID();
    const orderType = body.orderType || "GTC";

    // Build Dome API request (per Dome SDK lines 1539-1552)
    const domeRequest = {
      jsonrpc: "2.0",
      method: "placeOrder",
      id: clientOrderId,
      params: {
        signedOrder: body.signedOrder,
        orderType,
        credentials: body.credentials,
        clientOrderId,
      },
    };

    console.log("[DOME-PLACE-ORDER] 🏗️ Submitting order via Dome API for builder attribution");
    console.log("[DOME-PLACE-ORDER] Order type:", orderType);
    console.log("[DOME-PLACE-ORDER] Token ID:", body.signedOrder.tokenId);
    console.log("[DOME-PLACE-ORDER] Side:", body.signedOrder.side === 0 ? "BUY" : "SELL");
    console.log("[DOME-PLACE-ORDER] Maker amount:", body.signedOrder.makerAmount);
    console.log("[DOME-PLACE-ORDER] Taker amount:", body.signedOrder.takerAmount);

    // Call Dome API with Authorization header
    const domeResponse = await fetch(DOME_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DOME_API_KEY}`,
      },
      body: JSON.stringify(domeRequest),
    });

    const responseText = await domeResponse.text();
    console.log("[DOME-PLACE-ORDER] Dome API response status:", domeResponse.status);
    console.log("[DOME-PLACE-ORDER] Dome API response:", responseText);

    let domeResult: { result?: DomeOrderResponse; error?: { message?: string; code?: number } };
    try {
      domeResult = JSON.parse(responseText);
    } catch {
      console.error("[DOME-PLACE-ORDER] Failed to parse Dome response:", responseText);
      return json(502, { error: "Invalid response from Dome API", raw: responseText });
    }

    // Check for JSON-RPC error
    if (domeResult.error) {
      console.error("[DOME-PLACE-ORDER] Dome API error:", domeResult.error);
      return json(400, { 
        error: domeResult.error.message || "Dome API error",
        code: domeResult.error.code,
        details: domeResult.error,
      });
    }

    const result = domeResult.result;
    if (!result) {
      console.error("[DOME-PLACE-ORDER] No result in Dome response");
      return json(502, { error: "No result from Dome API" });
    }

    // Check for order-level error
    if (result.errorMsg || result.error) {
      console.error("[DOME-PLACE-ORDER] Order error:", result.errorMsg || result.error);
      return json(400, { 
        error: result.errorMsg || result.error,
        orderID: result.orderID,
      });
    }

    console.log("[DOME-PLACE-ORDER] ✅ Order placed successfully via Dome");
    console.log("[DOME-PLACE-ORDER] Order ID:", result.orderID);
    console.log("[DOME-PLACE-ORDER] Status:", result.status);
    if (result.transactionsHashes?.length) {
      console.log("[DOME-PLACE-ORDER] Transaction hashes:", result.transactionsHashes);
    }

    return json(200, {
      success: true,
      orderID: result.orderID,
      status: result.status,
      takingAmount: result.takingAmount,
      makingAmount: result.makingAmount,
      transactionsHashes: result.transactionsHashes,
      clientOrderId,
      builder: "dome",
    });

  } catch (error) {
    console.error("[DOME-PLACE-ORDER] Error:", error);
    return json(500, { 
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
