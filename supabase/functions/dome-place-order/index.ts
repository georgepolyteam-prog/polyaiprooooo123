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
    const { signedOrder, orderType, credentials, signer, funderAddress, negRisk } = body;

    console.log('[dome-place-order] Received signed order:', {
      signer: signer?.slice(0, 10),
      funderAddress: funderAddress?.slice(0, 10),
      orderType,
      hasSignedOrder: !!signedOrder,
      hasCredentials: !!credentials,
    });

    // Validate required fields
    if (!signedOrder || !credentials || !signer || !funderAddress) {
      console.error('[dome-place-order] Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: signedOrder, credentials, signer, funderAddress' 
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

    // Log signed order details for debugging
    console.log('[dome-place-order] Signed order details:', {
      tokenId: signedOrder.tokenID?.slice(0, 20),
      side: signedOrder.side,
      size: signedOrder.size,
      price: signedOrder.price,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      maker: signedOrder.maker?.slice(0, 10),
      hasSignature: !!signedOrder.signature,
    });

    // Prepare payload for Dome API
    // The signedOrder is already signed with Dome's builder-signer client-side
    const payload = {
      userId: signer,
      marketId: signedOrder.tokenID,
      side: signedOrder.side?.toLowerCase(),
      size: signedOrder.size,
      price: signedOrder.price,
      walletType: 'safe',
      funderAddress,
      orderType: orderType || 'GTC',
      negRisk: negRisk || false,
      // Pass the pre-signed order for Dome to submit to CLOB
      signedOrder: signedOrder,
      // Include credentials for API authentication
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
