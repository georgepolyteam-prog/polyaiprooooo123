import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WHALE_THRESHOLD = 5000; // $5K minimum for whale trades
const DOME_API = "https://api.domeapi.io/v1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const domeApiKey = Deno.env.get("DOME_API_KEY");

function anonymizeWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return "Unknown";
  return `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;
}

function generateTradeHash(trade: any): string {
  const str = `${trade.platform}-${trade.market_question.substring(0, 50)}-${trade.side}-${trade.amount.toFixed(0)}-${trade.price.toFixed(2)}-${trade.timestamp}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

interface WhaleTrade {
  market_question: string;
  side: string;
  size: number;
  price: number;
  amount: number;
  platform: string;
  market_url: string | null;
  wallet: string;
  timestamp: string;
}

// Fetch REAL whale trades from Dome API - Polymarket ONLY
async function fetchRealWhaleTrades(timeRangeHours: number = 24): Promise<WhaleTrade[]> {
  if (!domeApiKey) {
    console.error("❌ DOME_API_KEY not configured - cannot fetch real whale data");
    return [];
  }

  const trades: WhaleTrade[] = [];
  const startTime = Math.floor((Date.now() - timeRangeHours * 60 * 60 * 1000) / 1000);

  console.log(`🔍 Fetching REAL Polymarket trades from Dome API (last ${timeRangeHours}h)...`);

  try {
    // Paginate through Dome API orders to find whale trades
    let offset = 0;
    const limit = 500;
    const maxPages = 10; // Max 5000 orders to check

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      console.log(`📄 Fetching page ${page + 1} (offset: ${offset})...`);

      const response = await fetch(`${DOME_API}/polymarket/orders?${params}`, {
        headers: {
          "Authorization": `Bearer ${domeApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Dome API error (${response.status}): ${errorText}`);
        break;
      }

      const data = await response.json();
      const orders = data.orders || data.data || [];

      if (orders.length === 0) {
        console.log(`📄 Page ${page + 1}: No more orders`);
        break;
      }

      console.log(`📄 Page ${page + 1}: Got ${orders.length} orders`);

      // Filter for whale-sized trades
      for (const order of orders) {
        // Parse order data - handle different possible field names
        const shares = parseFloat(order.shares_normalized || order.shares || order.size || 0);
        const price = parseFloat(order.price || 0);
        const amount = order.amount ? parseFloat(order.amount) : shares * price;

        // Check timestamp is within range
        const orderTime = order.timestamp || order.created_at;
        if (orderTime) {
          const orderTimestamp = new Date(orderTime).getTime() / 1000;
          if (orderTimestamp < startTime) {
            // Orders are likely sorted by time, so we can stop if we hit old orders
            console.log(`⏰ Reached orders older than ${timeRangeHours}h, stopping pagination`);
            break;
          }
        }

        if (amount >= WHALE_THRESHOLD) {
          // Build market URL from slug or condition_id
          const eventSlug = order.event_slug || order.slug || order.market_slug;
          const marketUrl = eventSlug
            ? `https://polymarket.com/event/${eventSlug}`
            : order.condition_id
              ? `https://polymarket.com/event/${order.condition_id}`
              : null;

          // Get wallet address
          const wallet = order.user || order.maker || order.taker || order.wallet || "";

          // Determine side
          let side = "YES";
          if (order.side) {
            const sideStr = order.side.toString().toUpperCase();
            if (sideStr === "SELL" || sideStr === "NO" || sideStr === "0") {
              side = "NO";
            }
          }

          trades.push({
            market_question: order.question || order.title || order.market || "Unknown Market",
            side,
            size: shares,
            price: Math.max(0.01, Math.min(0.99, price)),
            amount,
            platform: "polymarket",
            market_url: marketUrl,
            wallet: anonymizeWallet(wallet),
            timestamp: orderTime || new Date().toISOString(),
          });
        }
      }

      // Check if there are more pages
      const hasMore = data.pagination?.has_more || orders.length === limit;
      if (!hasMore) {
        console.log(`📄 No more pages available`);
        break;
      }

      offset += limit;
    }

    console.log(`✅ Found ${trades.length} REAL whale trades (≥$${WHALE_THRESHOLD}) from Dome API`);
    return trades;

  } catch (error) {
    console.error("❌ Error fetching from Dome API:", error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🐋 Whale tracker request received");

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "true";
    const platform = url.searchParams.get("platform");
    const minSize = parseInt(url.searchParams.get("minSize") || "0");
    const timeRange = url.searchParams.get("timeRange") || "24h";
    const side = url.searchParams.get("side");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Convert time range to hours
    let timeRangeHours = 24;
    switch (timeRange) {
      case "1h": timeRangeHours = 1; break;
      case "24h": timeRangeHours = 24; break;
      case "7d": timeRangeHours = 24 * 7; break;
      case "30d": timeRangeHours = 24 * 30; break;
    }

    // If refresh requested, fetch new REAL data from Dome API
    if (refresh) {
      console.log("🔄 Refreshing whale data from Dome API (REAL DATA ONLY)...");

      const realTrades = await fetchRealWhaleTrades(timeRangeHours);

      if (realTrades.length === 0) {
        console.log("⚠️ No real whale trades found from Dome API");
      } else {
        console.log(`💾 Storing ${realTrades.length} real whale trades to database...`);

        // Upsert trades to database
        for (const trade of realTrades) {
          const tradeHash = generateTradeHash(trade);

          const { error } = await supabase
            .from("whale_trades")
            .upsert({
              market_question: trade.market_question,
              side: trade.side,
              size: trade.size,
              price: trade.price,
              amount: trade.amount,
              platform: trade.platform,
              market_url: trade.market_url,
              wallet: trade.wallet,
              timestamp: trade.timestamp,
              trade_hash: tradeHash,
            }, { onConflict: "trade_hash" });

          if (error) {
            console.error("Error upserting trade:", error);
          }
        }

        console.log("✅ Real whale trades stored in database");
      }
    }

    // Time filter for database query
    const now = new Date();
    let timeFilter: Date;
    switch (timeRange) {
      case "1h":
        timeFilter = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "24h":
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Build query for stats - only Polymarket now
    let statsQuery = supabase
      .from("whale_trades")
      .select("side, amount, market_question")
      .eq("platform", "polymarket") // Only Polymarket
      .gte("timestamp", timeFilter.toISOString());

    if (minSize > 0) {
      statsQuery = statsQuery.gte("amount", minSize);
    }
    if (side) {
      statsQuery = statsQuery.eq("side", side);
    }

    const { data: allTrades, error: statsError } = await statsQuery;

    if (statsError) {
      console.error("Error fetching stats:", statsError);
    }

    // Calculate stats from ALL matching trades
    const totalVolume = allTrades?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const tradeCount = allTrades?.length || 0;
    const yesVolume = allTrades?.filter(t => t.side === "YES").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const noVolume = allTrades?.filter(t => t.side === "NO").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const netFlow = yesVolume - noVolume;

    // Hot markets (markets with most trades)
    const marketCounts: Record<string, number> = {};
    allTrades?.forEach(t => {
      marketCounts[t.market_question] = (marketCounts[t.market_question] || 0) + 1;
    });
    const hotMarketsCount = Object.values(marketCounts).filter(c => c >= 2).length;

    // Fetch trades for display (limited to 200) - only Polymarket
    let tradesQuery = supabase
      .from("whale_trades")
      .select("*")
      .eq("platform", "polymarket") // Only Polymarket
      .gte("timestamp", timeFilter.toISOString())
      .order("timestamp", { ascending: false })
      .limit(200);

    if (minSize > 0) {
      tradesQuery = tradesQuery.gte("amount", minSize);
    }
    if (side) {
      tradesQuery = tradesQuery.eq("side", side);
    }

    const { data: trades, error } = await tradesQuery;

    if (error) {
      console.error("Error fetching trades:", error);
      throw error;
    }

    // Honest response - indicate data source
    const response = {
      trades: trades || [],
      stats: {
        totalVolume,
        tradeCount,
        netFlow,
        hotMarketsCount,
        yesVolume,
        noVolume,
      },
      dataSource: "dome_api",
      message: trades?.length === 0
        ? `No whale trades (≥$${WHALE_THRESHOLD}) found in the last ${timeRange}. Try refreshing or expanding the time range.`
        : null,
    };

    console.log(`📊 Returning ${trades?.length || 0} trades, total volume: $${totalVolume.toLocaleString()}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Whale tracker error:", error);
    return new Response(JSON.stringify({
      error: "Failed to fetch whale activity",
      trades: [],
      stats: { totalVolume: 0, tradeCount: 0, netFlow: 0, hotMarketsCount: 0, yesVolume: 0, noVolume: 0 },
      dataSource: "none",
      message: "Unable to fetch whale data. Please try again later.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
