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

  try {
    const { address } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WalletAnalytics] Fetching data for: ${address}`);

    if (!DOME_API_KEY) {
      console.error('[WalletAnalytics] DOME_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch wallet PnL, orders, and metrics in parallel
    const [pnlResponse, ordersResponse, walletResponse] = await Promise.all([
      fetch(`${DOME_API}/polymarket/wallet/pnl/${address}?granularity=day`, {
        headers: {
          'Authorization': `Bearer ${DOME_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }),
      fetch(`${DOME_API}/polymarket/orders?user=${address}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${DOME_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }),
      fetch(`${DOME_API}/polymarket/wallet?eoa=${address}&with_metrics=true`, {
        headers: {
          'Authorization': `Bearer ${DOME_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
    ]);

    let pnlData = null;
    let orders: any[] = [];
    let walletMetrics = null;

    if (pnlResponse.ok) {
      const pnlJson = await pnlResponse.json();
      pnlData = pnlJson;
      console.log(`[WalletAnalytics] PnL data points: ${pnlJson.pnl_over_time?.length || 0}`);
    } else {
      console.log(`[WalletAnalytics] PnL fetch failed: ${pnlResponse.status}`);
    }

    if (ordersResponse.ok) {
      const ordersJson = await ordersResponse.json();
      orders = ordersJson.orders || [];
      console.log(`[WalletAnalytics] Orders found: ${orders.length}`);
    } else {
      console.log(`[WalletAnalytics] Orders fetch failed: ${ordersResponse.status}`);
    }

    if (walletResponse.ok) {
      const walletJson = await walletResponse.json();
      walletMetrics = walletJson.wallet_metrics || walletJson.metrics || null;
      console.log(`[WalletAnalytics] Wallet metrics:`, walletMetrics);
    } else {
      console.log(`[WalletAnalytics] Wallet fetch failed: ${walletResponse.status}`);
    }

    // Always calculate metrics from orders (more reliable than Dome wallet endpoint)
    if (orders.length > 0) {
      let totalVolume = 0;
      const markets = new Set<string>();
      
      orders.forEach((order: any) => {
        const shares = parseFloat(order.shares_normalized || order.shares || 0);
        const price = parseFloat(order.price || 0);
        totalVolume += shares * price;
        if (order.market_slug) markets.add(order.market_slug);
      });

      // Override with calculated metrics (Dome wallet endpoint often returns zeros)
      walletMetrics = {
        total_volume: totalVolume,
        total_trades: orders.length,
        unique_markets: markets.size
      };
    }

    // Format orders for the response
    const recentTrades = orders.slice(0, 20).map((order: any) => ({
      token_id: order.token_id,
      token_label: order.token_label,
      side: order.side,
      market_slug: order.market_slug,
      condition_id: order.condition_id,
      shares: order.shares,
      shares_normalized: order.shares_normalized,
      price: order.price,
      tx_hash: order.tx_hash,
      title: order.title,
      timestamp: order.timestamp,
      user: order.user
    }));

    return new Response(
      JSON.stringify({
        pnlData,
        recentTrades,
        walletMetrics
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WalletAnalytics] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch wallet analytics' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
