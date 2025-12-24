import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DOME_API = 'https://api.domeapi.io/v1';
const DOME_API_KEY = Deno.env.get('DOME_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TraderStats {
  wallet: string;
  volume: number;
  trades: number;
  markets: Set<string>;
  buys: number;
  sells: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const timeframe = url.searchParams.get('timeframe') || '7d';
  const minVolume = parseInt(url.searchParams.get('min_volume') || '0');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 100);
  const marketSlug = url.searchParams.get('market_slug') || '';

  console.log(`[Leaderboard] Fetching: timeframe=${timeframe}, minVolume=${minVolume}, market=${marketSlug}`);

  if (!DOME_API_KEY) {
    console.error('[Leaderboard] DOME_API_KEY not configured');
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
    const startTime = timeRanges[timeframe] || timeRanges['7d'];

    // Fetch recent orders with pagination
    let allOrders: any[] = [];
    let offset = 0;
    const pageLimit = 1000;

    // Fetch up to 5 pages (5000 orders max)
    for (let i = 0; i < 5; i++) {
      const params = new URLSearchParams({
        limit: pageLimit.toString(),
        offset: offset.toString(),
      });
      
      if (startTime > 0) {
        params.append('start_time', startTime.toString());
      }
      
      if (marketSlug) {
        params.append('market_slug', marketSlug);
      }

      console.log(`[Leaderboard] Fetching page ${i + 1}: offset=${offset}`);
      
      const response = await fetch(
        `${DOME_API}/polymarket/orders?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${DOME_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error(`[Leaderboard] Dome API error: ${response.status}`);
        break;
      }

      const data = await response.json();
      const orders = data.orders || [];
      allOrders = [...allOrders, ...orders];

      console.log(`[Leaderboard] Got ${orders.length} orders, total: ${allOrders.length}`);

      // Check if there are more pages
      if (!data.pagination?.has_more || orders.length < pageLimit) {
        break;
      }
      
      offset += pageLimit;
    }

    console.log(`[Leaderboard] Total orders fetched: ${allOrders.length}`);

    // Aggregate by wallet
    const traders = new Map<string, TraderStats>();

    allOrders.forEach(order => {
      const wallet = order.user;
      if (!wallet) return;
      
      const shares = parseFloat(order.shares_normalized || order.shares || 0);
      const price = parseFloat(order.price || 0);
      const volume = shares * price;
      
      if (volume <= 0) return;

      if (!traders.has(wallet)) {
        traders.set(wallet, {
          wallet,
          volume: 0,
          trades: 0,
          markets: new Set(),
          buys: 0,
          sells: 0
        });
      }

      const trader = traders.get(wallet)!;
      trader.volume += volume;
      trader.trades++;
      
      if (order.market_slug) {
        trader.markets.add(order.market_slug);
      }
      
      const side = (order.side || '').toUpperCase();
      if (side === 'BUY') trader.buys++;
      else if (side === 'SELL') trader.sells++;
    });

    // Convert to array and sort by volume
    const leaderboard = Array.from(traders.values())
      .map(t => ({
        wallet: t.wallet,
        volume: t.volume,
        trades: t.trades,
        markets: t.markets.size,
        buys: t.buys,
        sells: t.sells,
        buyRatio: t.trades > 0 ? Math.round((t.buys / t.trades) * 100) : 50
      }))
      .filter(t => t.volume >= minVolume)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit)
      .map((trader, index) => ({
        rank: index + 1,
        ...trader
      }));

    // Calculate stats
    const totalVolume = allOrders.reduce((sum, o) => {
      const shares = parseFloat(o.shares_normalized || o.shares || 0);
      const price = parseFloat(o.price || 0);
      return sum + (shares * price);
    }, 0);

    console.log(`[Leaderboard] Returning ${leaderboard.length} traders`);

    return new Response(
      JSON.stringify({
        leaderboard,
        stats: {
          totalVolume,
          totalTrades: allOrders.length,
          totalTraders: traders.size,
          timeframe
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Leaderboard] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch leaderboard' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
