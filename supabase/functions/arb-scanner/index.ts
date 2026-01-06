import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DOME_API_URL = "https://api.domeapi.io/v1";

// ============ Types (match real Dome payloads we see in logs) ============

type PolymarketSide = {
  id: string;
  label: string;
};

interface PolymarketMarket {
  market_slug?: string;
  title?: string;
  condition_id?: string;
  start_time?: number;
  end_time?: number;
  tags?: string[];
  side_a?: PolymarketSide; // { id, label }
  side_b?: PolymarketSide;
  status?: string;
}

interface KalshiMarket {
  event_ticker?: string;
  market_ticker?: string; // this is the one we need for orderbooks + dedupe
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
  score: number; // 0-100
  similarity: number;
  wordOverlap: number;
  reason: string;
  polyYesTokenId: string;
  polyTitle: string;
  kalshiTitle: string;
  polyNorm: string;
  kalshiNorm: string;
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
}

// ============ Logging Helper ============

function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${timestamp}] [arb-scanner] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] [arb-scanner] ${message}`);
  }
}

// ============ Fetch helpers (with pagination) ============

async function domeGetJson(url: string, apiKey: string): Promise<{ ok: boolean; status: number; data: any; text?: string }> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, data: null, text };
  }

  const data = await res.json();
  return { ok: true, status: res.status, data };
}

function extractMarketsArray(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.markets)) return payload.markets;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

async function fetchPolymarketMarkets(apiKey: string, targetLimit: number): Promise<{ markets: PolymarketMarket[]; error?: string } > {
  const markets: PolymarketMarket[] = [];
  const pageSize = Math.min(100, Math.max(1, targetLimit));

  let offset = 0;
  while (markets.length < targetLimit) {
    const url = `${DOME_API_URL}/polymarket/markets?status=open&limit=${pageSize}&offset=${offset}`;
    log(`Fetching Polymarket markets: ${url}`);

    try {
      const res = await domeGetJson(url, apiKey);
      log(`Polymarket markets status: ${res.status}`);
      if (!res.ok) {
        log(`Polymarket markets error body: ${res.text || ""}`);
        return { markets, error: `Polymarket markets ${res.status}` };
      }

      const arr = extractMarketsArray(res.data);
      if (arr.length === 0) break;

      markets.push(...arr);
      if (arr.length < pageSize) break;

      offset += arr.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`Polymarket markets fetch exception: ${msg}`);
      return { markets, error: msg };
    }
  }

  const sliced = markets.slice(0, targetLimit);
  log(`Polymarket markets fetched: ${sliced.length}`);
  if (sliced[0]) {
    log(`Polymarket sample keys: ${Object.keys(sliced[0] as any).join(",")}`);
    log(`Polymarket sample:`, sliced[0]);
  }
  return { markets: sliced };
}

async function fetchKalshiMarkets(apiKey: string, targetLimit: number): Promise<{ markets: KalshiMarket[]; error?: string } > {
  const markets: KalshiMarket[] = [];
  const pageSize = Math.min(100, Math.max(1, targetLimit));

  let offset = 0;
  while (markets.length < targetLimit) {
    const url = `${DOME_API_URL}/kalshi/markets?status=open&limit=${pageSize}&offset=${offset}`;
    log(`Fetching Kalshi markets: ${url}`);

    try {
      const res = await domeGetJson(url, apiKey);
      log(`Kalshi markets status: ${res.status}`);
      if (!res.ok) {
        log(`Kalshi markets error body: ${res.text || ""}`);
        return { markets, error: `Kalshi markets ${res.status}` };
      }

      const arr = extractMarketsArray(res.data);
      if (arr.length === 0) break;

      markets.push(...arr);
      if (arr.length < pageSize) break;

      offset += arr.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`Kalshi markets fetch exception: ${msg}`);
      return { markets, error: msg };
    }
  }

  const sliced = markets.slice(0, targetLimit);
  log(`Kalshi markets fetched: ${sliced.length}`);
  if (sliced[0]) {
    log(`Kalshi sample keys: ${Object.keys(sliced[0] as any).join(",")}`);
    log(`Kalshi sample:`, sliced[0]);
  }
  return { markets: sliced };
}

async function fetchPolymarketOrderbook(tokenId: string, apiKey: string): Promise<Orderbook | null> {
  try {
    const url = `${DOME_API_URL}/polymarket/orderbooks?token_id=${encodeURIComponent(tokenId)}`;
    const res = await domeGetJson(url, apiKey);
    if (!res.ok) {
      log(`Polymarket orderbook failed (${res.status}) token_id=${tokenId}`);
      return null;
    }

    const bids = Array.isArray(res.data?.bids) ? res.data.bids : [];
    const asks = Array.isArray(res.data?.asks) ? res.data.asks : [];
    return { bids, asks };
  } catch (e) {
    log(`Polymarket orderbook exception token_id=${tokenId}: ${String(e)}`);
    return null;
  }
}

async function fetchKalshiOrderbook(marketTicker: string, apiKey: string): Promise<Orderbook | null> {
  try {
    const url = `${DOME_API_URL}/kalshi/orderbooks?ticker=${encodeURIComponent(marketTicker)}`;
    const res = await domeGetJson(url, apiKey);
    if (!res.ok) {
      log(`Kalshi orderbook failed (${res.status}) ticker=${marketTicker}`);
      return null;
    }

    const bids = Array.isArray(res.data?.bids) ? res.data.bids : [];
    const asks = Array.isArray(res.data?.asks) ? res.data.asks : [];
    return { bids, asks };
  } catch (e) {
    log(`Kalshi orderbook exception ticker=${marketTicker}: ${String(e)}`);
    return null;
  }
}

// ============ Matching helpers ============

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const stop = new Set([
    "will",
    "the",
    "be",
    "a",
    "an",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "and",
    "or",
    "is",
    "it",
    "by",
    "with",
    "as",
    "this",
    "that",
    "after",
    "before",
    "during",
    "from",
  ]);

  return normalizeText(text)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !stop.has(t));
}

function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const a = new Set(tokensA);
  const b = new Set(tokensB);

  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;

  const union = new Set([...a, ...b]).size;
  return (intersection / union) * 100;
}

function wordOverlapPercent(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const a = new Set(tokensA);
  const b = new Set(tokensB);

  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;

  const denom = Math.min(a.size, b.size) || 1;
  return (intersection / denom) * 100;
}

function detectCategory(polyTitle: string, kalshiTitle: string): string {
  const combined = `${polyTitle} ${kalshiTitle}`.toLowerCase();

  if (/trump|biden|elect|vote|congress|senate|president|democrat|republican/.test(combined)) return "politics";
  if (/bitcoin|btc|ethereum|eth|crypto|solana|sol/.test(combined)) return "crypto";
  if (/nfl|nba|mlb|nhl|super bowl|world series|championship|game|team/.test(combined)) return "sports";
  if (/interest rate|fed|inflation|gdp|stock|market/.test(combined)) return "finance";
  return "general";
}

function pickPolymarketYesTokenId(m: PolymarketMarket): string {
  // Based on actual payload: side_a.label="Yes" with id being token_id
  const a = m.side_a;
  const b = m.side_b;

  if (a?.id && a.label?.toLowerCase() === "yes") return a.id;
  if (b?.id && b.label?.toLowerCase() === "yes") return b.id;

  // fallback: still return side_a.id if exists (common)
  if (a?.id) return a.id;
  if (b?.id) return b.id;
  return "";
}

type ComparisonDebugRow = {
  score: number;
  similarity: number;
  wordOverlap: number;
  passed: boolean;
  polyTitle: string;
  kalshiTitle: string;
  polyNorm: string;
  kalshiNorm: string;
  why: string;
};

function pushTopComparisons(top: ComparisonDebugRow[], row: ComparisonDebugRow, limit: number) {
  if (top.length < limit) {
    top.push(row);
    top.sort((a, b) => b.score - a.score);
    return;
  }
  if (row.score <= top[top.length - 1].score) return;
  top[top.length - 1] = row;
  top.sort((a, b) => b.score - a.score);
}

function findMatchingMarkets(
  polyMarkets: PolymarketMarket[],
  kalshiMarkets: KalshiMarket[],
  minScore: number,
  debug: boolean
): { matches: MatchedPair[]; comparisonAttempts: number; topComparisons: ComparisonDebugRow[] } {
  const matches: MatchedPair[] = [];
  const usedKalshi = new Set<string>();

  const topComparisons: ComparisonDebugRow[] = [];
  let comparisonAttempts = 0;

  log(`Matching: ${polyMarkets.length} Polymarket x ${kalshiMarkets.length} Kalshi`);

  // Pre-filter: only Kalshi with market_ticker + title
  const kalshiCandidates = kalshiMarkets.filter((k) => Boolean(k.market_ticker && k.title));
  const polyCandidates = polyMarkets.filter((p) => Boolean((p.title || p.market_slug) && pickPolymarketYesTokenId(p)));

  log(`Candidates: poly=${polyCandidates.length}, kalshi=${kalshiCandidates.length}`);

  for (const p of polyCandidates) {
    const polyTitle = p.title || "";
    const polyYesTokenId = pickPolymarketYesTokenId(p);

    const pTokens = tokenize(polyTitle);
    const pNorm = normalizeText(polyTitle);

    let best: MatchedPair | null = null;

    for (const k of kalshiCandidates) {
      const kalshiTicker = k.market_ticker!;
      if (usedKalshi.has(kalshiTicker)) continue;

      const kalshiTitle = k.title || "";
      const kTokens = tokenize(kalshiTitle);
      const kNorm = normalizeText(kalshiTitle);

      comparisonAttempts++;

      const similarity = jaccardSimilarity(pTokens, kTokens);
      const overlap = wordOverlapPercent(pTokens, kTokens);
      const score = Math.max(similarity, overlap);

      const passed = score >= minScore;
      const why = passed
        ? `pass: score=${score.toFixed(1)} (sim=${similarity.toFixed(1)}, overlap=${overlap.toFixed(1)})`
        : `fail: score=${score.toFixed(1)} < ${minScore}`;

      if (debug) {
        pushTopComparisons(
          topComparisons,
          {
            score: Number(score.toFixed(2)),
            similarity: Number(similarity.toFixed(2)),
            wordOverlap: Number(overlap.toFixed(2)),
            passed,
            polyTitle,
            kalshiTitle,
            polyNorm: pNorm,
            kalshiNorm: kNorm,
            why,
          },
          20
        );
      }

      if (passed && (!best || score > best.score)) {
        best = {
          polymarket: p,
          kalshi: k,
          score: Number(score.toFixed(2)),
          similarity: Number(similarity.toFixed(2)),
          wordOverlap: Number(overlap.toFixed(2)),
          reason: `score=${score.toFixed(0)} (sim=${similarity.toFixed(0)}, overlap=${overlap.toFixed(0)})`,
          polyYesTokenId,
          polyTitle,
          kalshiTitle,
          polyNorm: pNorm,
          kalshiNorm: kNorm,
        };
      }
    }

    if (best) {
      usedKalshi.add(best.kalshi.market_ticker!);
      matches.push(best);
      log(`MATCH: ${best.score.toFixed(1)}% :: "${best.polyTitle.slice(0, 60)}" <-> "${best.kalshiTitle.slice(0, 60)}"`);
    }
  }

  log(`comparisonAttempts=${comparisonAttempts}, matches=${matches.length}`);

  matches.sort((a, b) => b.score - a.score);
  return { matches, comparisonAttempts, topComparisons };
}

// ============ Arbitrage calculation ============

function calcSpread(buyCents: number, sellCents: number): number {
  if (buyCents <= 0) return 0;
  return ((sellCents - buyCents) / buyCents) * 100;
}

function calculateArbitrage(pair: MatchedPair, polyOb: Orderbook, kalshiOb: Orderbook): ArbOpportunity | null {
  const polyBestBid = polyOb.bids[0];
  const polyBestAsk = polyOb.asks[0];
  const kalshiBestBid = kalshiOb.bids[0];
  const kalshiBestAsk = kalshiOb.asks[0];

  if (!polyBestBid && !polyBestAsk && !kalshiBestBid && !kalshiBestAsk) return null;

  const opportunities: ArbOpportunity[] = [];
  const eventTitle = pair.polyTitle || pair.kalshiTitle || "Unknown";
  const expiresAt = pair.polymarket.end_time ? new Date(pair.polymarket.end_time * 1000).toISOString() : (pair.kalshi.end_time ? new Date(pair.kalshi.end_time * 1000).toISOString() : null);
  const category = detectCategory(pair.polyTitle, pair.kalshiTitle);

  // Buy Kalshi ask, sell Polymarket bid
  if (kalshiBestAsk && polyBestBid) {
    const buyPrice = Math.round(kalshiBestAsk.price * 100);
    const sellPrice = Math.round(polyBestBid.price * 100);
    if (sellPrice > buyPrice) {
      const spread = calcSpread(buyPrice, sellPrice);
      opportunities.push({
        id: `${pair.kalshi.market_ticker}-${pair.polymarket.market_slug || pair.polymarket.condition_id}`,
        matchKey: pair.polymarket.market_slug || pair.polymarket.condition_id || pair.kalshi.market_ticker || "",
        eventTitle,
        category,
        spreadPercent: Number(spread.toFixed(2)),
        buyPlatform: "kalshi",
        sellPlatform: "polymarket",
        buyPrice,
        sellPrice,
        buyTicker: pair.kalshi.market_ticker || "",
        sellTicker: pair.polymarket.market_slug || pair.polymarket.condition_id || "",
        buyVolume: kalshiBestAsk.size,
        sellVolume: polyBestBid.size,
        estimatedProfit: Number(Math.max(0, spread - 2).toFixed(2)),
        expiresAt,
        updatedAt: Date.now(),
        matchScore: Math.round(pair.score),
        matchReason: pair.reason,
      });
    }
  }

  // Buy Polymarket ask, sell Kalshi bid
  if (polyBestAsk && kalshiBestBid) {
    const buyPrice = Math.round(polyBestAsk.price * 100);
    const sellPrice = Math.round(kalshiBestBid.price * 100);
    if (sellPrice > buyPrice) {
      const spread = calcSpread(buyPrice, sellPrice);
      opportunities.push({
        id: `${pair.polymarket.market_slug || pair.polymarket.condition_id}-${pair.kalshi.market_ticker}`,
        matchKey: pair.polymarket.market_slug || pair.polymarket.condition_id || pair.kalshi.market_ticker || "",
        eventTitle,
        category,
        spreadPercent: Number(spread.toFixed(2)),
        buyPlatform: "polymarket",
        sellPlatform: "kalshi",
        buyPrice,
        sellPrice,
        buyTicker: pair.polymarket.market_slug || pair.polymarket.condition_id || "",
        sellTicker: pair.kalshi.market_ticker || "",
        buyVolume: polyBestAsk.size,
        sellVolume: kalshiBestBid.size,
        estimatedProfit: Number(Math.max(0, spread - 2).toFixed(2)),
        expiresAt,
        updatedAt: Date.now(),
        matchScore: Math.round(pair.score),
        matchReason: pair.reason,
      });
    }
  }

  if (opportunities.length === 0) return null;
  opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
  return opportunities[0];
}

// ============ Main handler ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  log("=== ARB SCANNER START ===");

  // IMPORTANT: never throw 500; always return empty opportunities on failure
  try {
    const apiKey = Deno.env.get("DOME_API_KEY") || "";
    if (!apiKey) {
      log("Missing DOME_API_KEY");
      return new Response(
        JSON.stringify({ opportunities: [], error: "DOME_API_KEY missing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const minSpread = Number.parseFloat(String(body.minSpread ?? "1"));
    const minSimilarity = Number.parseFloat(String(body.minSimilarity ?? "60"));
    const limit = Math.max(1, Math.min(500, Number.parseInt(String(body.limit ?? "100"), 10) || 100));
    const debug = Boolean(body.debug);
    const category = String(body.category ?? "all");

    log(`Params: limit=${limit}, minSpread=${minSpread}, minSimilarity=${minSimilarity}, category=${category}, debug=${debug}`);

    // 1) Fetch markets
    const [polyRes, kalshiRes] = await Promise.all([
      fetchPolymarketMarkets(apiKey, limit),
      fetchKalshiMarkets(apiKey, limit),
    ]);

    const samplePolymarketTitles = polyRes.markets
      .map((m) => m.title)
      .filter(Boolean)
      .slice(0, 5);

    const sampleKalshiTitles = kalshiRes.markets
      .map((m) => m.title)
      .filter(Boolean)
      .slice(0, 5);

    log(`Fetched markets: polymarket=${polyRes.markets.length}, kalshi=${kalshiRes.markets.length}`);

    if (polyRes.markets.length === 0 || kalshiRes.markets.length === 0) {
      return new Response(
        JSON.stringify({
          opportunities: [],
          message: "Insufficient markets from one or both platforms",
          stats: {
            polymarketCount: polyRes.markets.length,
            kalshiCount: kalshiRes.markets.length,
            matchedPairs: 0,
            opportunitiesFound: 0,
            elapsedMs: Date.now() - start,
          },
          debug: debug
            ? {
                samplePolymarketTitles,
                sampleKalshiTitles,
                polymarketError: polyRes.error || null,
                kalshiError: kalshiRes.error || null,
              }
            : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Match
    const { matches, comparisonAttempts, topComparisons } = findMatchingMarkets(
      polyRes.markets,
      kalshiRes.markets,
      minSimilarity,
      debug
    );

    const topMatches = debug
      ? topComparisons.slice(0, 20)
      : undefined;

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({
          opportunities: [],
          message: "No matching markets found between platforms",
          stats: {
            polymarketCount: polyRes.markets.length,
            kalshiCount: kalshiRes.markets.length,
            matchedPairs: 0,
            opportunitiesFound: 0,
            elapsedMs: Date.now() - start,
          },
          debug: debug
            ? {
                samplePolymarketTitles,
                sampleKalshiTitles,
                comparisonAttempts,
                topMatches,
                note: "topMatches includes top 20 comparison attempts even if below threshold",
              }
            : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Fetch orderbooks & compute spreads (batch)
    const opportunities: ArbOpportunity[] = [];
    let orderbookPairsAttempted = 0;
    let orderbookPairsOk = 0;

    const batchSize = 5;
    for (let i = 0; i < matches.length; i += batchSize) {
      const batch = matches.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (pair) => {
          const kalshiTicker = pair.kalshi.market_ticker || "";
          const polyTokenId = pair.polyYesTokenId;

          if (!kalshiTicker || !polyTokenId) return null;

          orderbookPairsAttempted++;

          const [polyOb, kalshiOb] = await Promise.all([
            fetchPolymarketOrderbook(polyTokenId, apiKey),
            fetchKalshiOrderbook(kalshiTicker, apiKey),
          ]);

          if (!polyOb || !kalshiOb) return null;
          orderbookPairsOk++;

          return calculateArbitrage(pair, polyOb, kalshiOb);
        })
      );

      for (const opp of results) {
        if (!opp) continue;
        if (opp.spreadPercent < minSpread) continue;
        if (category !== "all" && opp.category !== category) continue;
        opportunities.push(opp);
      }
    }

    opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);

    const elapsedMs = Date.now() - start;
    log(`Done: opportunities=${opportunities.length} (matchedPairs=${matches.length}) in ${elapsedMs}ms`);

    return new Response(
      JSON.stringify({
        opportunities,
        count: opportunities.length,
        stats: {
          polymarketCount: polyRes.markets.length,
          kalshiCount: kalshiRes.markets.length,
          matchedPairs: matches.length,
          opportunitiesFound: opportunities.length,
          comparisonAttempts,
          orderbookPairsAttempted,
          orderbookPairsOk,
          elapsedMs,
        },
        category,
        minSpread,
        timestamp: Date.now(),
        debug: debug
          ? {
              samplePolymarketTitles,
              sampleKalshiTitles,
              comparisonAttempts,
              topMatches,
            }
          : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`FATAL (caught): ${msg}`);
    return new Response(
      JSON.stringify({
        opportunities: [],
        error: msg,
        stats: {
          polymarketCount: 0,
          kalshiCount: 0,
          matchedPairs: 0,
          opportunitiesFound: 0,
          elapsedMs: Date.now() - start,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
