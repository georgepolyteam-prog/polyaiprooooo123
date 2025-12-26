import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dome API endpoint - matches SDK's DOME_API_ENDPOINT constant
const DOME_API_ENDPOINT = 'https://api.domeapi.io/v1';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signedOrder, orderType, credentials, signer, funderAddress, negRisk } = await req.json();

    console.log('[dome-place-order] Request received:', {
      signer: signer?.slice(0, 10),
      tokenId: signedOrder?.tokenId?.slice(0, 20),
      side: signedOrder?.side,
      funderAddress: funderAddress?.slice(0, 10),
      orderType,
      hasCredentials: !!credentials,
    });

    // Validate required fields
    if (!signedOrder || !credentials || !signer || !funderAddress) {
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

    // Calculate size and price from signed order amounts
    const makerAmount = parseFloat(signedOrder.makerAmount);
    const takerAmount = parseFloat(signedOrder.takerAmount);
    const size = takerAmount / 1e6; // Convert from USDC decimals
    const price = makerAmount / takerAmount;

    // Prepare request payload matching SDK's placeOrder method
    // See: dome-sdk-ts/src/router/polymarket.ts lines 456-608
    const payload = {
      userId: signer,
      marketId: signedOrder.tokenId,
      side: signedOrder.side?.toLowerCase(),
      size,
      price,
      walletType: 'safe',
      funderAddress,
      orderType: orderType || 'GTC',
      negRisk: negRisk || false,
      // Include credentials for API authentication
      credentials: {
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        apiPassphrase: credentials.passphrase,
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

    // Submit to Dome's placeOrder endpoint (SDK's server-side endpoint)
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

    console.log('[dome-place-order] Order placed via Dome API:', {
      orderId: result?.orderID || result?.orderId || result?.id,
      status: result?.status,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        result,
        orderId: result?.orderID || result?.orderId || result?.id,
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
