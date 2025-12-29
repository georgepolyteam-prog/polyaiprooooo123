import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, solana-client',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Whitelist of safe RPC methods that clients can call
const ALLOWED_METHODS = [
  'getAccountInfo',
  'getBalance',
  'getBlockHeight',
  'getLatestBlockhash',
  'getMinimumBalanceForRentExemption',
  'getMultipleAccounts',
  'getParsedAccountInfo',
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
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'RPC not configured' }, id: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    // Parse the incoming JSON-RPC request
    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('[solana-rpc] Failed to parse request body');
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const methodName = body.method || 'unknown';
    const requestId = body.id || null;
    
    console.log(`[solana-rpc] ${methodName} request received`);

    // Validate request structure
    if (!body.method) {
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request: missing method' }, id: requestId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if method is allowed
    if (!ALLOWED_METHODS.includes(body.method)) {
      console.warn(`[solana-rpc] Blocked disallowed method: ${body.method}`);
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: `Method not allowed: ${body.method}` }, id: requestId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward the request to Helius
    const heliusResponse = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseText = await heliusResponse.text();
    
    if (!heliusResponse.ok) {
      console.error(`[solana-rpc] Helius error ${heliusResponse.status}:`, responseText.slice(0, 200));
      // Return proper JSON-RPC error format
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: `RPC error: ${heliusResponse.status}` }, id: requestId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[solana-rpc] ${methodName} success`);

    // Return the raw response from Helius (already JSON-RPC formatted)
    return new Response(responseText, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[solana-rpc] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: errorMessage }, id: null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
