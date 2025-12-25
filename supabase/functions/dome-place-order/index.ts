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
  side: "BUY" | "SELL" | number; // Accept both string and number for compatibility
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

// Convert side to human-readable string
function sideToString(side: "BUY" | "SELL" | number): string {
  if (typeof side === "string") return side;
  return side === 0 ? "BUY" : "SELL";
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

    // Log order identity info for debugging
    console.log("[DOME-PLACE-ORDER] 🔑 Order Identity:");
    console.log("[DOME-PLACE-ORDER]   → Maker:", body.signedOrder.maker);
    console.log("[DOME-PLACE-ORDER]   → Signer:", body.signedOrder.signer);
    console.log("[DOME-PLACE-ORDER]   → Signature Type:", body.signedOrder.signatureType);
    console.log("[DOME-PLACE-ORDER]   → API Key prefix:", body.credentials.apiKey.slice(0, 8) + "...");

    // Transform signedOrder: convert side from number to string for Dome API
    const transformedSignedOrder = {
      ...body.signedOrder,
      side: sideToString(body.signedOrder.side), // Convert 0 -> "BUY", 1 -> "SELL"
    };

    // Build Dome API request (per Dome SDK lines 1539-1552)
    const domeRequest = {
      jsonrpc: "2.0",
      method: "placeOrder",
      id: clientOrderId,
      params: {
        signedOrder: transformedSignedOrder,
        orderType,
        credentials: body.credentials,
        clientOrderId,
      },
    };

    console.log("[DOME-PLACE-ORDER] 🏗️ Submitting order via Dome API for builder attribution");
    console.log("[DOME-PLACE-ORDER] Order type:", orderType);
    console.log("[DOME-PLACE-ORDER] Token ID:", body.signedOrder.tokenId);
    console.log("[DOME-PLACE-ORDER] Side:", sideToString(body.signedOrder.side));
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

    let domeResult: { result?: DomeOrderResponse; error?: { message?: string; code?: number; data?: { reason?: string; maker?: string; tokenId?: string } } };
    try {
      domeResult = JSON.parse(responseText);
    } catch {
      console.error("[DOME-PLACE-ORDER] Failed to parse Dome response:", responseText);
      return json(502, { error: "Invalid response from Dome API", raw: responseText });
    }

    // Check for JSON-RPC error
    if (domeResult.error) {
      // Extract the most useful error message
      const reason = domeResult.error.data?.reason || domeResult.error.message || "Dome API error";
      const isAuthError = reason.toLowerCase().includes("unauthorized") || 
                          reason.toLowerCase().includes("invalid api key") ||
                          domeResult.error.code === 1006;
      
      console.error("[DOME-PLACE-ORDER] Dome API error:", {
        reason,
        code: domeResult.error.code,
        message: domeResult.error.message,
        data: domeResult.error.data,
      });
      
      return json(400, { 
        error: reason,  // Surface the actual reason at top level
        code: domeResult.error.code,
        isAuthError,
        maker: body.signedOrder.maker,
        tokenId: body.signedOrder.tokenId,
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
      const errorMsg = result.errorMsg || result.error;
      const isAuthError = errorMsg?.toLowerCase().includes("unauthorized") || 
                          errorMsg?.toLowerCase().includes("invalid api key");
      
      console.error("[DOME-PLACE-ORDER] Order error:", errorMsg);
      return json(400, { 
        error: errorMsg,
        isAuthError,
        orderID: result.orderID,
        maker: body.signedOrder.maker,
        tokenId: body.signedOrder.tokenId,
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
      orderId: result.orderID,
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
