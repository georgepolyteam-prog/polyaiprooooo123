import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ClobClient, Side, OrderType } from 'npm:@polymarket/clob-client@4.22.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dome Builder API for attribution tracking
const DOME_BUILDER_API = 'https://builder-signer.domeapi.io';

interface OrderParams {
  walletAddress: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  orderType?: 'GTC' | 'FOK' | 'FAK' | 'GTD';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: OrderParams = await req.json();
    const { walletAddress, tokenId, side, size, price, orderType = 'GTC' } = params;

    // Validate required fields
    if (!walletAddress || !tokenId || !side || !size || !price) {
      console.error('[dome-place-order] Missing required fields:', { 
        walletAddress: !!walletAddress, 
        tokenId: !!tokenId, 
        side: !!side, 
        size: !!size, 
        price: !!price 
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: walletAddress, tokenId, side, size, price' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[dome-place-order] Placing order for ${walletAddress}: ${side} ${size} @ ${price} on token ${tokenId}`);

    // Get credentials from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: creds, error: credsError } = await supabase
      .from('polymarket_credentials')
      .select('*')
      .eq('user_address', walletAddress.toLowerCase())
      .single();

    if (credsError || !creds) {
      console.error('[dome-place-order] Credentials not found:', credsError);
      return new Response(
        JSON.stringify({ 
          error: 'Wallet not linked to Polymarket. Please link your wallet first.',
          code: 'NOT_LINKED'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[dome-place-order] Found credentials for ${walletAddress}`);

    // Create ClobClient with stored API credentials
    const clobClient = new ClobClient(
      'https://clob.polymarket.com',
      137, // Polygon chainId
      undefined, // No signer needed - using API key auth
      {
        key: creds.api_key,
        secret: creds.api_secret,
        passphrase: creds.api_passphrase,
      }
    );

    // Build order arguments with proper types
    const orderArgs = {
      tokenID: tokenId,
      price: Number(price),
      size: Number(size),
      side: side.toUpperCase() === 'BUY' ? Side.BUY : Side.SELL,
      feeRateBps: 0,
      nonce: Date.now(),
      expiration: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    };

    console.log('[dome-place-order] Creating order with args:', JSON.stringify(orderArgs));

    // Create signed order
    let signedOrder;
    try {
      signedOrder = await clobClient.createOrder(orderArgs);
      console.log('[dome-place-order] Order created successfully');
    } catch (createError: any) {
      console.error('[dome-place-order] Failed to create order:', createError);
      return new Response(
        JSON.stringify({ 
          error: `Failed to create order: ${createError.message}`,
          code: 'ORDER_CREATION_FAILED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Post order to CLOB with order type
    let orderResponse;
    try {
      // Map order type string to OrderType enum
      let orderTypeEnum: OrderType = OrderType.GTC;
      if (orderType === 'FOK') orderTypeEnum = OrderType.FOK;
      else if (orderType === 'GTD') orderTypeEnum = OrderType.GTD;
      
      orderResponse = await clobClient.postOrder(signedOrder, orderTypeEnum);
      console.log('[dome-place-order] Order posted successfully:', JSON.stringify(orderResponse));
    } catch (postError: any) {
      console.error('[dome-place-order] Failed to post order:', postError);
      
      // Parse common error messages
      let errorMessage = postError.message || 'Failed to post order';
      let errorCode = 'ORDER_POST_FAILED';
      
      if (errorMessage.includes('insufficient')) {
        errorCode = 'INSUFFICIENT_BALANCE';
        errorMessage = 'Insufficient balance to place this order';
      } else if (errorMessage.includes('market') && errorMessage.includes('closed')) {
        errorCode = 'MARKET_CLOSED';
        errorMessage = 'This market is closed for trading';
      } else if (errorMessage.includes('price')) {
        errorCode = 'INVALID_PRICE';
        errorMessage = 'Invalid price for this market';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track with Dome builder attribution (non-blocking)
    const domeApiKey = Deno.env.get('DOME_API_KEY');
    if (domeApiKey && orderResponse?.orderID) {
      try {
        const trackResponse = await fetch(`${DOME_BUILDER_API}/builder-signer/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${domeApiKey}`,
          },
          body: JSON.stringify({
            orderId: orderResponse.orderID,
            walletAddress,
            tokenId,
            side,
            size,
            price,
          }),
        });
        
        if (trackResponse.ok) {
          console.log(`[dome-place-order] Order tracked with Dome builder`);
        } else {
          console.warn('[dome-place-order] Dome tracking response:', await trackResponse.text());
        }
      } catch (trackError) {
        // Non-blocking - just log the error
        console.warn('[dome-place-order] Failed to track with Dome:', trackError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: orderResponse?.orderID || orderResponse?.id,
        ...orderResponse,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[dome-place-order] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
