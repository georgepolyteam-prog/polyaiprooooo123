import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role to bypass RLS and get accurate counts
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all counts in parallel
    const [profilesResult, chatsResult, tradesResult] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("chat_logs").select("*", { count: "exact", head: true }),
      supabase.from("whale_trades").select("*", { count: "exact", head: true }),
    ]);

    const users = profilesResult.count ?? 0;
    const chatsRaw = chatsResult.count ?? 0;
    const trades = tradesResult.count ?? 0;

    // Apply the 30x multiplier for AI analyses
    const analyses = chatsRaw * 30;

    console.log(`Public stats: ${users} users, ${analyses} analyses (${chatsRaw} raw), ${trades} trades`);

    return new Response(
      JSON.stringify({
        users,
        analyses,
        trades,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching public stats:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch stats" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
