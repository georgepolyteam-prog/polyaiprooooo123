import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DOME_API = 'https://api.domeapi.io/v1';
const DOME_API_KEY = Deno.env.get('DOME_API_KEY');
const ORDERS_LIMIT = 1000;

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
      fetch(`${DOME_API}/polymarket/orders?user=${address}&limit=${ORDERS_LIMIT}`, {
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
    let pnlSeries: Array<{ timestamp: number; pnl_to_date: number }> = [];
    let totalPnl = 0;
    let orders: any[] = [];
    let walletMetrics = null;
    let ordersCapped = false;

    if (pnlResponse.ok) {
      const pnlJson = await pnlResponse.json();
      pnlData = pnlJson;
      console.log(`[WalletAnalytics] PnL data points: ${pnlJson.pnl_over_time?.length || 0}`);
      
      // Extract PnL series and calculate total
      if (pnlJson.pnl_over_time && pnlJson.pnl_over_time.length > 0) {
        pnlSeries = pnlJson.pnl_over_time.map((p: any) => ({
          timestamp: p.timestamp,
          pnl_to_date: p.pnl_to_date || 0
        }));
        // Total PnL is the last value in the series
        totalPnl = pnlJson.pnl_over_time[pnlJson.pnl_over_time.length - 1]?.pnl_to_date || 0;
      }
    } else {
      console.log(`[WalletAnalytics] PnL fetch failed: ${pnlResponse.status}`);
    }

    if (ordersResponse.ok) {
      const ordersJson = await ordersResponse.json();
      orders = ordersJson.orders || [];
      ordersCapped = orders.length >= ORDERS_LIMIT;
      console.log(`[WalletAnalytics] Orders found: ${orders.length}, capped: ${ordersCapped}`);
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

    // Calculate comprehensive metrics from orders
    let totalVolume = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalBuys = 0;
    let totalSells = 0;
    const markets = new Set<string>();
    
    if (orders.length > 0) {
      orders.forEach((order: any) => {
        const shares = parseFloat(order.shares_normalized || order.shares || 0);
        const price = parseFloat(order.price || 0);
        const tradeVolume = shares * price;
        totalVolume += tradeVolume;
        totalTrades++;
        
        if (order.market_slug) markets.add(order.market_slug);
        
        // Count buys vs sells
        if (order.side === 'BUY') {
          totalBuys++;
        } else if (order.side === 'SELL') {
          totalSells++;
        }
        
        // Estimate winning trades: sells at price > 0.5 or buys at price < 0.5 that resolved favorably
        // This is a heuristic since we don't have resolution data
        if (order.side === 'SELL' && price > 0.5) {
          winningTrades++;
        } else if (order.side === 'BUY' && price < 0.5) {
          // Consider low-price buys as potentially winning
          winningTrades += 0.5; // Partial credit
        }
      });
    }

    // Calculate win rate from PnL if available, otherwise estimate from trades
    let winRate = 0;
    if (totalPnl > 0 && totalTrades > 0) {
      // If overall PnL is positive, estimate win rate based on profitability
      winRate = Math.min(0.75, 0.5 + (totalPnl / (totalVolume || 1)) * 0.5);
    } else if (totalTrades > 0) {
      // Fallback: estimate based on buy ratio and general market assumptions
      const buyRatio = totalBuys / totalTrades;
      winRate = buyRatio * 0.45 + (1 - buyRatio) * 0.55; // Sells slightly more likely to be profitable
    }
    
    // Calculate average trade size
    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

    // Build wallet metrics with both camelCase and snake_case keys for compatibility
    walletMetrics = {
      totalVolume,
      total_volume: totalVolume,
      totalTrades,
      total_trades: totalTrades,
      uniqueMarkets: markets.size,
      unique_markets: markets.size,
      ordersCapped,
      orders_capped: ordersCapped,
      winRate: Math.round(winRate * 100), // As percentage
      avgTradeSize,
      totalBuys,
      totalSells,
      buyRatio: totalTrades > 0 ? Math.round((totalBuys / totalTrades) * 100) : 0
    };

    // Format orders for the response
    const recentTrades = orders.slice(0, 50).map((order: any) => ({
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

    // Build normalized PnL summary with both camelCase and snake_case keys
    const pnlSummary = {
      totalPnl,
      total_pnl: totalPnl,
      series: pnlSeries,
      winRate: walletMetrics.winRate,
      avgTradeSize
    };

    console.log(`[WalletAnalytics] Final metrics - PnL: ${totalPnl}, WinRate: ${walletMetrics.winRate}%, AvgTrade: ${avgTradeSize}`);

    return new Response(
      JSON.stringify({
        pnlData: pnlSeries,  // Return the array format that frontend expects
        pnlSummary,
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
