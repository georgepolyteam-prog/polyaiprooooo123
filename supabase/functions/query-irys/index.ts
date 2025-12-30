import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Election-specific keywords for relevance scoring
const ELECTION_KEYWORDS = {
  high: ['election', 'presidential', 'president', 'senate', 'governor', 'vote', 'ballot', 'candidate', 'nominee', 'primary', 'wins', 'won', 'loses', 'lost', 'victory', 'defeat', 'inaugurated', 'inauguration'],
  medium: ['race', 'campaign', 'polling', 'voter', 'democrat', 'republican', 'electoral', 'swing state'],
  exclude: ['meeting', 'meet', 'meets', 'zelensky', 'zelenskyy', 'pardon', 'pardons', 'turkey', 'speech', 'summit', 'diplomacy', 'talk', 'talks', 'visit', 'visits', 'erdogan', 'call', 'calls', 'phone', 'announces', 'says', 'said', 'remarks', 'statement']
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

// Infer category from user query
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
    (q.includes('blockchain') && !q.includes('irys'))
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
    (q.includes('game') && (q.includes('win') || q.includes('score')))
  ) {
    return 'sports';
  }
  
  // FINANCE
  if (
    q.includes('stock') || 
    (q.includes('market') && !q.includes('prediction market')) || 
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
  
  return null;
}

// Calculate relevance score for election markets - CRITICAL for filtering out non-election content
function calculateElectionRelevance(question: string, userQuery: string): number {
  const q = question.toLowerCase();
  const query = userQuery.toLowerCase();
  let score = 0;
  
  // Check for exclusion terms (auto-disqualify)
  for (const term of ELECTION_KEYWORDS.exclude) {
    if (q.includes(term)) {
      console.log(`[Irys Relevance] EXCLUDED: "${question.substring(0, 50)}..." contains "${term}"`);
      return -1000; // Disqualify
    }
  }
  
  // High value election keywords (+10 each)
  for (const term of ELECTION_KEYWORDS.high) {
    if (q.includes(term)) {
      score += 10;
    }
  }
  
  // Medium value keywords (+5 each)
  for (const term of ELECTION_KEYWORDS.medium) {
    if (q.includes(term)) {
      score += 5;
    }
  }
  
  // Boost if query terms appear in question (+3 each)
  const queryTerms = query.split(/\s+/).filter(t => t.length > 3);
  for (const term of queryTerms) {
    if (q.includes(term)) {
      score += 3;
    }
  }
  
  return score;
}

// Compute normalized fields for analysis
function normalizeMarket(market: any, txId: string, tagMap: Record<string, string>) {
  // Parse outcomes - handle both string and array formats
  let outcomes: string[] = [];
  let outcomePrices: number[] = [];
  
  try {
    if (typeof market.outcomes === 'string') {
      outcomes = JSON.parse(market.outcomes);
    } else if (Array.isArray(market.outcomes)) {
      // Handle array of objects with name/price
      if (market.outcomes[0]?.name) {
        outcomes = market.outcomes.map((o: any) => o.name);
        outcomePrices = market.outcomes.map((o: any) => parseFloat(o.price) || 0);
      } else {
        outcomes = market.outcomes;
      }
    }
    
    if (typeof market.outcomePrices === 'string') {
      outcomePrices = JSON.parse(market.outcomePrices).map((p: string) => parseFloat(p));
    } else if (Array.isArray(market.outcomePrices) && outcomePrices.length === 0) {
      outcomePrices = market.outcomePrices.map((p: any) => parseFloat(p) || 0);
    }
  } catch (e) {
    console.log('[Irys Normalize] Failed to parse outcomes:', e);
  }
  
  // For binary Yes/No markets
  const isYesNo = outcomes.length === 2 && 
    outcomes[0]?.toLowerCase() === 'yes' && 
    outcomes[1]?.toLowerCase() === 'no';
  
  const finalYesPrice = isYesNo && outcomePrices[0] !== undefined ? outcomePrices[0] : null;
  
  // Determine resolved outcome from various possible fields
  let resolvedOutcome = null;
  
  // Check for winning outcome in outcomes array
  if (Array.isArray(market.outcomes) && market.outcomes[0]?.winner !== undefined) {
    const winner = market.outcomes.find((o: any) => o.winner === true);
    if (winner) {
      resolvedOutcome = winner.name;
    }
  }
  
  // Fallback to other fields
  if (!resolvedOutcome) {
    resolvedOutcome = market.outcome || market.winning_outcome || market.resolved_outcome || null;
  }
  
  // For closed binary markets, infer outcome from final price if not set
  if (!resolvedOutcome && market.closed && isYesNo && finalYesPrice !== null) {
    // Price >= 0.95 means Yes won, <= 0.05 means No won
    if (finalYesPrice >= 0.95) {
      resolvedOutcome = 'Yes';
    } else if (finalYesPrice <= 0.05) {
      resolvedOutcome = 'No';
    }
  }
  
  // Predicted outcome (what market predicted based on final price)
  let predictedOutcome = null;
  let predictedProbability = null;
  
  if (isYesNo && finalYesPrice !== null) {
    predictedOutcome = finalYesPrice >= 0.5 ? 'Yes' : 'No';
    predictedProbability = Math.round((finalYesPrice >= 0.5 ? finalYesPrice : 1 - finalYesPrice) * 100);
  }
  
  // Check if prediction was correct
  let isCorrectPrediction = null;
  if (predictedOutcome && resolvedOutcome) {
    isCorrectPrediction = predictedOutcome.toLowerCase() === resolvedOutcome.toLowerCase();
  }
  
  return {
    ...market,
    txId,
    proofUrl: `https://gateway.irys.xyz/${txId}`,
    category: tagMap['category'] || market.category || 'unknown',
    outcomes,
    outcomePrices,
    finalYesPrice,
    resolvedOutcome,
    predictedOutcome,
    predictedProbability,
    isCorrectPrediction
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, category, limit = 20, debug = false } = await req.json();
    
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

    // Fetch MORE candidates for post-filtering (10x limit)
    const candidateLimit = Math.min(limit * 10, 200);

    // Build the GraphQL query with timestamp filter for Dec 29, 2024 upload window
    const graphqlQuery = `
      query {
        transactions(
          tags: [
            ${tags.map(t => `{ name: "${t.name}", values: ${JSON.stringify(t.values)} }`).join(', ')}
          ]
          timestamp: {
            from: 1767010000000
            to: 1767070000000
          }
          limit: ${candidateLimit}
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

    console.log(`[Irys] Fetching ${candidateLimit} candidates from Irys GraphQL...`);

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

    console.log(`[Irys] Retrieved ${edges.length} candidate transactions`);

    if (edges.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          markets: [],
          count: 0,
          category: inferredCategory,
          source: 'irys'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is an election-intent query (requires strict filtering)
    const hasElectionIntent = query && /election|presidential|vote|ballot|candidate|wins|won/i.test(query);
    console.log(`[Irys] Election intent: ${hasElectionIntent}`);

    // Fetch actual market data from each transaction
    const candidateMarkets = await Promise.all(
      edges.map(async (edge) => {
        try {
          const txId = edge.node.id;
          const dataRes = await fetch(`https://gateway.irys.xyz/${txId}`);
          if (!dataRes.ok) return null;
          
          const market = await dataRes.json();
          
          // Extract tags into a map
          const tagMap: Record<string, string> = {};
          edge.node.tags.forEach(t => { tagMap[t.name] = t.value; });

          // Normalize market data
          const normalized = normalizeMarket(market, txId, tagMap);
          
          // Calculate relevance score for election queries
          let relevanceScore = 0;
          if (inferredCategory === 'elections') {
            relevanceScore = calculateElectionRelevance(normalized.question || '', query || '');
          }

          return {
            ...normalized,
            relevanceScore,
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

    // Filter out null results and disqualified markets (negative score)
    let validMarkets = candidateMarkets.filter(m => m !== null && m.relevanceScore >= 0);

    console.log(`[Irys] Valid markets after null/disqualified filter: ${validMarkets.length}`);

    // For election-intent queries, ENFORCE strict filtering - only keep markets with positive relevance
    if (inferredCategory === 'elections' && hasElectionIntent) {
      const beforeCount = validMarkets.length;
      validMarkets = validMarkets.filter(m => m.relevanceScore > 0);
      console.log(`[Irys] After election keyword filter: ${validMarkets.length} (removed ${beforeCount - validMarkets.length})`);
    }

    // Sort by relevance score (highest first)
    validMarkets.sort((a, b) => (b?.relevanceScore || 0) - (a?.relevanceScore || 0));

    // Take top N results
    const topMarkets = validMarkets.slice(0, limit);

    console.log(`[Irys] Returning top ${topMarkets.length} markets`);

    // Calculate accuracy stats
    let accuracyStats = null;
    const marketsWithPrediction = topMarkets.filter(m => m.isCorrectPrediction !== null);
    if (marketsWithPrediction.length > 0) {
      const correctCount = marketsWithPrediction.filter(m => m.isCorrectPrediction).length;
      accuracyStats = {
        correct: correctCount,
        total: marketsWithPrediction.length,
        percentage: Math.round((correctCount / marketsWithPrediction.length) * 100)
      };
    }

    // Build result
    const result: any = { 
      success: true,
      markets: topMarkets,
      count: topMarkets.length,
      totalAvailable: edges.length,
      inferredCategory,
      sampleTxId: topMarkets[0]?.txId,
      accuracyStats,
      source: 'irys'
    };

    // Add debug info if requested
    if (debug) {
      result.debug = {
        candidatesRetrieved: edges.length,
        validAfterFilter: validMarkets.length,
        hasElectionIntent,
        topSample: topMarkets.slice(0, 5).map(m => ({
          question: m.question?.substring(0, 80),
          score: m.relevanceScore,
          txId: m.txId
        }))
      };
    }

    return new Response(
      JSON.stringify(result),
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
