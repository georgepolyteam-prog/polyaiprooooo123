import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOB_HOST = 'https://clob.polymarket.com';

interface OrderRequest {
  privyUserId: string;
  walletAddress: string;
  credentials: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  };
  order: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    orderType: 'GTC' | 'GTD' | 'FOK' | 'FAK';
    tickSize?: string;
    negRisk?: boolean;
  };
}

// Generate HMAC signature for Polymarket CLOB API
async function generateHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body?: string
): Promise<string> {
  const message = timestamp + method + path + (body || '');
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(secret), c => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Generate random salt for order
function generateSalt(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
    const DOME_API_KEY = Deno.env.get('DOME_API_KEY');

    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET || !PRIVY_AUTHORIZATION_KEY) {
      console.error('[privy-place-order] Missing Privy credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'Privy credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: OrderRequest = await req.json();
    const { privyUserId, walletAddress, credentials, order } = body;

    console.log('[privy-place-order] Placing order:', {
      privyUserId: privyUserId?.slice(0, 10),
      walletAddress: walletAddress?.slice(0, 10),
      tokenId: order?.tokenId?.slice(0, 20),
      side: order?.side,
      size: order?.size,
      price: order?.price,
      orderType: order?.orderType,
    });

    if (!privyUserId || !walletAddress || !credentials || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build order payload
    const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours
    const salt = generateSalt();
    const nonce = '0';
    
    // Calculate maker/taker amounts
    // makerAmount = size * price (in USDC micro units - 6 decimals)
    // takerAmount = size (in shares - no decimals for CTF)
    const priceInCents = Math.round(order.price * 100);
    const sizeInUnits = Math.floor(order.size);
    
    // For BUY: maker gives USDC, gets shares
    // For SELL: maker gives shares, gets USDC
    const makerAmount = order.side === 'BUY' 
      ? String(Math.floor(sizeInUnits * order.price * 1e6)) // USDC with 6 decimals
      : String(Math.floor(sizeInUnits * 1e6)); // Shares
    const takerAmount = order.side === 'BUY'
      ? String(Math.floor(sizeInUnits * 1e6)) // Shares
      : String(Math.floor(sizeInUnits * order.price * 1e6)); // USDC

    const orderPayload = {
      salt,
      maker: walletAddress,
      signer: walletAddress,
      taker: '0x0000000000000000000000000000000000000000',
      tokenId: order.tokenId,
      makerAmount,
      takerAmount,
      side: order.side === 'BUY' ? 0 : 1,
      expiration: String(expiration),
      nonce,
      feeRateBps: '0',
      signatureType: 0, // EOA signature
    };

    // EIP-712 domain and types for order signing
    const domain = {
      name: 'Polymarket CTF Exchange',
      version: '1',
      chainId: 137,
      verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E', // CTF Exchange
    };

    const types = {
      Order: [
        { name: 'salt', type: 'uint256' },
        { name: 'maker', type: 'address' },
        { name: 'signer', type: 'address' },
        { name: 'taker', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'makerAmount', type: 'uint256' },
        { name: 'takerAmount', type: 'uint256' },
        { name: 'expiration', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'feeRateBps', type: 'uint256' },
        { name: 'side', type: 'uint8' },
        { name: 'signatureType', type: 'uint8' },
      ],
    };

    console.log('[privy-place-order] Signing order with Privy...');

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
              primaryType: 'Order',
              message: orderPayload,
            },
          },
        }),
      }
    );

    if (!signResponse.ok) {
      const errorText = await signResponse.text();
      console.error('[privy-place-order] Privy signing failed:', signResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Order signing failed: ${signResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const signResult = await signResponse.json();
    const signature = signResult.data?.signature || signResult.signature;

    if (!signature) {
      console.error('[privy-place-order] No signature in response:', signResult);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get signature from Privy' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[privy-place-order] Order signed, submitting to CLOB...');

    // Submit to Polymarket CLOB
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = '/order';
    const method = 'POST';
    
    const signedOrder = {
      ...orderPayload,
      signature,
      side: order.side,
    };

    const orderBody = JSON.stringify({
      order: signedOrder,
      orderType: order.orderType,
    });

    const hmacSignature = await generateHmacSignature(
      credentials.apiSecret,
      timestamp,
      method,
      path,
      orderBody
    );

    const clobResponse = await fetch(`${CLOB_HOST}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'POLY_ADDRESS': walletAddress,
        'POLY_SIGNATURE': hmacSignature,
        'POLY_TIMESTAMP': timestamp,
        'POLY_NONCE': String(Math.floor(Math.random() * 1000000)),
        'POLY_API_KEY': credentials.apiKey,
        'POLY_PASSPHRASE': credentials.apiPassphrase,
      },
      body: orderBody,
    });

    const responseText = await clobResponse.text();
    console.log('[privy-place-order] CLOB response:', clobResponse.status, responseText.slice(0, 500));

    let clobResult;
    try {
      clobResult = JSON.parse(responseText);
    } catch {
      console.error('[privy-place-order] Failed to parse CLOB response');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid CLOB response',
          rawResponse: responseText.slice(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (clobResult.error || clobResult.errorMsg) {
      console.error('[privy-place-order] CLOB error:', clobResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: clobResult.errorMsg || clobResult.error || 'CLOB order failed',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[privy-place-order] Order placed successfully:', clobResult);

    return new Response(
      JSON.stringify({
        success: true,
        orderId: clobResult.orderID || clobResult.orderId,
        result: clobResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[privy-place-order] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
