import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PolymarketRouter } from "npm:@dome-api/sdk@^0.17.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_CHAIN_ID = 137;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { address, safeAddress, signedTypeData } = body;

    console.log('[dome-link-user] Request received:', {
      hasAddress: !!address,
      hasSafeAddress: !!safeAddress,
      hasSignedTypeData: !!signedTypeData,
    });

    // Validate required fields
    if (!address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Dome API key from environment
    const DOME_API_KEY = Deno.env.get('DOME_API_KEY');
    if (!DOME_API_KEY) {
      console.error('[dome-link-user] DOME_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Dome API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[dome-link-user] Initializing PolymarketRouter...');
    
    // Initialize router with API key
    const router = new PolymarketRouter({
      chainId: POLYGON_CHAIN_ID,
      apiKey: DOME_API_KEY,
    });

    // For server-side linking, we need to use createOrDeriveApiKey directly
    // Since we can't do wallet signing server-side, we use the CLOB API approach
    console.log('[dome-link-user] Calling Polymarket CLOB API to create/derive credentials...');

    // Use the Dome API to link user (creates API credentials)
    // This is a simplified flow - the actual signing happens client-side
    const DOME_API_URL = 'https://api.domeapi.io/v1';
    
    const linkPayload = {
      jsonrpc: '2.0',
      method: 'linkUser',
      id: crypto.randomUUID(),
      params: {
        address: address,
        safeAddress: safeAddress || null,
      },
    };

    console.log('[dome-link-user] Calling Dome linkUser API...');
    
    const response = await fetch(`${DOME_API_URL}/polymarket/linkUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOME_API_KEY}`,
      },
      body: JSON.stringify(linkPayload),
    });

    const responseText = await response.text();
    console.log('[dome-link-user] Dome API response status:', response.status);
    console.log('[dome-link-user] Dome API response:', responseText.slice(0, 500));

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error('[dome-link-user] Failed to parse response:', responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid response from Dome API',
          rawResponse: responseText.slice(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle JSON-RPC error
    if (result.error) {
      console.error('[dome-link-user] JSON-RPC error:', result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error.message || 'Failed to link user',
          code: result.error.code,
          details: result.error.data,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle success
    const credentials = result.result?.credentials || result.result;
    const resultSafeAddress = result.result?.safeAddress || safeAddress;

    console.log('[dome-link-user] Link successful:', {
      hasCredentials: !!credentials?.apiKey,
      safeAddress: resultSafeAddress?.slice(0, 10),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        credentials: {
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
          apiPassphrase: credentials.apiPassphrase,
        },
        safeAddress: resultSafeAddress,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[dome-link-user] Error:', error);
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
