import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOME_API_URL = 'https://api.domeapi.io/v1/polymarket/order';

interface DomeOrderRequest {
  userId: string;
  marketId: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  walletType: 'safe' | 'eoa';
  funderAddress: string;
  signature: string;
  orderType?: 'GTC' | 'GTD' | 'FOK' | 'FAK';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DomeOrderRequest = await req.json();
    
    console.log('[dome-place-order] Received order request:', {
      userId: body.userId?.slice(0, 10),
      marketId: body.marketId?.slice(0, 20),
      side: body.side,
      size: body.size,
      price: body.price,
      walletType: body.walletType,
      funderAddress: body.funderAddress?.slice(0, 10),
      hasSignature: !!body.signature,
      orderType: body.orderType,
    });

    // Validate required fields
    if (!body.userId || !body.marketId || !body.side || !body.size || !body.price || !body.funderAddress || !body.signature) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: userId, marketId, side, size, price, funderAddress, signature' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Dome API key from environment
    const domeApiKey = Deno.env.get('DOME_API_KEY');
    if (!domeApiKey) {
      console.error('[dome-place-order] DOME_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Dome API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare Dome API payload
    const domePayload = {
      userId: body.userId,
      marketId: body.marketId,
      side: body.side.toLowerCase(), // Dome expects lowercase
      size: body.size,
      price: body.price,
      walletType: body.walletType || 'safe',
      funderAddress: body.funderAddress,
      signature: body.signature,
      orderType: body.orderType || 'GTC',
    };

    console.log('[dome-place-order] Submitting to Dome API:', DOME_API_URL);

    // Submit to Dome API
    const domeResponse = await fetch(DOME_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${domeApiKey}`,
      },
      body: JSON.stringify(domePayload),
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
    if (!domeResponse.ok) {
      console.error('[dome-place-order] Dome API error:', domeResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: domeResult.error || domeResult.message || 'Order rejected by Dome',
          code: domeResult.code,
          details: domeResult,
        }),
        { status: domeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - return Dome result
    console.log('[dome-place-order] Order placed successfully:', {
      orderId: domeResult.orderId || domeResult.id,
      status: domeResult.status,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: domeResult,
        orderId: domeResult.orderId || domeResult.id,
        status: domeResult.status,
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
