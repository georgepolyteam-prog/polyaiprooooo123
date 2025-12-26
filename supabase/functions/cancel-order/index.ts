import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Edge function to cancel orders on Polymarket CLOB API.
 * Requires L2 authentication headers (HMAC signature).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOB_HOST = "https://clob.polymarket.com";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Generate L2 HMAC headers for Polymarket CLOB API
 * For DELETE requests with body, we need to include the body in the signature
 */
function generateL2Headers(
  method: string,
  pathOnly: string,
  address: string,
  apiCreds: { apiKey: string; secret: string; passphrase: string },
  body?: string
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Message format: timestamp + method + path + body (if present)
  let message = timestamp + method.toUpperCase() + pathOnly;
  if (body) {
    message += body;
  }
  
  console.log(`[HMAC] Signing message for cancel: "${message.slice(0, 100)}..."`);

  const secretBuffer = Buffer.from(apiCreds.secret, "base64");
  const signature = createHmac("sha256", secretBuffer)
    .update(message)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return {
    "POLY_ADDRESS": address.toLowerCase(),
    "POLY_SIGNATURE": signature,
    "POLY_TIMESTAMP": timestamp,
    "POLY_API_KEY": apiCreds.apiKey,
    "POLY_PASSPHRASE": apiCreds.passphrase,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiCreds, walletAddress, orderIds } = await req.json();

    if (!walletAddress) {
      return json(400, { error: "Missing wallet address" });
    }

    if (!apiCreds?.secret || !apiCreds?.apiKey || !apiCreds?.passphrase) {
      return json(400, { error: "Missing API credentials" });
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return json(400, { error: "Missing or empty orderIds array" });
    }

    console.log("[Cancel Order] Cancelling orders:", orderIds);

    const pathOnly = "/orders";
    const requestBody = JSON.stringify({ orderIds });

    // Generate L2 authentication headers with body included in signature
    const l2Headers = generateL2Headers("DELETE", pathOnly, walletAddress, apiCreds, requestBody);

    const response = await fetch(`${CLOB_HOST}${pathOnly}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...l2Headers,
      },
      body: requestBody,
    });

    const responseText = await response.text();
    console.log("[Cancel Order] Response status:", response.status, "body:", responseText);

    if (!response.ok) {
      // Parse error for user-friendly message
      let errorMessage = "Failed to cancel order";
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = responseText || `API error: ${response.status}`;
      }
      
      return json(response.status, { 
        success: false,
        error: errorMessage,
      });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { cancelled: orderIds };
    }

    console.log("[Cancel Order] Successfully cancelled orders");
    
    return json(200, { 
      success: true,
      cancelled: result.cancelled || orderIds,
      result,
    });
  } catch (error: unknown) {
    console.error("[Cancel Order] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { success: false, error: message });
  }
});
