import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Polymarket CLOB API host
const CLOB_HOST = 'https://clob.polymarket.com';

// Dome Builder API
const DOME_API_HOST = 'https://api.dome.xyz';

interface OrderParams {
  walletAddress: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  orderType?: 'GTC' | 'FOK' | 'FAK' | 'GTD';
  expirationTimestamp?: number;
}

// Generate HMAC signature for CLOB API authentication
async function generateHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string
): Promise<string> {
  const message = timestamp + method + path + body;
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(secret), c => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: OrderParams = await req.json();
    const { walletAddress, tokenId, side, size, price, orderType = 'GTC' } = params;

    if (!walletAddress || !tokenId || !side || !size || !price) {
      console.error('[dome-place-order] Missing required fields:', params);
      throw new Error('Missing required fields');
    }

    console.log(`[dome-place-order] Placing order for ${walletAddress}: ${side} ${size} @ ${price}`);

    // Get credentials from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: creds, error } = await supabase
      .from('polymarket_credentials')
      .select('*')
      .eq('user_address', walletAddress.toLowerCase())
      .single();

    if (error || !creds) {
      console.error('[dome-place-order] Credentials not found:', error);
      throw new Error('User not linked to Polymarket. Please link your wallet first.');
    }

    console.log(`[dome-place-order] Found credentials for ${walletAddress}`);

    // Build order payload for CLOB API
    const orderPayload = {
      tokenId,
      side,
      size: size.toString(),
      price: price.toString(),
      type: orderType,
      feeRateBps: '0', // Will be set by the system
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = '/order';
    const body = JSON.stringify(orderPayload);

    // Generate HMAC signature
    const signature = await generateHmacSignature(
      creds.api_secret,
      timestamp,
      'POST',
      path,
      body
    );

    // Place order via CLOB API
    const orderResponse = await fetch(`${CLOB_HOST}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'POLY_ADDRESS': walletAddress,
        'POLY_SIGNATURE': signature,
        'POLY_TIMESTAMP': timestamp,
        'POLY_API_KEY': creds.api_key,
        'POLY_PASSPHRASE': creds.api_passphrase,
      },
      body,
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error(`[dome-place-order] CLOB order error: ${orderResponse.status} - ${errorText}`);
      throw new Error(`Order failed: ${errorText}`);
    }

    const orderResult = await orderResponse.json();
    console.log(`[dome-place-order] Order placed successfully:`, orderResult);

    // Optionally track with Dome for builder attribution
    const domeApiKey = Deno.env.get('DOME_API_KEY');
    if (domeApiKey) {
      try {
        await fetch(`${DOME_API_HOST}/v1/builder/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${domeApiKey}`,
          },
          body: JSON.stringify({
            orderId: orderResult.orderId || orderResult.id,
            walletAddress,
            tokenId,
            side,
            size,
            price,
          }),
        });
        console.log(`[dome-place-order] Order tracked with Dome builder`);
      } catch (trackError) {
        // Non-blocking - just log the error
        console.warn('[dome-place-order] Failed to track with Dome:', trackError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: orderResult.orderId || orderResult.id,
        ...orderResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[dome-place-order] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
