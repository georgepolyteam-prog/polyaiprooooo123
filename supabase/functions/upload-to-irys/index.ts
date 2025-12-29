import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GAMMA_API = "https://gamma-api.polymarket.com";

interface PolymarketMarket {
  condition_id: string;
  question: string;
  outcomes: string[];
  end_date_iso: string;
  closed: boolean;
  outcome?: string;
  outcome_prices?: number[];
  volume?: string;
  category?: string;
}

function inferCategory(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("election") || q.includes("president") || q.includes("trump") || q.includes("biden") || q.includes("political") || q.includes("vote")) return "elections";
  if (q.includes("crypto") || q.includes("bitcoin") || q.includes("eth") || q.includes("token") || q.includes("blockchain")) return "crypto";
  if (q.includes("sports") || q.includes("nfl") || q.includes("nba") || q.includes("super bowl") || q.includes("championship")) return "sports";
  if (q.includes("ai") || q.includes("openai") || q.includes("gpt") || q.includes("technology")) return "tech";
  return "other";
}

async function fetchResolvedMarkets(limit: number): Promise<PolymarketMarket[]> {
  console.log(`Fetching ${limit} resolved markets from Gamma API...`);
  const response = await fetch(`${GAMMA_API}/markets?closed=true&limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Gamma API error: ${response.status}`);
  }
  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 50 } = await req.json().catch(() => ({}));
    
    console.log(`Starting Irys upload for ${limit} markets...`);
    
    // Note: Direct Irys upload requires wallet signing which is complex in Deno
    // This function prepares the data and provides instructions
    // For actual upload, use the Node.js script locally
    
    const markets = await fetchResolvedMarkets(limit);
    console.log(`Fetched ${markets.length} resolved markets`);

    // Prepare upload data with tags
    const preparedData = markets.map(market => ({
      data: JSON.stringify(market),
      tags: [
        { name: "application-id", value: "polymarket" },
        { name: "Content-Type", value: "application/json" },
        { name: "category", value: market.category || inferCategory(market.question) },
        { name: "status", value: "resolved" },
        { name: "market-id", value: market.condition_id },
        ...(market.outcome_prices?.[0] ? [{ name: "final-price", value: market.outcome_prices[0].toString() }] : [])
      ],
      question: market.question,
      condition_id: market.condition_id
    }));

    // Calculate approximate size
    const totalSize = preparedData.reduce((sum, item) => sum + item.data.length, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data prepared for Irys upload",
        info: "Run the local Node.js script to upload to Irys (requires wallet signing)",
        stats: {
          marketsCount: preparedData.length,
          totalSizeKB: (totalSize / 1024).toFixed(2),
          categories: {
            elections: preparedData.filter(m => m.tags.find(t => t.name === 'category')?.value === 'elections').length,
            crypto: preparedData.filter(m => m.tags.find(t => t.name === 'category')?.value === 'crypto').length,
            sports: preparedData.filter(m => m.tags.find(t => t.name === 'category')?.value === 'sports').length,
            tech: preparedData.filter(m => m.tags.find(t => t.name === 'category')?.value === 'tech').length,
            other: preparedData.filter(m => m.tags.find(t => t.name === 'category')?.value === 'other').length,
          }
        },
        // Include sample of prepared data
        sample: preparedData.slice(0, 3).map(p => ({
          question: p.question,
          tags: p.tags
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error preparing Irys upload:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
