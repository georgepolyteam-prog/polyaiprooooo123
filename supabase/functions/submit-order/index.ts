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
    const { signedOrder, orderType = "GTC", apiCreds, signerAddress } = await req.json();

    if (!signedOrder) {
      return json(400, { error: "Missing signedOrder" });
    }

    // For Polymarket CLOB L2 auth, POLY_ADDRESS MUST be the EOA signer address
    const eoaAddress: string | undefined =
      signerAddress || signedOrder.signer || signedOrder.signerAddress;

    if (!eoaAddress) {
      return json(400, { error: "Missing signerAddress (EOA)" });
    }

    // Use user's API creds if provided, otherwise use builder creds
    const userApiKey = apiCreds?.apiKey;
    const userSecret = apiCreds?.secret;
    const userPassphrase = apiCreds?.passphrase;

    const hasUserCreds = userApiKey && userSecret && userPassphrase;
    const hasBuilderCreds = POLY_API_KEY && POLY_API_SECRET && POLY_API_PASSPHRASE;

    if (!hasUserCreds && !hasBuilderCreds) {
      console.error("[Submit Order] No credentials available");
      return json(500, { error: "Server configuration error - no credentials" });
    }

    console.log("[Submit Order] Submitting order");
    console.log("[Submit Order]   → EOA (POLY_ADDRESS):", eoaAddress);
    console.log("[Submit Order]   → Maker:", signedOrder.maker);
    console.log("[Submit Order]   → SignatureType:", signedOrder.signatureType);
    console.log("[Submit Order]   → Using:", hasUserCreds ? "user credentials" : "builder credentials");

    const path = "/order";

    // Normalize minimal fields to match CLOB expectations
    const normalizedSide =
      typeof signedOrder.side === "string"
        ? signedOrder.side.toUpperCase() === "BUY"
          ? 0
          : 1
        : signedOrder.side;

    const normalizedOrder = {
      salt: typeof signedOrder.salt === "number" ? signedOrder.salt : Number(signedOrder.salt),
      maker: signedOrder.maker,
      signer: signedOrder.signer,
      taker: signedOrder.taker,
      tokenId: signedOrder.tokenId,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      side: normalizedSide,
      expiration: signedOrder.expiration,
      nonce: signedOrder.nonce,
      feeRateBps: signedOrder.feeRateBps,
      signatureType: signedOrder.signatureType,
      signature: signedOrder.signature,
    };

    // IMPORTANT: body format must match @polymarket/clob-client orderToJson()
    // owner = apiKey (NOT an address)
    const apiKey = hasUserCreds ? userApiKey : POLY_API_KEY!;
    const secret = hasUserCreds ? userSecret : POLY_API_SECRET!;
    const passphrase = hasUserCreds ? userPassphrase : POLY_API_PASSPHRASE!;

    const orderPayload = {
      deferExec: false,
      order: normalizedOrder,
      owner: apiKey,
      orderType,
    };

    const body = JSON.stringify(orderPayload);

    // CRITICAL: Polymarket uses seconds timestamps (matches @polymarket/clob-client)
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signature = generateL2Signature(secret, timestamp, "POST", path, body);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "POLY_ADDRESS": eoaAddress,
      "POLY_SIGNATURE": signature,
      "POLY_TIMESTAMP": timestamp,
      "POLY_API_KEY": apiKey,
      "POLY_PASSPHRASE": passphrase,
    };

    // Builder attribution headers (optional)
    if (hasBuilderCreds && hasUserCreds) {
      const builderTimestamp = Math.floor(Date.now() / 1000).toString();
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
        success: false,
      });
    }

    const result = JSON.parse(responseText);
    console.log("[Submit Order] ✅ Order placed successfully:", result);

    return json(200, {
      success: true,
      orderID: result.orderID || result.id,
      order: result,
    });
    console.error("[Submit Order] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message, success: false });
  }
});
