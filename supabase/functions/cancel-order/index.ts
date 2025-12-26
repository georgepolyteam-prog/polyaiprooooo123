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
 * Body MUST be included in the signature for DELETE /order endpoint
 */
function generateL2Headers(
  method: string,
  pathOnly: string,
  address: string,
  apiCreds: { apiKey: string; secret: string; passphrase: string },
  body?: string
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Message format: timestamp + method + path + body
  let message = timestamp + method.toUpperCase() + pathOnly;
  if (body) {
    message += body;
  }
  
  console.log(`[HMAC] Signing message for cancel: "${message}"`);

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

    // Cancel orders one by one using DELETE /order with body { orderID: ... }
    const cancelledIds: string[] = [];
    const errors: string[] = [];
    
    for (const orderId of orderIds) {
      try {
        const pathOnly = "/order";
        const requestBody = JSON.stringify({ orderID: orderId }); // Capital ID!

        // Generate L2 authentication headers WITH body in signature
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
        console.log("[Cancel Order] Response for", orderId, "status:", response.status, "body:", responseText);

        if (!response.ok) {
          // Parse error for user-friendly message
          let errorMessage = "Failed to cancel order";
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || `API error: ${response.status}`;
          } catch {
            errorMessage = responseText || `API error: ${response.status}`;
          }
          errors.push(`${orderId}: ${errorMessage}`);
        } else {
          cancelledIds.push(orderId);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${orderId}: ${msg}`);
      }
    }

    // If all failed, return error
    if (cancelledIds.length === 0 && errors.length > 0) {
      return json(400, { 
        success: false,
        error: errors[0].split(': ').slice(1).join(': ') || 'Failed to cancel order',
        errors,
      });
    }

    console.log("[Cancel Order] Successfully cancelled:", cancelledIds.length, "orders");
    
    return json(200, { 
      success: true,
      cancelled: cancelledIds,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error("[Cancel Order] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { success: false, error: message });
  }
});
