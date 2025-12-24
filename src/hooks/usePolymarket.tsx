import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Market {
  id: string;
  title: string;
  category: string;
  currentOdds: number;
  volume24h: number;
  liquidity?: number;
  endDate?: string;
  slug?: string;
}

export interface AnalyzedMarket extends Market {
  polyProbability: number;
  edge: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning?: string;
  recommendation: "BUY" | "SELL" | "PASS";
}

export interface MarketStats {
  totalChats: number;
  edgeOpportunities: number;
  totalVisitors: number;
}

export const usePolymarket = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [analyzedMarkets, setAnalyzedMarkets] = useState<AnalyzedMarket[]>([]);
  const [stats, setStats] = useState<MarketStats>({
    totalChats: 0,
    edgeOpportunities: 0,
    totalVisitors: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const fetchMarkets = useCallback(async (limit = 20) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("polymarket-data", {
        body: { action: "getMarkets", limit },
      });

      if (error) throw error;

      setMarkets(data.markets || []);
      return data.markets;
    } catch (error) {
      console.error("Error fetching markets:", error);
      toast.error("Failed to fetch markets from Polymarket");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      // Get cached markets with edge to count opportunities
      const { data: cachedMarkets } = await supabase
        .from("market_cache")
        .select("edge")
        .not("edge", "is", null);

      // Calculate opportunities (markets with >5% edge)
      const edgeOpportunities = cachedMarkets?.filter(m => Math.abs(m.edge || 0) >= 5).length || 0;

      // Fetch global stats from system_stats table (get the first row)
      const { data: systemStats } = await supabase
        .from("system_stats")
        .select("stats")
        .limit(1)
        .single();

      const globalStats = systemStats?.stats as { totalChats?: number; totalVisitors?: number } | null;
      const totalChats = globalStats?.totalChats || 847; // Fallback base number
      const totalVisitors = globalStats?.totalVisitors || 12470; // Fallback base number

      setStats({
        totalVisitors,
        edgeOpportunities,
        totalChats,
      });

      return { totalVisitors, edgeOpportunities, totalChats };
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Set fallback stats on error
      setStats({
        totalVisitors: 12470,
        edgeOpportunities: 0,
        totalChats: 847,
      });
    }
  }, []);

  // Function to increment chat count
  const incrementChatCount = useCallback(() => {
    const storedChats = localStorage.getItem("poly_chat_count");
    const current = storedChats ? parseInt(storedChats, 10) : 0;
    const newCount = current + 1;
    localStorage.setItem("poly_chat_count", newCount.toString());
    setStats(prev => ({ ...prev, totalChats: newCount }));
  }, []);

  const scanMarkets = useCallback(async (marketsToScan?: Market[]) => {
    setIsScanning(true);
    try {
      const toScan = marketsToScan || markets;
      
      if (toScan.length === 0) {
        const fetched = await fetchMarkets(20);
        if (fetched.length === 0) {
          throw new Error("No markets to scan");
        }
        
        const { data, error } = await supabase.functions.invoke("scan-markets", {
          body: { markets: fetched },
        });

        if (error) throw error;

        setAnalyzedMarkets(data.analyzedMarkets || []);
        
        const withEdge = (data.analyzedMarkets || []).filter(
          (m: AnalyzedMarket) => Math.abs(m.edge) >= 5
        );
        setStats((prev) => ({ ...prev, edgeOpportunities: withEdge.length }));
        
        toast.success(`Scanned ${data.analyzedMarkets?.length || 0} markets`);
        return data.analyzedMarkets;
      }

      const { data, error } = await supabase.functions.invoke("scan-markets", {
        body: { markets: toScan },
      });

      if (error) throw error;

      setAnalyzedMarkets(data.analyzedMarkets || []);
      
      const withEdge = (data.analyzedMarkets || []).filter(
        (m: AnalyzedMarket) => Math.abs(m.edge) >= 5
      );
      setStats((prev) => ({ ...prev, edgeOpportunities: withEdge.length }));
      
      toast.success(`Scanned ${data.analyzedMarkets?.length || 0} markets`);
      return data.analyzedMarkets;
    } catch (error) {
      console.error("Error scanning markets:", error);
      toast.error("Failed to scan markets");
      return [];
    } finally {
      setIsScanning(false);
    }
  }, [markets, fetchMarkets]);

  return {
    markets,
    analyzedMarkets,
    stats,
    isLoading,
    isScanning,
    fetchMarkets,
    fetchStats,
    scanMarkets,
    incrementChatCount,
  };
};
