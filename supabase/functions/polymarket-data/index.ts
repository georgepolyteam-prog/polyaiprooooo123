import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Builder API key for Polymarket tracking
const BUILDER_API_KEY = Deno.env.get('BUILDER_API_KEY');

// Helper to get headers with Builder API key
function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  
  if (BUILDER_API_KEY) {
    headers["Authorization"] = `Bearer ${BUILDER_API_KEY}`;
  }
  
  return headers;
}

// ========== STT (Speech-to-Text) ERROR CORRECTIONS ==========
// Common phonetic mistakes from voice recognition
const STT_CORRECTIONS: Record<string, string> = {
  // Phonetic errors
  'cars': 'cards',
  'car': 'card',
  'cells': 'sells',
  'cell': 'sell',
  'by': 'buy',      // only when context is trading
  'bye': 'buy',
  'their': 'there',
  'too': 'to',
  'won': 'one',
  'wan': 'one',
  'wanna': 'want to',
  'gonna': 'going to',
  'gotta': 'got to',
  'kinda': 'kind of',
  // Common mishearings
  'polymarket': 'polymarket',
  'poly market': 'polymarket',
  'crypt oh': 'crypto',
  'bit coin': 'bitcoin',
  'ether eum': 'ethereum',
  'nft': 'nft',
  'in ft': 'nft',
  'trump cards': 'trump cards',
  'gold car': 'gold card',
  'gold cars': 'gold cards',
};

// Common filler words to remove from search queries
// CRITICAL: Do NOT include important query terms like bitcoin, price, crypto, hit, reach, etc.
const FILLER_WORDS = [
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'can', 'could', 'do', 'does', 'did', 'would', 'should', 'may', 'might',
  'find', 'me', 'show', 'tell', 'about', 'what', 'which', 'who', 'when', 'where',
  'analyze', 'analysis', 'look', 'at', 'for', 'to', 'of',
  'give', 'get', 'check', 'some', 'any', 'please', 'i', 'you', 'my', 'your',
  'want', 'need', 'like', 'just', 'think', 'know', 'see', 'decision', 'decisions',
  // Voice-specific filler words
  'hey', 'poly', 'hello', 'hi', 'talk', 'talking', 'asking',
  // REMOVED: 'will', 'market', 'markets' - these are important for queries like "will bitcoin hit X" or "market for X"
];

// Synonym mappings for better matching
const SYNONYMS: Record<string, string[]> = {
  'trump': ['donald trump', 'trump', 'donaldtrump', '45th', '47th'],
  'biden': ['joe biden', 'biden', 'joseph biden'],
  // Crypto - EXPANDED for better matching
  'bitcoin': ['bitcoin', 'btc', 'crypto'],
  'btc': ['bitcoin', 'btc'],
  'ethereum': ['ethereum', 'eth'],
  'eth': ['ethereum', 'eth'],
  'crypto': ['cryptocurrency', 'crypto', 'bitcoin', 'btc', 'ethereum', 'eth'],
  'cryptocurrency': ['cryptocurrency', 'crypto', 'bitcoin', 'ethereum'],
  // Sports
  'football': ['nfl', 'football', 'american football'],
  'soccer': ['football', 'soccer', 'premier league', 'epl'],
  'basketball': ['nba', 'basketball'],
  // Fed Chair / Federal Reserve synonyms
  'fed': ['federal reserve', 'fed', 'fomc', 'central bank', 'reserve'],
  'chair': ['chairman', 'chair', 'head', 'leader', 'nominee', 'nominate'],
  'powell': ['jerome powell', 'powell', 'jpow', 'fed chair'],
  // Trump products
  'gold cards': ['gold cards', 'nft cards', 'digital cards', 'trump cards', 'trading cards'],
  'gold card': ['gold card', 'nft card', 'digital card', 'trump card', 'trading card'],
  'nft': ['nft', 'digital collectible', 'card', 'collectible'],
  // Common trading/price terms - helps match "will bitcoin hit X" queries
  'sell': ['sell', 'sold', 'sales', 'selling'],
  'buy': ['buy', 'purchase', 'bought', 'buying'],
  'price': ['price', 'value', 'worth', 'hit', 'reach', 'exceed', 'surpass'],
  'hit': ['hit', 'reach', 'exceed', 'surpass', 'break'],
  'reach': ['reach', 'hit', 'exceed', 'surpass'],
};

// Apply STT corrections to a query
function applySTTCorrections(query: string): string {
  let corrected = query.toLowerCase();
  
  // Apply whole-word replacements
  for (const [wrong, right] of Object.entries(STT_CORRECTIONS)) {
    // Replace whole words only (not partial matches)
    corrected = corrected.replace(
      new RegExp(`\\b${wrong}\\b`, 'gi'), 
      right
    );
  }
  
  return corrected;
}

// Clean and normalize search query
function cleanSearchQuery(query: string): string {
  // FIRST: Apply STT corrections
  let cleaned = applySTTCorrections(query);
  
  // Remove punctuation
  cleaned = cleaned.replace(/[?!.,'"]/g, '');
  
  // Split into words
  const words = cleaned.split(/\s+/);
  
  // Remove filler words
  const meaningful = words.filter(w => !FILLER_WORDS.includes(w) && w.length > 2);
  
  return meaningful.join(' ').trim();
}

// Extract outcome names from multi-outcome markets
function extractOutcomeNames(market: any): string {
  let outcomeText = '';
  
  // Check market.outcomes array (common format)
  if (market.outcomes && Array.isArray(market.outcomes)) {
    outcomeText += market.outcomes.map((o: any) => 
      typeof o === 'string' ? o : (o.name || o.outcome || '')
    ).join(' ');
  }
  
  // Check market.tokens array (alternative format)
  if (market.tokens && Array.isArray(market.tokens)) {
    outcomeText += ' ' + market.tokens.map((t: any) => t.outcome || t.name || '').join(' ');
  }
  
  // Check outcomePrices keys if it's an object with named keys
  if (market.outcomePrices && typeof market.outcomePrices === 'object' && !Array.isArray(market.outcomePrices)) {
    outcomeText += ' ' + Object.keys(market.outcomePrices).join(' ');
  }
  
  return outcomeText.toLowerCase().trim();
}

// Find which outcomes match the search query
function findMatchingOutcomes(market: any, searchTerms: string[]): string[] {
  const matchingOutcomes: string[] = [];
  
  // Check market.outcomes
  if (market.outcomes && Array.isArray(market.outcomes)) {
    for (const outcome of market.outcomes) {
      const outcomeName = typeof outcome === 'string' ? outcome : (outcome.name || outcome.outcome || '');
      const outcomeLower = outcomeName.toLowerCase();
      
      // Check if any search term matches this outcome
      const matches = searchTerms.filter(term => outcomeLower.includes(term));
      if (matches.length > 0) {
        matchingOutcomes.push(outcomeName);
      }
    }
  }
  
  // Check market.tokens
  if (market.tokens && Array.isArray(market.tokens)) {
    for (const token of market.tokens) {
      const outcomeName = token.outcome || token.name || '';
      const outcomeLower = outcomeName.toLowerCase();
      
      const matches = searchTerms.filter(term => outcomeLower.includes(term));
      if (matches.length > 0 && !matchingOutcomes.includes(outcomeName)) {
        matchingOutcomes.push(outcomeName);
      }
    }
  }
  
  return matchingOutcomes;
}

// Calculate relevance score (0-100 scale for clarity)
// Now includes outcome names for multi-outcome markets
function calculateRelevanceScore(
  questionLower: string, 
  descLower: string, 
  searchTerms: string[], 
  fullQuery: string,
  outcomeNames: string = ''
): { score: number; outcomeMatch: boolean } {
  let score = 0;
  let outcomeMatch = false;
  const combinedText = `${questionLower} ${descLower} ${outcomeNames}`;
  
  // Exact phrase match in question = +50 points (best signal)
  if (questionLower.includes(fullQuery)) {
    score += 50;
  }
  
  // Exact phrase match in outcomes = +45 points (very strong for multi-outcome)
  if (outcomeNames && outcomeNames.includes(fullQuery)) {
    score += 45;
    outcomeMatch = true;
  }
  
  // Exact phrase match in description = +25 points
  if (descLower.includes(fullQuery)) {
    score += 25;
  }
  
  // Each keyword match in question = +15 points
  for (const term of searchTerms) {
    if (questionLower.includes(term)) {
      score += 15;
    } else if (outcomeNames && outcomeNames.includes(term)) {
      // Outcome name keyword match = +20 points (higher than question for specificity)
      score += 20;
      outcomeMatch = true;
    } else if (descLower.includes(term)) {
      score += 7; // Description matches worth less
    } else {
      // Check synonyms
      for (const [base, syns] of Object.entries(SYNONYMS)) {
        if (syns.includes(term) || term.includes(base)) {
          for (const syn of syns) {
            if (questionLower.includes(syn) || (outcomeNames && outcomeNames.includes(syn))) {
              score += 12;
              break;
            }
          }
          break;
        }
      }
    }
  }
  
  // Key number match (years like 2025, quantities) = +20 points
  const numbers = fullQuery.match(/\d+/g) || [];
  for (const num of numbers) {
    if (questionLower.includes(num)) {
      score += 20;
    }
  }
  
  // Partial word matches (typo tolerance) = +5 points each
  for (const term of searchTerms) {
    if (term.length < 4) continue;
    const prefix = term.substring(0, 4);
    if (questionLower.includes(prefix)) {
      score += 5;
    }
  }
  
  return { score, outcomeMatch };
}

// Calculate fuzzy match score (legacy, kept for compatibility)
function fuzzyMatch(text: string, searchTerm: string): number {
  const textLower = text.toLowerCase();
  const searchLower = searchTerm.toLowerCase();
  
  // Exact match
  if (textLower.includes(searchLower)) return 1.0;
  
  // Check synonyms
  for (const [base, syns] of Object.entries(SYNONYMS)) {
    if (syns.includes(searchLower) || searchLower.includes(base)) {
      for (const syn of syns) {
        if (textLower.includes(syn)) return 0.9;
      }
    }
  }
  
  // Partial word match (for typos)
  const searchWords = searchLower.split(/\s+/);
  let partialScore = 0;
  for (const word of searchWords) {
    if (word.length < 3) continue;
    // Check if any word in text starts with the search word
    const textWords = textLower.split(/\s+/);
    for (const tw of textWords) {
      if (tw.startsWith(word.substring(0, 3)) || word.startsWith(tw.substring(0, 3))) {
        partialScore += 0.3;
        break;
      }
    }
  }
  
  return Math.min(partialScore, 0.7);
}

// Check if a market is expired
function isMarketExpired(market: any): boolean {
  const now = new Date();
  
  // Check if market is closed/resolved
  if (market.closed === true || market.resolved === true) {
    return true;
  }
  
  if (market.active === false) {
    return true;
  }
  
  // Check end date
  const endDateStr = market.endDate || market.end_date || market.closingDate;
  if (endDateStr) {
    try {
      const endDate = new Date(endDateStr);
      if (endDate < now) {
        return true;
      }
    } catch {
      // Couldn't parse date
    }
  }
  
  // Check if odds are exactly 50/50 (often indicates expired/suspended)
  if (market.outcomePrices) {
    try {
      const prices = typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices;
      const yesPrice = parseFloat(prices[0] || 0);
      if (yesPrice === 0.5 || yesPrice === 50) {
        return true;
      }
    } catch {
      // Couldn't parse prices
    }
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, marketSlug, limit = 50, query, order = 'volume24hr', ascending = false, closed = false, slug } = await req.json();

    // ===== GET EVENTS ACTION (for Markets page) =====
    if (action === "getEvents") {
      console.log('[GetEvents] Fetching events for Markets page...');
      
      // Polymarket API only supports these order values: id, volume, liquidity
      // Map client sortBy to valid API order params
      const validOrders: Record<string, string> = {
        'volume24hr': 'volume', // No 24hr order option, use total volume
        'volume': 'volume',
        'liquidity': 'liquidity',
        'id': 'id'
      };
      const apiOrder = validOrders[order] || 'volume';
      
      const params = new URLSearchParams({
        closed: String(closed),
        active: 'true',  // Only fetch active markets
        limit: String(limit),
        order: apiOrder,
        ascending: String(ascending)
      });
      
      const eventsUrl = `https://gamma-api.polymarket.com/events?${params}`;
      console.log('[GetEvents] URL:', eventsUrl);
      
      const response = await fetch(eventsUrl, { headers: getApiHeaders() });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GetEvents] API error:', response.status, errorText);
        throw new Error(`Events API returned ${response.status}: ${errorText}`);
      }
      
      const events = await response.json();
      console.log(`[GetEvents] Fetched ${events.length} events`);
      
      // Transform events to include all needed trading data
      // Helper to detect placeholder names in questions (e.g., "Will Person AB win...")
      const containsPlaceholder = (text: string): boolean => {
        // Matches patterns like "Person A", "Person AB", "Person CX", "Option 1", etc.
        // Both standalone and within sentences
        const placeholderPattern = /(^|\s)(person|player|team|candidate|option|choice)\s+[a-z]{1,3}($|\s|[?!,.])/i;
        return placeholderPattern.test(text);
      };
      
      // Helper to check if market is a placeholder/inactive market
      const isPlaceholderMarket = (market: any, yesPrice: number, volume: number, liquidity: number): boolean => {
        // Exact 50/50 with zero volume and zero liquidity = uninitialized placeholder
        if (yesPrice === 0.5 && volume === 0 && liquidity === 0) {
          return true;
        }
        return false;
      };
      
      const transformedEvents = events.map((event: any) => {
        const markets = event.markets || [];
        const seenConditionIds = new Set<string>();
        
        const outcomes = markets.map((market: any) => {
          const outcomeNames = market.outcomes ? JSON.parse(market.outcomes) : ['Yes', 'No'];
          const outcomePrices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [0.5, 0.5];
          // Parse clobTokenIds - it's a JSON array string from the API
          let clobTokenIds: string[] = [];
          if (market.clobTokenIds) {
            try {
              clobTokenIds = typeof market.clobTokenIds === 'string' 
                ? JSON.parse(market.clobTokenIds) 
                : market.clobTokenIds;
            } catch {
              // Fallback to split if not valid JSON
              clobTokenIds = market.clobTokenIds.split(',').map((id: string) => id.replace(/[\[\]"]/g, '').trim());
            }
          }
          
          // Get question text - clean placeholder names
          let question = market.question || market.groupItemTitle || event.title;
          
          // Detect and fix placeholder names like "Person A", "Person CX", "Option 1", etc.
          // Use a broader pattern that catches placeholders WITHIN questions
          if (containsPlaceholder(question)) {
            // Use groupItemTitle if it's more descriptive, or fall back to event title
            const groupTitle = market.groupItemTitle || '';
            if (groupTitle && !containsPlaceholder(groupTitle)) {
              question = groupTitle;
            } else {
              // Mark for filtering - this is a placeholder market
              return null;
            }
          }
          
          const yesPrice = parseFloat(outcomePrices[0]) || 0.5;
          const volume = parseFloat(market.volume) || 0;
          const liquidity = parseFloat(market.liquidity) || 0;
          
          // Filter out placeholder/inactive markets
          if (isPlaceholderMarket(market, yesPrice, volume, liquidity)) {
            return null;
          }
          
          return {
            question,
            slug: market.slug,
            conditionId: market.conditionId,
            yesTokenId: clobTokenIds[0] || null,
            noTokenId: clobTokenIds[1] || null,
            yesPrice,
            noPrice: parseFloat(outcomePrices[1]) || 0.5,
            volume,
            volume24hr: parseFloat(market.volume24hr) || 0,
            liquidity,
            endDate: market.endDate,
            image: market.image,
            outcomes: outcomeNames,
            outcomePrices: outcomePrices.map((p: string) => parseFloat(p)),
            acceptingOrders: market.acceptingOrders !== false,
            closed: market.closed || false,
            active: market.active !== false,
            resolved: market.resolved || false
          };
        }).filter((o: any) => {
          // Remove null entries (filtered placeholders)
          if (!o) return false;
          
          // STRICTER FILTERING: Check closed status
          if (o.closed === true) {
            console.log(`[GetEvents] Filtering closed market: ${o.question}`);
            return false;
          }
          
          // STRICTER FILTERING: Check if market is accepting orders
          if (o.acceptingOrders === false) {
            console.log(`[GetEvents] Filtering non-accepting market: ${o.question}`);
            return false;
          }
          
          // STRICTER FILTERING: Check active status
          if (o.active === false) {
            console.log(`[GetEvents] Filtering inactive market: ${o.question}`);
            return false;
          }
          
          // STRICTER FILTERING: Check resolved status
          if (o.resolved === true) {
            console.log(`[GetEvents] Filtering resolved market: ${o.question}`);
            return false;
          }
          
          // STRICTER FILTERING: Check if market is effectively resolved (99%+ on either side)
          if (o.yesPrice >= 0.99 || o.noPrice >= 0.99) {
            console.log(`[GetEvents] Filtering effectively-resolved market (${Math.round(o.yesPrice * 100)}%): ${o.question}`);
            return false;
          }
          
          // Remove expired markets (endDate in the past) with 5-minute buffer
          if (o.endDate) {
            try {
              const endDate = new Date(o.endDate);
              const bufferMs = 5 * 60 * 1000; // 5 minutes buffer for trades to settle
              const now = Date.now();
              if (endDate.getTime() < now || endDate.getTime() - now < bufferMs) {
                console.log(`[GetEvents] Filtering expired/ending-soon outcome: ${o.question} (ends ${o.endDate})`);
                return false;
              }
            } catch {
              // Couldn't parse date, keep the market
            }
          }
          // Dedupe by conditionId
          if (o.conditionId && seenConditionIds.has(o.conditionId)) return false;
          if (o.conditionId) seenConditionIds.add(o.conditionId);
          return true;
        });
        
        // Sort outcomes by volume (highest first)
        outcomes.sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0));
        
        // Extract category - fallback to first market category or tags
        let category = event.category;
        if (!category && markets.length > 0) {
          category = markets[0]?.category;
        }
        if (!category && event.tags?.length > 0) {
          category = event.tags[0]?.label;
        }
        
        return {
          id: event.id,
          title: event.title,
          slug: event.slug,
          image: event.image,
          icon: event.icon,
          category: category || 'Other',
          volume: event.volume || 0,
          volume24hr: event.volume24hr || 0,
          liquidity: event.liquidity || 0,
          endDate: event.endDate,
          outcomes,
          marketsCount: markets.length
        };
      }).filter((event: any) => {
        // Filter out events where ALL outcomes are expired or filtered out
        if (!event.outcomes || event.outcomes.length === 0) return false;
        
        // Filter out events where event-level endDate has passed
        if (event.endDate) {
          try {
            const endDate = new Date(event.endDate);
            if (endDate < new Date()) {
              console.log(`[GetEvents] Filtering expired event: ${event.title} (ended ${event.endDate})`);
              return false;
            }
          } catch {
            // Couldn't parse date, keep the event
          }
        }
        
        return true;
      });
      
      return new Response(JSON.stringify({
        success: true,
        events: transformedEvents,
        count: transformedEvents.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ===== GET EVENT BY SLUG ACTION (for Home page) =====
    if (action === "getEventBySlug") {
      if (!slug) {
        throw new Error("slug is required for getEventBySlug action");
      }
      
      console.log(`[GetEventBySlug] Fetching event: ${slug}`);
      
      const response = await fetch(
        `https://gamma-api.polymarket.com/events?slug=${slug}`,
        { headers: getApiHeaders() }
      );
      
      if (!response.ok) {
        console.error(`[GetEventBySlug] API error: ${response.status}`);
        throw new Error(`Events API returned ${response.status}`);
      }
      
      const events = await response.json();
      const event = events?.[0] || null;
      
      console.log(`[GetEventBySlug] Found event: ${event?.title || 'not found'}`);
      
      return new Response(JSON.stringify({
        success: true,
        event
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ===== SEARCH ACTION =====
    if (action === "search") {
      if (!query) {
        throw new Error("query is required for search action");
      }
      
      console.log(`[Search] Original query: "${query}"`);
      
      // Apply STT corrections FIRST, then clean
      const sttCorrected = applySTTCorrections(query);
      const cleanedQuery = cleanSearchQuery(query);
      console.log(`[Search] STT corrected: "${sttCorrected}" → Cleaned: "${cleanedQuery}"`);
      
      // Polymarket Gamma API supports text search with filters - fetch 500 to include lower volume markets
      console.log("[Search] Using Builder API key:", !!BUILDER_API_KEY);
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=500&order=volume&ascending=false`,
        { headers: getApiHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const markets = await response.json();
      
      // Filter by search query with IMPROVED relevance scoring
      const searchTerms = cleanedQuery.split(/\s+/).filter((t: string) => t.length > 2);
      
      const scoredMarkets = markets
        .filter((m: any) => {
          // Filter out invalid markets
          if (!m.question || !m.outcomePrices) return false;
          
          // Filter out expired markets
          if (isMarketExpired(m)) {
            return false;
          }
          
          return true;
        })
        .map((m: any) => {
          const questionLower = m.question.toLowerCase();
          const descLower = (m.description || '').toLowerCase();
          
          // NEW: Extract outcome names for multi-outcome markets
          const outcomeNames = extractOutcomeNames(m);
          
          // NEW: Use improved relevance scoring that includes outcomes (0-100 scale)
          const { score: relevanceScore, outcomeMatch } = calculateRelevanceScore(
            questionLower, 
            descLower, 
            searchTerms, 
            cleanedQuery,
            outcomeNames
          );
          
          // Find specific matching outcomes for context
          const matchedOutcomes = outcomeMatch ? findMatchingOutcomes(m, searchTerms) : [];
          
          return { market: m, score: relevanceScore, matchedOutcomes };
        })
        .filter(({ score }: { score: number }) => score >= 20) // Only return results with score > 20
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, limit)
        .map(({ market: m, score, matchedOutcomes }: { market: any; score: number; matchedOutcomes: string[] }) => {
          const prices = JSON.parse(m.outcomePrices || '[]');
          const yesPrice = parseFloat(prices[0] || 0) * 100;
          
          return {
            id: m.id,
            question: m.question,
            slug: m.slug,
            yesPrice: Math.round(yesPrice),
            noPrice: Math.round(100 - yesPrice),
            volume: parseFloat(m.volume) || 0,
            liquidity: parseFloat(m.liquidity) || 0,
            endDate: m.endDate,
            url: `https://polymarket.com/event/${m.slug}`,
            relevanceScore: score, // Include score for debugging and poly-chat filtering
            matchedOutcomes: matchedOutcomes.length > 0 ? matchedOutcomes : undefined, // Include matched outcomes if any
          };
        });
      
      console.log(`[Search] Found ${scoredMarkets.length} markets with relevance > 20 for "${cleanedQuery}"`);
      if (scoredMarkets.length > 0) {
        console.log(`[Search] Top match: "${scoredMarkets[0].question}" (score: ${scoredMarkets[0].relevanceScore})`);
      }
      
      return new Response(JSON.stringify({ 
        markets: scoredMarkets,
        query: query,
        cleanedQuery: cleanedQuery,
        sttCorrected: sttCorrected !== query.toLowerCase() ? sttCorrected : undefined, // Only include if changed
        count: scoredMarkets.length,
        searchFailed: scoredMarkets.length === 0, // Flag for poly-chat to handle gracefully
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getMarkets") {
      // Fetch active markets from Polymarket's Gamma API
      console.log("[getMarkets] Using Builder API key:", !!BUILDER_API_KEY);
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${limit}&order=volume&ascending=false`,
        { headers: getApiHeaders() }
      );

      if (!response.ok) {
        console.error("Polymarket API error:", response.status);
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const markets = await response.json();
      console.log(`Fetched ${markets.length} markets from Polymarket`);

      // Transform and filter markets - only show valid ones
      const transformedMarkets = markets
        .filter((m: any) => {
          if (!m.outcomePrices || !m.volume) return false;
          
          // Filter out expired markets
          if (isMarketExpired(m)) return false;
          
          // Parse prices
          let prices: number[] = [];
          try {
            prices = JSON.parse(m.outcomePrices);
          } catch {
            return false;
          }
          
          const yesPrice = prices[0] || 0;
          const volume = parseFloat(m.volume) || 0;
          
          // Filter criteria
          if (yesPrice > 0.95 || yesPrice < 0.05) return false; // Skip lopsided
          if (volume < 10000) return false; // Skip low volume
          
          return true;
        })
        .map((m: any) => {
          const prices = JSON.parse(m.outcomePrices || '[]');
          const yesPrice = parseFloat(prices[0] || 0) * 100;
          
          return {
            id: m.id,
            title: m.question,
            description: m.description,
            slug: m.slug,
            currentOdds: Math.round(yesPrice),
            volume24h: parseFloat(m.volume) || 0,
            liquidity: parseFloat(m.liquidity) || 0,
            endDate: m.endDate,
            category: m.category || "General",
            active: m.active,
          };
        });

      return new Response(JSON.stringify({ markets: transformedMarkets }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getMarketDetails") {
      if (!marketSlug) {
        throw new Error("marketSlug is required");
      }

      // Try to fetch by slug
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${marketSlug}`,
        { headers: getApiHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const markets = await response.json();
      const market = markets[0];

      if (!market) {
        // Try events endpoint as fallback
        const eventsResponse = await fetch(
          `https://gamma-api.polymarket.com/events?slug=${marketSlug}`,
          { headers: getApiHeaders() }
        );
        
        if (eventsResponse.ok) {
          const events = await eventsResponse.json();
          if (events[0]) {
            const event = events[0];
            return new Response(JSON.stringify({
              market: {
                id: event.id,
                title: event.title,
                description: event.description,
                slug: event.slug,
                category: event.category || "General",
                endDate: event.endDate,
                markets: event.markets?.map((m: any) => ({
                  question: m.question,
                  outcomePrices: m.outcomePrices,
                  volume: m.volume,
                  liquidity: m.liquidity,
                })),
              }
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        
        throw new Error("Market not found");
      }

      const prices = JSON.parse(market.outcomePrices || '[]');
      const yesPrice = parseFloat(prices[0] || 0) * 100;
      const noPrice = parseFloat(prices[1] || 0) * 100;

      return new Response(JSON.stringify({
        market: {
          id: market.id,
          title: market.question,
          description: market.description,
          slug: market.slug,
          currentOddsYes: Math.round(yesPrice),
          currentOddsNo: Math.round(noPrice),
          volume: parseFloat(market.volume) || 0,
          liquidity: parseFloat(market.liquidity) || 0,
          endDate: market.endDate,
          category: market.category || "General",
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getStats") {
      // Fetch overall stats from real Polymarket data
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=500`,
        { headers: getApiHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const markets = await response.json();
      
      // Calculate REAL stats - filter out expired
      const activeMarkets = markets.filter((m: any) => m.active && !m.closed && !isMarketExpired(m));
      const totalVolume = activeMarkets.reduce((sum: number, m: any) => sum + (parseFloat(m.volume) || 0), 0);
      
      return new Response(JSON.stringify({
        stats: {
          marketsTracked: activeMarkets.length,
          totalVolume: totalVolume,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("polymarket-data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
