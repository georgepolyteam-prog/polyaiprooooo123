import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RelatedMarket {
  question: string;
  url: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  impact: "positive" | "negative" | "neutral";
  relatedMarkets: RelatedMarket[];
  polyAnalysis: string;
  url: string;
}

export const useNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-news", {
        body: {},
      });

      if (error) throw error;

      // Handle both old format (string[]) and new format (object[]) for relatedMarkets
      const formattedNews = (data.news || []).map((item: any) => ({
        ...item,
        relatedMarkets: Array.isArray(item.relatedMarkets) 
          ? item.relatedMarkets.map((m: any) => 
              typeof m === 'string' 
                ? { question: m, url: '#' } 
                : m
            )
          : [],
        polyAnalysis: item.polyAnalysis || item.veraAnalysis || "Analyzing market impact...",
      }));

      setNews(formattedNews);
      return formattedNews;
    } catch (error) {
      console.error("Error fetching news:", error);
      toast.error("Failed to fetch news");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    news,
    isLoading,
    fetchNews,
  };
};
