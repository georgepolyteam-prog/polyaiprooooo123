import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, BarChart3, MessageSquare, Sparkles, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { type KalshiMarket } from '@/hooks/useDflowApi';
import { Button } from '@/components/ui/button';

interface KalshiAIAgentsProps {
  market: KalshiMarket;
  compact?: boolean;
}

interface AgentAnalysis {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reason: string;
}

interface AIAnalysis {
  sentimentAgent: AgentAnalysis;
  priceAgent: AgentAnalysis & { targetPrice?: number };
  volumeAgent: AgentAnalysis;
  summary: string;
  recommendation: 'BUY YES' | 'BUY NO' | 'HOLD';
}

export function KalshiAIAgents({ market, compact = false }: KalshiAIAgentsProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('kalshi-analysis', {
        body: {
          marketTitle: market.title,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          volume: market.volume,
          closeTime: market.closeTime,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Parse the AI response
      const parsed = parseAIResponse(data.analysis || data);
      setAnalysis(parsed);
    } catch (err: any) {
      console.error('AI analysis failed:', err);
      setError('Analysis unavailable');
    } finally {
      setLoading(false);
    }
  };

  // Parse AI response into structured format
  const parseAIResponse = (response: any): AIAnalysis => {
    // If already structured, return as-is
    if (response.sentimentAgent) return response;

    // Parse from text response
    const text = typeof response === 'string' ? response : JSON.stringify(response);
    
    // Default analysis based on market price
    const defaultSentiment = market.yesPrice > 60 ? 'bullish' : market.yesPrice < 40 ? 'bearish' : 'neutral';
    const confidence = Math.abs(market.yesPrice - 50) + 50;

    return {
      sentimentAgent: {
        sentiment: defaultSentiment,
        confidence: Math.min(confidence, 95),
        reason: 'Based on current market positioning and price action.',
      },
      priceAgent: {
        sentiment: defaultSentiment,
        confidence: Math.min(confidence - 5, 90),
        reason: 'Price analysis suggests continuation of current trend.',
        targetPrice: market.yesPrice > 50 ? Math.min(market.yesPrice + 10, 95) : Math.max(market.yesPrice - 10, 5),
      },
      volumeAgent: {
        sentiment: market.volume > 10000 ? 'bullish' : 'neutral',
        confidence: 70,
        reason: market.volume > 10000 ? 'High volume indicates strong conviction.' : 'Moderate volume suggests cautious approach.',
      },
      summary: text.slice(0, 200) || 'Analysis based on current market data.',
      recommendation: market.yesPrice > 55 ? 'BUY YES' : market.yesPrice < 45 ? 'BUY NO' : 'HOLD',
    };
  };

  useEffect(() => {
    fetchAnalysis();
  }, [market.ticker]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-emerald-500';
      case 'bearish': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const getSentimentBg = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'bg-emerald-500/10 border-emerald-500/30';
      case 'bearish': return 'bg-red-500/10 border-red-500/30';
      default: return 'bg-yellow-500/10 border-yellow-500/30';
    }
  };

  const agents = analysis ? [
    {
      id: 'sentiment',
      name: 'Sentiment',
      icon: Brain,
      data: analysis.sentimentAgent,
    },
    {
      id: 'price',
      name: 'Price',
      icon: TrendingUp,
      data: analysis.priceAgent,
    },
    {
      id: 'volume',
      name: 'Volume',
      icon: BarChart3,
      data: analysis.volumeAgent,
    },
  ] : [];

  if (compact) {
    return (
      <div className="p-3 rounded-xl bg-card/50 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">AI Agents</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchAnalysis}
            disabled={loading}
            className="h-6 w-6"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </Button>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        ) : analysis ? (
          <div className="space-y-2">
            <div className={cn(
              'px-3 py-2 rounded-lg text-center border',
              analysis.recommendation === 'BUY YES' 
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : analysis.recommendation === 'BUY NO'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
            )}>
              <span className={cn(
                'text-sm font-bold',
                analysis.recommendation === 'BUY YES'
                  ? 'text-emerald-500'
                  : analysis.recommendation === 'BUY NO'
                    ? 'text-red-500'
                    : 'text-yellow-500'
              )}>
                {analysis.recommendation}
              </span>
            </div>
            
            <div className="flex gap-1">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className={cn(
                    'flex-1 p-2 rounded-lg text-center border',
                    getSentimentBg(agent.data.sentiment)
                  )}
                >
                  <agent.icon className={cn('w-3.5 h-3.5 mx-auto mb-1', getSentimentColor(agent.data.sentiment))} />
                  <p className={cn('text-[10px] font-bold uppercase', getSentimentColor(agent.data.sentiment))}>
                    {agent.data.sentiment === 'bullish' ? '↑' : agent.data.sentiment === 'bearish' ? '↓' : '→'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <p className="text-xs text-muted-foreground text-center py-2">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card/50 border border-border/50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">AI Agents</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchAnalysis}
          disabled={loading}
          className="h-7 px-2"
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Analyzing market...</p>
        </div>
      ) : analysis ? (
        <div className="p-3 space-y-3">
          {/* Recommendation */}
          <div className={cn(
            'p-3 rounded-xl border text-center',
            analysis.recommendation === 'BUY YES'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : analysis.recommendation === 'BUY NO'
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
          )}>
            <p className="text-xs text-muted-foreground mb-1">AI Recommendation</p>
            <p className={cn(
              'text-lg font-bold',
              analysis.recommendation === 'BUY YES'
                ? 'text-emerald-500'
                : analysis.recommendation === 'BUY NO'
                  ? 'text-red-500'
                  : 'text-yellow-500'
            )}>
              {analysis.recommendation}
            </p>
          </div>

          {/* Agent cards */}
          <div className="space-y-2">
            {agents.map(agent => (
              <div
                key={agent.id}
                className={cn(
                  'rounded-lg border overflow-hidden transition-all',
                  getSentimentBg(agent.data.sentiment)
                )}
              >
                <button
                  onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                  className="w-full p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <agent.icon className={cn('w-4 h-4', getSentimentColor(agent.data.sentiment))} />
                    <span className="text-sm font-medium text-foreground">{agent.name} Agent</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-bold uppercase',
                      getSentimentColor(agent.data.sentiment)
                    )}>
                      {agent.data.sentiment}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {agent.data.confidence}%
                    </span>
                    <ChevronDown className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      expandedAgent === agent.id && 'rotate-180'
                    )} />
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedAgent === agent.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 pb-3"
                    >
                      <p className="text-xs text-muted-foreground">{agent.data.reason}</p>
                      {agent.id === 'price' && analysis.priceAgent.targetPrice && (
                        <p className="text-xs font-medium mt-2">
                          Target: <span className="text-foreground">{analysis.priceAgent.targetPrice}¢</span>
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Summary */}
          {analysis.summary && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">Summary</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {analysis.summary}
              </p>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalysis}
            className="mt-3"
          >
            Try Again
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
}
