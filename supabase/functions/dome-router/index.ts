import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
const POLYGON_CHAIN_ID = 137;

// Dome's builder-signer service for signing orders
const BUILDER_SIGNER_URL = "https://builder-signer.domeapi.io/builder-signer/sign";

// Polymarket CLOB API endpoints
const CLOB_API_URL = "https://clob.polymarket.com";

interface PlaceOrderRequest {
  action: "place_order";
  signedOrder: {
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
  };
  orderType: "GTC" | "FAK" | "FOK";
  credentials: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  };
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

// Create HMAC signature for CLOB API
async function createHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string = ""
): Promise<string> {
  const message = timestamp + method + path + body;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Sign order via Dome's builder-signer service
async function signWithBuilderSigner(
  method: string,
  path: string,
  body: string
): Promise<Record<string, string> | null> {
  try {
    console.log("[dome-router] Signing with builder-signer:", method, path);
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    const response = await fetch(BUILDER_SIGNER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, path, body, timestamp }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("[dome-router] Builder-signer error (non-blocking):", response.status, errorText);
      return null;
    }

    const headers = await response.json();
    console.log("[dome-router] Builder-signer headers received");
    return headers;
  } catch (e) {
    console.warn("[dome-router] Builder-signer failed (non-blocking):", e);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
        
        const domeResponse = await fetch(`https://api.domeapi.io/v1/polymarket/wallet?eoa=${address}`, {
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
        const { signedOrder, orderType, credentials } = body;
        
        if (!signedOrder || !credentials) {
          return new Response(
            JSON.stringify({ error: "Missing signedOrder or credentials" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("[dome-router] Placing signed order:", { 
          tokenId: signedOrder.tokenId, 
          side: signedOrder.side,
          signatureType: signedOrder.signatureType,
          maker: signedOrder.maker,
          signer: signedOrder.signer,
        });
        
        // Build the order payload for CLOB API
        const orderPath = "/order";
        const orderBody = {
          order: signedOrder,
          orderType: orderType || "GTC",
        };
        const orderBodyStr = JSON.stringify(orderBody);
        
        // Get builder-signer headers (optional - for attribution)
        const builderHeaders = await signWithBuilderSigner("POST", orderPath, orderBodyStr);
        
        // Create HMAC signature for CLOB API
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const hmacSignature = await createHmacSignature(
          credentials.apiSecret,
          timestamp,
          "POST",
          orderPath,
          orderBodyStr
        );
        
        // Build request headers
        const requestHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "POLY_API_KEY": credentials.apiKey,
          "POLY_SIGNATURE": hmacSignature,
          "POLY_TIMESTAMP": timestamp,
          "POLY_PASSPHRASE": credentials.apiPassphrase,
        };
        
        // Add builder headers if available (for attribution)
        if (builderHeaders) {
          Object.assign(requestHeaders, builderHeaders);
        }
        
        console.log("[dome-router] Submitting order to CLOB...");
        
        const clobResponse = await fetch(`${CLOB_API_URL}${orderPath}`, {
          method: "POST",
          headers: requestHeaders,
          body: orderBodyStr,
        });
        
        if (!clobResponse.ok) {
          const error = await clobResponse.text();
          console.error("[dome-router] CLOB order error:", clobResponse.status, error);
          
          let errorMessage = "Failed to place order";
          try {
            const errorJson = JSON.parse(error);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {
            errorMessage = error || errorMessage;
          }
          
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await clobResponse.json();
        console.log("[dome-router] Order placed successfully:", result);
        
        return new Response(
          JSON.stringify({ orderId: result.orderID || result.id, ...result }),
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