import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Loader2, X, Brain, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { KalshiMarket } from '@/hooks/useDflowApi';

interface KalshiAIInsightProps {
  market: KalshiMarket;
  onClose: () => void;
}

interface AIAnalysis {
  probability: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  keyFactors: string[];
  recommendation: string;
}

export function KalshiAIInsight({ market, onClose }: KalshiAIInsightProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeMarket = async () => {
    setIsLoading(true);
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
      setAnalysis(data);
    } catch (err) {
      console.error('AI analysis error:', err);
      setError('Failed to analyze market. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-emerald-400';
      case 'bearish': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-muted/50 text-muted-foreground border-border/50';
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-xl border-border/50 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Market Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Market Info */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
            <h3 className="font-semibold text-foreground line-clamp-2 mb-3">
              {market.title}
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm">Yes: <span className="font-semibold text-emerald-400">{market.yesPrice}¢</span></span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-sm">No: <span className="font-semibold text-red-400">{market.noPrice}¢</span></span>
              </div>
            </div>
          </div>

          {!analysis && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-8"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Brain className="w-10 h-10 text-primary" />
              </div>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Get AI-powered insights on this market including probability assessment, key factors, and trading recommendations.
              </p>
              <Button 
                onClick={analyzeMarket}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Market
              </Button>
            </motion.div>
          )}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-12"
            >
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Analyzing market data...</p>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 text-center mb-4">{error}</p>
              <Button 
                onClick={analyzeMarket}
                variant="outline"
                className="rounded-xl"
              >
                Try Again
              </Button>
            </motion.div>
          )}

          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* AI Probability */}
                <div className="p-5 rounded-2xl bg-card/50 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">AI Probability</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium border",
                      getConfidenceColor(analysis.confidence)
                    )}>
                      {analysis.confidence} confidence
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-bold text-foreground">
                      {analysis.probability}%
                    </span>
                    <span className={cn(
                      "font-semibold capitalize",
                      getSentimentColor(analysis.sentiment)
                    )}>
                      {analysis.sentiment}
                    </span>
                  </div>
                  
                  {/* Probability bar */}
                  <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${analysis.probability}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={cn(
                        "h-full rounded-full",
                        analysis.sentiment === 'bullish' ? 'bg-emerald-500' : 
                        analysis.sentiment === 'bearish' ? 'bg-red-500' : 'bg-amber-500'
                      )}
                    />
                  </div>
                </div>

                {/* Key Factors */}
                <div className="p-5 rounded-2xl bg-card/50 border border-border/50">
                  <h4 className="font-semibold text-foreground mb-3">Key Factors</h4>
                  <ul className="space-y-2">
                    {analysis.keyFactors.map((factor, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Reasoning */}
                <div className="p-5 rounded-2xl bg-card/50 border border-border/50">
                  <h4 className="font-semibold text-foreground mb-2">Analysis</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.reasoning}
                  </p>
                </div>

                {/* Recommendation */}
                <div className={cn(
                  "p-5 rounded-2xl border",
                  analysis.sentiment === 'bullish' 
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : analysis.sentiment === 'bearish'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                )}>
                  <h4 className={cn(
                    "font-semibold mb-2",
                    getSentimentColor(analysis.sentiment)
                  )}>
                    Recommendation
                  </h4>
                  <p className="text-sm text-foreground">
                    {analysis.recommendation}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
