import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Dome API configuration
const DOME_API_URL = "https://api.domeapi.io/v1";
const POLYGON_CHAIN_ID = 137;

interface PlaceOrderRequest {
  action: "place_order";
  signedOrder: {
    order: {
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
      side: string | number; // Accept both - will be "BUY" or "SELL" string after transformation
      signatureType: number;
    };
    signature: string;
    owner: string;
    orderType: string;
  };
  credentials: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  };
  negRisk?: boolean;
}

interface DeriveSafeRequest {
  action: "derive_safe";
  address: string;
}

interface CheckStatusRequest {
  action: "check_status";
  address: string;
  safeAddress: string;
}

type DomeRequest = PlaceOrderRequest | DeriveSafeRequest | CheckStatusRequest;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
    if (!DOME_API_KEY) {
      console.error("[dome-router] DOME_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Dome API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: DomeRequest = await req.json();
    console.log("[dome-router] Request action:", body.action);

    switch (body.action) {
      case "derive_safe": {
        const { address } = body;
        if (!address) {
          return new Response(
            JSON.stringify({ error: "Address required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Use Dome API to get wallet info which includes the safe/proxy address
        console.log("[dome-router] Fetching wallet info for:", address);
        
        const domeResponse = await fetch(`${DOME_API_URL}/polymarket/wallet?eoa=${address}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DOME_API_KEY}`,
          },
        });
        
        if (!domeResponse.ok) {
          const errorText = await domeResponse.text();
          console.log("[dome-router] Dome API wallet lookup failed:", domeResponse.status, errorText);
          
          // Return placeholder - Safe will be derived client-side
          return new Response(
            JSON.stringify({ safeAddress: null, needsDerivation: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await domeResponse.json();
        console.log("[dome-router] Wallet info:", result);
        
        return new Response(
          JSON.stringify({ safeAddress: result.proxy || result.safeAddress }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "place_order": {
        const { signedOrder, credentials, negRisk } = body as PlaceOrderRequest;
        
        if (!signedOrder || !credentials) {
          return new Response(
            JSON.stringify({ error: "Missing required fields (signedOrder, credentials)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("[dome-router] Submitting pre-signed order via Dome API:", { 
          tokenId: signedOrder.order?.tokenId?.slice(0, 20),
          side: signedOrder.order?.side,
          orderType: signedOrder.orderType,
          hasSignature: !!signedOrder.signature,
          negRisk: negRisk ?? false,
        });
        
        // Build JSON-RPC 2.0 payload with the pre-signed order
        const jsonRpcPayload = {
          jsonrpc: "2.0",
          method: "placeOrder",
          id: crypto.randomUUID(),
          params: {
            signedOrder,
            negRisk: negRisk ?? false,
            credentials: {
              apiKey: credentials.apiKey,
              apiSecret: credentials.apiSecret,
              apiPassphrase: credentials.apiPassphrase,
            },
          },
        };
        
        console.log("[dome-router] JSON-RPC payload:", JSON.stringify(jsonRpcPayload, null, 2));
        
        const domeResponse = await fetch(`${DOME_API_URL}/polymarket/placeOrder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DOME_API_KEY}`,
          },
          body: JSON.stringify(jsonRpcPayload),
        });
        
        const responseText = await domeResponse.text();
        console.log("[dome-router] Dome API response status:", domeResponse.status);
        console.log("[dome-router] Dome API response body:", responseText);
        
        let result;
        try {
          result = JSON.parse(responseText);
        } catch {
          console.error("[dome-router] Failed to parse Dome response as JSON:", responseText);
          return new Response(
            JSON.stringify({ error: `Invalid response from Dome: ${responseText}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Handle JSON-RPC error response
        if (result.error) {
          const errorMessage = result.error.message || "Unknown Dome error";
          const errorReason = result.error.data?.reason || "";
          const fullError = errorReason ? `${errorMessage} - ${errorReason}` : errorMessage;
          console.error("[dome-router] Dome JSON-RPC error:", result.error);
          
          return new Response(
            JSON.stringify({ 
              error: fullError,
              code: result.error.code,
              details: result.error.data,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Handle HTTP error (non-2xx without JSON-RPC error)
        if (!domeResponse.ok && !result.result) {
          console.error("[dome-router] Dome API HTTP error:", domeResponse.status, result);
          return new Response(
            JSON.stringify({ error: result.message || `Dome API error: ${domeResponse.status}` }),
            { status: domeResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Success - extract result from JSON-RPC response
        const orderResult = result.result || result;
        console.log("[dome-router] Order placed successfully:", orderResult);
        
        return new Response(
          JSON.stringify({ 
            success: true,
            orderId: orderResult.orderID || orderResult.orderId || orderResult.id, 
            ...orderResult 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "check_status": {
        const { address, safeAddress } = body;
        
        if (!address || !safeAddress) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Check Safe deployment status via RPC
        const rpcResponse = await fetch("https://polygon-rpc.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getCode",
            params: [safeAddress, "latest"],
          }),
        });
        
        const rpcResult = await rpcResponse.json();
        const isDeployed = rpcResult.result && rpcResult.result !== "0x" && rpcResult.result !== "0x0";
        
        return new Response(
          JSON.stringify({ isDeployed, safeAddress }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[dome-router] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});