import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DOME_API = 'https://api.domeapi.io/v1';
const DOME_API_KEY = Deno.env.get('DOME_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const address = url.searchParams.get('address');
  const timeframe = url.searchParams.get('timeframe') || '30d';

  if (!address) {
    return new Response(
      JSON.stringify({ error: 'Address required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[WalletProfile] Fetching profile for: ${address}`);

  if (!DOME_API_KEY) {
    console.error('[WalletProfile] DOME_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'API not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const timeRanges: Record<string, number> = {
      '24h': now - 86400,
      '7d': now - (7 * 86400),
      '30d': now - (30 * 86400),
      'all': 0
    };
    const startTime = timeRanges[timeframe] || timeRanges['30d'];

    // Fetch wallet's orders
    const params = new URLSearchParams({
      user: address,
      limit: '1000'
    });
    
    if (startTime > 0) {
      params.append('start_time', startTime.toString());
    }

    const ordersResponse = await fetch(
      `${DOME_API}/polymarket/orders?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${DOME_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!ordersResponse.ok) {
      console.error(`[WalletProfile] Dome API error: ${ordersResponse.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch wallet data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ordersData = await ordersResponse.json();
    const orders = ordersData.orders || [];

    console.log(`[WalletProfile] Found ${orders.length} orders for wallet`);
    if (orders.length > 0) {
      console.log(`[WalletProfile] Sample order fields:`, Object.keys(orders[0]).join(', '));
      console.log(`[WalletProfile] Sample order timestamp:`, orders[0].timestamp, typeof orders[0].timestamp);
    }

    // Calculate stats
    let totalVolume = 0;
    let buys = 0;
    let sells = 0;
    const markets = new Set<string>();
    const marketVolumes = new Map<string, { volume: number; title: string }>();

    orders.forEach((order: any) => {
      const shares = parseFloat(order.shares_normalized || order.shares || 0);
      const price = parseFloat(order.price || 0);
      const volume = shares * price;
      
      totalVolume += volume;
      
      const side = (order.side || '').toUpperCase();
      if (side === 'BUY') buys++;
      else if (side === 'SELL') sells++;
      
      if (order.market_slug) {
        markets.add(order.market_slug);
        
        const existing = marketVolumes.get(order.market_slug);
        if (existing) {
          existing.volume += volume;
        } else {
          marketVolumes.set(order.market_slug, {
            volume,
            title: order.title || order.market_slug
          });
        }
      }
    });

    // Format recent trades - return all trades (up to 1000 from API limit)
    const recentTrades = orders
      .map((order: any) => {
        const shares = parseFloat(order.shares_normalized || order.shares || 0);
        const price = parseFloat(order.price || 0);
        
        // Parse timestamp - Dome returns Unix seconds as number or string
        let timestamp = Math.floor(Date.now() / 1000);
        if (order.timestamp) {
          const ts = typeof order.timestamp === 'string' ? parseInt(order.timestamp) : order.timestamp;
          if (!isNaN(ts)) timestamp = ts;
        } else if (order.created_at) {
          const ts = typeof order.created_at === 'string' ? parseInt(order.created_at) : order.created_at;
          if (!isNaN(ts)) timestamp = ts;
        }
        
        return {
          marketSlug: order.market_slug,
          marketTitle: order.title || order.market_slug,
          side: order.side,
          token_label: order.token_label, // YES or NO - this is the actual outcome, not BUY/SELL
          volume: shares * price,
          price: price,
          shares: shares,
          timestamp: timestamp // Unix seconds
        };
      });

    // Top markets by volume
    const topMarkets = Array.from(marketVolumes.entries())
      .map(([slug, data]) => ({
        slug,
        title: data.title,
        volume: data.volume
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    const totalTrades = orders.length;
    const buyRatio = totalTrades > 0 ? Math.round((buys / totalTrades) * 100) : 50;

    return new Response(
      JSON.stringify({
        address,
        stats: {
          volume: totalVolume,
          trades: totalTrades,
          markets: markets.size,
          buys,
          sells,
          buyRatio,
          timeframe
        },
        recentTrades,
        topMarkets,
        rank: null // Would need to compare with leaderboard
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WalletProfile] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch wallet profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
