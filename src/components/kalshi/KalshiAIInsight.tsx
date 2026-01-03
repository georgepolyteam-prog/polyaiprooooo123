import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Loader2, Brain, AlertTriangle, Send, MessageCircle, ArrowLeft, Bot, User, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { KalshiMarket } from '@/hooks/useDflowApi';

interface KalshiAIInsightProps {
  market: KalshiMarket;
  onClose: () => void;
  onTrade?: () => void;
}

interface AIAnalysis {
  probability: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  keyFactors: string[];
  recommendation: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function KalshiAIInsight({ market, onClose, onTrade }: KalshiAIInsightProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('kalshi-chat', {
        body: {
          messages: [...chatMessages, userMessage],
          marketTitle: market.title,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          volume: market.volume,
          closeTime: market.closeTime,
          initialAnalysis: analysis,
        },
      });

      if (fnError) throw fnError;
      
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.message };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleTradeClick = () => {
    onClose();
    onTrade?.();
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

  const quickQuestions = [
    "Why do you think this?",
    "What's the best entry point?",
    "What could change the outcome?",
    "Should I wait or trade now?"
  ];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent 
        className="sm:max-w-lg bg-background/95 backdrop-blur-xl border-border/50 max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" 
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/30 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {isChatMode && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsChatMode(false)}
                className="h-8 w-8 rounded-lg mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              {isChatMode ? <MessageCircle className="w-4 h-4 text-purple-400" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
            </div>
            {isChatMode ? 'AI Chat' : 'AI Analysis'}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/50 hover:scrollbar-thumb-border">
          {/* Market Info - Always visible */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 mb-4">
            <h3 className="font-medium text-foreground text-sm line-clamp-2 mb-2">
              {market.title}
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs">Yes: <span className="font-semibold text-emerald-400">{market.yesPrice}¢</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs">No: <span className="font-semibold text-red-400">{market.noPrice}¢</span></span>
              </div>
            </div>
          </div>

          {/* Chat Mode */}
          {isChatMode ? (
            <div className="space-y-3">
              {/* Chat messages */}
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-2",
                    msg.role === 'user' ? 'flex-row-reverse' : ''
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    msg.role === 'user' 
                      ? 'bg-primary/20' 
                      : 'bg-purple-500/20'
                  )}>
                    {msg.role === 'user' 
                      ? <User className="w-3.5 h-3.5 text-primary" />
                      : <Bot className="w-3.5 h-3.5 text-purple-400" />
                    }
                  </div>
                  <div className={cn(
                    "px-3 py-2 rounded-xl max-w-[85%] text-sm",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 border border-border/50 text-foreground'
                  )}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              
              {/* Typing indicator */}
              {isChatLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-muted/50 border border-border/50">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={chatEndRef} />
              
              {/* Quick questions */}
              {chatMessages.length === 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">Quick questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setChatInput(q);
                          setTimeout(() => sendChatMessage(), 100);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Analysis Mode */
            <div className="space-y-4">
              {!analysis && !isLoading && !error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center py-6"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                    <Brain className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-muted-foreground text-center mb-6 max-w-sm text-sm">
                    Get AI-powered insights including probability assessment, key factors, and trading recommendations.
                  </p>
                  <Button 
                    onClick={analyzeMarket}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl px-6"
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
                  className="flex flex-col items-center py-10"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="relative w-10 h-10 text-purple-400 animate-spin" />
                  </div>
                  <p className="text-muted-foreground mt-4 text-sm">Analyzing market data...</p>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center py-6"
                >
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                    <AlertTriangle className="w-7 h-7 text-red-400" />
                  </div>
                  <p className="text-red-400 text-center mb-4 text-sm">{error}</p>
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
                    className="space-y-3"
                  >
                    {/* AI Probability */}
                    <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">AI Probability</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                          getConfidenceColor(analysis.confidence)
                        )}>
                          {analysis.confidence} confidence
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold text-foreground">
                          {analysis.probability}%
                        </span>
                        <span className={cn(
                          "font-semibold capitalize text-sm",
                          getSentimentColor(analysis.sentiment)
                        )}>
                          {analysis.sentiment}
                        </span>
                      </div>
                      
                      {/* Probability bar */}
                      <div className="mt-2.5 h-1.5 rounded-full bg-muted/50 overflow-hidden">
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
                    <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                      <h4 className="font-semibold text-foreground mb-2 text-sm">Key Factors</h4>
                      <ul className="space-y-1.5">
                        {analysis.keyFactors.map((factor, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Reasoning */}
                    <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                      <h4 className="font-semibold text-foreground mb-1.5 text-sm">Analysis</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {analysis.reasoning}
                      </p>
                    </div>

                    {/* Recommendation */}
                    <div className={cn(
                      "p-4 rounded-xl border",
                      analysis.sentiment === 'bullish' 
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : analysis.sentiment === 'bearish'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-amber-500/10 border-amber-500/30'
                    )}>
                      <h4 className={cn(
                        "font-semibold mb-1 text-sm",
                        getSentimentColor(analysis.sentiment)
                      )}>
                        Recommendation
                      </h4>
                      <p className="text-xs text-foreground">
                        {analysis.recommendation}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="grid grid-cols-2 gap-3 pt-2"
                    >
                      <Button
                        onClick={() => setIsChatMode(true)}
                        variant="outline"
                        className="h-11 rounded-xl border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/50 text-purple-400 group"
                      >
                        <MessageCircle className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                        Ask Follow-up
                      </Button>
                      
                      {onTrade && (
                        <Button
                          onClick={handleTradeClick}
                          className="h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white group"
                        >
                          <Zap className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                          Trade Now
                        </Button>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Chat input - Only in chat mode */}
        {isChatMode && (
          <div className="shrink-0 p-4 border-t border-border/30 bg-background/50">
            <form 
              onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}
              className="flex gap-2"
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about this market..."
                className="flex-1 h-10 rounded-xl bg-muted/40 border-border/50 focus:border-purple-500/50 text-sm"
                disabled={isChatLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!chatInput.trim() || isChatLoading}
                className="h-10 w-10 rounded-xl bg-purple-500 hover:bg-purple-600 text-white shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
