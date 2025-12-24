import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const timePeriod = url.searchParams.get('timePeriod') || 'WEEK';
    const builder = url.searchParams.get('builder');
    const limit = url.searchParams.get('limit') || '25';

    console.log(`Fetching builder stats: timePeriod=${timePeriod}, builder=${builder}, limit=${limit}`);

    // Fetch leaderboard from Polymarket Data API
    const leaderboardUrl = `https://data-api.polymarket.com/v1/builders/leaderboard?timePeriod=${timePeriod}&limit=${limit}`;
    console.log(`Fetching leaderboard: ${leaderboardUrl}`);
    
    const leaderboardRes = await fetch(leaderboardUrl);
    
    if (!leaderboardRes.ok) {
      const errorText = await leaderboardRes.text();
      console.error(`Leaderboard API error: ${leaderboardRes.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch leaderboard', 
          status: leaderboardRes.status,
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leaderboard = await leaderboardRes.json();
    console.log(`Leaderboard fetched: ${leaderboard?.length || 0} builders`);

    // If specific builder requested, fetch their volume history
    let volumeHistory = null;
    let builderDetails = null;

    if (builder) {
      // Find builder in leaderboard
      builderDetails = leaderboard.find((b: any) => 
        b.builder?.toLowerCase() === builder.toLowerCase() ||
        b.builderName?.toLowerCase() === builder.toLowerCase()
      );

      // Fetch volume time series for this builder
      const volumeUrl = `https://data-api.polymarket.com/v1/builders/volume?builder=${encodeURIComponent(builder)}&timePeriod=${timePeriod}`;
      console.log(`Fetching volume history: ${volumeUrl}`);
      
      try {
        const volumeRes = await fetch(volumeUrl);
        if (volumeRes.ok) {
          volumeHistory = await volumeRes.json();
          console.log(`Volume history fetched: ${volumeHistory?.length || 0} data points`);
        } else {
          console.warn(`Volume API returned ${volumeRes.status}`);
        }
      } catch (volumeError) {
        console.warn('Failed to fetch volume history:', volumeError);
      }
    }

    return new Response(
      JSON.stringify({
        leaderboard,
        volumeHistory,
        builderDetails,
        timePeriod,
        fetchedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in builder-stats function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
