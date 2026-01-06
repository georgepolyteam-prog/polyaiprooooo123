import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, RefreshCw, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface NewsArticle {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
  published?: string;
}

interface PolyMarketNewsProps {
  market: PolyMarket;
  compact?: boolean;
}

export function PolyMarketNews({ market, compact = false }: PolyMarketNewsProps) {
  const { session } = useAuth();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    setAiSummary(null);
    
    try {
      // Use poly-chat to get news with AI summary
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poly-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `Show me the most recent news articles (last 7 days) about "${market.title}". Focus on factual news that could impact this market. Be concise.`
              }
            ],
            currentMarket: {
              slug: market.slug,
              url: market.marketUrl,
              question: market.title
            },
            detailMode: 'quick',
            authToken: session?.access_token || null,
            conversationId: `news-${market.id}-${Date.now()}`
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      // Handle streaming response - read text
      const text = await response.text();
      
      // Parse sources from the response if available
      const sourcesMatch = text.match(/Sources?:?\s*([\s\S]*?)$/i);
      const parsedArticles: NewsArticle[] = [];
      
      if (sourcesMatch) {
        const sourcesText = sourcesMatch[1];
        const urlMatches = sourcesText.matchAll(/\d+\.\s*(?:\[([^\]]+)\]\()?([^)\s]+)\)?/g);
        
        for (const match of urlMatches) {
          const title = match[1] || '';
          const url = match[2];
          
          if (url && url.startsWith('http')) {
            try {
              const domain = new URL(url).hostname.replace('www.', '');
              parsedArticles.push({
                title: title || domain,
                url: url,
                source: domain,
              });
            } catch {
              // Skip invalid URLs
            }
          }
        }
      }
      
      // Set the AI summary (without sources section)
      const summaryContent = text
        .replace(/Sources?:?\s*[\s\S]*$/i, '')
        .trim();
      
      if (summaryContent) {
        setAiSummary(summaryContent);
      }
      
      setArticles(parsedArticles);
    } catch (err: any) {
      console.error('Failed to fetch news:', err);
      setError('Unable to load news');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (market?.id) {
      fetchNews();
    }
  }, [market?.id]);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'h-full flex flex-col rounded-2xl bg-gradient-to-b from-card/80 to-card/60 border border-border/50 backdrop-blur-xl shadow-xl shadow-black/5',
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Newspaper className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Market News</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchNews}
          disabled={loading}
          className="h-8 w-8"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
            <span className="text-xs text-muted-foreground">Fetching news...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="w-6 h-6 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNews}
              className="mt-2 h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : !aiSummary && articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Newspaper className="w-6 h-6 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">No recent news found</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Check back later for updates</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* AI Summary */}
            {aiSummary && (
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <p className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {aiSummary}
                </p>
              </div>
            )}

            {/* Source Articles */}
            {articles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sources</p>
                {articles.map((article, idx) => (
                  <a
                    key={idx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2.5 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </p>
                        {article.snippet && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                            {article.snippet}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-muted-foreground font-medium">{article.source}</span>
                          {article.published && (
                            <>
                              <span className="text-[9px] text-muted-foreground/50">•</span>
                              <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {formatTime(article.published)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
}