import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Twitter OAuth 1.0a credentials
const API_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const API_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();
const BEARER_TOKEN = Deno.env.get("TWITTER_BEARER_TOKEN")?.trim();

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&"),
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  return hmacSha1.update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(method, url, oauthParams, API_SECRET!, ACCESS_TOKEN_SECRET!);

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return (
    "OAuth " +
    Object.entries(signedOAuthParams)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

async function searchMentions(sinceId?: string): Promise<any> {
  const query = "@trypolyai (polymarket.com OR kalshi.com)";
  let searchUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=author_id,created_at&expansions=author_id&user.fields=username`;

  if (sinceId) {
    searchUrl += `&since_id=${sinceId}`;
  }

  console.log("Searching for mentions...");

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Search API error:", response.status, errorText);
    throw new Error(`Twitter search failed: ${response.status}`);
  }

  return response.json();
}

async function getPolyAnalysis(marketUrl: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return "Analysis unavailable - API not configured";
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are Poly, an AI prediction market analyst. Provide extremely concise analysis in under 240 characters. Be direct, valuable, and skip fluff.",
          },
          {
            role: "user",
            content: `Analyze this prediction market briefly: ${marketUrl}

Provide:
- Current market snapshot
- Key insight
- Quick take

Keep it under 240 characters total.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(" AI error:", response.status, errorText);
      return "Analysis unavailable";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Analysis unavailable";
  } catch (error) {
    console.error("Error getting Poly analysis:", error);
    return "Analysis unavailable";
  }
}

async function postReply(tweetId: string, text: string): Promise<boolean> {
  const url = "https://api.twitter.com/2/tweets";
  const oauthHeader = generateOAuthHeader("POST", url);

  console.log(`Posting reply to tweet ${tweetId}...`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text.substring(0, 280),
      reply: {
        in_reply_to_tweet_id: tweetId,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to post reply:", response.status, errorText);
    return false;
  }

  console.log("Reply posted successfully");
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate credentials
    if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET || !BEARER_TOKEN) {
      throw new Error("Missing Twitter credentials");
    }

    console.log("Twitter bot polling started...");

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Get last checked tweet ID
    const { data: lastCheck } = await supabase
      .from("twitter_bot_status")
      .select("last_mention_id")
      .eq("id", 1)
      .maybeSingle();

    console.log("Last mention ID:", lastCheck?.last_mention_id);

    // Search for recent mentions
    const data = await searchMentions(lastCheck?.last_mention_id);

    if (!data.data || data.data.length === 0) {
      console.log("No new mentions found");
      return new Response(JSON.stringify({ message: "No new mentions", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${data.data.length} new mentions`);

    const users = data.includes?.users || [];
    let processed = 0;

    // Process each mention
    for (const tweet of data.data) {
      const author = users.find((u: any) => u.id === tweet.author_id);

      if (!author) {
        console.log(`No author found for tweet ${tweet.id}`);
        continue;
      }

      // Don't reply to ourselves
      if (author.username.toLowerCase() === "trypolyai") {
        console.log("Skipping own tweet");
        continue;
      }

      console.log(`Processing tweet from @${author.username}: ${tweet.text.substring(0, 50)}...`);

      // Extract market URL
      const polymarketMatch = tweet.text.match(/(https?:\/\/)?polymarket\.com\/[^\s]+/);
      const kalshiMatch = tweet.text.match(/(https?:\/\/)?kalshi\.com\/[^\s]+/);
      const marketUrl = polymarketMatch?.[0] || kalshiMatch?.[0];

      if (!marketUrl) {
        console.log("No market URL found in tweet");
        continue;
      }

      // Ensure URL has protocol
      const fullMarketUrl = marketUrl.startsWith("http") ? marketUrl : `https://${marketUrl}`;
      console.log(`Found market URL: ${fullMarketUrl}`);

      // Get Poly analysis
      const analysis = await getPolyAnalysis(fullMarketUrl);
      console.log(`Analysis: ${analysis.substring(0, 50)}...`);

      // Build reply
      const replyText = `@${author.username} ${analysis}\n\nFull analysis → polyai.pro`;

      // Post reply
      const success = await postReply(tweet.id, replyText);
      if (success) {
        processed++;
      }

      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Update last processed tweet ID (use the newest tweet)
    if (data.data.length > 0) {
      const newestTweetId = data.data[0].id;
      console.log(`Updating last_mention_id to: ${newestTweetId}`);

      await supabase.from("twitter_bot_status").upsert({
        id: 1,
        last_mention_id: newestTweetId,
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`Processed ${processed} mentions successfully`);

    return new Response(
      JSON.stringify({
        message: "Success",
        found: data.data.length,
        processed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Twitter bot error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
