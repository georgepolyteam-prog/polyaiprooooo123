import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
const DOME_API_BASE = "https://api.domeapi.io/v1";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conditionId, startTime, endTime, interval = 60, yesTokenId } = await req.json();

    if (!conditionId) {
      return new Response(
        JSON.stringify({ error: "conditionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!startTime || !endTime) {
      return new Response(
        JSON.stringify({ error: "startTime and endTime are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Candlesticks] Fetching for conditionId=${conditionId}, interval=${interval}`);

    const url = `${DOME_API_BASE}/polymarket/candlesticks/${conditionId}?start_time=${startTime}&end_time=${endTime}&interval=${interval}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (DOME_API_KEY) {
      headers["Authorization"] = `Bearer ${DOME_API_KEY}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Candlesticks] Dome API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch candlesticks: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Parse the candlesticks response format
    // Each item is [candlestickData[], tokenMetadata]
    const candlestickTuples = data.candlesticks || [];
    
    if (candlestickTuples.length === 0) {
      console.log(`[Candlesticks] No data returned for ${conditionId}`);
      return new Response(
        JSON.stringify({ candlesticks: [], tokenId: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to find the YES token's data if yesTokenId is provided
    let selectedTuple = candlestickTuples[0];
    let selectedTokenId: string | null = null;

    if (yesTokenId) {
      const matchingTuple = candlestickTuples.find((tuple: any[]) => {
        const metadata = tuple[1];
        return metadata?.token_id === yesTokenId;
      });
      if (matchingTuple) {
        selectedTuple = matchingTuple;
        selectedTokenId = yesTokenId;
      }
    }

    if (!selectedTokenId && selectedTuple?.[1]?.token_id) {
      selectedTokenId = selectedTuple[1].token_id;
    }

    const [rawCandles] = selectedTuple || [[]];

    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      console.log(`[Candlesticks] No candle data in response for ${conditionId}`);
      return new Response(
        JSON.stringify({ candlesticks: [], tokenId: selectedTokenId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to frontend-friendly format (percentages)
    const formattedCandles = rawCandles
      .map((c: any) => {
        const price = c.price || c.yes_ask || c.yes_bid || {};
        return {
          time: c.end_period_ts,
          open: parseFloat(price.open_dollars || price.open || 0) * 100,
          high: parseFloat(price.high_dollars || price.high || 0) * 100,
          low: parseFloat(price.low_dollars || price.low || 0) * 100,
          close: parseFloat(price.close_dollars || price.close || 0) * 100,
          volume: c.volume || 0,
        };
      })
      .filter((c: any) => c.open > 0 || c.close > 0)
      .sort((a: any, b: any) => a.time - b.time);

    console.log(`[Candlesticks] Returning ${formattedCandles.length} candles for ${conditionId}`);

    return new Response(
      JSON.stringify({ 
        candlesticks: formattedCandles, 
        tokenId: selectedTokenId,
        count: formattedCandles.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Candlesticks] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
