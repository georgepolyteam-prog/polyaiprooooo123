import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

interface PolyMarketNewsProps {
  market: PolyMarket;
  compact?: boolean;
}

export function PolyMarketNews({ market, compact = false }: PolyMarketNewsProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-news', {
        body: {
          query: market.title || market.question,
          limit: compact ? 3 : 5,
        },
      });

      if (fnError) throw fnError;
      
      if (data?.articles && data.articles.length > 0) {
        setNews(data.articles);
      } else {
        setNews([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch news:', err);
      setError('Unable to load news');
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [market.id]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-muted/30 border border-border/50',
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Related News</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchNews}
          disabled={loading}
          className="h-7 w-7"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(compact ? 2 : 3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-muted rounded w-3/4 mb-1.5" />
              <div className="h-2 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-4 text-center">
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
      ) : news.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <Newspaper className="w-6 h-6 text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground">No recent news found</p>
        </div>
      ) : (
        <ScrollArea className={compact ? 'max-h-[140px]' : 'max-h-[200px]'}>
          <div className="space-y-2.5">
            {news.map((item, idx) => (
              <a
                key={idx}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{item.source}</span>
                      <span className="text-[10px] text-muted-foreground/50">•</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(item.publishedAt)}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-0.5" />
                </div>
              </a>
            ))}
          </div>
        </ScrollArea>
      )}
    </motion.div>
  );
}
