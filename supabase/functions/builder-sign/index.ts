import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

const POLY_API_KEY = Deno.env.get("POLY_API_KEY");
const POLY_API_SECRET = Deno.env.get("POLY_API_SECRET");
const POLY_API_PASSPHRASE = Deno.env.get("POLY_API_PASSPHRASE");
const CLOB_BASE_URL = "https://clob.polymarket.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ApiCredsPayload = {
  action: "l1_create_or_derive_api_creds";
  address: string;
  signature: string;
  timestamp: string;
  nonce?: string;
};

// RemoteBuilderConfig payload from @polymarket/builder-signing-sdk
type BuilderSignPayload = {
  method: string;
  path: string;
  body?: string;
  timestamp?: number;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    console.log("[BUILDER-SIGN] Request received:", JSON.stringify(payload).slice(0, 200));

    // 1) L1: create/derive user API credentials
    if (payload.action === "l1_create_or_derive_api_creds") {
      const { address, signature, timestamp, nonce } = payload as ApiCredsPayload;
      
      if (!address || !signature || !timestamp) {
        return json(400, { error: "Missing address, signature, or timestamp" });
      }

      console.log("[BUILDER-SIGN] L1 auth for address:", address);

      const l1Headers: Record<string, string> = {
        "POLY-ADDRESS": address,
        "POLY-SIGNATURE": signature,
        "POLY-TIMESTAMP": timestamp,
        "POLY-NONCE": nonce || "0",
      };

      // Try create first
      const createResp = await fetch(`${CLOB_BASE_URL}/auth/api-key`, {
        method: "POST",
        headers: { ...l1Headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (createResp.ok) {
        const creds = await createResp.json();
        console.log("[BUILDER-SIGN] Created new API creds for:", address);
        return json(200, { creds });
      }

      // If create fails (already exists), try derive
      console.log("[BUILDER-SIGN] Create failed, trying derive...");
      const deriveResp = await fetch(`${CLOB_BASE_URL}/auth/derive-api-key`, {
        method: "GET",
        headers: l1Headers,
      });

      if (!deriveResp.ok) {
        const errorText = await deriveResp.text();
        console.error("[BUILDER-SIGN] Failed to create/derive API creds:", errorText);
        return json(400, { error: errorText || "Failed to create/derive API credentials" });
      }

      const creds = await deriveResp.json();
      console.log("[BUILDER-SIGN] Derived existing API creds for:", address);
      return json(200, { creds });
    }

    // 2) Builder program: generate HMAC headers for CLOB API requests
    // This is called by BuilderConfig.remoteBuilderConfig from @polymarket/builder-signing-sdk
    const { method, path, body, timestamp: providedTimestamp } = payload as BuilderSignPayload;
    
    if (!method || !path) {
      return json(400, { error: "Missing method or path" });
    }

    if (!POLY_API_KEY || !POLY_API_SECRET || !POLY_API_PASSPHRASE) {
      console.error("[BUILDER-SIGN] Missing builder env vars");
      return json(500, { error: "Server configuration error" });
    }

    // Use provided timestamp or generate new one - MUST be in SECONDS, not milliseconds
    const timestamp = (providedTimestamp || Math.floor(Date.now() / 1000)).toString();
    
    // HMAC signature: timestamp + method + path + body
    // Secret must be base64-decoded before use
    const message = timestamp + method + path + (body || "");
    const base64Secret = Buffer.from(POLY_API_SECRET, "base64");
    const signature = createHmac("sha256", base64Secret)
      .update(message)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    console.log("[BUILDER-SIGN] Generated HMAC for:", method, path);

    // Return BuilderHeaderPayload format expected by SDK
    return json(200, {
      POLY_BUILDER_SIGNATURE: signature,
      POLY_BUILDER_TIMESTAMP: timestamp,
      POLY_BUILDER_API_KEY: POLY_API_KEY,
      POLY_BUILDER_PASSPHRASE: POLY_API_PASSPHRASE,
    });
  } catch (error: unknown) {
    console.error("[BUILDER-SIGN] Error:", error);
    return json(500, { error: "Internal server error" });
  }
});
