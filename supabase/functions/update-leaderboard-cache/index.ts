import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DOME_API = 'https://api.domeapi.io/v1';
const DOME_API_KEY = Deno.env.get('DOME_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  try {
    console.log('[CACHE UPDATE] Starting leaderboard cache update...');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Update for each timeframe
    const timeframes = ['24h', '7d', '30d', 'all'];
    const results: string[] = [];
    
    for (const timeframe of timeframes) {
      console.log(`[CACHE UPDATE] Processing ${timeframe}...`);
      
      try {
        const leaderboardData = await fetchAndAggregateLeaderboard(timeframe);
        
        // Store in database
        const { error } = await supabase
          .from('leaderboard_cache')
          .upsert({
            id: `leaderboard_${timeframe}_0`,
            timeframe,
            min_volume: 0,
            data: leaderboardData,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error(`[CACHE UPDATE] Error storing ${timeframe}:`, error);
          results.push(`${timeframe}: failed`);
        } else {
          console.log(`[CACHE UPDATE] ✅ Cached ${timeframe} with ${leaderboardData.leaderboard?.length || 0} traders`);
          results.push(`${timeframe}: success`);
        }
      } catch (err) {
        console.error(`[CACHE UPDATE] Error processing ${timeframe}:`, err);
        results.push(`${timeframe}: error`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CACHE UPDATE] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchAndAggregateLeaderboard(timeframe: string) {
  const now = Math.floor(Date.now() / 1000);
  const timeRanges: Record<string, number> = {
    '24h': now - 86400,
    '7d': now - (7 * 86400),
    '30d': now - (30 * 86400),
    'all': 0
  };
  const startTime = timeRanges[timeframe] || timeRanges['7d'];

  console.log(`[CACHE UPDATE] Fetching orders for ${timeframe} (start: ${startTime})...`);

  // Fetch orders from Dome - using same approach as working leaderboard function
  let allOrders: any[] = [];
  let offset = 0;
  const pageLimit = 1000;
  const maxPages = 20; // Max 20,000 orders for better coverage
  
  for (let i = 0; i < maxPages; i++) {
    const params = new URLSearchParams({
      limit: pageLimit.toString(),
      offset: offset.toString(),
    });
    
    if (startTime > 0) {
      params.append('start_time', startTime.toString()); // Seconds, NOT milliseconds
    }

    console.log(`[CACHE UPDATE] Fetching page ${i + 1}: offset=${offset}`);

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
      console.error(`[CACHE UPDATE] Dome API error: ${response.status}`);
      break;
    }
    
    const data = await response.json();
    const orders = data.orders || [];
    allOrders = [...allOrders, ...orders];
    
    console.log(`[CACHE UPDATE] Got ${orders.length} orders, total: ${allOrders.length}`);
    
    // Check if there are more pages
    if (!data.pagination?.has_more || orders.length < pageLimit) {
      break;
    }
    
    offset += pageLimit;
    
    // Rate limiting - wait 1s every 5 pages to avoid API throttling
    if (i > 0 && (i + 1) % 5 === 0) {
      console.log(`[CACHE UPDATE] Rate limiting - waiting 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[CACHE UPDATE] Total orders fetched: ${allOrders.length}`);

  // Aggregate by wallet
  const traders = new Map<string, TraderStats>();
  
  allOrders.forEach((order: any) => {
    const wallet = order.user;
    if (!wallet) return;
    
    const volume = (order.shares_normalized || 0) * (order.price || 0);
    const isBuy = order.side?.toLowerCase() === 'buy';
    
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
    if (order.market_slug) trader.markets.add(order.market_slug);
    if (isBuy) trader.buys++;
    else trader.sells++;
  });

  // Convert to leaderboard
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
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 100)
    .map((trader, index) => ({
      rank: index + 1,
      ...trader
    }));

  const totalVolume = allOrders.reduce((sum, o) => sum + ((o.shares_normalized || 0) * (o.price || 0)), 0);

  return {
    leaderboard,
    timeframe,
    totalTraders: traders.size,
    totalVolume,
    totalTrades: allOrders.length
  };
}
