import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DOME_API_URL = "https://api.domeapi.io/v1";

// ============ Types ============

type PolymarketSide = { id: string; label: string };

interface PolymarketMarket {
  market_slug?: string;
  title?: string;
  condition_id?: string;
  start_time?: number;
  end_time?: number;
  tags?: string[];
  side_a?: PolymarketSide;
  side_b?: PolymarketSide;
  status?: string;
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
}

interface KalshiMarket {
  event_ticker?: string;
  market_ticker?: string;
  title?: string;
  start_time?: number;
  end_time?: number;
  close_time?: number;
  status?: string;
  last_price?: number;
  volume?: number;
  volume_24h?: number;
}

interface OrderbookLevel {
  price: number;
  size: number;
}

interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

interface MatchedPair {
  polymarket: PolymarketMarket;
  kalshi: KalshiMarket;
  score: number;
  reason: string;
  polyYesTokenId: string;
  polyTitle: string;
  kalshiTitle: string;
  polyNorm: string;
  kalshiNorm: string;
  keyEntities: { poly: string[]; kalshi: string[]; matched: string[]; mismatched: string[] };
}

interface ArbOpportunity {
  id: string;
  matchKey: string;
  eventTitle: string;
  category: string;
  spreadPercent: number;
  buyPlatform: "kalshi" | "polymarket";
  sellPlatform: "kalshi" | "polymarket";
  buyPrice: number;
  sellPrice: number;
  buyTicker: string;
  sellTicker: string;
  buyVolume: number;
  sellVolume: number;
  estimatedProfit: number;
  expiresAt: string | null;
  updatedAt: number;
  matchScore: number;
  matchReason: string;
  dataAgeMinutes?: number;
}

// ============ Logging ============

function log(msg: string, data?: unknown) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] [arb-scanner] ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${ts}] [arb-scanner] ${msg}`);
  }
}

// ============ API helpers ============

async function domeGet(url: string, apiKey: string): Promise<{ ok: boolean; status: number; data: any; text?: string }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, data: null, text };
  }
  return { ok: true, status: res.status, data: await res.json() };
}

function extractArr(d: any): any[] {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.markets)) return d.markets;
  if (Array.isArray(d.data)) return d.data;
  return [];
}

// Filter constants for high-quality markets
const MIN_VOLUME_API = 1000; // API filter: $1k+ volume (lowered for more results)
const MAX_DAYS_TO_CLOSE = 30; // Markets closing within 30 days
const API_PAGE_LIMIT = 100; // Dome API hard limit per request
const PAGES_TO_FETCH = 3; // Always fetch 3 pages = up to 300 markets

async function fetchPolymarketMarketsPage(apiKey: string, offset: number): Promise<{ markets: PolymarketMarket[]; error?: string }> {
  const url = `${DOME_API_URL}/polymarket/markets?status=open&min_volume=${MIN_VOLUME_API}&limit=${API_PAGE_LIMIT}&offset=${offset}`;
  log(`Fetching Polymarket page offset=${offset}: ${url}`);
  try {
    const res = await domeGet(url, apiKey);
    if (!res.ok) return { markets: [], error: `Poly ${res.status}: ${res.text}` };
    return { markets: extractArr(res.data) };
  } catch (e) {
    return { markets: [], error: String(e) };
  }
}

async function fetchPolymarketMarkets(apiKey: string, targetCount: number): Promise<{ markets: PolymarketMarket[]; error?: string }> {
  // Always fetch PAGES_TO_FETCH pages (3 x 100 = 300 markets max)
  const offsets = Array.from({ length: PAGES_TO_FETCH }, (_, i) => i * API_PAGE_LIMIT);
  
  log(`Polymarket: fetching ${PAGES_TO_FETCH} pages (offsets: ${offsets.join(', ')}) for up to 300 markets`);
  
  const results = await Promise.all(offsets.map(offset => fetchPolymarketMarketsPage(apiKey, offset)));
  
  let allMarkets: PolymarketMarket[] = [];
  let firstError: string | undefined;
  
  for (const r of results) {
    if (r.error && !firstError) firstError = r.error;
    allMarkets = allMarkets.concat(r.markets);
  }
  
  // Filter for short-term markets (close within MAX_DAYS)
  const now = Date.now();
  const maxCloseTime = now + MAX_DAYS_TO_CLOSE * 24 * 60 * 60 * 1000;
  
  allMarkets = allMarkets.filter((m: PolymarketMarket) => {
    const endTime = m.end_time ? m.end_time * 1000 : Infinity;
    return endTime <= maxCloseTime;
  });
  
  // Sort by volume descending
  allMarkets.sort((a, b) => ((b.volume || b.volume_24h || 0) - (a.volume || a.volume_24h || 0)));
  allMarkets = allMarkets.slice(0, targetCount);
  
  log(`Polymarket total: ${allMarkets.length} markets (vol>=$${MIN_VOLUME_API}, closes within ${MAX_DAYS_TO_CLOSE}d)`);
  if (allMarkets[0]) log("Poly top:", { title: allMarkets[0].title, volume: allMarkets[0].volume || allMarkets[0].volume_24h });
  
  return { markets: allMarkets, error: allMarkets.length === 0 ? firstError : undefined };
}

async function fetchKalshiMarketsPage(apiKey: string, offset: number): Promise<{ markets: KalshiMarket[]; error?: string }> {
  const url = `${DOME_API_URL}/kalshi/markets?status=open&min_volume=${MIN_VOLUME_API}&limit=${API_PAGE_LIMIT}&offset=${offset}`;
  log(`Fetching Kalshi page offset=${offset}: ${url}`);
  try {
    const res = await domeGet(url, apiKey);
    if (!res.ok) return { markets: [], error: `Kalshi ${res.status}: ${res.text}` };
    return { markets: extractArr(res.data) };
  } catch (e) {
    return { markets: [], error: String(e) };
  }
}

async function fetchKalshiMarkets(apiKey: string, targetCount: number): Promise<{ markets: KalshiMarket[]; error?: string }> {
  // Always fetch PAGES_TO_FETCH pages (3 x 100 = 300 markets max)
  const offsets = Array.from({ length: PAGES_TO_FETCH }, (_, i) => i * API_PAGE_LIMIT);
  
  log(`Kalshi: fetching ${PAGES_TO_FETCH} pages (offsets: ${offsets.join(', ')}) for up to 300 markets`);
  
  const results = await Promise.all(offsets.map(offset => fetchKalshiMarketsPage(apiKey, offset)));
  
  let allMarkets: KalshiMarket[] = [];
  let firstError: string | undefined;
  
  for (const r of results) {
    if (r.error && !firstError) firstError = r.error;
    allMarkets = allMarkets.concat(r.markets);
  }
  
  // Filter for short-term markets
  const now = Date.now();
  const maxCloseTime = now + MAX_DAYS_TO_CLOSE * 24 * 60 * 60 * 1000;
  
  allMarkets = allMarkets.filter((m: KalshiMarket) => {
    const closeTime = m.close_time ? m.close_time * 1000 : (m.end_time ? m.end_time * 1000 : Infinity);
    return closeTime <= maxCloseTime;
  });
  
  // Sort by volume descending
  allMarkets.sort((a, b) => ((b.volume || b.volume_24h || 0) - (a.volume || a.volume_24h || 0)));
  allMarkets = allMarkets.slice(0, targetCount);
  
  log(`Kalshi total: ${allMarkets.length} markets (vol>=$${MIN_VOLUME_API}, closes within ${MAX_DAYS_TO_CLOSE}d)`);
  if (allMarkets[0]) log("Kalshi top:", { title: allMarkets[0].title, volume: allMarkets[0].volume || allMarkets[0].volume_24h });
  
  return { markets: allMarkets, error: allMarkets.length === 0 ? firstError : undefined };
}

// Orderbook endpoints REQUIRE start_time and end_time (milliseconds)
// Snapshots are periodic, NOT real-time. Use 24-hour window to find most recent snapshot.
const ORDERBOOK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours - more relaxed for active markets

interface OrderbookResult {
  ob: Orderbook | null;
  url: string;
  error?: string;
  snapshotTimestamp?: number;
  snapshotAgeMinutes?: number;
}

async function fetchPolymarketOrderbook(tokenId: string, apiKey: string): Promise<OrderbookResult> {
  const now = Date.now();
  const startTime = now - ORDERBOOK_WINDOW_MS; // 24 hours ago
  const url = `${DOME_API_URL}/polymarket/orderbooks?token_id=${encodeURIComponent(tokenId)}&start_time=${startTime}&end_time=${now}&limit=1`;
  try {
    const res = await domeGet(url, apiKey);
    if (!res.ok) {
      return { ob: null, url, error: `${res.status}: ${res.text?.slice(0, 200)}` };
    }
    const snapshots = res.data?.snapshots || [];
    if (snapshots.length === 0) {
      return { ob: null, url, error: "No snapshots in 24h window" };
    }
    const snap = snapshots[0];
    const snapshotTs = snap.timestamp || snap.t || now;
    const ageMs = now - snapshotTs;
    const ageMinutes = Math.round(ageMs / 60000);
    
    // Check if snapshot is too stale
    if (ageMs > STALE_THRESHOLD_MS) {
      return { ob: null, url, error: `Snapshot too old: ${ageMinutes} min`, snapshotTimestamp: snapshotTs, snapshotAgeMinutes: ageMinutes };
    }
    
    const bids: OrderbookLevel[] = (snap.bids || []).map((b: any) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }));
    const asks: OrderbookLevel[] = (snap.asks || []).map((a: any) => ({ price: parseFloat(a.price), size: parseFloat(a.size) }));
    return { ob: { bids, asks }, url, snapshotTimestamp: snapshotTs, snapshotAgeMinutes: ageMinutes };
  } catch (e) {
    return { ob: null, url, error: String(e) };
  }
}

async function fetchKalshiOrderbook(ticker: string, apiKey: string): Promise<OrderbookResult> {
  const now = Date.now();
  const startTime = now - ORDERBOOK_WINDOW_MS; // 24 hours ago
  const url = `${DOME_API_URL}/kalshi/orderbooks?ticker=${encodeURIComponent(ticker)}&start_time=${startTime}&end_time=${now}&limit=1`;
  try {
    const res = await domeGet(url, apiKey);
    if (!res.ok) {
      return { ob: null, url, error: `${res.status}: ${res.text?.slice(0, 200)}` };
    }
    const snapshots = res.data?.snapshots || [];
    if (snapshots.length === 0) {
      return { ob: null, url, error: "No snapshots in 24h window" };
    }
    const snap = snapshots[0];
    const snapshotTs = snap.timestamp || snap.t || now;
    const ageMs = now - snapshotTs;
    const ageMinutes = Math.round(ageMs / 60000);
    
    // Check if snapshot is too stale
    if (ageMs > STALE_THRESHOLD_MS) {
      return { ob: null, url, error: `Snapshot too old: ${ageMinutes} min`, snapshotTimestamp: snapshotTs, snapshotAgeMinutes: ageMinutes };
    }
    
    // Kalshi format: yes: [[price, size], ...], no: [[price, size], ...]
    const orderbook = snap.orderbook || snap;
    const yesBids = orderbook.yes || [];
    const noBids = orderbook.no || [];
    // Yes bids are bids to buy YES; we treat yes_dollars if available
    const bids: OrderbookLevel[] = (orderbook.yes_dollars || yesBids).map((level: any) => {
      if (Array.isArray(level)) return { price: parseFloat(level[0]), size: parseFloat(level[1]) };
      return { price: 0, size: 0 };
    }).filter((l: OrderbookLevel) => l.price > 0);
    const asks: OrderbookLevel[] = (orderbook.no_dollars || noBids).map((level: any) => {
      if (Array.isArray(level)) return { price: 1 - parseFloat(level[0]), size: parseFloat(level[1]) }; // NO price = 1 - YES price for asks
      return { price: 0, size: 0 };
    }).filter((l: OrderbookLevel) => l.price > 0);
    return { ob: { bids, asks }, url, snapshotTimestamp: snapshotTs, snapshotAgeMinutes: ageMinutes };
  } catch (e) {
    return { ob: null, url, error: String(e) };
  }
}

// ============ Matching ============

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const STOP_WORDS = new Set(["will", "the", "be", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or", "is", "it", "by", "with", "as", "this", "that", "after", "before", "during", "from", "win", "next"]);

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

// Extract key entities (names, teams, specific identifiers)
function extractKeyEntities(title: string): string[] {
  const norm = normalize(title);
  const entities: string[] = [];

  // Known person name patterns (first + last name together)
  const personPatterns = [
    /trump/g, /biden/g, /elon musk/g, /musk/g,
    /kevin warsh/g, /warsh/g, /kevin hassett/g, /hassett/g,
    /mark cuban/g, /cuban/g, /mark kelly/g, /kelly/g,
    /barron trump/g, /barron/g,
    /scott bessent/g, /bessent/g, /chris waller/g, /waller/g,
    /jerome powell/g, /powell/g,
  ];

  // Team patterns
  const teamPatterns = [
    /liverpool|lfc/g, /leeds/g, /arsenal|ars/g, /chelsea|cfc/g,
    /man city|manchester city|mci/g, /man united|manchester united|mnu/g,
    /tottenham|spurs|tot/g, /newcastle/g, /everton/g, /aston villa/g,
    /patriots/g, /chiefs/g, /eagles/g, /cowboys/g, /packers/g, /49ers/g,
    /lakers/g, /celtics/g, /warriors/g, /bulls/g, /heat/g, /nets/g,
  ];

  // Crypto patterns
  const cryptoPatterns = [
    /bitcoin|btc/g, /ethereum|eth/g, /solana|sol/g, /dogecoin|doge/g,
  ];

  // Check patterns
  const allPatterns = [...personPatterns, ...teamPatterns, ...cryptoPatterns];
  for (const pattern of allPatterns) {
    const matches = norm.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (!entities.includes(m)) entities.push(m);
      }
    }
  }

  // Extract any capitalized multi-word names from original title
  const namePattern = /[A-Z][a-z]+ [A-Z][a-z]+/g;
  const nameMatches = title.match(namePattern) || [];
  for (const nm of nameMatches) {
    const normalized = nm.toLowerCase();
    if (!entities.includes(normalized)) entities.push(normalized);
  }

  return entities;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return (inter / new Set([...a, ...b]).size) * 100;
}

function wordOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return (inter / Math.min(a.length, b.length)) * 100;
}

function detectCategory(t1: string, t2: string): string {
  const c = `${t1} ${t2}`.toLowerCase();
  if (/trump|biden|elect|vote|congress|senate|president|democrat|republican|nominate/.test(c)) return "politics";
  if (/bitcoin|btc|ethereum|eth|crypto|solana|sol/.test(c)) return "crypto";
  if (/nfl|nba|mlb|nhl|super bowl|epl|premier league|championship|game|team/.test(c)) return "sports";
  if (/interest rate|fed|inflation|gdp|stock|market/.test(c)) return "finance";
  return "general";
}

// Detect if two markets are INVERSE (opposite bets on same outcome)
// e.g., "Will Bitcoin DIP to $100k" vs "Will Bitcoin be ABOVE $100k"
function isInversePair(title1: string, title2: string): { isInverse: boolean; reason: string } {
  const t1 = title1.toLowerCase();
  const t2 = title2.toLowerCase();
  
  // Keywords indicating DOWN/negative direction
  const downKeywords = ['dip', 'drop', 'fall', 'below', 'under', 'crash', 'decline', 'decrease', 'down'];
  // Keywords indicating UP/positive direction
  const upKeywords = ['above', 'rise', 'reach', 'exceed', 'over', 'hit', 'break', 'surpass', 'up'];
  
  const t1HasDown = downKeywords.some(k => t1.includes(k));
  const t1HasUp = upKeywords.some(k => t1.includes(k));
  const t2HasDown = downKeywords.some(k => t2.includes(k));
  const t2HasUp = upKeywords.some(k => t2.includes(k));
  
  // If one title has UP keywords and the other has DOWN keywords, they're inverse
  if ((t1HasDown && t2HasUp) || (t1HasUp && t2HasDown)) {
    return { isInverse: true, reason: `Inverse: "${t1HasDown ? 'down' : 'up'}" vs "${t2HasDown ? 'down' : 'up'}" keywords` };
  }
  
  return { isInverse: false, reason: '' };
}

function pickPolyYesTokenId(m: PolymarketMarket): string {
  const a = m.side_a;
  const b = m.side_b;
  if (a?.id && a.label?.toLowerCase() === "yes") return a.id;
  if (b?.id && b.label?.toLowerCase() === "yes") return b.id;
  return a?.id || b?.id || "";
}

type DebugRow = {
  score: number;
  passed: boolean;
  polyTitle: string;
  kalshiTitle: string;
  polyNorm: string;
  kalshiNorm: string;
  polyEntities: string[];
  kalshiEntities: string[];
  entityMatch: boolean;
  entityMismatch: string[];
  isInverse: boolean;
  inverseReason: string;
  why: string;
};

function findMatches(
  polyMarkets: PolymarketMarket[],
  kalshiMarkets: KalshiMarket[],
  minScore: number,
  debug: boolean
): { matches: MatchedPair[]; attempts: number; topRows: DebugRow[] } {
  const matches: MatchedPair[] = [];
  const usedKalshi = new Set<string>();
  const topRows: DebugRow[] = [];
  let attempts = 0;

  const polyCandidates = polyMarkets.filter(p => Boolean((p.title || p.market_slug) && pickPolyYesTokenId(p)));
  const kalshiCandidates = kalshiMarkets.filter(k => Boolean(k.market_ticker && k.title));

  log(`Candidates: poly=${polyCandidates.length}, kalshi=${kalshiCandidates.length}`);

  for (const p of polyCandidates) {
    const polyTitle = p.title || "";
    const polyTokenId = pickPolyYesTokenId(p);
    const pTokens = tokenize(polyTitle);
    const pNorm = normalize(polyTitle);
    const pEntities = extractKeyEntities(polyTitle);

    let best: MatchedPair | null = null;
    let bestRow: DebugRow | null = null;

    for (const k of kalshiCandidates) {
      const ticker = k.market_ticker!;
      if (usedKalshi.has(ticker)) continue;

      const kalshiTitle = k.title || "";
      const kTokens = tokenize(kalshiTitle);
      const kNorm = normalize(kalshiTitle);
      const kEntities = extractKeyEntities(kalshiTitle);

      attempts++;

      const sim = jaccard(pTokens, kTokens);
      const overlap = wordOverlap(pTokens, kTokens);
      let score = Math.max(sim, overlap);

      // Entity matching: check if key entities match or mismatch
      const matchedEntities: string[] = [];
      const mismatchedEntities: string[] = [];

      // If both have entities, they MUST have at least one in common
      if (pEntities.length > 0 && kEntities.length > 0) {
        for (const pe of pEntities) {
          if (kEntities.some(ke => ke.includes(pe) || pe.includes(ke))) {
            matchedEntities.push(pe);
          }
        }
        // Check for mismatches (entities in one but not similar to any in other)
        for (const pe of pEntities) {
          if (!kEntities.some(ke => ke.includes(pe) || pe.includes(ke))) {
            mismatchedEntities.push(`poly:${pe}`);
          }
        }
        for (const ke of kEntities) {
          if (!pEntities.some(pe => pe.includes(ke) || ke.includes(pe))) {
            mismatchedEntities.push(`kalshi:${ke}`);
          }
        }

        // If no entities match but both have entities, reject
        if (matchedEntities.length === 0 && (pEntities.length > 0 || kEntities.length > 0)) {
          score = 0; // Force fail
        }
      }

      // Check for inverse pairs (opposite bets)
      const inverseCheck = isInversePair(polyTitle, kalshiTitle);

      const entityMatch = matchedEntities.length > 0 || (pEntities.length === 0 && kEntities.length === 0);
      // SKIP inverse pairs - they're opposite bets, not same market
      const passed = score >= minScore && entityMatch && !inverseCheck.isInverse;
      
      let why = '';
      if (inverseCheck.isInverse) {
        why = `SKIP INVERSE: ${inverseCheck.reason}`;
      } else if (passed) {
        why = `PASS: score=${score.toFixed(0)}, entities=${matchedEntities.join(",")}`;
      } else {
        why = `FAIL: score=${score.toFixed(0)}${!entityMatch ? ", entity mismatch" : ""}`;
      }

      const row: DebugRow = {
        score: Math.round(score),
        passed,
        polyTitle,
        kalshiTitle,
        polyNorm: pNorm,
        kalshiNorm: kNorm,
        polyEntities: pEntities,
        kalshiEntities: kEntities,
        entityMatch,
        entityMismatch: mismatchedEntities,
        isInverse: inverseCheck.isInverse,
        inverseReason: inverseCheck.reason,
        why,
      };

      // Keep top 20 for debug
      if (debug) {
        if (topRows.length < 20) {
          topRows.push(row);
          topRows.sort((a, b) => b.score - a.score);
        } else if (score > topRows[19].score) {
          topRows[19] = row;
          topRows.sort((a, b) => b.score - a.score);
        }
      }

      if (passed && (!best || score > best.score)) {
        best = {
          polymarket: p,
          kalshi: k,
          score: Math.round(score),
          reason: why,
          polyYesTokenId: polyTokenId,
          polyTitle,
          kalshiTitle,
          polyNorm: pNorm,
          kalshiNorm: kNorm,
          keyEntities: { poly: pEntities, kalshi: kEntities, matched: matchedEntities, mismatched: mismatchedEntities },
        };
        bestRow = row;
      }
    }

    if (best) {
      usedKalshi.add(best.kalshi.market_ticker!);
      matches.push(best);
      log(`MATCH ${best.score}%: "${best.polyTitle.slice(0, 50)}" <-> "${best.kalshiTitle.slice(0, 50)}"`);
    }
  }

  matches.sort((a, b) => b.score - a.score);
  log(`Matching complete: ${attempts} attempts, ${matches.length} matches`);
  return { matches, attempts, topRows };
}

// ============ Arbitrage ============

function calcSpread(buy: number, sell: number): number {
  return buy > 0 ? ((sell - buy) / buy) * 100 : 0;
}

function calcArb(pair: MatchedPair, polyOb: Orderbook, kalshiOb: Orderbook, dataAgeMinutes?: number): ArbOpportunity | null {
  const pBid = polyOb.bids[0];
  const pAsk = polyOb.asks[0];
  const kBid = kalshiOb.bids[0];
  const kAsk = kalshiOb.asks[0];

  const opps: ArbOpportunity[] = [];
  const title = pair.polyTitle || pair.kalshiTitle || "Unknown";
  const category = detectCategory(pair.polyTitle, pair.kalshiTitle);
  const expiresAt = pair.polymarket.end_time ? new Date(pair.polymarket.end_time * 1000).toISOString() : null;

  // Buy Kalshi, sell Poly
  if (kAsk && pBid && pBid.price > kAsk.price) {
    const buy = Math.round(kAsk.price * 100);
    const sell = Math.round(pBid.price * 100);
    const spread = calcSpread(buy, sell);
    opps.push({
      id: `${pair.kalshi.market_ticker}-${pair.polymarket.market_slug || pair.polymarket.condition_id}`,
      matchKey: pair.polymarket.market_slug || pair.polymarket.condition_id || "",
      eventTitle: title,
      category,
      spreadPercent: Number(spread.toFixed(2)),
      buyPlatform: "kalshi",
      sellPlatform: "polymarket",
      buyPrice: buy,
      sellPrice: sell,
      buyTicker: pair.kalshi.market_ticker || "",
      sellTicker: pair.polymarket.market_slug || pair.polymarket.condition_id || "",
      buyVolume: kAsk.size,
      sellVolume: pBid.size,
      estimatedProfit: Number(Math.max(0, spread - 2).toFixed(2)),
      expiresAt,
      updatedAt: Date.now(),
      matchScore: pair.score,
      matchReason: pair.reason,
      dataAgeMinutes,
    });
  }

  // Buy Poly, sell Kalshi
  if (pAsk && kBid && kBid.price > pAsk.price) {
    const buy = Math.round(pAsk.price * 100);
    const sell = Math.round(kBid.price * 100);
    const spread = calcSpread(buy, sell);
    opps.push({
      id: `${pair.polymarket.market_slug || pair.polymarket.condition_id}-${pair.kalshi.market_ticker}`,
      matchKey: pair.polymarket.market_slug || pair.polymarket.condition_id || "",
      eventTitle: title,
      category,
      spreadPercent: Number(spread.toFixed(2)),
      buyPlatform: "polymarket",
      sellPlatform: "kalshi",
      buyPrice: buy,
      sellPrice: sell,
      buyTicker: pair.polymarket.market_slug || pair.polymarket.condition_id || "",
      sellTicker: pair.kalshi.market_ticker || "",
      buyVolume: pAsk.size,
      sellVolume: kBid.size,
      estimatedProfit: Number(Math.max(0, spread - 2).toFixed(2)),
      expiresAt,
      updatedAt: Date.now(),
      matchScore: pair.score,
      matchReason: pair.reason,
      dataAgeMinutes,
    });
  }

  if (opps.length === 0) return null;
  return opps.sort((a, b) => b.spreadPercent - a.spreadPercent)[0];
}

// ============ Main ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  log("=== ARB SCANNER START ===");

  try {
    const apiKey = Deno.env.get("DOME_API_KEY") || "";
    if (!apiKey) {
      return new Response(JSON.stringify({ opportunities: [], error: "DOME_API_KEY missing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }

    const minSpread = parseFloat(String(body.minSpread ?? "1"));
    const minSimilarity = parseFloat(String(body.minSimilarity ?? "60"));
    const limit = Math.min(300, Math.max(1, parseInt(String(body.limit ?? "200"), 10)));
    const debug = Boolean(body.debug);
    const category = String(body.category ?? "all");

    log(`Params: limit=${limit}, minSpread=${minSpread}, minSimilarity=${minSimilarity}, category=${category}, debug=${debug}`);

    const [polyRes, kalshiRes] = await Promise.all([
      fetchPolymarketMarkets(apiKey, limit),
      fetchKalshiMarkets(apiKey, limit),
    ]);

    const samplePolyTitles = polyRes.markets.map(m => m.title).filter(Boolean).slice(0, 5);
    const sampleKalshiTitles = kalshiRes.markets.map(m => m.title).filter(Boolean).slice(0, 5);

    if (polyRes.markets.length === 0 || kalshiRes.markets.length === 0) {
      return new Response(JSON.stringify({
        opportunities: [],
        message: "Insufficient markets",
        stats: { polymarketCount: polyRes.markets.length, kalshiCount: kalshiRes.markets.length, matchedPairs: 0, opportunitiesFound: 0, elapsedMs: Date.now() - start },
        debug: debug ? { samplePolyTitles, sampleKalshiTitles, polyError: polyRes.error, kalshiError: kalshiRes.error } : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { matches, attempts, topRows } = findMatches(polyRes.markets, kalshiRes.markets, minSimilarity, debug);

    if (matches.length === 0) {
      return new Response(JSON.stringify({
        opportunities: [],
        message: "No matching markets found",
        stats: { polymarketCount: polyRes.markets.length, kalshiCount: kalshiRes.markets.length, matchedPairs: 0, comparisonAttempts: attempts, opportunitiesFound: 0, elapsedMs: Date.now() - start },
        debug: debug ? { samplePolyTitles, sampleKalshiTitles, comparisonAttempts: attempts, topMatches: topRows } : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch orderbooks
    const opportunities: ArbOpportunity[] = [];
    const orderbookErrors: { pair: string; polyUrl: string; polyError?: string; polyAgeMin?: number; kalshiUrl: string; kalshiError?: string; kalshiAgeMin?: number }[] = [];
    const spreadAnalysis: { pair: string; polyBid?: number; polyAsk?: number; kalshiBid?: number; kalshiAsk?: number; spread1?: number; spread2?: number; reason: string }[] = [];
    let obAttempted = 0;
    let obOk = 0;
    let noSpreadCount = 0;
    let belowMinSpreadCount = 0;

    const batchSize = 3;
    for (let i = 0; i < matches.length; i += batchSize) {
      const batch = matches.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (pair) => {
        const ticker = pair.kalshi.market_ticker || "";
        const tokenId = pair.polyYesTokenId;
        if (!ticker || !tokenId) return { opp: null, analysis: null };

        obAttempted++;
        const [polyResult, kalshiResult] = await Promise.all([
          fetchPolymarketOrderbook(tokenId, apiKey),
          fetchKalshiOrderbook(ticker, apiKey),
        ]);

        const pairName = `${pair.polyTitle.slice(0, 40)}`;
        if (!polyResult.ob || !kalshiResult.ob) {
          orderbookErrors.push({
            pair: pairName,
            polyUrl: polyResult.url,
            polyError: polyResult.error,
            polyAgeMin: polyResult.snapshotAgeMinutes,
            kalshiUrl: kalshiResult.url,
            kalshiError: kalshiResult.error,
            kalshiAgeMin: kalshiResult.snapshotAgeMinutes,
          });
          log(`OB FAIL: ${pairName} - Poly: ${polyResult.error || 'ok'}, Kalshi: ${kalshiResult.error || 'ok'}`);
          return { opp: null, analysis: { pair: pairName, reason: `OB fetch failed: Poly=${polyResult.error}, Kalshi=${kalshiResult.error}` } };
        }

        const maxAge = Math.max(polyResult.snapshotAgeMinutes || 0, kalshiResult.snapshotAgeMinutes || 0);
        log(`OB OK: ${pairName} - Poly age: ${polyResult.snapshotAgeMinutes}min, Kalshi age: ${kalshiResult.snapshotAgeMinutes}min`);
        obOk++;
        
        // Analyze the spread even if no arb
        const pBid = polyResult.ob.bids[0];
        const pAsk = polyResult.ob.asks[0];
        const kBid = kalshiResult.ob.bids[0];
        const kAsk = kalshiResult.ob.asks[0];
        
        const analysis: typeof spreadAnalysis[0] = {
          pair: pairName,
          polyBid: pBid ? Math.round(pBid.price * 100) : undefined,
          polyAsk: pAsk ? Math.round(pAsk.price * 100) : undefined,
          kalshiBid: kBid ? Math.round(kBid.price * 100) : undefined,
          kalshiAsk: kAsk ? Math.round(kAsk.price * 100) : undefined,
          reason: '',
        };
        
        // Check for arb opportunities
        let hasArb = false;
        if (kAsk && pBid && pBid.price > kAsk.price) {
          analysis.spread1 = Number((((pBid.price - kAsk.price) / kAsk.price) * 100).toFixed(2));
          hasArb = true;
        }
        if (pAsk && kBid && kBid.price > pAsk.price) {
          analysis.spread2 = Number((((kBid.price - pAsk.price) / pAsk.price) * 100).toFixed(2));
          hasArb = true;
        }
        
        if (!hasArb) {
          analysis.reason = 'No arb: prices not crossed';
          noSpreadCount++;
        } else {
          const maxSpread = Math.max(analysis.spread1 || 0, analysis.spread2 || 0);
          if (maxSpread < minSpread) {
            analysis.reason = `Spread ${maxSpread}% < min ${minSpread}%`;
            belowMinSpreadCount++;
          } else {
            analysis.reason = `ARB FOUND: ${maxSpread}%`;
          }
        }
        
        return { opp: calcArb(pair, polyResult.ob, kalshiResult.ob, maxAge), analysis };
      }));

      for (const { opp, analysis } of results) {
        if (analysis) spreadAnalysis.push(analysis);
        if (!opp) continue;
        if (opp.spreadPercent < minSpread) continue;
        if (category !== "all" && opp.category !== category) continue;
        opportunities.push(opp);
      }
    }

    opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);

    const elapsedMs = Date.now() - start;
    log(`Done: ${opportunities.length} opportunities (${matches.length} matched, ${obOk}/${obAttempted} orderbooks ok) in ${elapsedMs}ms`);

    return new Response(JSON.stringify({
      opportunities,
      count: opportunities.length,
      stats: {
        polymarketCount: polyRes.markets.length,
        kalshiCount: kalshiRes.markets.length,
        matchedPairs: matches.length,
        comparisonAttempts: attempts,
        orderbookPairsAttempted: obAttempted,
        orderbookPairsOk: obOk,
        noSpreadCount,
        belowMinSpreadCount,
        opportunitiesFound: opportunities.length,
        elapsedMs,
      },
      category,
      minSpread,
      timestamp: Date.now(),
      debug: debug ? {
        samplePolyTitles,
        sampleKalshiTitles,
        comparisonAttempts: attempts,
        topMatches: topRows,
        orderbookErrors: orderbookErrors.slice(0, 10),
        spreadAnalysis: spreadAnalysis.slice(0, 15),
      } : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`FATAL: ${msg}`);
    return new Response(JSON.stringify({ opportunities: [], error: msg, stats: { elapsedMs: Date.now() - start } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
