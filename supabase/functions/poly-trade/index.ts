import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createHmac } from 'node:crypto';

const POLY_API_KEY = Deno.env.get('POLY_API_KEY');
const POLY_API_SECRET = Deno.env.get('POLY_API_SECRET');
const POLY_API_PASSPHRASE = Deno.env.get('POLY_API_PASSPHRASE');
const CLOB_API_URL = Deno.env.get('CLOB_API_URL') || 'https://clob.polymarket.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
  signature: string;
}

// Rate limiting
const orderCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(address: string): boolean {
  const now = Date.now();
  const entry = orderCounts.get(address);
  
  if (!entry || now > entry.resetTime) {
    orderCounts.set(address, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (entry.count >= 10) {
    console.log(`[Trade] Rate limit exceeded for ${address}`);
    return false;
  }
  
  entry.count++;
  return true;
}

// Generate L2 headers for Polymarket CLOB API
function generateL2Headers(method: string, path: string, body?: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method + path + (body || '');
  
  const signature = createHmac('sha256', POLY_API_SECRET || '')
    .update(message)
    .digest('base64');

  return {
    'POLY-ADDRESS': '', // Will be set per request
    'POLY-SIGNATURE': signature,
    'POLY-TIMESTAMP': timestamp,
    'POLY-API-KEY': POLY_API_KEY || '',
    'POLY-PASSPHRASE': POLY_API_PASSPHRASE || '',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check API credentials
    if (!POLY_API_KEY || !POLY_API_SECRET || !POLY_API_PASSPHRASE) {
      console.error('[Trade] Missing API credentials');
      return new Response(
        JSON.stringify({ error: 'Trading API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, params } = await req.json();
    console.log(`[Trade] Action: ${action}`, JSON.stringify(params, null, 2));

    switch (action) {
      case 'submit_signed_order':
        return await submitSignedOrder(params);
      
      case 'cancel_order':
        return await cancelOrder(params);
      
      case 'get_orders':
        return await getOrders(params);
      
      case 'get_balance':
        return await getBalance(params);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('[Trade] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Submit an order that has already been signed by the user's wallet
 */
async function submitSignedOrder(params: { signedOrder: SignedOrder; userAddress: string }) {
  console.log('[Trade] Submitting signed order for:', params.userAddress);
  
  const { signedOrder, userAddress } = params;

  // Validate the signed order
  if (!signedOrder || !signedOrder.signature) {
    return new Response(
      JSON.stringify({ error: 'Missing signed order or signature' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the maker matches the user address
  if (signedOrder.maker.toLowerCase() !== userAddress.toLowerCase()) {
    return new Response(
      JSON.stringify({ error: 'Order maker does not match user address' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limit check
  if (!checkRateLimit(userAddress)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Max 10 orders per minute.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Format order for CLOB API
  const orderPayload = {
    order: {
      salt: signedOrder.salt,
      maker: signedOrder.maker,
      signer: signedOrder.signer,
      taker: signedOrder.taker,
      tokenId: signedOrder.tokenId,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      expiration: signedOrder.expiration,
      nonce: signedOrder.nonce,
      feeRateBps: signedOrder.feeRateBps,
      side: signedOrder.side,
      signatureType: signedOrder.signatureType,
    },
    signature: signedOrder.signature,
    owner: userAddress,
    orderType: 'GTC', // Good Till Cancelled
  };

  const path = '/order';
  const body = JSON.stringify(orderPayload);
  const headers = generateL2Headers('POST', path, body);
  headers['POLY-ADDRESS'] = userAddress;

  try {
    console.log('[Trade] Sending to CLOB API:', `${CLOB_API_URL}${path}`);
    console.log('[Trade] Order payload:', body);

    const response = await fetch(`${CLOB_API_URL}${path}`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body,
    });

    const responseText = await response.text();
    console.log(`[Trade] API Response (${response.status}):`, responseText);

    if (!response.ok) {
      console.error('[Trade] Order submission failed:', responseText);
      
      // Try to parse error message
      let errorMessage = 'Order submission failed';
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.message || errorJson.error || responseText;
      } catch {
        errorMessage = responseText;
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          success: false 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(responseText);
    console.log('[Trade] ✅ Order placed:', result);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        orderID: result.orderID || result.id,
        order: result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (fetchError: unknown) {
    console.error('[Trade] Fetch error:', fetchError);
    const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Network error: ${message}`, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function cancelOrder(params: { orderID: string; userAddress: string }) {
  console.log('[Trade] Cancelling order:', params.orderID);
  
  const path = `/order/${params.orderID}`;
  const headers = generateL2Headers('DELETE', path);
  headers['POLY-ADDRESS'] = params.userAddress;

  const response = await fetch(`${CLOB_API_URL}${path}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Trade] Cancel failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to cancel order', success: false }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[Trade] ✅ Order cancelled');
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getOrders(params: { userAddress: string }) {
  console.log('[Trade] Getting orders for:', params.userAddress);
  
  const path = `/orders?maker=${params.userAddress}`;
  const headers = generateL2Headers('GET', path);
  headers['POLY-ADDRESS'] = params.userAddress;

  const response = await fetch(`${CLOB_API_URL}${path}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Trade] Get orders failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get orders', orders: [] }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const orders = await response.json();
  return new Response(
    JSON.stringify({ orders }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getBalance(params: { userAddress: string }) {
  console.log('[Trade] Getting balance for:', params.userAddress);
  
  const path = `/balance/${params.userAddress}`;
  const headers = generateL2Headers('GET', path);
  headers['POLY-ADDRESS'] = params.userAddress;

  const response = await fetch(`${CLOB_API_URL}${path}`, {
    headers,
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to get balance', balance: '0' }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const balance = await response.json();
  return new Response(
    JSON.stringify({ balance }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
