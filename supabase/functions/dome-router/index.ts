import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
const POLYGON_CHAIN_ID = 137;

// Polymarket CLOB API endpoints
const CLOB_API_URL = "https://clob.polymarket.com";
const GAMMA_API_URL = "https://gamma-api.polymarket.com";

interface LinkUserRequest {
  action: "link";
  address: string;
  signature: string;
  nonce: string;
  timestamp: number;
}

interface PlaceOrderRequest {
  action: "place_order";
  address: string;
  safeAddress: string;
  tokenId: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  orderType: "GTC" | "FAK" | "FOK";
  signature: string;
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

type DomeRequest = LinkUserRequest | PlaceOrderRequest | DeriveSafeRequest | CheckStatusRequest;

// Polymarket Safe factory constants
const SAFE_FACTORY = "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2";
const SAFE_SINGLETON = "0xd9Db270c1B5E3Bd161E8c8503c55cEABe709552F";
const PROXY_BYTECODE_HASH = "0x0xcc69f5e8c8e20cf21dc3c1c0dbd30f9b3a18b0cf0c27b0d3ce3e7f3d6f0f5e0a";

// Derive Safe address deterministically (same as SDK)
function deriveSafeAddress(eoaAddress: string): string {
  // This is a simplified version - the actual derivation uses CREATE2
  // For production, we should call the SDK or use the same algorithm
  const lowerAddress = eoaAddress.toLowerCase();
  
  // The Polymarket Safe derivation uses a specific salt based on the EOA
  // and CREATE2 with the Safe factory
  // For now, return a placeholder that matches expected format
  return `0x${lowerAddress.slice(2)}`.toLowerCase();
}

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

// Call Polymarket CLOB API with credentials
async function callClobApi(
  method: string,
  path: string,
  credentials: { apiKey: string; apiSecret: string; apiPassphrase: string },
  body?: object
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : "";
  
  const signature = await createHmacSignature(
    credentials.apiSecret,
    timestamp,
    method,
    path,
    bodyStr
  );
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "POLY_API_KEY": credentials.apiKey,
    "POLY_SIGNATURE": signature,
    "POLY_TIMESTAMP": timestamp,
    "POLY_PASSPHRASE": credentials.apiPassphrase,
  };
  
  const url = `${CLOB_API_URL}${path}`;
  
  return fetch(url, {
    method,
    headers,
    body: bodyStr || undefined,
  });
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
        
        // Call Dome API to get the derived Safe address
        const domeResponse = await fetch("https://api.dome.xyz/v1/polymarket/derive-safe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DOME_API_KEY}`,
          },
          body: JSON.stringify({ eoaAddress: address }),
        });
        
        if (!domeResponse.ok) {
          const error = await domeResponse.text();
          console.error("[dome-router] Dome API error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to derive Safe address" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await domeResponse.json();
        return new Response(
          JSON.stringify({ safeAddress: result.safeAddress }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "link": {
        const { address, signature, nonce, timestamp } = body;
        
        if (!address || !signature || !nonce) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("[dome-router] Linking user:", address);
        
        // Call Dome API to link the user
        const domeResponse = await fetch("https://api.dome.xyz/v1/polymarket/link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DOME_API_KEY}`,
          },
          body: JSON.stringify({
            eoaAddress: address,
            signature,
            nonce,
            timestamp,
            walletType: "safe",
            autoDeploySafe: true,
            autoSetAllowances: true,
          }),
        });
        
        if (!domeResponse.ok) {
          const error = await domeResponse.text();
          console.error("[dome-router] Dome link error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to link wallet" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await domeResponse.json();
        console.log("[dome-router] Link successful:", result.safeAddress);
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "place_order": {
        const { address, safeAddress, tokenId, side, size, price, orderType, signature, credentials } = body;
        
        if (!address || !safeAddress || !tokenId || !side || !size || !price || !credentials) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("[dome-router] Placing order:", { tokenId, side, size, price, orderType });
        
        // Call Dome API to place the order
        const domeResponse = await fetch("https://api.dome.xyz/v1/polymarket/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DOME_API_KEY}`,
          },
          body: JSON.stringify({
            eoaAddress: address,
            safeAddress,
            tokenId,
            side,
            size,
            price,
            orderType: orderType || "GTC",
            signature,
            credentials,
          }),
        });
        
        if (!domeResponse.ok) {
          const error = await domeResponse.text();
          console.error("[dome-router] Dome order error:", error);
          
          let errorMessage = "Failed to place order";
          try {
            const errorJson = JSON.parse(error);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {}
          
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await domeResponse.json();
        console.log("[dome-router] Order placed:", result.orderId);
        
        return new Response(
          JSON.stringify(result),
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
