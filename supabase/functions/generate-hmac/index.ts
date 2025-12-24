import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Edge function to generate L2 HMAC signatures for Polymarket CLOB API.
 * 
 * This is needed because:
 * 1. ClobClient.postOrder() uses Node.js crypto.createHmac which doesn't work in browsers
 * 2. Edge function calls to Polymarket are blocked by Cloudflare
 * 
 * Solution: Generate HMAC here, but let the browser make the actual API call
 */

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { method, path, body, apiCreds } = await req.json();

    // Validate required fields
    if (!method || !path) {
      return json(400, { error: "Missing method or path" });
    }

    if (!apiCreds?.secret || !apiCreds?.apiKey || !apiCreds?.passphrase) {
      return json(400, { error: "Missing API credentials (apiKey, secret, passphrase)" });
    }

    // Generate timestamp (seconds as string, matching Polymarket SDK)
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Build the message for HMAC: timestamp + method + path + body
    const message = timestamp + method.toUpperCase() + path + (body ?? "");

    // CRITICAL: Decode the secret from base64 first (Polymarket SDK requirement)
    const base64Secret = Buffer.from(apiCreds.secret, "base64");

    // Generate HMAC-SHA256 signature
    const sig = createHmac("sha256", base64Secret)
      .update(message)
      .digest("base64");

    // Convert to URL-safe base64 (replace + with -, / with _)
    const signature = sig.replace(/\+/g, "-").replace(/\//g, "_");

    console.log("[Generate HMAC] Generated signature for:", method, path);
    console.log("[Generate HMAC] Timestamp:", timestamp);
    console.log("[Generate HMAC] Message length:", message.length);

    return json(200, {
      signature,
      timestamp,
      apiKey: apiCreds.apiKey,
      passphrase: apiCreds.passphrase,
    });
  } catch (error: unknown) {
    console.error("[Generate HMAC] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message });
  }
});
