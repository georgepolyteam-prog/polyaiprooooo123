import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkUserRequest {
  privyUserId: string;
  walletAddress: string;
  privyWalletId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PRIVY_APP_ID = Deno.env.get('PRIVY_APP_ID');
    const PRIVY_APP_SECRET = Deno.env.get('PRIVY_APP_SECRET');
    const PRIVY_AUTHORIZATION_KEY = Deno.env.get('PRIVY_AUTHORIZATION_KEY');

    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET || !PRIVY_AUTHORIZATION_KEY) {
      console.error('[privy-link-user] Missing Privy credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'Privy credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: LinkUserRequest = await req.json();
    const { privyUserId, walletAddress, privyWalletId } = body;

    console.log('[privy-link-user] Linking user:', {
      privyUserId: privyUserId?.slice(0, 10),
      walletAddress: walletAddress?.slice(0, 10),
    });

    if (!privyUserId || !walletAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create EIP-712 payload for Polymarket CLOB API key derivation
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 1000000);
    
    const domain = {
      name: "ClobAuthDomain",
      version: "1",
      chainId: 137,
    };

    const types = {
      ClobAuth: [
        { name: "address", type: "address" },
        { name: "timestamp", type: "string" },
        { name: "nonce", type: "uint256" },
        { name: "message", type: "string" },
      ],
    };

    const message = {
      address: walletAddress,
      timestamp: String(timestamp),
      nonce: nonce,
      message: "This message attests that I control the given wallet",
    };

    console.log('[privy-link-user] Signing with Privy authorization key...');

    // Sign using Privy authorization key API
    const signResponse = await fetch(
      `https://auth.privy.io/api/v1/wallets/${walletAddress}/rpc`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`)}`,
          'privy-app-id': PRIVY_APP_ID,
          'privy-authorization-signature': PRIVY_AUTHORIZATION_KEY,
        },
        body: JSON.stringify({
          method: 'eth_signTypedData_v4',
          params: {
            typedData: {
              domain,
              types,
              primaryType: 'ClobAuth',
              message,
            },
          },
        }),
      }
    );

    if (!signResponse.ok) {
      const errorText = await signResponse.text();
      console.error('[privy-link-user] Privy signing failed:', signResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Privy signing failed: ${signResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const signResult = await signResponse.json();
    const signature = signResult.data?.signature || signResult.signature;

    if (!signature) {
      console.error('[privy-link-user] No signature in response:', signResult);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get signature from Privy' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[privy-link-user] Got signature, deriving API key...');

    // Call Polymarket CLOB to derive/create API key
    const clobResponse = await fetch('https://clob.polymarket.com/auth/derive-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: walletAddress,
        signature,
        timestamp: String(timestamp),
        nonce,
      }),
    });

    if (!clobResponse.ok) {
      const errorText = await clobResponse.text();
      console.error('[privy-link-user] CLOB derive-api-key failed:', clobResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `CLOB API key derivation failed: ${clobResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clobResult = await clobResponse.json();

    console.log('[privy-link-user] API key derived successfully');

    return new Response(
      JSON.stringify({
        success: true,
        credentials: {
          apiKey: clobResult.apiKey || clobResult.key,
          apiSecret: clobResult.secret,
          apiPassphrase: clobResult.passphrase,
        },
        walletAddress,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[privy-link-user] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
