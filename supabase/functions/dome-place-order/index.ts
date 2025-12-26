import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOME_API_ENDPOINT = 'https://api.domeapi.io/v1';

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOME_API_KEY = Deno.env.get('DOME_API_KEY');
    if (!DOME_API_KEY) {
      console.error('[dome-place-order] DOME_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Dome API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: PlaceOrderRequest = await req.json();
    const { signedOrder, orderType, credentials, clientOrderId } = body;

    console.log('[dome-place-order] Received order request:', {
      maker: signedOrder?.maker?.slice(0, 10),
      tokenId: signedOrder?.tokenId?.slice(0, 20),
      side: signedOrder?.side,
      orderType,
      hasCredentials: !!credentials?.apiKey,
      clientOrderId,
    });

    // Validate required fields
    if (!signedOrder || !credentials) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing signedOrder or credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize signedOrder.side to string (ClobClient returns numeric 0/1, Dome expects "BUY"/"SELL")
    const normalizedOrder = {
      ...signedOrder,
      side: typeof signedOrder.side === 'number' 
        ? (signedOrder.side === 0 ? 'BUY' : 'SELL') 
        : signedOrder.side,
    };

    console.log('[dome-place-order] Normalized order side:', {
      original: signedOrder.side,
      normalized: normalizedOrder.side,
    });

    // Prepare the request to Dome API
    const domeRequestBody = {
      jsonrpc: '2.0',
      method: 'placeOrder',
      id: clientOrderId || crypto.randomUUID(),
      params: {
        signedOrder: normalizedOrder,
        orderType,
        credentials: {
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
          apiPassphrase: credentials.apiPassphrase,
        },
        clientOrderId: clientOrderId || crypto.randomUUID(),
      },
    };

    console.log('[dome-place-order] Sending to Dome API:', {
      endpoint: `${DOME_API_ENDPOINT}/polymarket/placeOrder`,
      method: 'POST',
      orderType,
    });

    // Send to Dome API
    const domeResponse = await fetch(`${DOME_API_ENDPOINT}/polymarket/placeOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOME_API_KEY}`,
      },
      body: JSON.stringify(domeRequestBody),
    });

    const responseText = await domeResponse.text();
    console.log('[dome-place-order] Dome API response status:', domeResponse.status);
    console.log('[dome-place-order] Dome API response:', responseText.slice(0, 500));

    let domeResult;
    try {
      domeResult = JSON.parse(responseText);
    } catch {
      console.error('[dome-place-order] Failed to parse Dome response:', responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid response from Dome API',
          rawResponse: responseText.slice(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for Dome API errors
    if (domeResult.error) {
      console.error('[dome-place-order] Dome API error:', domeResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: domeResult.error.message || domeResult.error,
          code: domeResult.error.code,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - return Dome result
    console.log('[dome-place-order] Order placed successfully:', {
      status: domeResult.result?.status,
      orderId: domeResult.result?.orderId || domeResult.result?.orderID,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: domeResult.result,
        orderId: domeResult.result?.orderId || domeResult.result?.orderID,
        status: domeResult.result?.status,
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
