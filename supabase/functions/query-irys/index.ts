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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, limit = 20 } = await req.json();
    
    console.log(`Querying Irys for category: ${category || 'all'}, limit: ${limit}`);

    // Build GraphQL tags filter
    const tags: IrysTag[] = [
      { name: "application-id", values: ["polymarket"] },
      { name: "status", values: ["resolved"] }
    ];

    if (category && category !== 'all') {
      tags.push({ name: "category", values: [category] });
    }

    // Build the GraphQL query
    const query = `
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

    console.log('GraphQL Query:', query);

    // Query Irys GraphQL endpoint
    const graphqlRes = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!graphqlRes.ok) {
      throw new Error(`Irys GraphQL error: ${graphqlRes.status}`);
    }

    const graphqlData = await graphqlRes.json();
    const edges: GraphQLEdge[] = graphqlData.data?.transactions?.edges || [];

    console.log(`Found ${edges.length} transactions on Irys`);

    // Fetch actual market data from each transaction
    const markets = await Promise.all(
      edges.map(async (edge) => {
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
          console.error(`Failed to fetch market ${edge.node.id}:`, err);
          return null;
        }
      })
    );

    // Filter out null results
    const validMarkets = markets.filter(Boolean);

    console.log(`Successfully retrieved ${validMarkets.length} markets`);

    return new Response(
      JSON.stringify({ 
        success: true,
        markets: validMarkets,
        count: validMarkets.length,
        source: 'irys'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error querying Irys:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        markets: []
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
