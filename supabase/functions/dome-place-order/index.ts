import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dome API for order routing with builder attribution
const DOME_API_URL = 'https://api.domeapi.io/v1';

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

    console.log(`[dome-place-order] Found credentials for ${walletAddress}, submitting to Dome API`);

    // Get Dome API key
    const domeApiKey = Deno.env.get('DOME_API_KEY');
    if (!domeApiKey) {
      console.error('[dome-place-order] DOME_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Dome API not configured', code: 'CONFIG_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route order through Dome API for builder attribution
    // Try both header formats - some APIs use X-API-KEY, others use Authorization: Bearer
    console.log(`[dome-place-order] Using Dome API key (first 8 chars): ${domeApiKey.substring(0, 8)}...`);
    
    const domeResponse = await fetch(`${DOME_API_URL}/polymarket/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${domeApiKey}`,
        'X-API-KEY': domeApiKey,
        'x-api-key': domeApiKey,
        'POLY-API-KEY': creds.api_key,
        'POLY-API-SECRET': creds.api_secret,
        'POLY-API-PASSPHRASE': creds.api_passphrase,
      },
      body: JSON.stringify({
        token_id: tokenId,
        side: side.toLowerCase(),
        size: size.toString(),
        price: price.toString(),
        order_type: orderType,
        // Include funder address (the wallet that holds USDC)
        funder_address: walletAddress,
      }),
    });

    const responseText = await domeResponse.text();
    console.log(`[dome-place-order] Dome API response status: ${domeResponse.status}`);
    console.log(`[dome-place-order] Dome API response: ${responseText}`);

    if (!domeResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText };
      }
      
      const { message, code } = mapErrorMessage(errorData.error || errorData.message || responseText);
      console.error(`[dome-place-order] Dome API error: ${message}`);
      
      return new Response(
        JSON.stringify({ error: message, code, details: errorData }),
        { status: domeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
