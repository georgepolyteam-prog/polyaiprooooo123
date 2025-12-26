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
  userId: string;
  marketId: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  credentials: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  };
  funderAddress: string;
  negRisk?: boolean;
  orderType?: string;
  tickSize?: string;
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
        const { userId, marketId, side, size, price, credentials, funderAddress, negRisk, orderType, tickSize } = body as PlaceOrderRequest;
        
        if (!marketId || !credentials || !funderAddress) {
          return new Response(
            JSON.stringify({ error: "Missing required fields (marketId, credentials, funderAddress)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        console.log("[dome-router] Placing order via Dome API:", { 
          userId,
          marketId, 
          side,
          size,
          price,
          funderAddress,
          orderType: orderType || "GTC",
        });
        
        // Call Dome's placeOrder API endpoint directly
        // This uses Dome's PolymarketRouter which handles:
        // 1. Builder-signer for attribution
        // 2. Order signing with ClobClient
        // 3. Submission to Polymarket CLOB
        const domeResponse = await fetch(`${DOME_API_URL}/polymarket/placeOrder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DOME_API_KEY}`,
          },
          body: JSON.stringify({
            userId: userId || funderAddress,
            marketId,
            side: side.toLowerCase(),
            size,
            price,
            credentials: {
              key: credentials.apiKey,
              secret: credentials.apiSecret,
              passphrase: credentials.apiPassphrase,
            },
            walletType: "eoa",
            funderAddress,
            negRisk: negRisk ?? false,
            orderType: orderType || "GTC",
            tickSize: tickSize || "0.01",
            chainId: POLYGON_CHAIN_ID,
          }),
        });
        
        if (!domeResponse.ok) {
          const errorText = await domeResponse.text();
          console.error("[dome-router] Dome API placeOrder error:", domeResponse.status, errorText);
          
          let errorMessage = `Dome API error: ${domeResponse.status}`;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: domeResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await domeResponse.json();
        console.log("[dome-router] Order placed via Dome successfully:", result);
        
        return new Response(
          JSON.stringify({ 
            success: true,
            orderId: result.orderID || result.orderId || result.id, 
            ...result 
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