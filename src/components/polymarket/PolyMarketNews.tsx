import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, RefreshCw, Clock, AlertCircle, Loader2, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
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

// Markdown formatting for news summary - same as PolyMarketChat
const formatInlineText = (text: string): React.ReactNode => {
  const boldRegex = /\*\*(.*?)\*\*/g;
  const tempText = text.replace(boldRegex, (_, content) => `<<<BOLD_START>>>${content}<<<BOLD_END>>>`);
  const parts = tempText.split(/(<<<BOLD_START>>>.*?<<<BOLD_END>>>)/);

  return parts.map((part, idx) => {
    if (part.startsWith("<<<BOLD_START>>>") && part.endsWith("<<<BOLD_END>>>")) {
      const content = part.slice(16, -14);
      return <strong key={idx} className="font-semibold text-foreground">{content}</strong>;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(part)) {
      const urlParts = part.split(urlRegex);
      return urlParts.map((urlPart, i) => {
        if (/(https?:\/\/[^\s]+)/.test(urlPart)) {
          return (
            <a
              key={`${idx}-${i}`}
              href={urlPart}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {urlPart}
            </a>
          );
        }
        return urlPart;
      });
    }

    return part;
  });
};

const formatText = (text: string) => {
  const lines = text.split("\n");

  return lines.map((line, index) => {
    const trimmedLine = line.trim();
    
    // Empty line
    if (trimmedLine === "") return <div key={index} className="h-1" />;
    
    // Horizontal rule: --- or ___
    if (/^[-_]{3,}$/.test(trimmedLine)) {
      return <hr key={index} className="my-2 border-border/30" />;
    }
    
    // Main header: # Title (single hash)
    if (/^#\s+/.test(trimmedLine) && !trimmedLine.startsWith("##")) {
      const headerText = trimmedLine.replace(/^#\s+/, '');
      return (
        <h1 key={index} className="text-sm font-bold text-foreground mt-3 mb-1.5 first:mt-0">
          {formatInlineText(headerText)}
        </h1>
      );
    }
    
    // Secondary header: ## Title
    if (trimmedLine.startsWith("## ")) {
      const headerText = trimmedLine.slice(3);
      return (
        <h2 key={index} className="text-xs font-bold text-foreground mt-2.5 mb-1 first:mt-0">
          {formatInlineText(headerText)}
        </h2>
      );
    }
    
    // Sub header: ### Subtitle
    if (trimmedLine.startsWith("### ")) {
      const headerText = trimmedLine.slice(4);
      return (
        <h3 key={index} className="text-[11px] font-semibold text-foreground mt-2 mb-0.5 border-l-2 border-primary/50 pl-1.5">
          {formatInlineText(headerText)}
        </h3>
      );
    }
    
    // Sub-sub header: #### Subtitle
    if (trimmedLine.startsWith("#### ")) {
      const headerText = trimmedLine.slice(5);
      return (
        <h4 key={index} className="text-[10px] font-semibold text-foreground/90 mt-1.5 mb-0.5">
          {formatInlineText(headerText)}
        </h4>
      );
    }
    
    // Key-value bold line: **Label:** Value
    if (trimmedLine.startsWith("**") && trimmedLine.includes(":**")) {
      return (
        <div key={index} className="py-0.5 px-1.5 my-0.5 rounded bg-muted/40 text-[10px]">
          {formatInlineText(trimmedLine)}
        </div>
      );
    }
    
    // Bullet points: • - *
    if (trimmedLine.startsWith("• ") || trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      const bulletContent = trimmedLine.slice(2);
      return (
        <div key={index} className="flex gap-1.5 ml-1.5 my-0.5">
          <span className="text-primary mt-0.5 text-[9px]">•</span>
          <span className="text-foreground/90 text-[10px] leading-relaxed">{formatInlineText(bulletContent)}</span>
        </div>
      );
    }
    
    // Numbered lists: 1. 2. etc
    const numberMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
    if (numberMatch) {
      return (
        <div key={index} className="flex gap-1.5 ml-1.5 my-0.5">
          <span className="text-primary/70 font-medium min-w-[0.8rem] text-[10px]">{numberMatch[1]}.</span>
          <span className="text-foreground/90 text-[10px] leading-relaxed">{formatInlineText(numberMatch[2])}</span>
        </div>
      );
    }
    
    // [DONE] tag cleanup
    if (trimmedLine === '[DONE]') {
      return null;
    }

    // Regular paragraph
    return (
      <p key={index} className="text-foreground/90 my-0.5 leading-relaxed text-[10px]">
        {formatInlineText(trimmedLine)}
      </p>
    );
  });
};

export function PolyMarketNews({ market, compact = false }: PolyMarketNewsProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const isAuthenticated = !!session?.access_token;

  const fetchNews = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token) {
      setError('Please sign in to fetch news');
      return;
    }

    setLoading(true);
    setError(null);
    setAiSummary(null);
    setArticles([]);
    
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
                content: `Find the most recent news articles (last 7 days) about "${market.title}". Focus on factual news. List the key headlines and sources.`
              }
            ],
            currentMarket: {
              slug: market.slug,
              url: market.marketUrl,
              question: market.title
            },
            detailMode: 'quick',
            authToken: session.access_token,
            conversationId: `news-${market.id}-${Date.now()}`
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      // Handle streaming response - accumulate full text
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE data chunks
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices?.[0]?.delta?.content) {
                  fullText += data.choices[0].delta.content;
                }
              } catch {
                // Non-JSON line, might be raw text
                fullText += line.slice(6);
              }
            }
          }
        }
      }
      
      // Clean up the response text
      let cleanText = fullText
        .replace(/^data:\s*\{.*?\}\s*/gm, '') // Remove JSON prefixes
        .replace(/\{"choices":\[.*?\]\}/g, '') // Remove JSON wrappers
        .trim();

      // Parse sources from the response if available
      const sourcesMatch = cleanText.match(/Sources?:?\s*([\s\S]*?)$/i);
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
      const summaryContent = cleanText
        .replace(/Sources?:?\s*[\s\S]*$/i, '')
        .trim();
      
      if (summaryContent) {
        setAiSummary(summaryContent);
      }
      
      setArticles(parsedArticles);
      setHasFetched(true);
    } catch (err: any) {
      console.error('Failed to fetch news:', err);
      setError('Unable to load news');
    } finally {
      setLoading(false);
    }
  }, [market?.id, market?.title, market?.slug, market?.marketUrl, session?.access_token, isAuthenticated]);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return '';
    }
  };

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'h-full flex flex-col rounded-2xl bg-gradient-to-b from-card/80 to-card/60 border border-border/50 backdrop-blur-xl shadow-xl shadow-black/5',
          compact ? 'p-3' : 'p-4'
        )}
      >
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Sign in for News</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-[180px]">
            Get AI-powered news summaries for this market
          </p>
          <Button onClick={() => navigate('/auth')} size="sm" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Sign In
          </Button>
        </div>
      </motion.div>
    );
  }

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
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Newspaper className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground">Market News</span>
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
      <ScrollArea className="flex-1 min-h-0">
        {!hasFetched && !loading ? (
          // Initial state - prompt to fetch
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Newspaper className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs font-medium text-foreground mb-1">Fetch Latest News</p>
            <p className="text-[10px] text-muted-foreground mb-3 max-w-[160px]">
              Get AI-summarized news about this market
            </p>
            <Button onClick={fetchNews} size="sm" className="gap-1.5 h-8">
              <RefreshCw className="w-3 h-3" />
              Load News
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-primary animate-spin mb-2" />
            <span className="text-[10px] text-muted-foreground">Fetching news...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="w-5 h-5 text-muted-foreground/50 mb-2" />
            <p className="text-[10px] text-muted-foreground">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNews}
              className="mt-2 h-6 text-[10px]"
            >
              Retry
            </Button>
          </div>
        ) : !aiSummary && articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Newspaper className="w-5 h-5 text-muted-foreground/50 mb-2" />
            <p className="text-[10px] text-muted-foreground">No recent news found</p>
            <p className="text-[9px] text-muted-foreground/70 mt-0.5">Check back later</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* AI Summary - formatted */}
            {aiSummary && (
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/30">
                <div className="prose-compact">{formatText(aiSummary)}</div>
              </div>
            )}

            {/* Source Articles */}
            {articles.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Sources</p>
                {articles.map((article, idx) => (
                  <a
                    key={idx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </p>
                        {article.snippet && (
                          <p className="text-[9px] text-muted-foreground line-clamp-2 mt-0.5">
                            {article.snippet}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8px] text-muted-foreground font-medium">{article.source}</span>
                          {article.published && (
                            <>
                              <span className="text-[8px] text-muted-foreground/50">•</span>
                              <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="w-2 h-2" />
                                {formatTime(article.published)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
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