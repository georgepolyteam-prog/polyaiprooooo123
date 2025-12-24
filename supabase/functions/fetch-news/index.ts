import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// STRICT keywords that MUST be in news for prediction market relevance
const REQUIRED_KEYWORDS = [
  // Politics - specific names and terms
  'trump', 'biden', 'harris', 'desantis', 'newsom', 'kennedy', 'rfk',
  'election', 'vote', 'poll', 'polling', 'ballot', 'electoral', 'gop', 'dnc',
  'senate', 'congress', 'house of representatives', 'supreme court',
  
  // Crypto - specific terms
  'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'cryptocurrency',
  'binance', 'coinbase', 'stablecoin', 'defi', 'nft', 'blockchain',
  
  // Economics/Finance 
  'federal reserve', 'fed rate', 'interest rate', 'inflation rate', 'cpi',
  'recession', 'gdp', 'unemployment rate', 'stock market crash',
  
  // Geopolitics
  'russia ukraine', 'putin', 'zelensky', 'nato', 'ceasefire',
  'israel gaza', 'netanyahu', 'hamas', 'iran nuclear',
  'china taiwan', 'xi jinping', 'tariff war',
  
  // Sports - championships only
  'super bowl', 'nba finals', 'world series', 'stanley cup', 'world cup',
  'nfl playoffs', 'nba playoffs', 'champions league final',
  
  // Tech/AI - specific predictions
  'agi', 'gpt-5', 'openai', 'sam altman', 'elon musk twitter', 'tesla stock',
  'spacex launch', 'apple stock', 'nvidia stock',
  
  // Specific prediction market terms
  'polymarket', 'prediction market', 'betting odds', 'odds shift'
];

function getTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch {
    return 'recently';
  }
}

function determineSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase();
  const positive = ['win', 'wins', 'boost', 'surge', 'surges', 'rise', 'rises', 'gain', 'gains', 'success', 'breakthrough', 'approved', 'growth', 'rally', 'rallies', 'leads', 'leading', 'soars', 'victory', 'advances', 'bullish', 'up', 'higher', 'record high'];
  const negative = ['lose', 'loses', 'crash', 'crashes', 'fall', 'falls', 'decline', 'declines', 'fail', 'fails', 'crisis', 'threat', 'concern', 'drop', 'drops', 'war', 'attack', 'defeat', 'plunge', 'fears', 'warns', 'warning', 'bearish', 'down', 'lower', 'collapse'];
  
  const posCount = positive.filter(w => lowerText.includes(w)).length;
  const negCount = negative.filter(w => lowerText.includes(w)).length;
  
  if (posCount > negCount + 1) return 'positive';
  if (negCount > posCount + 1) return 'negative';
  return 'neutral';
}

// STRICT relevance check - article must contain at least one required keyword
function isStrictlyRelevant(text: string): boolean {
  const lowerText = text.toLowerCase();
  return REQUIRED_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

function generatePolyAnalysis(article: any, relatedMarkets: any[]): string {
  const title = (article.title || '').toLowerCase();
  const sentiment = determineSentiment(title);
  
  // Generate SPECIFIC analysis based on content
  if (title.includes('trump')) {
    if (sentiment === 'positive') {
      return "📈 Bullish for Trump markets. If this moves polls, expect Trump YES to tick up 1-3% within 24h.";
    } else if (sentiment === 'negative') {
      return "📉 Could pressure Trump odds down. Watch for overreaction - might create buying opportunity.";
    }
    return "⚖️ Keep an eye on Trump-related markets. Volume will tell us if traders care about this.";
  }
  
  if (title.includes('bitcoin') || title.includes('btc') || title.includes('crypto')) {
    if (sentiment === 'positive') {
      return "📈 Bitcoin bullish signal. Watch the BTC >$100K markets - could see a pump.";
    } else if (sentiment === 'negative') {
      return "📉 Crypto bearish. BTC price target markets likely to see NO side strengthen.";
    }
    return "⚖️ Crypto news - monitor BTC and ETH price prediction markets for movement.";
  }
  
  if (title.includes('fed') || title.includes('interest rate') || title.includes('inflation')) {
    return "💰 Fed/macro news directly impacts rate cut prediction markets. Watch closely.";
  }
  
  if (title.includes('russia') || title.includes('ukraine') || title.includes('ceasefire')) {
    return "🌍 Ukraine situation affects ceasefire and war-related markets. High uncertainty = opportunity.";
  }
  
  if (title.includes('nfl') || title.includes('nba') || title.includes('super bowl')) {
    return "🏈 Sports news - check relevant team/championship markets for odds movement.";
  }
  
  if (relatedMarkets.length > 0) {
    return `📊 This affects ${relatedMarkets[0].question.slice(0, 40)}... Watch for price movement.`;
  }
  
  return "📰 Monitor related prediction markets for delayed price reaction.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Fetching prediction market relevant news...");
    
    // Fetch active markets from Polymarket for matching
    let topMarkets: any[] = [];
    try {
      const marketsRes = await fetch('https://gamma-api.polymarket.com/events?closed=false&active=true&limit=30&order=volume24hr');
      if (marketsRes.ok) {
        const events = await marketsRes.json();
        topMarkets = events.slice(0, 20).flatMap((e: any) => {
          const eventSlug = e.slug;
          return (e.markets || []).slice(0, 2).map((m: any) => ({
            question: m.question || e.title,
            eventSlug: eventSlug,
            marketSlug: m.slug,
            url: `https://polymarket.com/event/${eventSlug}${m.slug ? '/' + m.slug : ''}`
          }));
        });
        console.log(`Loaded ${topMarkets.length} markets for matching`);
      }
    } catch (e) {
      console.error('Failed to fetch markets for matching:', e);
    }

    const allArticles: any[] = [];
    const userAgent = 'Mozilla/5.0 (compatible; Poly/1.0; +https://poly.app)';
    
    // Reddit - ONLY relevant subreddits for prediction markets
    const relevantSubreddits = [
      'politics',           // Political news
      'worldnews',          // International events  
      'cryptocurrency',     // Crypto news
      'bitcoin',            // Bitcoin specific
      'wallstreetbets',     // Market sentiment
      'nfl',                // Sports
      'nba',                // Sports
      'polymarket'          // Direct PM news
    ];
    
    for (const sub of relevantSubreddits) {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=8`, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'application/json'
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          const posts = (data.data?.children || [])
            .filter((c: any) => c.data && c.data.title && !c.data.stickied && !c.data.over_18)
            .filter((c: any) => c.data.score > 100) // Only popular posts
            .map((c: any) => ({
              title: c.data.title,
              link: c.data.url_overridden_by_dest || `https://reddit.com${c.data.permalink}`,
              description: c.data.selftext?.slice(0, 200) || c.data.title,
              pubDate: new Date(c.data.created_utc * 1000).toISOString(),
              source: `r/${sub}`,
              score: c.data.score || 0
            }));
          
          allArticles.push(...posts);
          console.log(`r/${sub}: ${posts.length} posts`);
        }
      } catch (e) {
        console.error(`Reddit r/${sub} failed:`, e);
      }
    }

    // Try NewsAPI style feeds (public RSS)
    const rssFeeds = [
      { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', source: 'NYT Politics' },
    ];
    
    // Note: RSS parsing would require additional handling, skipping for now
    
    console.log(`Total fetched: ${allArticles.length} articles`);

    // STRICT filtering - only truly relevant articles
    const relevantArticles = allArticles
      .filter(a => isStrictlyRelevant(a.title + ' ' + (a.description || '')))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`${relevantArticles.length} articles pass strict relevance filter`);

    // Deduplicate
    const seen = new Set<string>();
    const uniqueArticles = relevantArticles.filter(a => {
      const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Format news items
    const formattedNews = uniqueArticles.slice(0, 18).map((article, idx) => {
      // Find related markets
      const articleText = (article.title + ' ' + (article.description || '')).toLowerCase();
      
      const relatedMarkets = topMarkets
        .filter(market => {
          const marketText = market.question.toLowerCase();
          // Check for keyword overlap
          const keywords = ['trump', 'biden', 'bitcoin', 'btc', 'election', 'nfl', 'nba', 'russia', 'ukraine', 'fed', 'rate'];
          return keywords.some(kw => articleText.includes(kw) && marketText.includes(kw));
        })
        .slice(0, 2);

      return {
        id: String(idx + 1),
        title: article.title,
        source: article.source,
        publishedAt: getTimeAgo(article.pubDate),
        summary: article.description || article.title,
        impact: determineSentiment(article.title),
        relatedMarkets: relatedMarkets.map(m => ({
          question: m.question,
          url: m.url
        })),
        polyAnalysis: generatePolyAnalysis(article, relatedMarkets),
        url: article.link
      };
    });

    console.log(`Returning ${formattedNews.length} formatted news items`);

    // If no relevant news, show market movers instead
    if (formattedNews.length < 18 && topMarkets.length > 0) {
      console.log('Not enough relevant news, adding market-based items...');
      
      const marketNews = topMarkets.slice(0, 18 - formattedNews.length).map((m, idx) => ({
        id: String(formattedNews.length + idx + 1),
        title: `📊 Active Market: ${m.question}`,
        source: 'Polymarket',
        publishedAt: 'now',
        summary: `High trading volume on this market. Click to view current odds and place trades.`,
        impact: 'neutral' as const,
        relatedMarkets: [{
          question: m.question,
          url: m.url
        }],
        polyAnalysis: "⚖️ This market is seeing significant activity. Worth monitoring for edge opportunities.",
        url: m.url
      }));
      
      formattedNews.push(...marketNews);
    }

    return new Response(JSON.stringify({ 
      news: formattedNews,
      lastUpdated: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("fetch-news error:", error);
    
    return new Response(JSON.stringify({ 
      news: [{
        id: "1",
        title: "⚠️ News temporarily unavailable",
        source: "System",
        publishedAt: "just now",
        summary: "We're having trouble connecting to news sources. Please try refreshing in a moment.",
        impact: "neutral",
        relatedMarkets: [],
        polyAnalysis: "News sources are temporarily unavailable. Check the Scanner for active markets.",
        url: "#",
      }],
      lastUpdated: new Date().toISOString(),
      error: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});