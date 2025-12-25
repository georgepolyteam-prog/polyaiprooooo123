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

    // Call Polymarket CLOB API to derive/create API credentials
    // The API uses the EIP-712 signature to authenticate and derive credentials
    const derivePayload = {
      signature,
      timestamp,
      nonce,
    };
    
    console.log('[link-polymarket-user] Calling CLOB derive API...');
    
    const deriveResponse = await fetch(`${CLOB_HOST}/auth/derive-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(derivePayload),
    });

    const responseText = await deriveResponse.text();
    
    if (!deriveResponse.ok) {
      console.error(`[link-polymarket-user] CLOB derive API error: ${deriveResponse.status}`);
      console.error(`[link-polymarket-user] Response body: ${responseText}`);
      
      // Parse error for better user messaging
      let errorMessage = 'Failed to derive API credentials';
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // Use default message if not JSON
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: 'DERIVE_FAILED',
          status: deriveResponse.status 
        }),
        { status: deriveResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
