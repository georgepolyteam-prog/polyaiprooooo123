import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// SIMPLIFIED IRYS QUERY - Claude handles intelligent filtering
// This function returns top markets by volume, Claude decides what's relevant
// ============================================================================

// Simple category inference for GraphQL filtering (optional optimization)
function inferCategoryFromQuery(query: string): string | null {
  if (!query) return null;
  const q = query.toLowerCase();
  
  if (/election|president|presidential|political|trump|biden|senate|congress|vote|candidate/.test(q)) {
    return 'elections';
  }
  if (/crypto|bitcoin|eth|ethereum|solana|btc/.test(q)) {
    return 'crypto';
  }
  if (/sport|nba|nfl|soccer|lakers|game|championship|playoffs/.test(q)) {
    return 'sports';
  }
  if (/stock|finance|recession|inflation|fed/.test(q)) {
    return 'finance';
  }
  if (/movie|oscar|grammy|entertainment|netflix|hollywood/.test(q)) {
    return 'entertainment';
  }
  if (/tech|ai|spacex|science/.test(q)) {
    return 'science-tech';
  }
  
  return null;
}

// Normalize market data with accurate outcome detection
function normalizeMarket(market: any, txId: string) {
  let outcomes: string[] = [];
  let outcomePrices: number[] = [];
  
  try {
    outcomes = market.outcomes ? (typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes) : [];
  } catch {
    outcomes = [];
  }
  
  try {
    const rawPrices = market.outcomePrices ? (typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices) : [];
    outcomePrices = rawPrices.map((p: any) => typeof p === 'string' ? parseFloat(p) : p);
  } catch {
    outcomePrices = [];
  }
  
  const isYesNo = outcomes.length === 2 && outcomes[0] === 'Yes' && outcomes[1] === 'No';
  const finalYesPrice = isYesNo && outcomePrices[0] !== undefined ? outcomePrices[0] : null;
  
  // ONLY use explicit outcome fields - don't infer from price
  const resolvedOutcome = market.outcome || market.winning_outcome || market.resolved_outcome || null;
  
  // Predicted outcome (what market said before resolution)
  const predictedOutcome = isYesNo && finalYesPrice !== null 
    ? (finalYesPrice >= 0.5 ? 'Yes' : 'No')
    : null;
  
  const predictedProbability = finalYesPrice !== null ? (finalYesPrice * 100) : null;
  
  // Check if prediction was correct (ONLY if we have explicit outcome)
  const isCorrectPrediction = (predictedOutcome && resolvedOutcome) 
    ? predictedOutcome.toLowerCase() === resolvedOutcome.toLowerCase()
    : null;
  
  return {
    ...market,
    txId,
    proofUrl: `https://gateway.irys.xyz/${txId}`,
    outcomes,
    outcomePrices,
    finalYesPrice,
    resolvedOutcome,
    predictedOutcome,
    predictedProbability,
    isCorrectPrediction
  };
}

// Fetch with concurrency limit
async function fetchWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<any>,
  limit: number = 20
): Promise<any[]> {
  const results: any[] = [];
  
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  
  return results;
}

// Simple keyword matching - Claude specifies what keywords must be present
function matchesKeywords(question: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const q = question.toLowerCase();
  // All keywords must be present
  return keywords.every(kw => q.includes(kw.toLowerCase()));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Accept params from Claude's tool call
    const { 
      query = '', 
      limit = 100,  // Default higher since Claude will filter
      debug = false,
      category: providedCategory,  // Claude can specify category directly
      keywords = [],               // Claude can specify required keywords
      minVolume = 0                // Claude can filter by minimum volume
    } = await req.json();
    
    console.log('[Irys Query] ========================================');
    console.log('[Irys Query] SIMPLIFIED MODE - Claude handles filtering');
    console.log('[Irys Query] Query:', query);
    console.log('[Irys Query] Limit:', limit);
    console.log('[Irys Query] Provided category:', providedCategory);
    console.log('[Irys Query] Required keywords:', keywords);
    console.log('[Irys Query] Min volume:', minVolume);
    
    // Use provided category or infer from query
    const category = providedCategory || inferCategoryFromQuery(query);
    console.log('[Irys Query] Final category:', category);
    
    // Build GraphQL tags - filter by application-id AND category if detected
    const tags: Array<{ name: string; values: string[] }> = [
      { name: "application-id", values: ["polymarket"] }
    ];
    
    // Add category filter if we detected one
    if (category) {
      tags.push({ name: "category", values: [category] });
      console.log('[Irys Query] Adding category filter:', category);
    }
    
    console.log('[Irys Query] GraphQL tags filter:', JSON.stringify(tags));
    
    // Fetch more candidates so Claude has options to filter from
    const targetCandidates = Math.min(limit * 5, 500);
    const pageSize = 100;
    const maxPages = Math.ceil(targetCandidates / pageSize);
    
    console.log('[Irys Query] Target candidates:', targetCandidates, 'Pages:', maxPages);
    
    let allEdges: any[] = [];
    let after: string | null = null;
    
    // Paginate through results
    for (let page = 0; page < maxPages; page++) {
      const tagsGraphQL = tags.map((t: { name: string; values: string[] }) => 
        `{ name: "${t.name}", values: [${t.values.map(v => `"${v}"`).join(', ')}] }`
      ).join(', ');
      
      const graphqlQueryStr: string = `
        query {
          transactions(
            tags: [${tagsGraphQL}],
            limit: ${pageSize},
            ${after ? `after: "${after}",` : ''}
            order: DESC
          ) {
            edges {
              cursor
              node {
                id
                timestamp
                tags { name value }
              }
            }
          }
        }
      `;
      
      console.log(`[Irys Query] Fetching page ${page + 1}/${maxPages}`);
      
      const response: Response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: graphqlQueryStr })
      });
      
      const rawText: string = await response.text();
      
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error('[Irys Query] Failed to parse JSON:', e);
        break;
      }
      
      if (data.errors) {
        console.error('[Irys Query] GraphQL errors:', JSON.stringify(data.errors));
      }
      
      const edges: any[] = data.data?.transactions?.edges || [];
      
      if (edges.length === 0) {
        console.log('[Irys Query] No more results, stopping pagination');
        break;
      }
      
      allEdges.push(...edges);
      after = edges[edges.length - 1]?.cursor;
      
      console.log(`[Irys Query] Page ${page + 1}: Retrieved ${edges.length} transactions (Total: ${allEdges.length})`);
    }
    
    console.log('[Irys Query] Total transactions fetched:', allEdges.length);
    
    if (allEdges.length === 0) {
      return new Response(
        JSON.stringify({ success: true, markets: [], count: 0, category, note: 'No markets found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch market data with concurrency limit
    console.log('[Irys Query] Fetching market data from gateway (concurrency: 20)...');
    
    const candidateMarkets = await fetchWithConcurrency(
      allEdges,
      async (edge: any) => {
        try {
          const txId = edge.node.id;
          const marketResponse = await fetch(`https://gateway.irys.xyz/${txId}`);
          const marketData = await marketResponse.json();
          
          const normalized = normalizeMarket(marketData, txId);
          
          // Filter for resolved markets
          const isResolved = normalized.closed === true || normalized.closed === 'true';
          if (!isResolved) {
            return null;
          }
          
          // Apply keyword filter if Claude specified keywords
          if (keywords.length > 0 && !matchesKeywords(normalized.question || '', keywords)) {
            return null;
          }
          
          return normalized;
        } catch (err) {
          console.error('[Irys Query] Failed to fetch market:', err);
          return null;
        }
      },
      20
    );
    
    // Filter out nulls
    let validMarkets = candidateMarkets.filter((m: any) => m !== null);
    
    console.log('[Irys Query] Valid markets after filtering:', validMarkets.length);
    
    // Apply minVolume filter if specified
    if (minVolume > 0) {
      const beforeCount = validMarkets.length;
      validMarkets = validMarkets.filter((m: any) => {
        const vol = parseFloat(m.volume || '0');
        return vol >= minVolume;
      });
      console.log(`[Irys Query] Volume filter ($${minVolume}+): ${beforeCount} → ${validMarkets.length} markets`);
    }
    
    // SIMPLE: Sort by volume (higher volume = better quality data)
    // Claude will do intelligent filtering based on user intent
    validMarkets.sort((a: any, b: any) => {
      const volA = parseFloat(a.volume || '0');
      const volB = parseFloat(b.volume || '0');
      return volB - volA;
    });
    
    // Log top 5 for debugging
    console.log('[Irys Query] Top 5 markets by volume:');
    validMarkets.slice(0, 5).forEach((m: any, i: number) => {
      const vol = parseFloat(m.volume || '0');
      console.log(`  ${i + 1}. Vol $${Math.round(vol/1000)}k: "${m.question?.slice(0, 60)}..."`);
    });
    
    // Take top N
    const topMarkets = validMarkets.slice(0, limit);
    
    console.log('[Irys Query] Returning top', topMarkets.length, 'markets');
    
    // Calculate accuracy stats for markets with explicit outcomes
    const marketsWithPrediction = topMarkets.filter((m: any) => m.isCorrectPrediction !== null);
    const correctCount = marketsWithPrediction.filter((m: any) => m.isCorrectPrediction).length;
    const totalCount = marketsWithPrediction.length;
    
    const accuracyStats = totalCount > 0 ? {
      correct: correctCount,
      total: totalCount,
      percentage: Math.round((correctCount / totalCount) * 100)
    } : null;
    
    if (accuracyStats) {
      console.log('[Irys Query] Accuracy stats:', accuracyStats);
    }
    
    const result: any = {
      success: true,
      markets: topMarkets,
      count: topMarkets.length,
      totalAvailable: validMarkets.length,
      inferredCategory: category,
      sampleTxId: topMarkets[0]?.txId,
      accuracyStats,
      // Remind Claude to filter intelligently
      note: 'RAW results sorted by volume. Filter based on user intent before presenting.',
      filteringHint: keywords.length > 0 
        ? `Filtered to markets containing: ${keywords.join(', ')}`
        : 'No keyword filter applied - apply intelligent filtering based on user query'
    };
    
    // Add debug info if requested
    if (debug) {
      result.debug = {
        candidatesRetrieved: allEdges.length,
        validAfterFilter: validMarkets.length,
        keywordsApplied: keywords,
        minVolumeApplied: minVolume
      };
    }
    
    console.log('[Irys Query] ========================================');
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Irys Query] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, markets: [], count: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
