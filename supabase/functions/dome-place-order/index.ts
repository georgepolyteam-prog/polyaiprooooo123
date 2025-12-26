import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dome API endpoint
const DOME_API_ENDPOINT = 'https://api.domeapi.io/v1';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { signedOrder, orderParams, orderType, credentials, signer, funderAddress, negRisk } = body;

    console.log('[dome-place-order] Received order:', {
      signer: signer?.slice(0, 10),
      funderAddress: funderAddress?.slice(0, 10),
      orderType,
      hasSignedOrder: !!signedOrder,
      hasOrderParams: !!orderParams,
      hasCredentials: !!credentials,
    });

    // Validate required fields
    if (!signedOrder || !orderParams || !credentials || !signer || !funderAddress) {
      console.error('[dome-place-order] Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: signedOrder, orderParams, credentials, signer, funderAddress' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Dome API key from environment
    const DOME_API_KEY = Deno.env.get('DOME_API_KEY');
    if (!DOME_API_KEY) {
      console.error('[dome-place-order] DOME_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Dome API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log order details for debugging
    console.log('[dome-place-order] Order params:', {
      tokenId: orderParams.tokenId?.slice(0, 20),
      side: orderParams.side,
      size: orderParams.size,
      price: orderParams.price,
    });

    console.log('[dome-place-order] Signed order details:', {
      maker: signedOrder.maker?.slice(0, 10),
      hasSignature: !!signedOrder.signature,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
    });

    // Prepare payload for Dome API using orderParams for readable fields
    const payload = {
      userId: signer,
      marketId: orderParams.tokenId,
      side: orderParams.side.toLowerCase(),  // Now works - it's a string!
      size: orderParams.size,
      price: orderParams.price,
      walletType: 'safe',
      funderAddress,
      orderType: orderType || 'GTC',
      negRisk: negRisk || false,
      signedOrder: signedOrder,  // The actual signed order for CLOB
      credentials: {
        key: credentials.apiKey,
        secret: credentials.apiSecret,
        passphrase: credentials.passphrase,
      },
    };

    console.log('[dome-place-order] Submitting to Dome API:', {
      endpoint: `${DOME_API_ENDPOINT}/polymarket/placeOrder`,
      userId: payload.userId?.slice(0, 10),
      marketId: payload.marketId?.slice(0, 20),
      side: payload.side,
      size: payload.size,
      price: payload.price,
    });

    // Submit to Dome's placeOrder endpoint
    const response = await fetch(`${DOME_API_ENDPOINT}/polymarket/placeOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOME_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[dome-place-order] Dome API response status:', response.status);
    console.log('[dome-place-order] Dome API response:', responseText.slice(0, 500));

    let result;
    try {
      result = JSON.parse(responseText);
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

    // Check for API errors
    if (!response.ok) {
      console.error('[dome-place-order] Dome API error:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error || result.message || 'Order rejected by Dome',
          code: result.code,
          details: result,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderId = result?.orderID || result?.orderId || result?.id;
    console.log('[dome-place-order] Order placed successfully:', {
      orderId,
      status: result?.status,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        result,
        orderId,
        status: result?.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[dome-place-order] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
