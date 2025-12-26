import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOB_API_URL = 'https://clob.polymarket.com';
const BUILDER_SIGNER_URL = 'https://builder-signer.domeapi.io/builder-signer/sign';

interface PlaceOrderRequest {
  signedOrder: {
    salt: string;
    maker: string;
    signer: string;
    taker: string;
    tokenId: string;
    makerAmount: string;
    takerAmount: string;
    side: string;
    expiration: string;
    nonce: string;
    feeRateBps: string;
    signatureType: number;
    signature: string;
  };
  orderType: 'GTC' | 'GTD' | 'FOK' | 'FAK';
  credentials: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  };
  clientOrderId?: string;
}

// Generate HMAC-SHA256 signature for Polymarket CLOB API
async function createHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body?: string
): Promise<string> {
  const message = timestamp + method + path + (body || '');
  
  // Decode base64 secret
  const secretBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  
  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Get optional builder attribution headers (non-blocking)
async function getBuilderHeaders(
  method: string,
  path: string,
  body: string,
  timestamp: string
): Promise<Record<string, string>> {
  try {
    const response = await fetch(BUILDER_SIGNER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, path, body, timestamp }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[dome-place-order] Builder headers received:', Object.keys(data));
      return data.headers || {};
    }
    
    console.log('[dome-place-order] Builder signer returned non-ok:', response.status);
    return {};
  } catch (error) {
    console.log('[dome-place-order] Builder signer failed (non-blocking):', error);
    return {};
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PlaceOrderRequest = await req.json();
    const { signedOrder, orderType, credentials, clientOrderId } = body;

    console.log('[dome-place-order] Received order request:', {
      maker: signedOrder?.maker?.slice(0, 10),
      tokenId: signedOrder?.tokenId?.slice(0, 20),
      side: signedOrder?.side,
      orderType,
      signatureType: signedOrder?.signatureType,
      hasCredentials: !!credentials?.apiKey,
    });

    // Validate required fields
    if (!signedOrder || !credentials) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing signedOrder or credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize side to string format expected by CLOB
    const normalizedOrder = {
      ...signedOrder,
      side: typeof signedOrder.side === 'number' 
        ? (signedOrder.side === 0 ? 'BUY' : 'SELL') 
        : signedOrder.side,
    };

    // Prepare request body for CLOB API
    const orderPayload = {
      order: normalizedOrder,
      orderType,
    };
    
    const orderBody = JSON.stringify(orderPayload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = '/order';
    const method = 'POST';

    // Generate HMAC signature
    const hmacSignature = await createHmacSignature(
      credentials.apiSecret,
      timestamp,
      method,
      path,
      orderBody
    );

    console.log('[dome-place-order] Generated HMAC signature for CLOB API');

    // Get optional builder attribution headers (don't block on failure)
    const builderHeaders = await getBuilderHeaders(method, path, orderBody, timestamp);

    // Submit to Polymarket CLOB
    console.log('[dome-place-order] Submitting to CLOB:', CLOB_API_URL + path);

    const clobResponse = await fetch(`${CLOB_API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'POLY_API_KEY': credentials.apiKey,
        'POLY_SIGNATURE': hmacSignature,
        'POLY_TIMESTAMP': timestamp,
        'POLY_PASSPHRASE': credentials.apiPassphrase,
        ...builderHeaders,
      },
      body: orderBody,
    });

    const responseText = await clobResponse.text();
    console.log('[dome-place-order] CLOB response status:', clobResponse.status);
    console.log('[dome-place-order] CLOB response:', responseText.slice(0, 500));

    let clobResult;
    try {
      clobResult = JSON.parse(responseText);
    } catch {
      console.error('[dome-place-order] Failed to parse CLOB response:', responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid response from CLOB API',
          rawResponse: responseText.slice(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for CLOB API errors
    if (!clobResponse.ok) {
      console.error('[dome-place-order] CLOB API error:', clobResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: clobResult.error || clobResult.message || 'Order rejected by CLOB',
          code: clobResult.code,
          details: clobResult,
        }),
        { status: clobResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - return CLOB result
    console.log('[dome-place-order] Order placed successfully:', {
      orderId: clobResult.orderID || clobResult.id,
      status: clobResult.status,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: clobResult,
        orderId: clobResult.orderID || clobResult.id,
        status: clobResult.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[dome-place-order] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
