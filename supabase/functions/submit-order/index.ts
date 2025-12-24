import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const POLY_API_KEY = Deno.env.get("POLY_API_KEY");
const POLY_API_SECRET = Deno.env.get("POLY_API_SECRET");
const POLY_API_PASSPHRASE = Deno.env.get("POLY_API_PASSPHRASE");
const CLOB_BASE_URL = "https://clob.polymarket.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Generate L2 HMAC signature for API authentication
function generateL2Signature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string = ""
): string {
  const message = timestamp + method + path + body;
  return createHmac("sha256", secret)
    .update(message)
    .digest("base64");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signedOrder, makerAddress, apiCreds } = await req.json();

    if (!signedOrder || !makerAddress) {
      return json(400, { error: "Missing signedOrder or makerAddress" });
    }

    // Use user's API creds if provided, otherwise use builder creds
    const userApiKey = apiCreds?.apiKey;
    const userSecret = apiCreds?.secret;
    const userPassphrase = apiCreds?.passphrase;

    // Validate we have some credentials to use
    const hasUserCreds = userApiKey && userSecret && userPassphrase;
    const hasBuilderCreds = POLY_API_KEY && POLY_API_SECRET && POLY_API_PASSPHRASE;

    if (!hasUserCreds && !hasBuilderCreds) {
      console.error("[Submit Order] No credentials available");
      return json(500, { error: "Server configuration error - no credentials" });
    }

    console.log("[Submit Order] Submitting order for maker:", makerAddress);
    console.log("[Submit Order] Using:", hasUserCreds ? "user credentials" : "builder credentials");
    console.log("[Submit Order] Order:", JSON.stringify(signedOrder, null, 2));

    // The signedOrder from ClobClient.createOrder() contains the order struct
    // We need to wrap it in the expected API format
    const path = "/order";
    const orderPayload = {
      order: signedOrder,
      owner: makerAddress,
      orderType: "GTC",
    };
    const body = JSON.stringify(orderPayload);

    // Generate timestamp for L2 auth (milliseconds)
    const timestamp = Date.now().toString();

    // Use user's credentials for L2 auth
    const apiKey = hasUserCreds ? userApiKey : POLY_API_KEY!;
    const secret = hasUserCreds ? userSecret : POLY_API_SECRET!;
    const passphrase = hasUserCreds ? userPassphrase : POLY_API_PASSPHRASE!;

    // Generate L2 HMAC signature
    const signature = generateL2Signature(secret, timestamp, "POST", path, body);

    console.log("[Submit Order] Generated L2 signature");
    console.log("[Submit Order] Timestamp:", timestamp);
    console.log("[Submit Order] API Key:", apiKey.substring(0, 8) + "...");

    // Build headers for L2 authenticated request
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "POLY-ADDRESS": makerAddress,
      "POLY-SIGNATURE": signature,
      "POLY-TIMESTAMP": timestamp,
      "POLY-API-KEY": apiKey,
      "POLY-PASSPHRASE": passphrase,
    };

    // Add builder attribution headers if we have builder credentials
    if (hasBuilderCreds && hasUserCreds) {
      // When using user creds, add builder headers separately for attribution
      const builderTimestamp = Date.now().toString();
      const builderSignature = generateL2Signature(
        POLY_API_SECRET!,
        builderTimestamp,
        "POST",
        path,
        body
      );
      
      headers["POLY_BUILDER_SIGNATURE"] = builderSignature;
      headers["POLY_BUILDER_TIMESTAMP"] = builderTimestamp;
      headers["POLY_BUILDER_API_KEY"] = POLY_API_KEY!;
      headers["POLY_BUILDER_PASSPHRASE"] = POLY_API_PASSPHRASE!;
      
      console.log("[Submit Order] Added builder attribution headers");
    }

    // Submit to CLOB API
    const response = await fetch(`${CLOB_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body,
    });

    const responseText = await response.text();
    console.log(`[Submit Order] CLOB response (${response.status}):`, responseText);

    if (!response.ok) {
      console.error("[Submit Order] CLOB API error:", responseText);
      
      let errorMessage = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error || errorJson.message || responseText;
      } catch {
        // Keep original text
      }
      
      return json(response.status, { 
        error: errorMessage,
        success: false 
      });
    }

    const result = JSON.parse(responseText);
    console.log("[Submit Order] ✅ Order placed successfully:", result);

    return json(200, { 
      success: true, 
      orderID: result.orderID || result.id,
      order: result 
    });
  } catch (error: unknown) {
    console.error("[Submit Order] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message, success: false });
  }
});
