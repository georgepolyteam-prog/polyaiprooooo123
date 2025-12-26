import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Edge function to fetch user trading data from Dome API.
 * 
 * Uses Dome's /polymarket/orders and /polymarket/activity endpoints
 * which don't require user-side HMAC auth - just the DOME_API_KEY.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOME_API_URL = "https://api.dome.trade";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface OrdersParams {
  user: string;
  market_slug?: string;
  condition_id?: string;
  token_id?: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  offset?: number;
}

interface ActivityParams {
  user: string;
  market_slug?: string;
  condition_id?: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  offset?: number;
}

async function fetchOrders(params: OrdersParams, apiKey: string) {
  const queryParams = new URLSearchParams();
  queryParams.set("user", params.user.toLowerCase());
  
  if (params.market_slug) queryParams.set("market_slug", params.market_slug);
  if (params.condition_id) queryParams.set("condition_id", params.condition_id);
  if (params.token_id) queryParams.set("token_id", params.token_id);
  if (params.start_time !== undefined) queryParams.set("start_time", String(params.start_time));
  if (params.end_time !== undefined) queryParams.set("end_time", String(params.end_time));
  if (params.limit !== undefined) queryParams.set("limit", String(params.limit));
  if (params.offset !== undefined) queryParams.set("offset", String(params.offset));

  const url = `${DOME_API_URL}/polymarket/orders?${queryParams.toString()}`;
  console.log("[Dome User Data] Fetching orders:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Dome User Data] Orders API error:", response.status, errorText);
    throw new Error(`Dome orders API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[Dome User Data] Orders response:", JSON.stringify(data).slice(0, 500));
  
  return data;
}

async function fetchActivity(params: ActivityParams, apiKey: string) {
  const queryParams = new URLSearchParams();
  queryParams.set("user", params.user.toLowerCase());
  
  if (params.market_slug) queryParams.set("market_slug", params.market_slug);
  if (params.condition_id) queryParams.set("condition_id", params.condition_id);
  if (params.start_time !== undefined) queryParams.set("start_time", String(params.start_time));
  if (params.end_time !== undefined) queryParams.set("end_time", String(params.end_time));
  if (params.limit !== undefined) queryParams.set("limit", String(params.limit));
  if (params.offset !== undefined) queryParams.set("offset", String(params.offset));

  const url = `${DOME_API_URL}/polymarket/activity?${queryParams.toString()}`;
  console.log("[Dome User Data] Fetching activity:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Dome User Data] Activity API error:", response.status, errorText);
    throw new Error(`Dome activity API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[Dome User Data] Activity response:", JSON.stringify(data).slice(0, 500));
  
  return data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOME_API_KEY = Deno.env.get("DOME_API_KEY");
    if (!DOME_API_KEY) {
      console.error("[Dome User Data] Missing DOME_API_KEY");
      return json(500, { error: "Server configuration error" });
    }

    const body = await req.json();
    const { user, type = "orders", ...filters } = body;

    if (!user) {
      return json(400, { error: "Missing user address" });
    }

    console.log(`[Dome User Data] Request type: ${type}, user: ${user}`);

    if (type === "orders") {
      const orders = await fetchOrders({ user, ...filters }, DOME_API_KEY);
      return json(200, { orders: orders.orders || orders.data || orders || [] });
    } 
    
    if (type === "activity") {
      const activity = await fetchActivity({ user, ...filters }, DOME_API_KEY);
      return json(200, { activity: activity.activity || activity.data || activity || [] });
    }
    
    if (type === "all") {
      // Fetch both orders and activity in parallel
      const [ordersResult, activityResult] = await Promise.all([
        fetchOrders({ user, ...filters }, DOME_API_KEY).catch(err => {
          console.error("[Dome User Data] Orders fetch failed:", err);
          return { orders: [] };
        }),
        fetchActivity({ user, ...filters }, DOME_API_KEY).catch(err => {
          console.error("[Dome User Data] Activity fetch failed:", err);
          return { activity: [] };
        }),
      ]);

      return json(200, {
        orders: ordersResult.orders || ordersResult.data || ordersResult || [],
        activity: activityResult.activity || activityResult.data || activityResult || [],
      });
    }

    return json(400, { error: `Invalid type: ${type}. Use 'orders', 'activity', or 'all'` });
  } catch (error: unknown) {
    console.error("[Dome User Data] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(500, { error: message });
  }
});
