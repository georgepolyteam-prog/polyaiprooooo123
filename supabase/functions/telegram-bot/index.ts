import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// In-memory cache for detailed analysis (10-minute expiry)
interface CachedAnalysis {
  marketQuestion: string;
  marketUrl: string;
  yesPrice: string;
  noPrice: string;
  volume: number;
  whaleTrades: any[];
  quickAnalysis: string;
  timestamp: number;
  expiresAt: number;
}

const analysisCache = new Map<string, CachedAnalysis>();

// Clean expired cache entries periodically
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of analysisCache) {
    if (now > value.expiresAt) {
      analysisCache.delete(key);
    }
  }
}

// Helper to format time ago
function timeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

// Generate cache key for a market
function getCacheKey(marketUrl: string): string {
  return `analysis:${marketUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100)}`;
}

// Telegram API helpers
async function sendTelegramMessage(chatId: number, text: string, replyToMessageId?: number, replyMarkup?: any): Promise<number | null> {
  const MAX_LENGTH = 4000;
  const messages: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      messages.push(remaining);
      break;
    }
    
    let breakPoint = remaining.lastIndexOf('\n', MAX_LENGTH);
    if (breakPoint === -1 || breakPoint < MAX_LENGTH / 2) {
      breakPoint = remaining.lastIndexOf(' ', MAX_LENGTH);
    }
    if (breakPoint === -1) {
      breakPoint = MAX_LENGTH;
    }
    
    messages.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }
  
  let lastMessageId: number | null = null;
  
  for (let i = 0; i < messages.length; i++) {
    const payload: any = {
      chat_id: chatId,
      text: messages[i],
      parse_mode: 'Markdown',
      reply_to_message_id: i === 0 ? replyToMessageId : undefined,
      disable_web_page_preview: true,
    };
    
    // Only add reply_markup to the last message
    if (i === messages.length - 1 && replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      delete payload.parse_mode;
      const retryResponse = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (retryResponse.ok) {
        const data = await retryResponse.json();
        lastMessageId = data.result?.message_id || null;
      }
    } else {
      const data = await response.json();
      lastMessageId = data.result?.message_id || null;
    }
  }
  
  return lastMessageId;
}

async function editTelegramMessage(chatId: number, messageId: number, text: string, replyMarkup?: any): Promise<boolean> {
  const payload: any = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  };
  
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  
  const response = await fetch(`${TELEGRAM_API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    // Try without markdown
    delete payload.parse_mode;
    const retryResponse = await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return retryResponse.ok;
  }
  
  return true;
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
    }),
  });
}

async function sendTypingAction(chatId: number) {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action: 'typing',
    }),
  });
}

// Extract market URL from message
function extractMarketUrl(text: string): string | null {
  const polymarketMatch = text.match(/https?:\/\/(www\.)?polymarket\.com\/[^\s]+/i);
  if (polymarketMatch) return polymarketMatch[0];
  
  const kalshiMatch = text.match(/https?:\/\/(www\.)?kalshi\.com\/[^\s]+/i);
  if (kalshiMatch) return kalshiMatch[0];
  
  return null;
}

// Extract key terms from market title for fuzzy matching
function extractKeyTerms(title: string): string[] {
  const stopWords = ['will', 'the', 'a', 'an', 'in', 'on', 'at', 'by', 'for', 'to', 'of', 'be', 'is', 'are', 'was', 'were', 'this', 'that', 'these', 'those'];
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 5); // Top 5 meaningful terms
}

// Truncate wallet address
function truncateWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return wallet || 'Unknown';
  return `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`;
}

// Fetch whale trades for a market with multiple matching strategies
async function fetchWhaleTrades(marketTitle: string, marketUrl?: string, minAmount: number = 5000): Promise<any[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const keyTerms = extractKeyTerms(marketTitle);
  
  console.log(`Fetching whale trades for: "${marketTitle}" with terms: [${keyTerms.join(', ')}]`);
  
  // Strategy 1: Try exact-ish match first (30 chars)
  let { data, error } = await supabase
    .from('whale_trades')
    .select('*')
    .ilike('market_question', `%${marketTitle.substring(0, 30)}%`)
    .gte('timestamp', oneDayAgo)
    .gte('amount', minAmount)
    .order('amount', { ascending: false })
    .limit(20);
  
  if (!error && data && data.length > 0) {
    console.log(`Strategy 1 found ${data.length} whale trades`);
    return data;
  }
  
  // Strategy 2: Try with key terms
  if (keyTerms.length >= 2) {
    for (const term of keyTerms.slice(0, 3)) {
      const { data: termData, error: termError } = await supabase
        .from('whale_trades')
        .select('*')
        .ilike('market_question', `%${term}%`)
        .gte('timestamp', oneDayAgo)
        .gte('amount', minAmount)
        .order('amount', { ascending: false })
        .limit(25);
      
      if (!termError && termData && termData.length > 0) {
        // Filter to find trades that match at least 2 key terms
        const filtered = termData.filter(trade => {
          const questionLower = (trade.market_question || '').toLowerCase();
          const matchCount = keyTerms.filter(t => questionLower.includes(t)).length;
          return matchCount >= 2;
        });
        
        if (filtered.length > 0) {
          console.log(`Strategy 2 found ${filtered.length} whale trades with term "${term}"`);
          return filtered.slice(0, 20);
        }
      }
    }
  }
  
  // Strategy 3: Try URL-based matching if provided
  if (marketUrl) {
    const urlSlug = marketUrl.match(/event\/([^\/\?]+)/)?.[1];
    if (urlSlug) {
      const slugTerms = urlSlug.split('-').filter(t => t.length > 2);
      
      for (const term of slugTerms.slice(0, 2)) {
        const { data: urlData, error: urlError } = await supabase
          .from('whale_trades')
          .select('*')
          .or(`market_question.ilike.%${term}%,market_url.ilike.%${term}%`)
          .gte('timestamp', oneDayAgo)
          .gte('amount', minAmount)
          .order('amount', { ascending: false })
          .limit(20);
        
        if (!urlError && urlData && urlData.length > 0) {
          console.log(`Strategy 3 found ${urlData.length} whale trades with slug term "${term}"`);
          return urlData;
        }
      }
    }
  }
  
  // Strategy 4: Broad search on first key term
  if (keyTerms.length > 0) {
    const { data: broadData } = await supabase
      .from('whale_trades')
      .select('*')
      .ilike('market_question', `%${keyTerms[0]}%`)
      .gte('timestamp', oneDayAgo)
      .gte('amount', minAmount)
      .order('amount', { ascending: false })
      .limit(20);
    
    if (broadData && broadData.length > 0) {
      console.log(`Strategy 4 found ${broadData.length} whale trades with broad search`);
      return broadData;
    }
  }
  
  console.log('No whale trades found with any strategy');
  return [];
}

// Fetch hot markets by whale activity
async function fetchHotWhaleMarkets(): Promise<any[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('whale_trades')
    .select('market_question, market_url, amount, side')
    .gte('timestamp', oneDayAgo)
    .order('amount', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('Error fetching hot whale markets:', error);
    return [];
  }
  
  // Aggregate by market
  const marketMap = new Map<string, { question: string; url: string; totalVolume: number; yesVolume: number; noVolume: number; tradeCount: number }>();
  
  for (const trade of data || []) {
    const key = trade.market_question;
    const existing = marketMap.get(key) || { 
      question: trade.market_question, 
      url: trade.market_url, 
      totalVolume: 0, 
      yesVolume: 0, 
      noVolume: 0, 
      tradeCount: 0 
    };
    
    existing.totalVolume += trade.amount;
    existing.tradeCount += 1;
    if (trade.side?.toLowerCase() === 'yes') {
      existing.yesVolume += trade.amount;
    } else {
      existing.noVolume += trade.amount;
    }
    
    marketMap.set(key, existing);
  }
  
  return Array.from(marketMap.values())
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 5);
}

// Calculate whale consensus summary
function getWhaleConsensus(trades: any[]): { yesCount: number; noCount: number; yesVolume: number; noVolume: number; consensus: string } {
  let yesVolume = 0;
  let noVolume = 0;
  let yesCount = 0;
  let noCount = 0;
  
  for (const trade of trades) {
    const side = trade.side?.toUpperCase() || 'YES';
    if (side === 'YES') {
      yesVolume += trade.amount;
      yesCount++;
    } else {
      noVolume += trade.amount;
      noCount++;
    }
  }
  
  const consensus = yesVolume > noVolume * 1.5 ? 'HEAVY YES' : 
                    noVolume > yesVolume * 1.5 ? 'HEAVY NO' :
                    yesVolume > noVolume ? 'SLIGHT YES' : 
                    noVolume > yesVolume ? 'SLIGHT NO' : 'MIXED';
  
  return { yesCount, noCount, yesVolume, noVolume, consensus };
}

// Format whale trades section - compact version for quick analysis
function formatWhaleTradesCompact(trades: any[]): string {
  if (!trades || trades.length === 0) {
    return '\n\n━━━━━━━━━━━━━━━━━━━━\n🐋 *WHALE ACTIVITY (24h)*\n_No whale trades >$5K detected_\n━━━━━━━━━━━━━━━━━━━━';
  }
  
  const { yesCount, noCount, yesVolume, noVolume, consensus } = getWhaleConsensus(trades);
  const totalVolume = yesVolume + noVolume;
  
  let section = '\n\n━━━━━━━━━━━━━━━━━━━━\n🐋 *WHALE ACTIVITY (24h)*\n';
  section += `📊 *${trades.length} trades* totaling *${formatCurrency(totalVolume)}*\n\n`;
  
  // Show top 4 trades only with better formatting
  const sortedTrades = [...trades].sort((a, b) => b.amount - a.amount);
  for (const trade of sortedTrades.slice(0, 4)) {
    const side = trade.side?.toUpperCase() || 'YES';
    const emoji = side === 'YES' ? '💰' : '💸';
    const priceDisplay = trade.price ? `at ${(trade.price * 100).toFixed(0)}¢` : '';
    section += `${emoji} *${formatCurrency(trade.amount)} ${side}* ${priceDisplay} - ${timeAgo(trade.timestamp)}\n`;
  }
  
  if (sortedTrades.length > 4) {
    section += `_(+ ${sortedTrades.length - 4} more trades)_\n`;
  }
  
  // Consensus with visual indicator
  section += `\n💡 *Consensus:* ${yesCount} YES (${formatCurrency(yesVolume)}) vs ${noCount} NO (${formatCurrency(noVolume)})\n`;
  
  if (consensus === 'HEAVY YES') {
    section += `🟢 *Smart money heavily bullish*`;
  } else if (consensus === 'HEAVY NO') {
    section += `🔴 *Smart money heavily bearish*`;
  } else if (consensus === 'SLIGHT YES') {
    section += `📈 Smart money leaning YES`;
  } else if (consensus === 'SLIGHT NO') {
    section += `📉 Smart money leaning NO`;
  } else {
    section += `➡️ Mixed signals from whales`;
  }
  
  section += '\n━━━━━━━━━━━━━━━━━━━━';
  
  return section;
}

// Format whale trades section - detailed version
function formatWhaleTrades(trades: any[], includeHeader: boolean = true): string {
  if (!trades || trades.length === 0) {
    if (includeHeader) {
      return '\n🐋 *WHALE ACTIVITY (Last 24h):*\n_No significant whale trades detected_\n──────────';
    }
    return '';
  }
  
  let section = includeHeader ? '\n🐋 *WHALE ACTIVITY (Last 24h):*\n' : '';
  
  const { yesCount, noCount, yesVolume, noVolume, consensus } = getWhaleConsensus(trades);
  
  // Sort by amount descending
  const sortedTrades = [...trades].sort((a, b) => b.amount - a.amount);
  
  for (const trade of sortedTrades.slice(0, 8)) {
    const side = trade.side?.toUpperCase() || 'YES';
    const emoji = side === 'YES' ? '💰' : '💸';
    const priceDisplay = trade.price ? `at ${(trade.price * 100).toFixed(0)}¢` : '';
    const walletDisplay = truncateWallet(trade.wallet);
    const platformDisplay = trade.platform || 'Polymarket';
    
    section += `${emoji} *${formatCurrency(trade.amount)} ${side}* ${priceDisplay} - ${timeAgo(trade.timestamp)}\n`;
    section += `   └ ${walletDisplay} on ${platformDisplay}\n`;
  }
  
  // Consensus analysis
  section += '\n';
  section += `💡 *Whale Consensus:* ${yesCount} YES (${formatCurrency(yesVolume)}) vs ${noCount} NO (${formatCurrency(noVolume)})\n`;
  
  if (consensus === 'HEAVY YES') {
    section += `⚠️ *Heavy YES pressure from smart money*`;
  } else if (consensus === 'HEAVY NO') {
    section += `⚠️ *Heavy NO pressure from smart money*`;
  } else if (consensus === 'SLIGHT YES') {
    section += `📈 Smart money leaning YES`;
  } else if (consensus === 'SLIGHT NO') {
    section += `📉 Smart money leaning NO`;
  } else {
    section += `➡️ Mixed signals from whales`;
  }
  
  if (includeHeader) {
    section += '\n──────────';
  }
  
  return section;
}

// Format expanded whale data view
function formatExpandedWhaleData(trades: any[], marketQuestion: string, marketUrl: string): string {
  let message = `🐋 *DETAILED WHALE ACTIVITY*\n`;
  message += `Market: _${marketQuestion}_\n\n`;
  
  if (!trades || trades.length === 0) {
    message += `📊 *Last 24 Hours:*\n_No whale trades detected (trades >$5K)_\n\n`;
    message += `🔗 [View market](${marketUrl})`;
    return message;
  }
  
  const { yesCount, noCount, yesVolume, noVolume, consensus } = getWhaleConsensus(trades);
  const sortedTrades = [...trades].sort((a, b) => b.amount - a.amount);
  
  message += `📊 *Last 24 Hours:*\n`;
  
  for (const trade of sortedTrades) {
    const side = trade.side?.toUpperCase() || 'YES';
    const emoji = side === 'YES' ? '💰' : '💸';
    const priceDisplay = trade.price ? `at ${(trade.price * 100).toFixed(0)}¢` : '';
    const walletDisplay = truncateWallet(trade.wallet);
    const platformDisplay = trade.platform || 'Polymarket';
    
    message += `\n${emoji} *${formatCurrency(trade.amount)} ${side}* ${priceDisplay} - ${timeAgo(trade.timestamp)}\n`;
    message += `   └ Wallet: ${walletDisplay}\n`;
    message += `   └ Platform: ${platformDisplay}\n`;
  }
  
  // Patterns section
  message += `\n📈 *WHALE PATTERNS:*\n`;
  message += `   • Total volume: ${formatCurrency(yesVolume + noVolume)}\n`;
  message += `   • YES vs NO: ${formatCurrency(yesVolume)} vs ${formatCurrency(noVolume)}\n`;
  message += `   • Trade count: ${sortedTrades.length}\n`;
  if (sortedTrades.length > 0) {
    message += `   • Largest trade: ${formatCurrency(sortedTrades[0].amount)}\n`;
    message += `   • Average position: ${formatCurrency((yesVolume + noVolume) / sortedTrades.length)}\n`;
  }
  
  // Smart money consensus
  message += `\n💡 *SMART MONEY CONSENSUS:*\n`;
  if (consensus === 'HEAVY YES') {
    message += `Strong conviction from whales on YES. ${yesCount} traders betting ${formatCurrency(yesVolume)} on the outcome happening.`;
  } else if (consensus === 'HEAVY NO') {
    message += `Strong conviction from whales on NO. ${noCount} traders betting ${formatCurrency(noVolume)} against the outcome.`;
  } else if (consensus === 'SLIGHT YES') {
    message += `Slight lean towards YES from smart money, but not overwhelming conviction.`;
  } else if (consensus === 'SLIGHT NO') {
    message += `Slight lean towards NO from smart money, but not overwhelming conviction.`;
  } else {
    message += `Mixed signals - no clear consensus from whale traders.`;
  }
  
  message += `\n\n🔗 [View market](${marketUrl})`;
  
  return message;
}

// Check if a market is expired/resolved
function isMarketExpired(market: any): { expired: boolean; reason: string; endDate?: string } {
  // Check various fields that indicate market is closed/resolved
  if (market.closed === true || market.resolved === true || market.active === false) {
    return { expired: true, reason: market.resolved ? 'resolved' : 'closed' };
  }
  
  // Check end date
  if (market.endDate || market.end_date || market.endDateIso) {
    const endDateStr = market.endDate || market.end_date || market.endDateIso;
    try {
      const endDate = new Date(endDateStr);
      const now = new Date();
      if (endDate < now) {
        return { 
          expired: true, 
          reason: 'ended', 
          endDate: endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
      }
    } catch { /* ignore parse errors */ }
  }
  
  // Check if prices indicate resolution (0% or 100%)
  if (market.outcomePrices) {
    try {
      const prices = typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices;
      const yesPrice = parseFloat(prices[0]);
      // Markets at exactly 0 or 1 are typically resolved
      if (yesPrice === 0 || yesPrice === 1) {
        return { expired: true, reason: 'resolved' };
      }
    } catch { /* ignore */ }
  }
  
  return { expired: false, reason: '' };
}

// Fetch Polymarket event data
async function fetchPolymarketEventData(eventSlug: string): Promise<any> {
  try {
    const eventsUrl = `https://gamma-api.polymarket.com/events?slug=${eventSlug}`;
    console.log('Fetching Polymarket event data:', eventsUrl);
    
    const eventsResponse = await fetch(eventsUrl);
    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      if (events && events.length > 0) {
        const event = events[0];
        const markets = event.markets || [];
        
        // Check if the entire event is closed
        const eventExpired = event.closed === true || event.resolved === true || event.active === false;
        
        return {
          eventTitle: event.title,
          eventSlug: event.slug,
          eventExpired,
          eventEndDate: event.endDate || event.end_date,
          markets: markets.map((m: any) => {
            let yesPrice = 0.5;
            try {
              if (m.outcomePrices) {
                const prices = typeof m.outcomePrices === 'string' 
                  ? JSON.parse(m.outcomePrices) 
                  : m.outcomePrices;
                yesPrice = parseFloat(prices[0]) || 0.5;
              }
            } catch { yesPrice = 0.5; }
            
            // Check if this specific market is expired
            const expiredCheck = isMarketExpired(m);
            
            return {
              question: m.question,
              slug: m.slug,
              yesPrice: (yesPrice * 100).toFixed(1),
              noPrice: ((1 - yesPrice) * 100).toFixed(1),
              volume: parseFloat(m.volume) || 0,
              url: m.slug 
                ? `https://polymarket.com/event/${event.slug}/${m.slug}`
                : `https://polymarket.com/event/${event.slug}`,
              expired: expiredCheck.expired,
              expiredReason: expiredCheck.reason,
              endDate: m.endDate || m.end_date || expiredCheck.endDate,
              resolved: m.resolved,
              outcome: m.outcome, // If resolved, what was the outcome
            };
          }),
          url: `https://polymarket.com/event/${event.slug}`,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Polymarket event data:', error);
    return null;
  }
}

// Build expired market message
function buildExpiredMarketMessage(market: any, eventUrl: string): string {
  let msg = `⚠️ *Market Expired/Resolved*\n\n`;
  msg += `📊 "${market.question}"\n\n`;
  
  if (market.endDate) {
    msg += `📅 Ended: ${market.endDate}\n`;
  }
  
  if (market.outcome) {
    msg += `✅ Outcome: ${market.outcome}\n`;
  } else if (market.resolved) {
    const finalPrice = parseFloat(market.yesPrice);
    if (finalPrice >= 99) {
      msg += `✅ Resolved: YES\n`;
    } else if (finalPrice <= 1) {
      msg += `❌ Resolved: NO\n`;
    }
  }
  
  msg += `\n_This market is no longer trading._\n\n`;
  msg += `💡 Would you like to:\n`;
  msg += `• Send another market URL to analyze\n`;
  msg += `• Use /scan to find active opportunities\n`;
  msg += `• Use /hot to see current whale activity\n\n`;
  msg += `🔗 [View market history](${eventUrl})`;
  
  return msg;
}

// Parse URL to get event slug
function parsePolymarketUrl(url: string): { eventSlug: string; marketSlug: string | null } | null {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/^\/+|\/+$/g, '');
    const parts = path.split('/').filter(Boolean);
    
    if (parts[0] !== 'event' || !parts[1]) return null;
    
    return {
      eventSlug: parts[1],
      marketSlug: parts[2] || null,
    };
  } catch {
    return null;
  }
}

// Call Poly chat function
async function getPolyResponse(message: string): Promise<string> {
  try {
    const messages = [{ role: 'user', content: message }];
    
    const response = await fetch(`${supabaseUrl}/functions/v1/poly-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        messages,
        detailMode: 'advanced',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Poly chat error (non-200):', errorText);
      return "Sorry, I'm having trouble analyzing that right now. Please try again.";
    }
    
    const rawText = await response.text();
    
    let accumulated = '';
    for (let line of rawText.split('\n')) {
      line = line.trim();
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const choice = parsed.choices?.[0];
        const deltaContent = choice?.delta?.content ?? choice?.message?.content;
        if (typeof deltaContent === 'string') {
          accumulated += deltaContent;
        }
      } catch (e) {
        console.error('Failed to parse SSE line:', e);
      }
    }
    
    if (!accumulated) {
      return "Sorry, I couldn't generate an answer. Please try again.";
    }
    
    return accumulated;
  } catch (error) {
    console.error('Error calling poly-chat:', error);
    return "Sorry, I encountered an error. Please try again.";
  }
}

// Format volume display - only show if available
function formatVolume(volume: number | undefined): string {
  if (!volume || volume <= 0) return '';
  if (volume >= 1000000) return `Vol: $${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `Vol: $${(volume / 1000).toFixed(0)}K`;
  return `Vol: $${volume.toFixed(0)}`;
}

// Build market header with odds and volume
function buildMarketHeader(question: string, yesPrice: string, noPrice: string, volume?: number, platform: string = 'Polymarket'): string {
  const volStr = formatVolume(volume);
  const volPart = volStr ? ` | ${volStr}` : '';
  return `📊 *${question}*\n💰 ${yesPrice}% YES / ${noPrice}% NO${volPart} | ${platform}`;
}

// Generate QUICK Poly prompt for single market analysis
function buildQuickPolyPrompt(question: string, yesPrice: string, whaleSummary: string): string {
  return `You're Poly — super smart friend who helps with quick answers.

Keep it SHORT. Talk like a human. Be helpful and direct.

MARKET: "${question}"
CURRENT ODDS: ${yesPrice}% YES
${whaleSummary}

When analyzing:
1. Give your take (1-2 sentences)
2. Key data points
3. One actionable insight

Skip the formal structure. Just be helpful.

🎯 Your quick take
🎲 The play: BUY YES / BUY NO / SKIP
📊 Edge if any

⚠️ One risk`;
}

// Generate DETAILED Poly prompt for deep analysis
function buildDetailedPolyPrompt(question: string, yesPrice: string, whaleSummary: string): string {
  return `You're Poly — super smart friend who helps with quick answers.

Keep it SHORT. Talk like a human. Be helpful and direct.

MARKET: "${question}"
CURRENT ODDS: ${yesPrice}% YES
${whaleSummary}

When analyzing:
1. Give your take (1-2 sentences)
2. Key data points
3. One actionable insight

Go a bit deeper here but still conversational:

⏰ What needs to happen?

🎯 Your analysis
- Why it's mispriced (or not)
- What matters most

📊 Numbers:
- Your estimate vs market (${yesPrice}%)
- Edge

🎲 The play + confidence

⚠️ Risks

💡 Bottom line`;
}

// Generate brief Poly prompt for multi-market analysis
function buildBriefPolyPrompt(question: string, yesPrice: string): string {
  return `You're Poly — super smart friend. Quick take in 2-3 sentences max.

MARKET: "${question}" at ${yesPrice}% YES

🎯 [Your take]
🎲 [BUY YES / BUY NO / SKIP] | Edge: [+X% or None]

Be super concise.`;
}

// Format Poly's response for Telegram - clean up any formatting issues
function formatForTelegram(text: string): string {
  return text
    .replace(/\*\*/g, '*')
    .replace(/\n---\n/g, '\n──────────\n')
    .replace(/#+\s*/g, '') // Remove markdown headers
    .replace(/Here's my analysis[^\n]*\n/gi, '') // Remove "here's my analysis" intros
    .replace(/Let me analyze[^\n]*\n/gi, '')
    .replace(/I'll analyze[^\n]*\n/gi, '')
    .trim();
}

// Build buttons for single market analysis
function buildAnalysisButtons(cacheKey: string): any {
  return {
    inline_keyboard: [
      [
        { text: '📊 View Detailed Analysis', callback_data: `detailed:${cacheKey.substring(0, 50)}` },
        { text: '🐋 More Whale Data', callback_data: `whales:${cacheKey.substring(0, 50)}` },
      ],
      [
        { text: '🔄 Refresh Analysis', callback_data: `refresh:${cacheKey.substring(0, 50)}` },
      ],
    ],
  };
}

// Extract unique option name by comparing against all markets in the series
function extractUniqueOptionName(marketTitle: string, seriesTitle: string, allMarkets?: any[]): string {
  // Strategy 1: Find what's UNIQUE across all markets in this series
  if (allMarkets && allMarkets.length > 1) {
    // Tokenize all market questions
    const tokenize = (text: string): string[] => {
      return text.toLowerCase()
        .replace(/[^\w\s$%]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);
    };
    
    const allTokens = allMarkets.map(m => new Set(tokenize(m.question)));
    const thisTokens = tokenize(marketTitle);
    
    // Find words that appear in ALL markets (common words to filter out)
    const commonWords = new Set<string>();
    thisTokens.forEach(word => {
      if (allTokens.every(tokenSet => tokenSet.has(word))) {
        commonWords.add(word);
      }
    });
    
    // Also add generic stop words
    const stopWords = new Set(['will', 'the', 'a', 'an', 'be', 'is', 'as', 'to', 'for', 'by', 'of', 'in', 'on', 'at', 'or', 'and', 'if', 'this', 'that', 'who', 'what', 'when', 'where', 'how', 'which', 'nominates', 'nominate', 'nominated', 'picks', 'pick', 'picked', 'chooses', 'choose', 'chosen', 'selects', 'select', 'selected', 'wins', 'win', 'trump', 'trumps']);
    
    // Extract UNIQUE words from this market title (preserve original case)
    const originalWords = marketTitle.split(/\s+/);
    const uniqueWords: string[] = [];
    
    for (const word of originalWords) {
      const cleanWord = word.toLowerCase().replace(/[^\w$%]/g, '');
      if (cleanWord.length > 1 && 
          !commonWords.has(cleanWord) && 
          !stopWords.has(cleanWord)) {
        // Keep original word but clean punctuation
        uniqueWords.push(word.replace(/[?.,!:;]/g, ''));
      }
    }
    
    if (uniqueWords.length > 0) {
      // Return first 2-3 unique words (likely the person/option name)
      return uniqueWords.slice(0, 3).join(' ').trim();
    }
  }
  
  // Strategy 2: Pattern matching for common market structures
  const patterns = [
    // "Trump nominates Jerome Powell" → "Jerome Powell"
    /(?:nominates?|picks?|chooses?|selects?)\s+(.+?)(?:\s+(?:as|for|to)\s+|\?|$)/i,
    // "Will Jerome Powell be nominated?" → "Jerome Powell"
    /(?:Will|Can|Does)\s+(.+?)\s+(?:be\s+)?(?:nominated|selected|chosen|picked|appointed)/i,
    // "Jerome Powell nominated as Fed Chair" → "Jerome Powell"
    /^(.+?)\s+(?:nominated|selected|chosen|picked|appointed)/i,
    // "Will X win?" pattern
    /(?:Will|Can)\s+(.+?)\s+(?:win|become|get|reach|hit)/i,
    // Price targets "$100,000"
    /(\$[\d,]+(?:\.\d+)?)/,
    // Percentage targets "above 50%"
    /((?:above|below|over|under)\s+\d+%)/i,
  ];
  
  for (const pattern of patterns) {
    const match = marketTitle.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim().replace(/[?.,!:;]/g, '');
      // Make sure we didn't just extract generic words
      const lowerExtracted = extracted.toLowerCase();
      if (extracted.length > 2 && 
          extracted.length < 40 &&
          !lowerExtracted.includes('trump') &&
          lowerExtracted !== 'the' &&
          lowerExtracted !== 'this') {
        return extracted;
      }
    }
  }
  
  // Strategy 3: Fallback - clean up the title
  let option = marketTitle;
  
  // Remove series title if present
  option = option.replace(new RegExp(seriesTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
  
  // Remove common prefixes/suffixes
  option = option
    .replace(/^(Will|Who will|What|Does|Can|Is)\s+/i, '')
    .replace(/\s+(win|be nominated|be selected|be chosen|be picked|be appointed|become|reach|hit).*$/i, '')
    .replace(/\?$/, '')
    .trim();
  
  // If we got something reasonable, return it
  if (option.length > 2 && option.length < 40) {
    // Try to extract a proper name (capitalized words)
    const nameMatch = option.match(/([A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)*)/);
    if (nameMatch && nameMatch[1].length > 2 && !nameMatch[1].toLowerCase().startsWith('trump')) {
      return nameMatch[1];
    }
    return option.split(' ').slice(0, 3).join(' ');
  }
  
  // Last resort: use a shortened version of the full title
  return marketTitle.substring(0, 25) + (marketTitle.length > 25 ? '...' : '');
}

// Build market selection buttons
function buildMarketSelectionButtons(eventData: any, whaleTrades: any[]): { text: string; keyboard: any } {
  const { eventTitle, markets, url } = eventData;
  
  // Sort markets by volume and filter out expired ones for the display list
  const sortedMarkets = [...markets].sort((a, b) => b.volume - a.volume);
  const activeMarkets = sortedMarkets.filter(m => !m.expired);
  const expiredCount = sortedMarkets.length - activeMarkets.length;
  
  const displayMarkets = activeMarkets.slice(0, 8); // Max 8 buttons
  
  let text = `📊 *${eventTitle}*\n\n`;
  
  if (displayMarkets.length === 0) {
    text += `⚠️ *All markets in this series have expired/resolved.*\n\n`;
    text += `💡 Try:\n• /scan for active opportunities\n• /hot for current whale activity\n\n`;
    text += `🔗 [View series history](${url})`;
    return { text, keyboard: { inline_keyboard: [] } };
  }
  
  text += `Select option to analyze:\n\n`;
  
  // Build list with unique names - pass ALL markets for comparison
  for (let i = 0; i < displayMarkets.length; i++) {
    const m = displayMarkets[i];
    const shortName = extractUniqueOptionName(m.question, eventTitle, sortedMarkets);
    
    // Check whale activity
    const hasWhale = whaleTrades.some(t => 
      m.question.toLowerCase().includes(t.market_question?.toLowerCase()?.substring(0, 20) || '')
    );
    const whaleEmoji = hasWhale ? ' 🐋' : '';
    
    text += `${i + 1}️⃣ *${shortName}*${whaleEmoji} - ${m.yesPrice}% YES\n`;
  }
  
  if (activeMarkets.length > 8) {
    text += `\n_(+ ${activeMarkets.length - 8} more active options)_\n`;
  }
  
  if (expiredCount > 0) {
    text += `\n_⚠️ ${expiredCount} expired option${expiredCount > 1 ? 's' : ''} hidden_\n`;
  }
  
  text += `\n💡 Or reply:\n• "top 3" - Best opportunities\n• "all" - All options\n\n`;
  text += `🔗 [View series](${url})`;
  
  // Build inline keyboard using activeMarkets indices
  const rows: any[][] = [];
  
  // Add market buttons (2 per row) with unique names
  for (let i = 0; i < displayMarkets.length; i += 2) {
    const row: any[] = [];
    
    // First button - find the original index in sortedMarkets for callback
    const m1 = displayMarkets[i];
    const originalIndex1 = sortedMarkets.findIndex(m => m.question === m1.question);
    const name1 = extractUniqueOptionName(m1.question, eventTitle, sortedMarkets);
    const label1 = `${i + 1}️⃣ ${name1.substring(0, 18)} ${m1.yesPrice}%`;
    row.push({
      text: label1.substring(0, 32),
      callback_data: `analyze:${eventData.eventSlug}:${originalIndex1}`,
    });
    
    // Second button if exists
    if (i + 1 < displayMarkets.length) {
      const m2 = displayMarkets[i + 1];
      const originalIndex2 = sortedMarkets.findIndex(m => m.question === m2.question);
      const name2 = extractUniqueOptionName(m2.question, eventTitle, sortedMarkets);
      const label2 = `${i + 2}️⃣ ${name2.substring(0, 18)} ${m2.yesPrice}%`;
      row.push({
        text: label2.substring(0, 32),
        callback_data: `analyze:${eventData.eventSlug}:${originalIndex2}`,
      });
    }
    
    rows.push(row);
  }
  
  // Add action buttons
  rows.push([
    { text: '📊 Top 3', callback_data: `analyze_top3:${eventData.eventSlug}` },
    { text: '📈 All', callback_data: `analyze_all:${eventData.eventSlug}` },
  ]);
  
  return {
    text,
    keyboard: { inline_keyboard: rows },
  };
}

function getWelcomeMessage(): string {
  return `🎯 *Welcome to Poly Bot!*

I'm Poly, your smart friend for Polymarket analysis. I find trading edges and keep it simple.

*Commands:*
/scan - Top market opportunities
/hot - Markets with most whale activity
/whale [url] - Show whale trades only
/alert [url] [price] - Set price alert
/following - Your followed markets
/help - All commands

*How to use:*
• Send any Polymarket/Kalshi URL
• Ask questions about markets
• Tap "Detailed Analysis" for deep dives

Let's find some alpha! 🚀`;
}

function getHelpMessage(): string {
  return `📚 *Poly Bot Commands*

*Market Analysis:*
• Send a URL - Quick analysis + buttons
• Tap "Detailed Analysis" - Deep dive
• Tap "More Whale Data" - Full whale view
• /scan - Top opportunities now
• /hot - Whale activity hotspots

*Whale Tracking:*
• /whale [url] - Whale trades only
• Shows who's betting big

*Alerts & Following:*
• /alert [url] [price] - Price alert
• /following - Your watched markets

*Tips:*
• Quick analysis = fast overview
• Detailed = full research report
• Whale data = smart money signals`;
}

// Store pending alert selections for multi-market series
const pendingAlertSelections = new Map<number, { eventSlug: string; markets: any[]; targetPrice: number; username: string }>();

// Handle /alert command
async function handleAlertCommand(chatId: number, text: string, username: string): Promise<void> {
  const parts = text.replace('/alert', '').trim().split(/\s+/);
  
  if (parts.length < 2) {
    await sendTelegramMessage(chatId, 
      `📌 *Set Price Alert*\n\nUsage: /alert [market_url] [target_price]\n\nExample:\n/alert https://polymarket.com/event/bitcoin-100k 65\n\nI'll notify you when the market hits 65%!`
    );
    return;
  }
  
  const url = extractMarketUrl(parts[0]) || parts[0];
  const targetPriceStr = parts[1].replace('%', '');
  const targetPrice = parseFloat(targetPriceStr);
  
  if (isNaN(targetPrice) || targetPrice < 0 || targetPrice > 100) {
    await sendTelegramMessage(chatId, '❌ Invalid price. Please enter a number between 0 and 100.');
    return;
  }
  
  // Check if this is a Polymarket series with multiple markets
  if (url.includes('polymarket.com')) {
    const parsed = parsePolymarketUrl(url);
    if (parsed) {
      await sendTelegramMessage(chatId, '⏳ Checking market...', undefined);
      const eventData = await fetchPolymarketEventData(parsed.eventSlug);
      
      if (eventData && eventData.markets && eventData.markets.length > 1) {
        // Multi-market series - show selection
        const sortedMarkets = [...eventData.markets].sort((a, b) => b.volume - a.volume);
        
        let message = `📊 *Found ${sortedMarkets.length} markets.*\nWhich one should I set alert for?\n\n`;
        
        const displayCount = Math.min(sortedMarkets.length, 10);
        for (let i = 0; i < displayCount; i++) {
          const m = sortedMarkets[i];
          const shortQ = m.question.length > 35 ? m.question.substring(0, 32) + '...' : m.question;
          message += `${i + 1}️⃣ ${shortQ}\n   └ *${m.yesPrice}% YES*\n\n`;
        }
        
        if (sortedMarkets.length > 10) {
          message += `_(+ ${sortedMarkets.length - 10} more)_\n\n`;
        }
        
        message += `Reply with: *[number] ${targetPrice}%*\n`;
        message += `Example: \`3 ${targetPrice}%\` to set alert for market #3`;
        
        // Store pending selection
        pendingAlertSelections.set(chatId, { 
          eventSlug: parsed.eventSlug, 
          markets: sortedMarkets, 
          targetPrice, 
          username 
        });
        
        await sendTelegramMessage(chatId, message);
        return;
      }
      
      // Single market - proceed normally
      if (eventData && eventData.markets && eventData.markets.length === 1) {
        const market = eventData.markets[0];
        await saveAlertToDatabase(chatId, username, market.url, market.question, targetPrice);
        return;
      }
    }
  }
  
  // Default: save with URL as title
  await saveAlertToDatabase(chatId, username, url, 'Unknown Market', targetPrice);
}

// Save alert to database helper
async function saveAlertToDatabase(chatId: number, username: string, url: string, title: string, targetPrice: number): Promise<void> {
  const { error } = await supabase
    .from('price_alerts')
    .insert({
      telegram_chat_id: chatId,
      telegram_username: username,
      market_url: url,
      market_title: title,
      target_price: targetPrice,
      direction: 'above',
    });
  
  if (error) {
    console.error('Error saving alert:', error);
    await sendTelegramMessage(chatId, '❌ Failed to save alert. Please try again.');
    return;
  }
  
  await sendTelegramMessage(chatId, 
    `✅ *Alert Set!*\n\n📊 "${title}"\n🎯 Target: ${targetPrice}%\n\nI'll DM you when it hits this price!`
  );
  
  // Also follow this market
  await supabase
    .from('telegram_followed_markets')
    .upsert({
      telegram_chat_id: chatId,
      market_url: url,
      market_title: title,
    }, { onConflict: 'telegram_chat_id,market_url' });
}

// Handle alert selection reply (e.g., "3 65%")
async function handleAlertSelection(chatId: number, text: string): Promise<boolean> {
  const pending = pendingAlertSelections.get(chatId);
  if (!pending) return false;
  
  // Check if text matches pattern: number followed by optional percentage
  const match = text.match(/^(\d+)\s*(\d+)?%?$/);
  if (!match) return false;
  
  const marketIndex = parseInt(match[1], 10) - 1; // Convert to 0-based
  const targetPrice = match[2] ? parseFloat(match[2]) : pending.targetPrice;
  
  if (marketIndex < 0 || marketIndex >= pending.markets.length) {
    await sendTelegramMessage(chatId, `❌ Invalid selection. Please choose a number between 1 and ${pending.markets.length}`);
    return true;
  }
  
  const market = pending.markets[marketIndex];
  
  // Clear pending selection
  pendingAlertSelections.delete(chatId);
  
  // Save the alert
  await saveAlertToDatabase(chatId, pending.username, market.url, market.question, targetPrice);
  
  return true;
}

// Handle /following command
async function handleFollowingCommand(chatId: number): Promise<void> {
  const { data, error } = await supabase
    .from('telegram_followed_markets')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error || !data || data.length === 0) {
    await sendTelegramMessage(chatId, 
      '📋 *Your Followed Markets*\n\nNo markets followed yet!\n\nSend me any market URL to start following it.'
    );
    return;
  }
  
  let message = '📋 *Your Followed Markets*\n\n';
  
  for (let i = 0; i < data.length; i++) {
    const m = data[i];
    const shortTitle = m.market_title.length > 40 
      ? m.market_title.substring(0, 37) + '...' 
      : m.market_title;
    message += `${i + 1}. ${shortTitle}\n`;
    message += `   └ [View Market](${m.market_url})\n\n`;
  }
  
  await sendTelegramMessage(chatId, message);
}

// Handle /hot command
async function handleHotCommand(chatId: number): Promise<void> {
  // Send immediate feedback
  await sendTelegramMessage(chatId, '⏳ Analyzing whale activity... this may take a few seconds');
  await sendTypingAction(chatId);
  
  const hotMarkets = await fetchHotWhaleMarkets();
  
  if (hotMarkets.length === 0) {
    await sendTelegramMessage(chatId, '🐋 No significant whale activity in the last 24 hours.');
    return;
  }
  
  let message = '🔥 *HOT MARKETS BY WHALE ACTIVITY*\n_(Last 24 hours)_\n\n';
  
  for (let i = 0; i < hotMarkets.length; i++) {
    const m = hotMarkets[i];
    const shortQ = m.question.length > 35 ? m.question.substring(0, 32) + '...' : m.question;
    const consensus = m.yesVolume > m.noVolume ? '📈' : m.noVolume > m.yesVolume ? '📉' : '➡️';
    
    message += `${i + 1}. *${shortQ}*\n`;
    message += `   💰 ${formatCurrency(m.totalVolume)} total\n`;
    message += `   ${consensus} ${formatCurrency(m.yesVolume)} YES / ${formatCurrency(m.noVolume)} NO\n`;
    message += `   📊 ${m.tradeCount} whale trades\n`;
    if (m.url) message += `   🔗 ${m.url}\n`;
    message += '\n';
  }
  
  message += '\n💡 _Higher volume = more conviction from smart money_';
  
  await sendTelegramMessage(chatId, message);
}

// Handle /whale command
async function handleWhaleCommand(chatId: number, text: string): Promise<void> {
  const url = extractMarketUrl(text);
  
  if (!url) {
    await sendTelegramMessage(chatId, 
      '🐋 *Whale Trades*\n\nUsage: /whale [market_url]\n\nExample:\n/whale https://polymarket.com/event/bitcoin-100k'
    );
    return;
  }
  
  await sendTelegramMessage(chatId, '⏳ Fetching whale trades...');
  await sendTypingAction(chatId);
  
  // Get market title for search
  let marketTitle = '';
  if (url.includes('polymarket.com')) {
    const parsed = parsePolymarketUrl(url);
    if (parsed) {
      const eventData = await fetchPolymarketEventData(parsed.eventSlug);
      if (eventData) {
        marketTitle = eventData.eventTitle;
      }
    }
  }
  
  if (!marketTitle) {
    // Extract from URL slug
    const match = url.match(/event\/([^\/\?]+)/);
    if (match) {
      marketTitle = match[1].replace(/-/g, ' ');
    }
  }
  
  // Fetch with lower threshold for more data
  const trades = await fetchWhaleTrades(marketTitle, url, 5000);
  
  const message = formatExpandedWhaleData(trades, marketTitle, url);
  await sendTelegramMessage(chatId, message);
}

// Perform quick analysis and cache results
async function performQuickAnalysis(
  chatId: number,
  market: { question: string; yesPrice: string; noPrice: string; volume: number; url: string },
  whaleTrades: any[]
): Promise<{ message: string; cacheKey: string }> {
  const cacheKey = getCacheKey(market.url);
  
  // Get whale consensus for prompt
  const { yesCount, noCount, yesVolume, noVolume } = getWhaleConsensus(whaleTrades);
  
  let whaleSummary = '';
  if (whaleTrades.length > 0) {
    const whaleDirection = yesVolume > noVolume ? 'YES' : 'NO';
    whaleSummary = `WHALE DATA: ${whaleTrades.length} trades detected. ${yesCount} YES (${formatCurrency(yesVolume)}) vs ${noCount} NO (${formatCurrency(noVolume)}). Smart money leaning ${whaleDirection}.`;
    
    // Add note if whales disagree with market
    const marketYesPercent = parseFloat(market.yesPrice);
    if ((marketYesPercent > 50 && noVolume > yesVolume * 1.5) || 
        (marketYesPercent < 50 && yesVolume > noVolume * 1.5)) {
      whaleSummary += ' NOTE: Whales may disagree with current market pricing.';
    }
  }
  
  // Build header with odds and volume
  const header = buildMarketHeader(market.question, market.yesPrice, market.noPrice, market.volume);
  
  // Get QUICK Poly analysis
  const polyPrompt = buildQuickPolyPrompt(market.question, market.yesPrice, whaleSummary);
  const polyResponse = await getPolyResponse(polyPrompt);
  
  // Format whale section (compact)
  const whaleSection = formatWhaleTradesCompact(whaleTrades);
  
  // Cache the analysis data
  analysisCache.set(cacheKey, {
    marketQuestion: market.question,
    marketUrl: market.url,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume: market.volume,
    whaleTrades,
    quickAnalysis: polyResponse,
    timestamp: Date.now(),
    expiresAt: Date.now() + 600000, // 10 minutes
  });
  
  // Build final message
  const finalMessage = `${header}\n\n${formatForTelegram(polyResponse)}${whaleSection}\n\n📘 *Want the full research report?*\nTap "📊 View Detailed Analysis" below for Poly's deep dive plus full whale breakdown.\n\n🔗 [View market](${market.url})`;
  
  return { message: finalMessage, cacheKey };
}

// Handle callback query (button clicks)
async function handleCallbackQuery(callbackQuery: any): Promise<void> {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const callbackData = callbackQuery.data;
  const callbackQueryId = callbackQuery.id;
  
  if (!chatId || !messageId || !callbackData) {
    await answerCallbackQuery(callbackQueryId, 'Invalid request');
    return;
  }
  
  console.log(`Callback: ${callbackData} from chat ${chatId}`);
  
  // Acknowledge the callback immediately
  await answerCallbackQuery(callbackQueryId);
  
  // Clean expired cache
  cleanExpiredCache();
  
  // Parse callback data
  const parts = callbackData.split(':');
  const action = parts[0];
  
  if (action === 'detailed') {
    // User wants detailed analysis
    const cacheKeyPart = parts.slice(1).join(':');
    
    // Find matching cache entry
    let cached: CachedAnalysis | undefined;
    for (const [key, value] of analysisCache) {
      if (key.includes(cacheKeyPart) || cacheKeyPart.includes(key.substring(0, 30))) {
        cached = value;
        break;
      }
    }
    
    if (cached) {
      await sendTelegramMessage(chatId, '⏳ Generating detailed analysis...');
      await sendTypingAction(chatId);
      
      // Get whale consensus for prompt
      const { yesCount, noCount, yesVolume, noVolume } = getWhaleConsensus(cached.whaleTrades);
      
      let whaleSummary = '';
      if (cached.whaleTrades.length > 0) {
        const whaleDirection = yesVolume > noVolume ? 'YES' : 'NO';
        whaleSummary = `WHALE DATA: ${cached.whaleTrades.length} trades. ${yesCount} YES (${formatCurrency(yesVolume)}) vs ${noCount} NO (${formatCurrency(noVolume)}). Whales leaning ${whaleDirection}.`;
        
        const marketYesPercent = parseFloat(cached.yesPrice);
        if ((marketYesPercent > 50 && noVolume > yesVolume * 1.5) || 
            (marketYesPercent < 50 && yesVolume > noVolume * 1.5)) {
          whaleSummary += ' ⚠️ Smart money disagrees with Poly - this is either a fade opportunity or Poly is wrong.';
        }
      }
      
      // Get detailed analysis
      const detailedPrompt = buildDetailedPolyPrompt(cached.marketQuestion, cached.yesPrice, whaleSummary);
      const detailedResponse = await getPolyResponse(detailedPrompt);
      
      // Build header
      const header = buildMarketHeader(cached.marketQuestion, cached.yesPrice, cached.noPrice, cached.volume);
      
      // Full whale section
      const whaleSection = formatWhaleTrades(cached.whaleTrades);
      
      const detailedMessage = `${header}\n\n*📊 DETAILED ANALYSIS*\n\n${formatForTelegram(detailedResponse)}\n${whaleSection}\n\n🔗 [View market](${cached.marketUrl})\n\n💡 _Want another market? Send a URL or use /scan_`;
      
      await sendTelegramMessage(chatId, detailedMessage);
    } else {
      // Fallback: regenerate detailed analysis directly from the original message
      const messageText: string = callbackQuery.message?.text || '';
      const entities: any[] | undefined = callbackQuery.message?.entities;
      
      let url: string | null = null;
      if (entities && Array.isArray(entities)) {
        const linkEntity = entities.find((e: any) => e.type === 'text_link' && e.url);
        if (linkEntity?.url) {
          url = linkEntity.url;
        }
      }
      if (!url) {
        url = extractMarketUrl(messageText);
      }
      
      let question: string | null = null;
      if (messageText) {
        const firstLine = messageText.split('\n')[0] || '';
        question = firstLine
          .replace(/^📊\s*/, '')
          .replace(/-\s*DETAILED ANALYSIS\s*$/i, '')
          .trim();
      }
      
      if (!url) {
        await sendTelegramMessage(chatId, '❌ I could not find that market again. Please resend the URL for a fresh analysis.');
        return;
      }
      
      await sendTelegramMessage(chatId, '⏳ Generating fresh detailed analysis...');
      await sendTypingAction(chatId);
      
      const prompt = `Give me a thorough analysis of this prediction market. Include current odds, key factors, probability estimate, and risks.\n\nMarket URL: ${url}${question ? `\nTitle: ${question}` : ''}`;
      const detailedResponse = await getPolyResponse(prompt);
      
      await sendTelegramMessage(chatId, `*📊 DETAILED ANALYSIS*\n\n${formatForTelegram(detailedResponse)}`);
    }
    
  } else if (action === 'whales') {
    // User wants expanded whale data
    const cacheKeyPart = parts.slice(1).join(':');
    
    // Find matching cache entry
    let cached: CachedAnalysis | undefined;
    for (const [key, value] of analysisCache) {
      if (key.includes(cacheKeyPart) || cacheKeyPart.includes(key.substring(0, 30))) {
        cached = value;
        break;
      }
    }
    
    if (cached) {
      // Fetch more whale data with lower threshold
      await sendTelegramMessage(chatId, '⏳ Fetching detailed whale data...');
      const expandedTrades = await fetchWhaleTrades(cached.marketQuestion, cached.marketUrl, 5000);
      
      const message = formatExpandedWhaleData(expandedTrades, cached.marketQuestion, cached.marketUrl);
      await sendTelegramMessage(chatId, message);
    } else {
      const messageText: string = callbackQuery.message?.text || '';
      const entities: any[] | undefined = callbackQuery.message?.entities;
      
      let url: string | null = null;
      if (entities && Array.isArray(entities)) {
        const linkEntity = entities.find((e: any) => e.type === 'text_link' && e.url);
        if (linkEntity?.url) {
          url = linkEntity.url;
        }
      }
      if (!url) {
        url = extractMarketUrl(messageText);
      }
      
      let question: string | null = null;
      if (messageText) {
        const firstLine = messageText.split('\n')[0] || '';
        question = firstLine.replace(/^📊\s*/, '').trim();
      }
      
      if (!url || !question) {
        await sendTelegramMessage(chatId, '❌ I could not find that market again. Please resend the URL to see whale activity.');
        return;
      }
      
      await sendTelegramMessage(chatId, '⏳ Fetching detailed whale data...');
      const expandedTrades = await fetchWhaleTrades(question, url, 5000);
      const message = formatExpandedWhaleData(expandedTrades, question, url);
      await sendTelegramMessage(chatId, message);
    }
    
  } else if (action === 'refresh') {
    // User wants to refresh analysis
    const cacheKeyPart = parts.slice(1).join(':');
    
    // Find matching cache entry to get market info
    let cached: CachedAnalysis | undefined;
    for (const [key, value] of analysisCache) {
      if (key.includes(cacheKeyPart) || cacheKeyPart.includes(key.substring(0, 30))) {
        cached = value;
        break;
      }
    }
    
    if (cached) {
      await sendTelegramMessage(chatId, '🔄 Refreshing analysis...');
      await sendTypingAction(chatId);
      
      // Fetch fresh whale trades
      const freshTrades = await fetchWhaleTrades(cached.marketQuestion, cached.marketUrl);
      
      // Perform fresh quick analysis
      const { message, cacheKey } = await performQuickAnalysis(
        chatId,
        {
          question: cached.marketQuestion,
          yesPrice: cached.yesPrice,
          noPrice: cached.noPrice,
          volume: cached.volume,
          url: cached.marketUrl,
        },
        freshTrades
      );
      
      const buttons = buildAnalysisButtons(cacheKey);
      await sendTelegramMessage(chatId, message, undefined, buttons);
    } else {
      await sendTelegramMessage(chatId, '⏳ Cache expired. Please send the market URL again.');
    }
    
  } else if (action === 'analyze') {
    // Single market analysis: analyze:eventSlug:marketIndex
    const eventSlug = parts[1];
    const marketIndex = parseInt(parts[2], 10);
    
    // Show loading
    await editTelegramMessage(chatId, messageId, '⏳ Analyzing market...');
    await sendTypingAction(chatId);
    
    // Fetch fresh event data
    const eventData = await fetchPolymarketEventData(eventSlug);
    if (!eventData || !eventData.markets || marketIndex >= eventData.markets.length) {
      await editTelegramMessage(chatId, messageId, '❌ Could not fetch market data. Please try sending the URL again.');
      return;
    }
    
    const sortedMarkets = [...eventData.markets].sort((a, b) => b.volume - a.volume);
    const market = sortedMarkets[marketIndex];
    
    // Check if market is expired/resolved
    if (market.expired) {
      await editTelegramMessage(chatId, messageId, '⚠️ Market status check...');
      const expiredMsg = buildExpiredMarketMessage(market, eventData.url);
      await sendTelegramMessage(chatId, expiredMsg);
      return;
    }
    
    // Fetch whale trades for this market
    const whaleTrades = await fetchWhaleTrades(market.question, market.url);
    
    // Perform quick analysis with caching
    const { message, cacheKey } = await performQuickAnalysis(chatId, market, whaleTrades);
    
    // Send the analysis with buttons
    await editTelegramMessage(chatId, messageId, `✅ Analysis complete`);
    
    const buttons = buildAnalysisButtons(cacheKey);
    await sendTelegramMessage(chatId, message, undefined, buttons);
    
  } else if (action === 'analyze_top3') {
    // Top 3 analysis
    const eventSlug = parts[1];
    
    await editTelegramMessage(chatId, messageId, '⏳ Analyzing top 3 markets by volume...');
    await sendTypingAction(chatId);
    
    const eventData = await fetchPolymarketEventData(eventSlug);
    if (!eventData || !eventData.markets) {
      await editTelegramMessage(chatId, messageId, '❌ Could not fetch market data. Please try again.');
      return;
    }
    
    const sortedMarkets = [...eventData.markets].sort((a, b) => b.volume - a.volume).slice(0, 3);
    
    for (let i = 0; i < sortedMarkets.length; i++) {
      await editTelegramMessage(chatId, messageId, `⏳ Analyzing ${i + 1}/${sortedMarkets.length}...`);
      
      const market = sortedMarkets[i];
      
      // Fetch whale trades
      const whaleTrades = await fetchWhaleTrades(market.question, market.url);
      const whaleSection = formatWhaleTrades(whaleTrades, false); // No header for brief
      
      // Build header
      const header = buildMarketHeader(market.question, market.yesPrice, market.noPrice, market.volume);
      
      // Use brief prompt for multi-market
      const polyPrompt = buildBriefPolyPrompt(market.question, market.yesPrice);
      const polyResponse = await getPolyResponse(polyPrompt);
      
      let msg = `${header}\n\n${formatForTelegram(polyResponse)}`;
      if (whaleSection) msg += `\n🐋 ${whaleSection}`;
      
      await sendTelegramMessage(chatId, msg);
    }
    
    await editTelegramMessage(chatId, messageId, `✅ Analyzed top 3 markets for "${eventData.eventTitle}"`);
    
  } else if (action === 'analyze_all') {
    // All markets analysis (limited to 5)
    const eventSlug = parts[1];
    
    await editTelegramMessage(chatId, messageId, '⏳ Analyzing top 5 markets by volume...');
    await sendTypingAction(chatId);
    
    const eventData = await fetchPolymarketEventData(eventSlug);
    if (!eventData || !eventData.markets) {
      await editTelegramMessage(chatId, messageId, '❌ Could not fetch market data. Please try again.');
      return;
    }
    
    const sortedMarkets = [...eventData.markets].sort((a, b) => b.volume - a.volume).slice(0, 5);
    
    for (let i = 0; i < sortedMarkets.length; i++) {
      await editTelegramMessage(chatId, messageId, `⏳ Analyzing ${i + 1}/${sortedMarkets.length}...`);
      
      const market = sortedMarkets[i];
      
      // Fetch whale trades
      const whaleTrades = await fetchWhaleTrades(market.question, market.url);
      const whaleSection = formatWhaleTrades(whaleTrades, false);
      
      // Build header
      const header = buildMarketHeader(market.question, market.yesPrice, market.noPrice, market.volume);
      
      // Use brief prompt
      const polyPrompt = buildBriefPolyPrompt(market.question, market.yesPrice);
      const polyResponse = await getPolyResponse(polyPrompt);
      
      let msg = `${header}\n\n${formatForTelegram(polyResponse)}`;
      if (whaleSection) msg += `\n🐋 ${whaleSection}`;
      
      await sendTelegramMessage(chatId, msg);
    }
    
    await editTelegramMessage(chatId, messageId, `✅ Analyzed top 5 markets for "${eventData.eventTitle}"\n\n_Tap individual buttons above for other markets._`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Telegram webhook received:', JSON.stringify(body, null, 2));
    
    // Handle callback query (button clicks)
    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Handle regular message
    const message = body.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const chatId = message.chat.id;
    const text = message.text || '';
    const messageId = message.message_id;
    const username = message.from?.username || message.from?.first_name || 'User';
    
    console.log(`Message from ${username} (${chatId}): ${text}`);
    
    // Check if this is a first-time user (auto-welcome for mobile users who don't see /start)
    const { data: existingUser } = await supabase
      .from('telegram_followed_markets')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .limit(1);
    
    const isFirstTime = !existingUser || existingUser.length === 0;
    
    // Check for pending alert selection (e.g., "3 65%")
    if (await handleAlertSelection(chatId, text)) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Handle commands
    if (text.startsWith('/start')) {
      await sendTelegramMessage(chatId, getWelcomeMessage(), messageId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Auto-welcome first-time users who send any message (mobile fix)
    if (isFirstTime && !text.startsWith('/')) {
      await sendTelegramMessage(chatId, getWelcomeMessage());
      // Continue processing their actual message below
    }
    
    if (text.startsWith('/help')) {
      await sendTelegramMessage(chatId, getHelpMessage(), messageId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (text.startsWith('/scan')) {
      // Immediate feedback
      await sendTelegramMessage(chatId, '⏳ Scanning for top market opportunities...', messageId);
      await sendTypingAction(chatId);
      const response = await getPolyResponse("What are the top 5 market opportunities right now? Show me the best trades with highest edge.");
      await sendTelegramMessage(chatId, formatForTelegram(response));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (text.startsWith('/hot')) {
      await handleHotCommand(chatId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (text.startsWith('/whale')) {
      await handleWhaleCommand(chatId, text);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (text.startsWith('/alert')) {
      await handleAlertCommand(chatId, text, username);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (text.startsWith('/following')) {
      await handleFollowingCommand(chatId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Check if message contains a Polymarket URL
    const marketUrl = extractMarketUrl(text);
    
    if (marketUrl && marketUrl.includes('polymarket.com')) {
      const parsed = parsePolymarketUrl(marketUrl);
      
      if (parsed) {
        // Send immediate feedback
        await sendTelegramMessage(chatId, '⏳ Fetching market data...', messageId);
        await sendTypingAction(chatId);
        
        const eventData = await fetchPolymarketEventData(parsed.eventSlug);
        
        if (eventData && eventData.markets && eventData.markets.length > 1) {
          console.log(`Found ${eventData.markets.length} markets for event ${parsed.eventSlug}`);
          
          // Follow this market
          await supabase
            .from('telegram_followed_markets')
            .upsert({
              telegram_chat_id: chatId,
              market_url: marketUrl,
              market_title: eventData.eventTitle,
            }, { onConflict: 'telegram_chat_id,market_url' });
          
          // For multi-market series, don't show aggregated whale stats (they'd be for the wrong markets)
          // Instead, show a summary hint - users get accurate whale data when they SELECT a specific market
          const trades: any[] = []; // Empty for series selection - whale data shown on individual selection
          
          // Build market selection with buttons (don't auto-analyze)
          const { text: selectionText, keyboard } = buildMarketSelectionButtons(eventData, trades);
          
          // Add helpful hint about whale data instead of wrong aggregated stats
          let finalText = selectionText;
          finalText += '\n\n🐋 _Select a market above to see whale activity for that specific option._';
          
          await sendTelegramMessage(chatId, finalText, undefined, keyboard);
          
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
          
        } else if (eventData && eventData.markets && eventData.markets.length === 1) {
          // Single market - analyze directly with quick analysis + buttons
          const market = eventData.markets[0];
          
          // Check if market is expired/resolved BEFORE analyzing
          if (market.expired) {
            const expiredMsg = buildExpiredMarketMessage(market, eventData.url);
            await sendTelegramMessage(chatId, expiredMsg, messageId);
            return new Response(JSON.stringify({ ok: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          await sendTelegramMessage(chatId, '⏳ Analyzing market...', messageId);
          await sendTypingAction(chatId);
          
          // Follow this market
          await supabase
            .from('telegram_followed_markets')
            .upsert({
              telegram_chat_id: chatId,
              market_url: market.url,
              market_title: market.question,
            }, { onConflict: 'telegram_chat_id,market_url' });
          
          // Fetch whale trades
          const whaleTrades = await fetchWhaleTrades(market.question, market.url);
          
          // Perform quick analysis with caching
          const { message: analysisMessage, cacheKey } = await performQuickAnalysis(chatId, market, whaleTrades);
          
          // Send with buttons
          const buttons = buildAnalysisButtons(cacheKey);
          await sendTelegramMessage(chatId, analysisMessage, undefined, buttons);
          
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }
    
    // Single market or general question - send directly to Poly
    await sendTelegramMessage(chatId, '⏳ Processing your request...', messageId);
    await sendTypingAction(chatId);
    
    let query = text;
    if (marketUrl) {
      query = `Analyze this market: ${marketUrl}`;
      const additionalText = text.replace(marketUrl, '').trim();
      if (additionalText) {
        query = `${additionalText} - Market URL: ${marketUrl}`;
      }
    }
    
    const polyResponse = await getPolyResponse(query);
    await sendTelegramMessage(chatId, formatForTelegram(polyResponse));
    
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    console.error('Telegram bot error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
