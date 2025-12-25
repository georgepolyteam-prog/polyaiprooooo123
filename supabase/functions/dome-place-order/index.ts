import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Polymarket CLOB API for order submission
const CLOB_API_URL = 'https://clob.polymarket.com';

interface OrderParams {
  walletAddress: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  orderType?: 'GTC' | 'FOK' | 'FAK' | 'GTD';
}

// Input validation
function validateOrderParams(params: OrderParams): string | null {
  const { tokenId, side, size, price, orderType } = params;

  if (!tokenId || typeof tokenId !== 'string') {
    return 'Invalid tokenId: must be a non-empty string';
  }

  if (!['BUY', 'SELL'].includes(side?.toUpperCase())) {
    return 'Invalid side: must be BUY or SELL';
  }

  if (typeof size !== 'number' || size <= 0) {
    return 'Invalid size: must be a positive number';
  }

  if (typeof price !== 'number' || price < 0.01 || price > 0.99) {
    return 'Invalid price: must be between $0.01 and $0.99';
  }

  if (orderType && !['GTC', 'FOK', 'FAK', 'GTD'].includes(orderType)) {
    return 'Invalid orderType: must be GTC, FOK, FAK, or GTD';
  }

  return null;
}

// Map Dome API errors to user-friendly messages
function mapErrorMessage(error: string): { message: string; code: string } {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('insufficient') || errorLower.includes('balance')) {
    return { message: 'Insufficient USDC balance. Please deposit funds to your wallet.', code: 'INSUFFICIENT_BALANCE' };
  }
  if (errorLower.includes('market') && errorLower.includes('closed')) {
    return { message: 'This market is closed for trading.', code: 'MARKET_CLOSED' };
  }
  if (errorLower.includes('price')) {
    return { message: 'Invalid price. Price must be between $0.01 and $0.99.', code: 'INVALID_PRICE' };
  }
  if (errorLower.includes('min') && errorLower.includes('size')) {
    return { message: 'Order too small. Minimum order size is $1.00.', code: 'MIN_SIZE_NOT_MET' };
  }
  if (errorLower.includes('allowance')) {
    return { message: 'USDC approval needed. Please approve USDC spending first.', code: 'INSUFFICIENT_ALLOWANCE' };
  }
  if (errorLower.includes('not linked') || errorLower.includes('credentials')) {
    return { message: 'Wallet not linked to Polymarket. Please link your wallet first.', code: 'NOT_LINKED' };
  }
  
  return { message: error, code: 'ORDER_FAILED' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: OrderParams = await req.json();
    const { walletAddress, tokenId, side, size, price, orderType = 'GTC' } = params;

    // Validate wallet address
    if (!walletAddress) {
      console.error('[dome-place-order] Missing wallet address');
      return new Response(
        JSON.stringify({ error: 'Wallet address is required', code: 'MISSING_WALLET' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate order parameters
    const validationError = validateOrderParams(params);
    if (validationError) {
      console.error('[dome-place-order] Validation error:', validationError);
      return new Response(
        JSON.stringify({ error: validationError, code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[dome-place-order] Routing order through Dome API for ${walletAddress}: ${side} ${size} @ ${price} on token ${tokenId}`);

    // Get stored credentials from database
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

    console.log(`[dome-place-order] Found credentials for ${walletAddress}, submitting to Polymarket CLOB`);

    // Submit order directly to Polymarket CLOB API using the stored credentials
    const clobResponse = await fetch(`${CLOB_API_URL}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'POLY_API_KEY': creds.api_key,
        'POLY_API_SECRET': creds.api_secret,
        'POLY_API_PASSPHRASE': creds.api_passphrase,
      },
      body: JSON.stringify({
        tokenID: tokenId,
        side: side.toUpperCase(),
        size: size,
        price: price,
        type: orderType,
        funderAddress: walletAddress.toLowerCase(),
      }),
    });

    const responseText = await clobResponse.text();
    console.log(`[dome-place-order] CLOB API response status: ${clobResponse.status}`);
    console.log(`[dome-place-order] CLOB API response: ${responseText}`);

    if (!clobResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText };
      }
      
      const { message, code } = mapErrorMessage(errorData.error || errorData.message || responseText);
      console.error(`[dome-place-order] CLOB API error: ${message}`);
      
      return new Response(
        JSON.stringify({ error: message, code, details: errorData }),
        { status: clobResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log(`[dome-place-order] Order placed successfully via Dome API:`, JSON.stringify(result));

    return new Response(
      JSON.stringify({
        success: true,
        orderId: result?.order_id || result?.orderId || result?.id,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[dome-place-order] Unexpected error:', error);
    const { message, code } = mapErrorMessage(error.message || 'An unexpected error occurred');
    
    return new Response(
      JSON.stringify({ error: message, code }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
