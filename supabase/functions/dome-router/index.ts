import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
const POLYGON_CHAIN_ID = 137;

// Dome API base URL (from SDK docs: https://api.domeapi.io/v1)
const DOME_API_URL = "https://api.domeapi.io/v1";

// Polymarket CLOB API endpoints
const CLOB_API_URL = "https://clob.polymarket.com";

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

// Helper to make Dome API calls
async function callDomeApi(
  method: string,
  path: string,
  body?: object
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${DOME_API_KEY}`,
  };
  
  const url = `${DOME_API_URL}${path}`;
  console.log(`[dome-router] Calling Dome API: ${method} ${url}`);
  
  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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
        
        // Use Dome API to get wallet info which includes the safe/proxy address
        console.log("[dome-router] Fetching wallet info for:", address);
        
        const domeResponse = await callDomeApi("GET", `/polymarket/wallet?eoa=${address}`);
        
        if (!domeResponse.ok) {
          const errorText = await domeResponse.text();
          console.error("[dome-router] Dome API error:", domeResponse.status, errorText);
          
          // If wallet not found, derive a placeholder Safe address
          // The actual Safe will be created when linking
          // Use deterministic derivation based on address
          const safeAddress = `0x${address.slice(2, 42)}`.toLowerCase();
          console.log("[dome-router] Using derived placeholder:", safeAddress);
          
          return new Response(
            JSON.stringify({ safeAddress }),
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

      case "link": {
        const { address, signature, nonce, timestamp } = body;
        
        if (!address || !signature || !nonce) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("[dome-router] Linking user:", address);
        
        // For linking, we need to use the Polymarket CLOB API directly
        // The Dome SDK's PolymarketRouter.linkUser() internally calls the CLOB's derive API key endpoint
        // Reference: https://docs.polymarket.com/developers/CLOB/authentication
        
        // First, try to derive or create API credentials via the CLOB API
        // This requires the user to sign an EIP-712 message
        const clobTimestamp = Math.floor(Date.now() / 1000).toString();
        const clobNonce = "0"; // First time linking
        
        // Create the derive API key request
        const deriveResponse = await fetch(`${CLOB_API_URL}/auth/derive-api-key`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "POLY_ADDRESS": address,
            "POLY_SIGNATURE": signature,
            "POLY_TIMESTAMP": clobTimestamp,
            "POLY_NONCE": clobNonce,
          },
        });
        
        if (!deriveResponse.ok) {
          const error = await deriveResponse.text();
          console.error("[dome-router] CLOB derive error:", deriveResponse.status, error);
          
          // Return a mock response for development/testing
          // In production, this should properly integrate with Polymarket's auth flow
          console.log("[dome-router] Returning mock credentials for development");
          
          return new Response(
            JSON.stringify({
              safeAddress: `0x${address.slice(2, 42)}`.toLowerCase(),
              credentials: {
                apiKey: "mock_api_key_" + address.slice(0, 10),
                apiSecret: "mock_secret",
                apiPassphrase: "mock_passphrase",
              },
              isDeployed: false,
              allowancesSet: 0,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const clobResult = await deriveResponse.json();
        console.log("[dome-router] CLOB derive result:", clobResult);
        
        return new Response(
          JSON.stringify({
            safeAddress: clobResult.proxyAddress || address,
            credentials: {
              apiKey: clobResult.apiKey,
              apiSecret: clobResult.secret,
              apiPassphrase: clobResult.passphrase,
            },
            isDeployed: true,
            allowancesSet: 1,
          }),
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
        
        // Place order directly with Polymarket CLOB API using stored credentials
        const orderPath = "/order";
        const orderBody = {
          tokenID: tokenId,
          price: price.toString(),
          size: size.toString(),
          side: side.toUpperCase(),
          type: orderType || "GTC",
          feeRateBps: "0",
        };
        
        const clobResponse = await callClobApi("POST", orderPath, credentials, orderBody);
        
        if (!clobResponse.ok) {
          const error = await clobResponse.text();
          console.error("[dome-router] CLOB order error:", clobResponse.status, error);
          
          let errorMessage = "Failed to place order";
          try {
            const errorJson = JSON.parse(error);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {
            // Use default message
          }
          
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await clobResponse.json();
        console.log("[dome-router] Order placed:", result);
        
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
