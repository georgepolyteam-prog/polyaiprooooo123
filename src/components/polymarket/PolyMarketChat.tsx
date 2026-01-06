import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, User, Sparkles, Lock, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { usePolyChat } from '@/hooks/usePolyChat';
import { useNavigate } from 'react-router-dom';

import polyLogo from '@/assets/poly-logo-new.png';

interface PolyMarketChatProps {
  market: PolyMarket;
  compact?: boolean;
}

export function PolyMarketChat({ market, compact = false }: PolyMarketChatProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { session } = useAuth();
  const { credits, hasCredits, isLoading: creditsLoading } = useCredits();
  const navigate = useNavigate();
  
  const isAuthenticated = !!session?.access_token;

  // Use the shared usePolyChat hook - same as /chat page
  const {
    messages,
    isLoading,
    sendMessage,
    setCurrentMarketContext,
    clearMessages,
  } = usePolyChat(session, null);

  // Update market context when market changes
  useEffect(() => {
    if (market) {
      setCurrentMarketContext({
        slug: market.slug,
        eventSlug: market.eventSlug,
        question: market.title,
        url: market.marketUrl,
      });
      clearMessages();
    }
  }, [market.id, market.slug, setCurrentMarketContext, clearMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = () => {
    const input = inputRef.current;
    if (!input || !input.value.trim() || isLoading) return;
    
    const message = input.value.trim();
    input.value = '';
    sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    'What are the key factors?',
    'Analyze whale activity',
    'Should I buy YES or NO?',
    'Show recent news',
  ];

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl bg-gradient-to-b from-card/80 to-card/60 border border-border/50 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden shadow-xl shadow-black/5',
          compact ? 'h-[280px]' : 'h-[420px]'
        )}
      >
        <div className="flex flex-col items-center text-center p-6">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Sign in to Chat</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-[200px]">
            Get AI-powered analysis for this market
          </p>
          <Button onClick={() => navigate('/auth')} className="gap-2">
            <Sparkles className="w-4 h-4" />
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
        'rounded-2xl bg-gradient-to-b from-card/80 to-card/60 border border-border/50 backdrop-blur-xl flex flex-col overflow-hidden shadow-xl shadow-black/5',
        compact ? 'h-[280px]' : 'h-[420px]'
      )}
    >
      {/* Header - Poly Branding */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="relative">
          <img src={polyLogo} alt="Poly AI" className="w-8 h-8 rounded-lg shadow-md" />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card animate-pulse" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-semibold text-foreground">AI Analysis</span>
          <p className="text-[10px] text-muted-foreground">Powered by Poly</p>
        </div>
        <div className="flex items-center gap-2">
          {!creditsLoading && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 border border-border/30">
              <Coins className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-medium text-muted-foreground">{credits}</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-medium text-primary">Live</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-4 py-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
                <img src={polyLogo} alt="Poly" className="w-10 h-10 rounded-lg" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                Ask Poly anything
              </p>
              <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                About "{market.title?.slice(0, 30)}..."
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (inputRef.current) inputRef.current.value = q;
                    }}
                    className="px-3 py-1.5 text-xs rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={`${msg.role}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      'flex gap-3',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 shadow-sm">
                        <img src={polyLogo} alt="Poly" className="w-5 h-5 rounded" />
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        'max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md shadow-lg shadow-primary/20'
                          : 'bg-muted/50 text-foreground rounded-bl-md border border-border/50'
                      )}
                    >
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse" />
                      )}
                    </div>
                    
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Analyzing market data</span>
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/30 bg-muted/20">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            onKeyDown={handleKeyDown}
            placeholder={hasCredits(1) ? "Ask about this market..." : "Add credits to chat..."}
            className="h-10 text-sm bg-background/50 border-border/30 focus:border-primary/50 transition-colors"
            disabled={isLoading || !hasCredits(1)}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isLoading || !hasCredits(1)}
            className="h-10 w-10 shrink-0 shadow-lg shadow-primary/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
