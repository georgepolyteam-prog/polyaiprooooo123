import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DOME_BUILDER_SIGNER_URL = "https://builder-signer.domeapi.io/builder-signer/sign";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This edge function now ONLY handles builder-signer proxy requests
// API credential creation is now done client-side using @polymarket/clob-client

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

    // Builder program: proxy to Dome's official builder-signer service
    // NOTE: This is OPTIONAL and non-blocking for trades. 
    // If this fails (401), trades still work - builder attribution just won't be recorded.
    const { method, path, body, timestamp } = payload as BuilderSignPayload;
    
    if (!method || !path) {
      return json(400, { error: "Missing method or path" });
    }

    console.log("[BUILDER-SIGN] Proxying to Dome builder-signer:", method, path);

    try {
      // Forward the request to Dome's builder-signer
      // NOTE: Per Dome SDK docs, builder-signer does NOT require Authorization header
      // The DOME_API_KEY is only needed for order placement via api.domeapi.io
      const domeResponse = await fetch(DOME_BUILDER_SIGNER_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method, path, body, timestamp }),
      });

      if (!domeResponse.ok) {
        const errorText = await domeResponse.text();
        // Log the error but return a graceful response
        // This is non-blocking - trades will still work without builder attribution
        console.warn("[BUILDER-SIGN] Dome builder-signer returned", domeResponse.status, ":", errorText.slice(0, 200));
        console.warn("[BUILDER-SIGN] Builder attribution skipped - this is non-blocking, trades will still work");
        
        // Return empty headers so the calling code can proceed without builder attribution
        return json(200, { 
          skipped: true, 
          reason: `Dome returned ${domeResponse.status}`,
          message: "Builder attribution skipped - trades will still work"
        });
      }

      const domeHeaders = await domeResponse.json();
      console.log("[BUILDER-SIGN] Dome builder-signer success, headers received");

      return json(200, domeHeaders);
    } catch (domeError: unknown) {
      // Network or other error - log and return graceful response
      console.warn("[BUILDER-SIGN] Dome builder-signer error (non-blocking):", domeError);
      return json(200, { 
        skipped: true, 
        reason: "Network error",
        message: "Builder attribution skipped - trades will still work"
      });
    }
  } catch (error: unknown) {
    console.error("[BUILDER-SIGN] Error:", error);
    return json(500, { error: "Internal server error" });
  }
});
