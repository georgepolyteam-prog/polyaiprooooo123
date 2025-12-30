import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// High-signal entity terms (anchor terms)
const ANCHOR_TERMS = [
  'trump', 'donald trump',
  'biden', 'joe biden',
  'harris', 'kamala harris',
  'jd vance', 'vance',
  'obama', 'barack obama',
  'clinton', 'hillary clinton',
  'putin', 'vladimir putin',
  'xi', 'xi jinping',
  'elon', 'musk', 'elon musk',
  'bezos', 'jeff bezos',
  'zuckerberg'
];

// Election-specific keywords with smart exclusions
const ELECTION_KEYWORDS = {
  high: ['election', 'presidential', 'president', 'senate', 'governor', 'vote', 'ballot', 'candidate', 'nominee', 'primary', 'wins', 'won', 'loses', 'lost', 'inaugurated', 'inauguration'],
  medium: ['race', 'campaign', 'polling', 'voter', 'democrat', 'republican'],
  // Smart exclusions - removed 'says', 'say', 'talk' as they appear in election markets
  exclude: ['meeting', 'meet', 'zelensky', 'zelenskyy', 'pardon', 'turkey', 'speech', 'summit', 'diplomacy', 'visit', 'erdogan']
};

// Election whitelist patterns - auto-boost for actual election markets
const ELECTION_WHITELIST = [
  /president.*elect/i,
  /presidential.*elect/i,
  /win.*election/i,
  /electoral.*vote/i,
  /inaugurated.*president/i,
  /(trump|biden|harris).*win.*202/i,
  /(trump|biden|harris).*202\d.*election/i,
  /senate.*race/i,
  /house.*seat/i,
  /win.*202\d.*presidential/i,
  /202\d.*presidential.*election/i
];

function inferCategoryFromQuery(query: string): string | null {
  const q = query.toLowerCase();
  
  if (
    q.includes('election') || 
    q.includes('president') || 
    q.includes('presidential') ||
    q.includes('political') || 
    q.includes('trump') || 
    q.includes('biden') ||
    q.includes('senate') ||
    q.includes('congress') ||
    q.includes('vote') ||
    q.includes('candidate')
  ) {
    return 'elections';
  }
  
  if (q.includes('crypto') || q.includes('bitcoin') || q.includes('eth') || q.includes('ethereum') || q.includes('solana') || q.includes('btc')) {
    return 'crypto';
  }
  
  if (q.includes('sport') || q.includes('nba') || q.includes('nfl') || q.includes('soccer') || q.includes('lakers') || q.includes('game') || q.includes('championship') || q.includes('playoffs')) {
    return 'sports';
  }
  
  if (q.includes('stock') || q.includes('market') || q.includes('finance') || q.includes('recession') || q.includes('inflation') || q.includes('fed')) {
    return 'finance';
  }
  
  if (q.includes('movie') || q.includes('oscar') || q.includes('grammy') || q.includes('entertainment') || q.includes('netflix') || q.includes('hollywood')) {
    return 'entertainment';
  }
  
  if (q.includes('tech') || q.includes('ai') || q.includes('spacex') || q.includes('science') || q.includes('elon') || q.includes('musk')) {
    return 'science-tech';
  }
  
  return null;
}

// Extract anchor terms from user query
function extractAnchorTerms(query: string): string[] {
  const q = query.toLowerCase();
  const found: string[] = [];
  
  for (const term of ANCHOR_TERMS) {
    if (q.includes(term)) {
      found.push(term);
    }
  }
  
  return found;
}

// Calculate relevance score with anchor term and keyword matching
function calculateRelevance(question: string, userQuery: string, anchorTerms: string[], category: string, requiredKeywords: string[] = []): number {
  const q = question.toLowerCase();
  const query = userQuery.toLowerCase();
  let score = 0;
  
  // STEP 0: Election whitelist - MASSIVE boost for actual election markets
  const isElectionMarket = ELECTION_WHITELIST.some(p => p.test(question));
  if (category === 'elections' && isElectionMarket) {
    score += 200; // MASSIVE boost for actual election markets
    console.log(`[Relevance] ELECTION BOOST: "${question.slice(0, 60)}"`);
  }
  
  // STEP 1: Required keywords (from Claude's tool call) - MUST match
  if (requiredKeywords.length > 0) {
    const matchedKeywords = requiredKeywords.filter(kw => q.includes(kw.toLowerCase()));
    const matchRatio = matchedKeywords.length / requiredKeywords.length;
    
    if (matchRatio === 0) {
      // No keywords matched - heavily penalize
      return -1000;
    } else if (matchRatio < 0.5) {
      // Less than half matched - penalize but don't disqualify
      score -= 50;
    } else {
      // Good keyword match - boost based on match ratio
      score += Math.round(matchRatio * 100);
    }
  }
  
  // STEP 2: ANCHOR TERM REQUIREMENT (context-aware)
  if (anchorTerms.length > 0) {
    const hasAnchor = anchorTerms.some(term => q.includes(term));
    
    if (!hasAnchor) {
      // If it's an election market (Biden 2020, Senate race), don't penalize too much
      if (category === 'elections' && isElectionMarket) {
        score -= 20; // Small penalty, not -100
      } else {
        score -= 100; // Heavy penalty for non-election markets
      }
    } else {
      // Market contains anchor term - HUGE boost
      score += 100;
    }
  }
  
  // STEP 3: Exclusion filter (apply to non-election markets)
  if (category === 'elections' && !isElectionMarket) {
    for (const excludeTerm of ELECTION_KEYWORDS.exclude) {
      if (q.includes(excludeTerm)) {
        score -= 50; // Penalize excluded terms
      }
    }
  }
  
  // STEP 4: Election keywords (only matters if anchor requirement is met)
  if (category === 'elections') {
    for (const term of ELECTION_KEYWORDS.high) {
      if (q.includes(term)) {
        score += 10;
      }
    }
    
    for (const term of ELECTION_KEYWORDS.medium) {
      if (q.includes(term)) {
        score += 5;
      }
    }
  }
  
  // STEP 5: Query term matching
  const queryTerms = query.split(' ').filter(t => t.length > 3);
  for (const term of queryTerms) {
    if (q.includes(term)) {
      score += 3;
    }
  }
  
  return score;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Accept new params from Claude's tool call
    const { 
      query, 
      limit = 30, 
      debug = false,
      category: providedCategory,  // Claude can specify category directly
      keywords = [],               // Claude can specify required keywords
      minVolume = 0                // Claude can filter by minimum volume
    } = await req.json();
    
    console.log('[Irys Query] ========================================');
    console.log('[Irys Query] Query:', query);
    console.log('[Irys Query] Limit:', limit);
    console.log('[Irys Query] Provided category:', providedCategory);
    console.log('[Irys Query] Required keywords:', keywords);
    console.log('[Irys Query] Min volume:', minVolume);
    
    // Use provided category or infer from query
    const category = providedCategory || inferCategoryFromQuery(query);
    console.log('[Irys Query] Final category:', category);
    
    // Combine query terms with provided keywords for anchor extraction
    const combinedQuery = keywords.length > 0 ? [...keywords, query].join(' ') : query;
    const anchorTerms = extractAnchorTerms(combinedQuery);
    console.log('[Irys Query] Anchor terms:', anchorTerms);
    
    // Build GraphQL tags - filter by application-id AND category if detected
    const tags: Array<{ name: string; values: string[] }> = [
      { name: "application-id", values: ["polymarket"] }
    ];
    
    // Add category filter if we detected one from the query
    if (category) {
      tags.push({ name: "category", values: [category] });
      console.log('[Irys Query] Adding category filter:', category);
    }
    
    console.log('[Irys Query] GraphQL tags filter:', JSON.stringify(tags));
    
    // PAGINATION: With category filter we can fetch more (narrower results)
    // Without category: keep conservative limit
    const targetCandidates = category 
      ? Math.min(limit * 50, 2000)  // Category filtered: up to 2000
      : anchorTerms.length > 0 
        ? Math.min(limit * 20, 500)  // Anchor terms: 500
        : Math.min(limit * 10, 200); // Generic: 200
    
    const pageSize = 100; // Irys GraphQL limit per page
    const maxPages = Math.ceil(targetCandidates / pageSize);
    
    console.log('[Irys Query] Target candidates:', targetCandidates, 'Pages:', maxPages);
    
    let allEdges: any[] = [];
    let after: string | null = null;
    
    // Paginate through results
    for (let page = 0; page < maxPages; page++) {
      // Format tags for GraphQL (unquoted field names)
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
      console.log('[Irys Query] GraphQL query:', graphqlQueryStr.replace(/\s+/g, ' ').trim());
      
      const response: Response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: graphqlQueryStr })
      });
      
      console.log('[Irys Query] Response status:', response.status);
      const rawText: string = await response.text();
      console.log('[Irys Query] Raw response (first 500 chars):', rawText.slice(0, 500));
      
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
      
      // If we have enough candidates with anchor terms, we can stop early
      if (anchorTerms.length > 0 && allEdges.length >= limit * 10) {
        console.log('[Irys Query] Sufficient candidates, stopping pagination early');
        break;
      }
    }
    
    console.log('[Irys Query] Total transactions fetched:', allEdges.length);
    
    // DEBUG: Check for known TX ID
    const knownTxId = '9KGFjwMRTMJRbMnrPQSan8Q4cgj3iELm3omeyC5KWJsT';
    const hasKnownTx = allEdges.some((e: any) => e.node.id === knownTxId);
    console.log('[Irys Query] Contains known TX', knownTxId, ':', hasKnownTx);
    
    if (allEdges.length === 0) {
      return new Response(
        JSON.stringify({ markets: [], count: 0, category }),
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
          
          // Filter for resolved markets in code instead of GraphQL
          const isResolved = normalized.closed === true || normalized.closed === 'true';
          if (!isResolved) {
            console.log('[Irys Query] Skipping non-resolved market:', (normalized.question || '').slice(0, 60));
            return null;
          }
          
          // Calculate relevance score with required keywords from Claude
          const relevanceScore = calculateRelevance(
            normalized.question || '',
            query,
            anchorTerms,
            category || '',
            keywords // Pass Claude's required keywords
          );
          
          return {
            ...normalized,
            relevanceScore
          };
        } catch (err) {
          console.error('[Irys Query] Failed to fetch market:', err);
          return null;
        }
      },
      20 // Concurrency limit
    );
    
    // Filter out nulls and disqualified markets
    let validMarkets = candidateMarkets.filter((m: any) => m !== null && m.relevanceScore >= 0);
    
    console.log('[Irys Query] Valid markets after relevance filtering:', validMarkets.length);
    
    // Apply minVolume filter if specified by Claude
    if (minVolume > 0) {
      const beforeCount = validMarkets.length;
      validMarkets = validMarkets.filter((m: any) => {
        const vol = parseFloat(m.volume || '0');
        return vol >= minVolume;
      });
      console.log(`[Irys Query] Volume filter ($${minVolume}+): ${beforeCount} → ${validMarkets.length} markets`);
    }
    
    // DEBUG: Count Trump markets
    const trumpQuestionCount = validMarkets.filter((m: any) => /trump/i.test(m.question || '')).length;
    console.log('[Irys Query] Markets containing "trump":', trumpQuestionCount);
    
    // Sort by relevance score (highest first), then by volume (higher volume = better data quality)
    validMarkets.sort((a: any, b: any) => {
      // First sort by relevance score
      const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      
      // Then by volume (higher volume = better data quality)
      const volA = parseFloat(a.volume || '0');
      const volB = parseFloat(b.volume || '0');
      return volB - volA;
    });
    
    // Log top 5 scores for debugging
    console.log('[Irys Query] Top 5 market scores:');
    validMarkets.slice(0, 5).forEach((m: any, i: number) => {
      const vol = parseFloat(m.volume || '0');
      console.log(`  ${i + 1}. Score ${m.relevanceScore} | Vol $${Math.round(vol/1000)}k: "${m.question?.slice(0, 50)}..."`);
    });
    
    // Take top N
    const topMarkets = validMarkets.slice(0, limit);
    
    console.log('[Irys Query] Returning top', topMarkets.length, 'markets');
    
    // Calculate accuracy stats (only for markets with explicit outcomes)
    let accuracyStats: any = null;
    if (category === 'elections') {
      const marketsWithPrediction = topMarkets.filter((m: any) => m.isCorrectPrediction !== null);
      const correctCount = marketsWithPrediction.filter((m: any) => m.isCorrectPrediction).length;
      const totalCount = marketsWithPrediction.length;
      
      accuracyStats = {
        correct: correctCount,
        total: totalCount,
        percentage: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
      };
      
      console.log('[Irys Query] Accuracy stats:', accuracyStats);
    }
    
    const result: any = {
      success: true,
      markets: topMarkets,
      count: topMarkets.length,
      totalAvailable: validMarkets.length,
      inferredCategory: category,
      sampleTxId: topMarkets[0]?.txId,
      accuracyStats
    };
    
    // Add debug info if requested
    if (debug) {
      result.debug = {
        candidatesRetrieved: allEdges.length,
        validAfterFilter: validMarkets.length,
        trumpMarketCount: trumpQuestionCount,
        hasKnownTx,
        anchorTerms,
        topScores: topMarkets.slice(0, 5).map((m: any) => ({
          question: m.question?.slice(0, 80),
          score: m.relevanceScore,
          txId: m.txId
        }))
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
