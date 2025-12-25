import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Polymarket CLOB API host
const CLOB_HOST = 'https://clob.polymarket.com';

interface LinkRequest {
  walletAddress: string;
  signature: string;
  timestamp: number;
  nonce: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: LinkRequest = await req.json();
    const { walletAddress, signature, timestamp, nonce } = body;

    // Validate required fields
    if (!walletAddress || !signature || !timestamp || !nonce) {
      console.error('[link-polymarket-user] Missing required fields:', { 
        walletAddress: !!walletAddress, 
        signature: !!signature, 
        timestamp: !!timestamp, 
        nonce: !!nonce 
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: walletAddress, signature, timestamp, nonce' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[link-polymarket-user] Deriving credentials for wallet: ${walletAddress}`);
    console.log(`[link-polymarket-user] Timestamp: ${timestamp}, Nonce: ${nonce}`);

    // Polymarket CLOB auth endpoints expect auth data in headers (not JSON body).
    // Flow:
    // 1) Try to derive an existing API key via GET /auth/derive-api-key
    // 2) If not found, create one via POST /auth/api-key

    const polyAuthHeaders = {
      'POLY_ADDRESS': walletAddress.toLowerCase(),
      'POLY_SIGNATURE': signature,
      'POLY_TIMESTAMP': String(timestamp),
      'POLY_NONCE': String(nonce),
    };

    console.log('[link-polymarket-user] Trying GET /auth/derive-api-key ...');

    let credentialsResponse = await fetch(`${CLOB_HOST}/auth/derive-api-key`, {
      method: 'GET',
      headers: polyAuthHeaders,
    });

    // If no existing key, create a new one
    if (!credentialsResponse.ok) {
      const deriveText = await credentialsResponse.text();
      console.error(`[link-polymarket-user] Derive failed: ${credentialsResponse.status}`);
      console.error(`[link-polymarket-user] Derive response body: ${deriveText}`);

      console.log('[link-polymarket-user] Trying POST /auth/api-key ...');
      credentialsResponse = await fetch(`${CLOB_HOST}/auth/api-key`, {
        method: 'POST',
        headers: polyAuthHeaders,
      });

      if (!credentialsResponse.ok) {
        const createText = await credentialsResponse.text();
        console.error(`[link-polymarket-user] Create API key failed: ${credentialsResponse.status}`);
        console.error(`[link-polymarket-user] Create response body: ${createText}`);

        let errorMessage = 'Failed to link wallet (CLOB auth failed)';
        try {
          const errorJson = JSON.parse(createText);
          errorMessage = errorJson?.error || errorJson?.message || errorMessage;
        } catch {
          // ignore
        }

        return new Response(
          JSON.stringify({
            error: errorMessage,
            code: 'CLOB_AUTH_FAILED',
            status: credentialsResponse.status,
          }),
          {
            status: credentialsResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const responseText = await credentialsResponse.text();

    let credentials;
    try {
      credentials = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[link-polymarket-user] Failed to parse credentials response:', responseText);
      return new Response(
        JSON.stringify({ error: 'Invalid response from Polymarket API', code: 'PARSE_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate credentials structure
    if (!credentials.apiKey || !credentials.secret || !credentials.passphrase) {
      console.error('[link-polymarket-user] Invalid credentials structure:', Object.keys(credentials));
      return new Response(
        JSON.stringify({ error: 'Invalid credentials received from Polymarket', code: 'INVALID_CREDS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[link-polymarket-user] Successfully derived credentials for ${walletAddress}`);

    // Store credentials in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: upsertError } = await supabase
      .from('polymarket_credentials')
      .upsert({
        user_address: walletAddress.toLowerCase(),
        api_key: credentials.apiKey,
        api_secret: credentials.secret,
        api_passphrase: credentials.passphrase,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_address',
      });

    if (upsertError) {
      console.error('[link-polymarket-user] Database upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store credentials', code: 'DB_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[link-polymarket-user] Credentials stored successfully for ${walletAddress}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[link-polymarket-user] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
