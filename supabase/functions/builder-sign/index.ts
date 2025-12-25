import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLOB_BASE_URL = "https://clob.polymarket.com";
const DOME_BUILDER_SIGNER_URL = "https://builder-signer.domeapi.io/builder-signer/sign";

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

    // 1) L1: create/derive user API credentials - keep this as-is
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

    // 2) Builder program: proxy to Dome's official builder-signer service
    const { method, path, body, timestamp } = payload as BuilderSignPayload;
    
    if (!method || !path) {
      return json(400, { error: "Missing method or path" });
    }

    console.log("[BUILDER-SIGN] Proxying to Dome builder-signer:", method, path);

    // Forward the request to Dome's builder-signer
    const domeResponse = await fetch(DOME_BUILDER_SIGNER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, path, body, timestamp }),
    });

    if (!domeResponse.ok) {
      const errorText = await domeResponse.text();
      console.error("[BUILDER-SIGN] Dome builder-signer error:", domeResponse.status, errorText);
      return json(domeResponse.status, { error: errorText || "Dome builder-signer error" });
    }

    const domeHeaders = await domeResponse.json();
    console.log("[BUILDER-SIGN] Dome builder-signer success, headers received");

    return json(200, domeHeaders);
  } catch (error: unknown) {
    console.error("[BUILDER-SIGN] Error:", error);
    return json(500, { error: "Internal server error" });
  }
});
