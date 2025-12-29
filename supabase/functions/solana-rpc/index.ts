import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Whitelist of safe RPC methods that clients can call
const ALLOWED_METHODS = [
  'getAccountInfo',
  'getBalance',
  'getBlockHeight',
  'getLatestBlockhash',
  'getMinimumBalanceForRentExemption',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getRecentBlockhash',
  'getSignatureStatuses',
  'getSlot',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getTransaction',
  'sendTransaction',
  'simulateTransaction',
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    if (!HELIUS_API_KEY) {
      console.error('[solana-rpc] HELIUS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'RPC not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    // Parse the incoming JSON-RPC request
    const body = await req.json();
    console.log('[solana-rpc] Incoming request:', JSON.stringify(body).slice(0, 200));

    // Validate request structure
    if (!body.method) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON-RPC request: missing method' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if method is allowed
    if (!ALLOWED_METHODS.includes(body.method)) {
      console.warn(`[solana-rpc] Blocked disallowed method: ${body.method}`);
      return new Response(
        JSON.stringify({ error: `Method not allowed: ${body.method}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward the request to Helius
    console.log(`[solana-rpc] Forwarding ${body.method} to Helius...`);
    const heliusResponse = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!heliusResponse.ok) {
      const errorText = await heliusResponse.text();
      console.error(`[solana-rpc] Helius error ${heliusResponse.status}:`, errorText);
      return new Response(
        JSON.stringify({ error: `RPC error: ${heliusResponse.status}`, details: errorText }),
        { status: heliusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await heliusResponse.json();
    console.log(`[solana-rpc] ${body.method} success`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[solana-rpc] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
