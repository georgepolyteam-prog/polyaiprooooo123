import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOME_API_URL = 'https://api.domeapi.io/v1';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { signedOrder, orderType, credentials } = body;

    console.log('[dome-place-order] Received request:', {
      hasSignedOrder: !!signedOrder,
      hasCredentials: !!credentials,
      orderType,
    });

    // Get Dome API key from environment
    const DOME_API_KEY = Deno.env.get('DOME_API_KEY');
    if (!DOME_API_KEY) {
      console.error('[dome-place-order] DOME_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Dome API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!signedOrder || !credentials) {
      console.error('[dome-place-order] Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: signedOrder and credentials are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique IDs for JSON-RPC
    const requestId = crypto.randomUUID();
    const clientOrderId = crypto.randomUUID();

    // JSON-RPC 2.0 format (required by Dome API)
    const payload = {
      jsonrpc: '2.0',
      method: 'placeOrder',
      id: requestId,
      params: {
        signedOrder: signedOrder,
        orderType: orderType || 'GTC',
        credentials: {
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
          apiPassphrase: credentials.passphrase,
        },
        clientOrderId: clientOrderId,
      },
    };

    console.log('[dome-place-order] Submitting JSON-RPC request to Dome API:', {
      endpoint: `${DOME_API_URL}/polymarket/placeOrder`,
      requestId,
      clientOrderId,
      signedOrderMaker: signedOrder.maker?.slice(0, 10),
      signedOrderTokenId: signedOrder.tokenId?.slice(0, 20),
    });

    // Submit to Dome API
    const response = await fetch(`${DOME_API_URL}/polymarket/placeOrder`, {
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

    // Handle JSON-RPC error response
    if (result.error) {
      console.error('[dome-place-order] JSON-RPC error:', result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error.message || 'Order rejected by Dome',
          code: result.error.code,
          details: result.error.data,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle non-2xx HTTP status (but valid JSON)
    if (!response.ok && !result.result) {
      console.error('[dome-place-order] Dome API HTTP error:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.message || 'Order rejected by Dome',
          details: result,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle JSON-RPC success response
    const orderId = result.result?.orderId || result.result?.orderID || result.result?.id;
    console.log('[dome-place-order] Order placed successfully:', {
      orderId,
      status: result.result?.status,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId,
        status: result.result?.status,
        result: result.result,
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
