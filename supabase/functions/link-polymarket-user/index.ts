import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Polymarket CLOB API host
const CLOB_HOST = 'https://clob.polymarket.com';

interface DeriveCredentialsPayload {
  address: string;
  timestamp: number;
  nonce: number;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, signature, timestamp, nonce } = await req.json();

    if (!walletAddress || !signature || !timestamp || !nonce) {
      console.error('[link-polymarket-user] Missing required fields:', { walletAddress: !!walletAddress, signature: !!signature, timestamp: !!timestamp, nonce: !!nonce });
      throw new Error('Missing required fields: walletAddress, signature, timestamp, nonce');
    }

    console.log(`[link-polymarket-user] Deriving credentials for wallet: ${walletAddress}`);

    // Call Polymarket CLOB API to derive/create API credentials
    // The API uses the signature to authenticate and derive credentials
    const deriveResponse = await fetch(`${CLOB_HOST}/auth/derive-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signature,
        timestamp,
        nonce,
      }),
    });

    if (!deriveResponse.ok) {
      const errorText = await deriveResponse.text();
      console.error(`[link-polymarket-user] CLOB derive API error: ${deriveResponse.status} - ${errorText}`);
      throw new Error(`Failed to derive API credentials: ${deriveResponse.status}`);
    }

    const credentials = await deriveResponse.json();
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
      throw new Error('Failed to store credentials');
    }

    console.log(`[link-polymarket-user] Credentials stored for ${walletAddress}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[link-polymarket-user] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
