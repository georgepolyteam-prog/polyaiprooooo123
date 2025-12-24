import { supabase } from "@/integrations/supabase/client";

export type TradeableMarketData = {
  title: string;
  currentPrice: number; // 0-1
  url: string;
  yesTokenId?: string;
  noTokenId?: string;
  conditionId?: string;
  eventSlug?: string;
  marketSlug?: string;
};

export type FetchTradeableMarketDataResult =
  | { ok: true; data: TradeableMarketData }
  | { ok: false; reason: "needs_market_selection" | "invalid" | "error"; message: string };

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function extractSlugsFromPolymarketUrl(url: string): { eventSlug?: string; marketSlug?: string } {
  try {
    const u = new URL(normalizeUrl(url));
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "event" && parts[1]) {
      return { eventSlug: parts[1], marketSlug: parts[2] };
    }
    return {};
  } catch {
    return {};
  }
}

function toProbability(odds: number): number {
  // Some endpoints return 0-1, others return 0-100. Normalize to 0-1.
  const prob = odds > 1.5 ? odds / 100 : odds;
  return Math.max(0.01, Math.min(0.99, prob));
}

export async function fetchTradeableMarketData(marketUrl: string): Promise<FetchTradeableMarketDataResult> {
  const url = normalizeUrl(marketUrl);

  try {
    const { data, error } = await supabase.functions.invoke("market-dashboard", {
      body: { marketUrl: url },
    });

    if (error) {
      return { ok: false, reason: "error", message: error.message || "Failed to load market" };
    }

    if (!data) {
      return { ok: false, reason: "error", message: "No market data returned" };
    }

    if (data.needsMarketSelection) {
      return {
        ok: false,
        reason: "needs_market_selection",
        message: data.message || "This event has multiple markets. Please select a specific market first.",
      };
    }

    if (!data.market?.question || !data.market?.url) {
      return { ok: false, reason: "invalid", message: "Invalid market data" };
    }

    const { eventSlug, marketSlug } = extractSlugsFromPolymarketUrl(data.market.url || url);

    return {
      ok: true,
      data: {
        title: data.market.question,
        currentPrice: toProbability(Number(data.market.odds)),
        url: data.market.url,
        yesTokenId: data.market.tokenId,
        noTokenId: data.market.noTokenId,
        conditionId: data.market.conditionId,
        eventSlug,
        marketSlug,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load market";
    return { ok: false, reason: "error", message: msg };
  }
}
