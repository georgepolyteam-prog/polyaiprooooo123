import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOB_API_URL = Deno.env.get("CLOB_API_URL") || "https://clob.polymarket.com";

// Dome's builder-signer service for builder attribution (optional)
const BUILDER_SIGNER_URL = "https://builder-signer.domeapi.io/builder-signer/sign";

interface PlaceOrderRequest {
  signedOrder: {
    salt: string;
    maker: string;
    signer: string;
    taker: string;
    tokenId: string;
    makerAmount: string;
    takerAmount: string;
    side: string | number;
    expiration: string;
    nonce: string;
    feeRateBps: string;
    signatureType: number;
    signature: string;
  };
  orderType: "GTC" | "GTD" | "FOK" | "FAK";
  credentials: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  };
  clientOrderId?: string;
}

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

async function signWithBuilderSigner(method: string, path: string, body: string) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const res = await fetch(BUILDER_SIGNER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, path, body, timestamp }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[dome-place-order] builder-signer skipped:", res.status, text.slice(0, 200));
      return null;
    }

    return await res.json();
  } catch (e) {
    console.warn("[dome-place-order] builder-signer failed (skipped):", e);
    return null;
  }
}

function normalizeSide(side: string | number): "BUY" | "SELL" {
  if (typeof side === "string") {
    const upper = side.toUpperCase();
    return upper === "BUY" ? "BUY" : "SELL";
  }
  // clob-client uses numeric enum internally (0=BUY, 1=SELL)
  return side === 0 ? "BUY" : "SELL";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PlaceOrderRequest = await req.json();
    const { signedOrder, orderType, credentials, clientOrderId } = body;

    console.log("[dome-place-order] Received order request:", {
      maker: signedOrder?.maker?.slice(0, 10),
      tokenId: signedOrder?.tokenId?.slice(0, 20),
      side: signedOrder?.side,
      orderType,
      hasCredentials: !!credentials?.apiKey,
      clientOrderId,
    });

    if (!signedOrder || !credentials?.apiKey || !credentials?.apiSecret || !credentials?.apiPassphrase) {
      return new Response(JSON.stringify({ success: false, error: "Missing signedOrder or credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderPath = "/order";

    // Match clob-client `orderToJson` payload shape
    const orderPayload = {
      deferExec: false,
      order: {
        ...signedOrder,
        // clob expects salt as number
        salt: Number.parseInt(String(signedOrder.salt), 10),
        // clob expects side as "BUY" | "SELL"
        side: normalizeSide(signedOrder.side),
      },
      // clob-client passes creds.key as "owner" in payload
      owner: credentials.apiKey,
      orderType,
    };

    const orderBody = JSON.stringify(orderPayload);

    // Optional builder attribution headers
    const builderHeaders = await signWithBuilderSigner("POST", orderPath, orderBody);

    // L2 auth headers (HMAC)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hmacSignature = await createHmacSignature(credentials.apiSecret, timestamp, "POST", orderPath, orderBody);

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      POLY_ADDRESS: signedOrder.maker,
      POLY_SIGNATURE: hmacSignature,
      POLY_TIMESTAMP: timestamp,
      POLY_API_KEY: credentials.apiKey,
      POLY_PASSPHRASE: credentials.apiPassphrase,
    };

    if (builderHeaders && typeof builderHeaders === "object") {
      Object.assign(requestHeaders, builderHeaders);
    }

    const clobResponse = await fetch(`${CLOB_API_URL}${orderPath}`, {
      method: "POST",
      headers: requestHeaders,
      body: orderBody,
    });

    const responseText = await clobResponse.text();
    console.log("[dome-place-order] CLOB response status:", clobResponse.status);
    console.log("[dome-place-order] CLOB response:", responseText.slice(0, 500));

    let clobResult: any;
    try {
      clobResult = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid response from CLOB", rawResponse: responseText.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!clobResponse.ok) {
      const message = clobResult?.message || clobResult?.error || "ORDER_REJECTED";
      return new Response(
        JSON.stringify({ success: false, error: message, code: clobResult?.code, details: clobResult }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: clobResult,
        orderId: clobResult?.orderID || clobResult?.id,
        status: clobResult?.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[dome-place-order] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
