import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DomeTrade {
  token_id: string;
  token_label: string;
  side: 'BUY' | 'SELL';
  market_slug: string;
  condition_id: string;
  shares: number;
  shares_normalized: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  order_hash: string;
  user: string;
  taker: string;
  image?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const domeApiKey = Deno.env.get('DOME_API_KEY');
    
    if (!domeApiKey) {
      console.error('DOME_API_KEY not found in secrets');
      return new Response(
        JSON.stringify({ error: 'Dome API key not configured', trades: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for optional parameters
    let limit = 50;
    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === 'number') {
        limit = Math.min(body.limit, 100); // Cap at 100
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Fetch recent trades from Dome REST API
    // Using the Polymarket orders endpoint
    const response = await fetch(`https://api.domeapi.io/v1/polymarket/orders?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${domeApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Dome API error:', response.status, await response.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch trades from Dome', trades: [] }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Transform to match the Trade interface expected by LiveTrades.tsx
    const trades: DomeTrade[] = (data.orders || data.data || data || []).map((order: Record<string, unknown>) => ({
      token_id: order.token_id || order.tokenId || '',
      token_label: order.token_label || order.tokenLabel || order.outcome || '',
      side: (order.side as string)?.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
      market_slug: order.market_slug || order.marketSlug || order.slug || '',
      condition_id: order.condition_id || order.conditionId || '',
      shares: Number(order.shares) || Number(order.size) || 0,
      shares_normalized: Number(order.shares_normalized) || Number(order.sharesNormalized) || Number(order.shares) || Number(order.size) || 0,
      price: Number(order.price) || 0,
      tx_hash: order.tx_hash || order.txHash || order.transactionHash || '',
      title: order.title || order.question || order.market_title || order.marketTitle || '',
      timestamp: Number(order.timestamp) || Math.floor(Date.now() / 1000),
      order_hash: order.order_hash || order.orderHash || order.id || '',
      user: order.user || order.maker || order.wallet || '',
      taker: order.taker || '',
      image: order.image || order.icon || order.market_image || undefined,
    }));

    console.log(`Returning ${trades.length} trades from Dome snapshot`);

    return new Response(
      JSON.stringify({ trades, source: 'dome-rest' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in dome-trades-snapshot function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message, trades: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
