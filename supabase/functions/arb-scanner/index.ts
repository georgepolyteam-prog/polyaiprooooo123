import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DOME_API_URL = "https://api.domeapi.io/v1";

// Supported sports leagues (Dome matching-markets sports endpoint)
const SPORTS_LEAGUES = ["nfl", "nba", "mlb", "nhl", "cfb", "cbb"] as const;
type SportLeague = (typeof SPORTS_LEAGUES)[number];

// ============ Types ============

interface MatchedMarket {
  event_name: string;
  market_type: string;
  polymarket?: {
    market_slug: string;
    condition_id: string;
    token_id: string;
    title: string;
    outcome: string;
    price: number;
  };
  kalshi?: {
    ticker: string;
    title: string;
    outcome: string;
    price: number;
  };
}

interface OrderbookLevel {
  price: number;
  size: number;
}

interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
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
  sport?: string;
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

function extractArrayFromResponse(d: any): any[] {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.matches)) return d.matches;
  if (Array.isArray(d.data)) return d.data;
  if (Array.isArray(d.results)) return d.results;
  if (Array.isArray(d.items)) return d.items;
  return [];
}

function toNumber(x: any): number {
  const n = typeof x === "number" ? x : parseFloat(String(x ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeMatchedMarket(raw: any): MatchedMarket | null {
  if (!raw || typeof raw !== "object") return null;

  // The docs/implementations can vary; we normalize a few common shapes.
  const eventName =
    raw.event_name ??
    raw.eventName ??
    raw.event ??
    raw.game ??
    raw.matchup ??
    raw.title ??
    "";

  const marketType = raw.market_type ?? raw.marketType ?? raw.type ?? "";

  const polyRaw = raw.polymarket ?? raw.poly ?? raw.pm ?? raw.polymarket_market ?? raw.polymarketMarket;
  const kalshiRaw = raw.kalshi ?? raw.kal ?? raw.km ?? raw.kalshi_market ?? raw.kalshiMarket;

  const polymarket = polyRaw
    ? {
        market_slug: String(polyRaw.market_slug ?? polyRaw.slug ?? polyRaw.marketSlug ?? polyRaw.market ?? ""),
        condition_id: String(polyRaw.condition_id ?? polyRaw.conditionId ?? polyRaw.condition ?? ""),
        token_id: String(polyRaw.token_id ?? polyRaw.tokenId ?? polyRaw.yes_token_id ?? polyRaw.yesTokenId ?? polyRaw.token ?? ""),
        title: String(polyRaw.title ?? polyRaw.question ?? eventName ?? ""),
        outcome: String(polyRaw.outcome ?? polyRaw.side ?? polyRaw.selection ?? polyRaw.answer ?? ""),
        price: toNumber(polyRaw.price ?? polyRaw.last_price ?? polyRaw.lastPrice ?? 0),
      }
    : undefined;

  const kalshi = kalshiRaw
    ? {
        ticker: String(kalshiRaw.ticker ?? kalshiRaw.market_ticker ?? kalshiRaw.marketTicker ?? ""),
        title: String(kalshiRaw.title ?? kalshiRaw.question ?? eventName ?? ""),
        outcome: String(kalshiRaw.outcome ?? kalshiRaw.side ?? kalshiRaw.selection ?? kalshiRaw.answer ?? ""),
        price: toNumber(kalshiRaw.price ?? kalshiRaw.last_price ?? kalshiRaw.lastPrice ?? 0),
      }
    : undefined;

  return {
    event_name: String(eventName),
    market_type: String(marketType),
    polymarket,
    kalshi,
  };
}

// ============ Fetch Pre-Matched Sports Markets ============

type FetchDebug = {
  sport: string;
  urls: string[];
  responseKeys?: string[];
  rawCount?: number;
  normalizedCount?: number;
  validCount?: number;
};

async function fetchSportsMatches(
  sport: SportLeague,
  apiKey: string,
  opts: { date?: string; debug?: boolean } = {}
): Promise<{ matches: MatchedMarket[]; error?: string; fetchDebug?: FetchDebug }> {
  const targetDate = opts.date || new Date().toISOString().split("T")[0];
  const urls: string[] = [];

  // Primary: use date (as requested)
  const urlWithDate = `${DOME_API_URL}/matching-markets/sports/${sport}?date=${targetDate}`;
  urls.push(urlWithDate);

  log(`Fetching ${sport.toUpperCase()} matches for ${targetDate}`);

  try {
    const res1 = await domeGet(urlWithDate, apiKey);
    if (!res1.ok) {
      log(`${sport} fetch failed: ${res1.status}`, res1.text);
      return {
        matches: [],
        error: `${sport}: ${res1.status} - ${res1.text?.slice(0, 200)}`,
        fetchDebug: opts.debug
          ? {
              sport,
              urls,
            }
          : undefined,
      };
    }

    let raw = res1.data;
    let rawArr = extractArrayFromResponse(raw);

    // If empty, some implementations return upcoming matches when date is omitted.
    if (rawArr.length === 0 && !opts.date) {
      const urlNoDate = `${DOME_API_URL}/matching-markets/sports/${sport}`;
      urls.push(urlNoDate);
      log(`${sport.toUpperCase()}: 0 results for date=${targetDate}, retrying without date`);

      const res2 = await domeGet(urlNoDate, apiKey);
      if (res2.ok) {
        raw = res2.data;
        rawArr = extractArrayFromResponse(raw);
      }
    }

    const responseKeys = raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw) : undefined;

    const normalized = rawArr
      .map(normalizeMatchedMarket)
      .filter((m): m is MatchedMarket => Boolean(m));

    // Valid = both platforms and identifiers present
    const valid = normalized.filter((m) => {
      const tokenId = m.polymarket?.token_id;
      const ticker = m.kalshi?.ticker;
      return Boolean(m.polymarket && m.kalshi && tokenId && ticker);
    });

    // Dedupe by tokenId+ticker (in case of retry)
    const seen = new Set<string>();
    const deduped: MatchedMarket[] = [];
    for (const m of valid) {
      const key = `${m.polymarket!.token_id}::${m.kalshi!.ticker}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(m);
    }

    log(`${sport.toUpperCase()}: Found ${rawArr.length} raw, ${normalized.length} normalized, ${deduped.length} valid pairs`);

    return {
      matches: deduped,
      fetchDebug: opts.debug
        ? {
            sport,
            urls,
            responseKeys,
            rawCount: rawArr.length,
            normalizedCount: normalized.length,
            validCount: deduped.length,
          }
        : undefined,
    };
  } catch (e) {
    return {
      matches: [],
      error: String(e),
      fetchDebug: opts.debug
        ? {
            sport,
            urls,
          }
        : undefined,
    };
  }
}

async function fetchAllSportsMatches(
  sports: SportLeague[],
  apiKey: string,
  debug: boolean
): Promise<{ allMatches: Array<MatchedMarket & { sport: string }>; errors: string[]; sportCounts: Record<string, number>; fetchDebug: FetchDebug[] }> {
  const results = await Promise.all(
    sports.map(async (sport) => {
      const { matches, error, fetchDebug } = await fetchSportsMatches(sport, apiKey, { debug });
      return { sport, matches, error, fetchDebug };
    })
  );

  const allMatches: Array<MatchedMarket & { sport: string }> = [];
  const errors: string[] = [];
  const sportCounts: Record<string, number> = {};
  const fetchDebugRows: FetchDebug[] = [];

  for (const { sport, matches, error, fetchDebug } of results) {
    if (error) errors.push(error);
    sportCounts[sport] = matches.length;
    if (fetchDebug) fetchDebugRows.push(fetchDebug);

    for (const match of matches) {
      allMatches.push({ ...match, sport });
    }
  }

  log(`Total matched pairs from all sports: ${allMatches.length}`, sportCounts);

  return { allMatches, errors, sportCounts, fetchDebug: fetchDebugRows };
}

// ============ Orderbook Fetching ============

const ORDERBOOK_WINDOW_MS = 24 * 60 * 60 * 1000;
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

interface OrderbookResult {
  ob: Orderbook | null;
  url: string;
  error?: string;
  snapshotAgeMinutes?: number;
}

async function fetchPolymarketOrderbook(tokenId: string, apiKey: string): Promise<OrderbookResult> {
  const now = Date.now();
  const startTime = now - ORDERBOOK_WINDOW_MS;
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

    if (ageMs > STALE_THRESHOLD_MS) {
      return { ob: null, url, error: `Snapshot too old: ${ageMinutes} min`, snapshotAgeMinutes: ageMinutes };
    }

    const bids: OrderbookLevel[] = (snap.bids || []).map((b: any) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }));
    const asks: OrderbookLevel[] = (snap.asks || []).map((a: any) => ({ price: parseFloat(a.price), size: parseFloat(a.size) }));

    return { ob: { bids, asks }, url, snapshotAgeMinutes: ageMinutes };
  } catch (e) {
    return { ob: null, url, error: String(e) };
  }
}

async function fetchKalshiOrderbook(ticker: string, apiKey: string): Promise<OrderbookResult> {
  const now = Date.now();
  const startTime = now - ORDERBOOK_WINDOW_MS;
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

    if (ageMs > STALE_THRESHOLD_MS) {
      return { ob: null, url, error: `Snapshot too old: ${ageMinutes} min`, snapshotAgeMinutes: ageMinutes };
    }

    const orderbook = snap.orderbook || snap;
    const yesBids = orderbook.yes || [];
    const noBids = orderbook.no || [];

    const bids: OrderbookLevel[] = (orderbook.yes_dollars || yesBids)
      .map((level: any) => {
        if (Array.isArray(level)) return { price: parseFloat(level[0]), size: parseFloat(level[1]) };
        return { price: 0, size: 0 };
      })
      .filter((l: OrderbookLevel) => l.price > 0);

    const asks: OrderbookLevel[] = (orderbook.no_dollars || noBids)
      .map((level: any) => {
        if (Array.isArray(level)) return { price: 1 - parseFloat(level[0]), size: parseFloat(level[1]) };
        return { price: 0, size: 0 };
      })
      .filter((l: OrderbookLevel) => l.price > 0);

    return { ob: { bids, asks }, url, snapshotAgeMinutes: ageMinutes };
  } catch (e) {
    return { ob: null, url, error: String(e) };
  }
}

// ============ Arbitrage Calculation ============

function calcSpread(buy: number, sell: number): number {
  return buy > 0 ? ((sell - buy) / buy) * 100 : 0;
}

function calcArb(
  match: MatchedMarket & { sport: string },
  polyOb: Orderbook,
  kalshiOb: Orderbook,
  dataAgeMinutes?: number
): ArbOpportunity | null {
  const pBid = polyOb.bids[0];
  const pAsk = polyOb.asks[0];
  const kBid = kalshiOb.bids[0];
  const kAsk = kalshiOb.asks[0];

  const opps: ArbOpportunity[] = [];
  const title = match.event_name || match.polymarket?.title || match.kalshi?.title || "Unknown";

  // Buy Kalshi, sell Poly
  if (kAsk && pBid && pBid.price > kAsk.price) {
    const buy = Math.round(kAsk.price * 100);
    const sell = Math.round(pBid.price * 100);
    const spread = calcSpread(buy, sell);

    opps.push({
      id: `${match.kalshi!.ticker}-${match.polymarket!.market_slug}`,
      matchKey: match.polymarket!.market_slug,
      eventTitle: title,
      category: "sports",
      spreadPercent: Number(spread.toFixed(2)),
      buyPlatform: "kalshi",
      sellPlatform: "polymarket",
      buyPrice: buy,
      sellPrice: sell,
      buyTicker: match.kalshi!.ticker,
      sellTicker: match.polymarket!.market_slug,
      buyVolume: kAsk.size,
      sellVolume: pBid.size,
      estimatedProfit: Number(Math.max(0, spread - 2).toFixed(2)),
      expiresAt: null,
      updatedAt: Date.now(),
      matchScore: 100,
      matchReason: "Pre-matched by Dome API",
      dataAgeMinutes,
      sport: match.sport,
    });
  }

  // Buy Poly, sell Kalshi
  if (pAsk && kBid && kBid.price > pAsk.price) {
    const buy = Math.round(pAsk.price * 100);
    const sell = Math.round(kBid.price * 100);
    const spread = calcSpread(buy, sell);

    opps.push({
      id: `${match.polymarket!.market_slug}-${match.kalshi!.ticker}`,
      matchKey: match.polymarket!.market_slug,
      eventTitle: title,
      category: "sports",
      spreadPercent: Number(spread.toFixed(2)),
      buyPlatform: "polymarket",
      sellPlatform: "kalshi",
      buyPrice: buy,
      sellPrice: sell,
      buyTicker: match.polymarket!.market_slug,
      sellTicker: match.kalshi!.ticker,
      buyVolume: pAsk.size,
      sellVolume: kBid.size,
      estimatedProfit: Number(Math.max(0, spread - 2).toFixed(2)),
      expiresAt: null,
      updatedAt: Date.now(),
      matchScore: 100,
      matchReason: "Pre-matched by Dome API",
      dataAgeMinutes,
      sport: match.sport,
    });
  }

  if (opps.length === 0) return null;
  return opps.sort((a, b) => b.spreadPercent - a.spreadPercent)[0];
}

// ============ Main ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  log("=== ARB SCANNER (SPORTS) START ===");

  try {
    const apiKey = Deno.env.get("DOME_API_KEY") || "";
    if (!apiKey) {
      return new Response(JSON.stringify({ opportunities: [], error: "DOME_API_KEY missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const minSpread = parseFloat(String(body.minSpread ?? "1"));
    const debug = Boolean(body.debug);
    const requestedSport = String(body.category ?? "all").toLowerCase();

    let sportsToFetch: SportLeague[];
    if (requestedSport === "all" || requestedSport === "sports") {
      sportsToFetch = [...SPORTS_LEAGUES];
    } else if (SPORTS_LEAGUES.includes(requestedSport as SportLeague)) {
      sportsToFetch = [requestedSport as SportLeague];
    } else {
      sportsToFetch = [...SPORTS_LEAGUES];
    }

    log(`Params: minSpread=${minSpread}, sport=${requestedSport}, debug=${debug}`);
    log(`Fetching sports: ${sportsToFetch.join(", ")}`);

    const { allMatches, errors, sportCounts, fetchDebug } = await fetchAllSportsMatches(sportsToFetch, apiKey, debug);

    if (allMatches.length === 0) {
      return new Response(
        JSON.stringify({
          opportunities: [],
          message: "No matched sports markets found today",
          stats: {
            matchedPairs: 0,
            sportCounts,
            opportunitiesFound: 0,
            elapsedMs: Date.now() - start,
          },
          debug: debug
            ? {
                errors,
                sportCounts,
                fetchDebug,
              }
            : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const opportunities: ArbOpportunity[] = [];
    const orderbookErrors: { pair: string; polyError?: string; kalshiError?: string }[] = [];
    const spreadAnalysis: { pair: string; polyBid?: number; polyAsk?: number; kalshiBid?: number; kalshiAsk?: number; spread?: number; reason: string }[] = [];

    let obAttempted = 0;
    let obOk = 0;
    let noSpreadCount = 0;
    let belowMinSpreadCount = 0;

    const batchSize = 3;
    for (let i = 0; i < allMatches.length; i += batchSize) {
      const batch = allMatches.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (match) => {
          const tokenId = match.polymarket?.token_id;
          const ticker = match.kalshi?.ticker;

          const pairName = (match.event_name || match.polymarket?.title || match.kalshi?.title || "Unknown").slice(0, 60);

          if (!tokenId || !ticker) {
            return { opp: null, analysis: { pair: pairName, reason: "Missing token_id or ticker" } };
          }

          obAttempted++;

          const [polyResult, kalshiResult] = await Promise.all([fetchPolymarketOrderbook(tokenId, apiKey), fetchKalshiOrderbook(ticker, apiKey)]);

          if (!polyResult.ob || !kalshiResult.ob) {
            orderbookErrors.push({
              pair: pairName,
              polyError: polyResult.error,
              kalshiError: kalshiResult.error,
            });
            return { opp: null, analysis: { pair: pairName, reason: `OB fetch failed` } };
          }

          obOk++;
          const maxAge = Math.max(polyResult.snapshotAgeMinutes || 0, kalshiResult.snapshotAgeMinutes || 0);

          const pBid = polyResult.ob.bids[0];
          const pAsk = polyResult.ob.asks[0];
          const kBid = kalshiResult.ob.bids[0];
          const kAsk = kalshiResult.ob.asks[0];

          const analysis: (typeof spreadAnalysis)[0] = {
            pair: pairName,
            polyBid: pBid ? Math.round(pBid.price * 100) : undefined,
            polyAsk: pAsk ? Math.round(pAsk.price * 100) : undefined,
            kalshiBid: kBid ? Math.round(kBid.price * 100) : undefined,
            kalshiAsk: kAsk ? Math.round(kAsk.price * 100) : undefined,
            reason: "",
          };

          let hasArb = false;
          let bestSpread = 0;

          if (kAsk && pBid && pBid.price > kAsk.price) {
            bestSpread = Math.max(bestSpread, ((pBid.price - kAsk.price) / kAsk.price) * 100);
            hasArb = true;
          }
          if (pAsk && kBid && kBid.price > pAsk.price) {
            bestSpread = Math.max(bestSpread, ((kBid.price - pAsk.price) / pAsk.price) * 100);
            hasArb = true;
          }

          analysis.spread = Number(bestSpread.toFixed(2));

          if (!hasArb) {
            analysis.reason = "No arb: prices not crossed";
            noSpreadCount++;
          } else if (bestSpread < minSpread) {
            analysis.reason = `Spread ${bestSpread.toFixed(2)}% < min ${minSpread}%`;
            belowMinSpreadCount++;
          } else {
            analysis.reason = `ARB FOUND: ${bestSpread.toFixed(2)}%`;
          }

          return { opp: calcArb(match, polyResult.ob, kalshiResult.ob, maxAge), analysis };
        })
      );

      for (const { opp, analysis } of results) {
        if (analysis) spreadAnalysis.push(analysis);
        if (!opp) continue;
        if (opp.spreadPercent < minSpread) continue;
        opportunities.push(opp);
      }
    }

    opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);

    const elapsedMs = Date.now() - start;
    log(`Done: ${opportunities.length} opportunities (${allMatches.length} matched pairs, ${obOk}/${obAttempted} orderbooks ok) in ${elapsedMs}ms`);

    return new Response(
      JSON.stringify({
        opportunities,
        count: opportunities.length,
        stats: {
          matchedPairs: allMatches.length,
          sportCounts,
          orderbookPairsAttempted: obAttempted,
          orderbookPairsOk: obOk,
          noSpreadCount,
          belowMinSpreadCount,
          opportunitiesFound: opportunities.length,
          elapsedMs,
        },
        category: requestedSport,
        minSpread,
        timestamp: Date.now(),
        debug: debug
          ? {
              errors,
              sportCounts,
              fetchDebug,
              orderbookErrors: orderbookErrors.slice(0, 10),
              spreadAnalysis: spreadAnalysis.slice(0, 20),
              sampleMatches: allMatches.slice(0, 5).map((m) => ({
                event: m.event_name,
                sport: m.sport,
                polyTitle: m.polymarket?.title,
                kalshiTitle: m.kalshi?.title,
                tokenId: m.polymarket?.token_id,
                ticker: m.kalshi?.ticker,
              })),
            }
          : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`FATAL: ${msg}`);
    return new Response(JSON.stringify({ opportunities: [], error: msg, stats: { elapsedMs: Date.now() - start } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
