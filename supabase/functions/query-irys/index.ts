import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IrysTag {
  name: string;
  values: string[];
}

interface GraphQLEdge {
  node: {
    id: string;
    timestamp: number;
    tags: { name: string; value: string }[];
  };
}

// Infer category from user query - IMPROVED for better accuracy
function inferCategoryFromQuery(query: string): string | null {
  const q = query.toLowerCase();
  
  // ELECTIONS - Expanded patterns (prioritize this for political figures)
  if (
    q.includes('election') || 
    q.includes('president') || 
    q.includes('presidential') ||
    q.includes('political') || 
    q.includes('trump') || 
    q.includes('biden') ||
    q.includes('harris') ||
    q.includes('senate') ||
    q.includes('congress') ||
    q.includes('governor') ||
    q.includes('vote') ||
    q.includes('voting') ||
    q.includes('candidate') ||
    q.includes('primary') ||
    q.includes('democrat') ||
    q.includes('republican') ||
    q.includes('electoral') ||
    q.includes('ballot')
  ) {
    return 'elections';
  }
  
  // CRYPTO
  if (
    q.includes('crypto') || 
    q.includes('bitcoin') || 
    q.includes('eth') || 
    q.includes('ethereum') ||
    q.includes('solana') ||
    q.includes('btc') ||
    q.includes('token') ||
    q.includes('blockchain') && !q.includes('irys') // Don't match "irys blockchain"
  ) {
    return 'crypto';
  }
  
  // SPORTS
  if (
    q.includes('sport') || 
    q.includes('nba') || 
    q.includes('nfl') || 
    q.includes('soccer') || 
    q.includes('lakers') ||
    q.includes('football') ||
    q.includes('basketball') ||
    q.includes('baseball') ||
    q.includes('super bowl') ||
    q.includes('world cup') ||
    q.includes('championship') ||
    q.includes('playoffs') ||
    q.includes('finals') ||
    q.includes('game') && (q.includes('win') || q.includes('score'))
  ) {
    return 'sports';
  }
  
  // FINANCE
  if (
    q.includes('stock') || 
    q.includes('market') && !q.includes('prediction market') || 
    q.includes('finance') || 
    q.includes('recession') ||
    q.includes('inflation') ||
    q.includes('fed') ||
    q.includes('interest rate') ||
    q.includes('gdp') ||
    q.includes('economy')
  ) {
    return 'finance';
  }
  
  // ENTERTAINMENT
  if (
    q.includes('movie') || 
    q.includes('oscar') || 
    q.includes('grammy') || 
    q.includes('entertainment') ||
    q.includes('netflix') ||
    q.includes('hollywood') ||
    q.includes('celebrity') ||
    q.includes('tv show') ||
    q.includes('award')
  ) {
    return 'entertainment';
  }
  
  // SCIENCE & TECH
  if (
    q.includes('tech') || 
    q.includes('ai') || 
    q.includes('spacex') || 
    q.includes('science') ||
    q.includes('nasa') ||
    q.includes('openai') ||
    q.includes('elon') ||
    q.includes('musk') ||
    q.includes('apple') ||
    q.includes('google') ||
    q.includes('microsoft')
  ) {
    return 'science-tech';
  }
  
  return null; // Return all categories if no match
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, category, limit = 20 } = await req.json();
    
    // Infer category from user query if not explicitly provided
    const inferredCategory = category || (query ? inferCategoryFromQuery(query) : null);
    
    console.log(`[Irys] Query: "${query?.substring(0, 50)}...", Category: ${inferredCategory || 'all'}, Limit: ${limit}`);

    // Build GraphQL tags filter
    const tags: IrysTag[] = [
      { name: "application-id", values: ["polymarket"] },
      { name: "status", values: ["resolved"] }
    ];

    if (inferredCategory && inferredCategory !== 'all') {
      tags.push({ name: "category", values: [inferredCategory] });
    }

    // Build the GraphQL query
    const graphqlQuery = `
      query {
        transactions(
          tags: [
            ${tags.map(t => `{ name: "${t.name}", values: ${JSON.stringify(t.values)} }`).join(', ')}
          ]
          limit: ${limit}
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;

    console.log('[Irys] Executing GraphQL query...');

    // Query Irys GraphQL endpoint
    const graphqlRes = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: graphqlQuery })
    });

    if (!graphqlRes.ok) {
      throw new Error(`Irys GraphQL error: ${graphqlRes.status}`);
    }

    const graphqlData = await graphqlRes.json();
    const edges: GraphQLEdge[] = graphqlData.data?.transactions?.edges || [];

    console.log(`[Irys] Found ${edges.length} transactions`);

    // Fetch actual market data from each transaction (batch with concurrency limit)
    const markets = await Promise.all(
      edges.slice(0, Math.min(edges.length, limit)).map(async (edge) => {
        try {
          const dataRes = await fetch(`https://gateway.irys.xyz/${edge.node.id}`);
          if (!dataRes.ok) return null;
          
          const market = await dataRes.json();
          
          // Extract tags into a more usable format
          const tagMap: Record<string, string> = {};
          edge.node.tags.forEach(t => { tagMap[t.name] = t.value; });

          return {
            ...market,
            irys: {
              txId: edge.node.id,
              timestamp: edge.node.timestamp,
              proofUrl: `https://gateway.irys.xyz/${edge.node.id}`,
              category: tagMap['category'],
              finalPrice: tagMap['final-price']
            }
          };
        } catch (err) {
          console.error(`[Irys] Failed to fetch market ${edge.node.id}:`, err);
          return null;
        }
      })
    );

    // Filter out null results
    const validMarkets = markets.filter(Boolean);

    console.log(`[Irys] Successfully retrieved ${validMarkets.length} markets`);

    // Extract sample transaction ID for proof links
    const sampleTxId = validMarkets.length > 0 ? validMarkets[0]?.irys?.txId : null;

    return new Response(
      JSON.stringify({ 
        success: true,
        markets: validMarkets,
        count: validMarkets.length,
        totalAvailable: edges.length,
        inferredCategory,
        sampleTxId,
        source: 'irys'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Irys] Error querying:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        markets: [],
        count: 0
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
