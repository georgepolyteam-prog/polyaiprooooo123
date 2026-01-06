import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, User, Sparkles, Lock, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import polyLogo from '@/assets/poly-logo-new.png';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface PolyMarketChatProps {
  market: PolyMarket;
  compact?: boolean;
}

export function PolyMarketChat({ market, compact = false }: PolyMarketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, session } = useAuth();
  const { credits, hasCredits, useCredit, isLoading: creditsLoading } = useCredits();
  const navigate = useNavigate();
  
  const isAuthenticated = !!session?.access_token;

  // Reset messages when market changes
  useEffect(() => {
    setMessages([]);
  }, [market.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    // Check authentication
    if (!isAuthenticated) {
      toast.error('Please sign in to chat');
      return;
    }
    
    // Check credits
    if (!hasCredits(1)) {
      toast.error('Out of credits', {
        description: 'Add more credits to continue chatting',
        action: {
          label: 'Get Credits',
          onClick: () => navigate('/credits'),
        },
      });
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Format messages for the edge function
      const chatMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: input.trim() },
      ];

      // Use poly-chat with market context and auth token
      const { data, error } = await supabase.functions.invoke('poly-chat', {
        body: {
          messages: chatMessages,
          marketSlug: market.slug,
          conditionId: market.conditionId,
          userMessage: input.trim(),
          skipAnalysis: false,
          authToken: session?.access_token,
          authType: 'supabase',
        },
      });

      if (error) throw error;

      // Deduct credit on success
      await useCredit(1);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.reply || data?.message || data?.response || 'Sorry, I could not generate a response.',
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      
      // Handle specific errors
      if (err?.message?.includes('401') || err?.message?.includes('Authentication')) {
        toast.error('Session expired', { description: 'Please sign in again' });
      } else if (err?.message?.includes('402')) {
        toast.error('Out of credits');
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, there was an error processing your message. Please try again.',
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
                    onClick={() => setInput(q)}
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
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
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
                    </div>
                    
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isLoading && (
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasCredits(1) ? "Ask about this market..." : "Add credits to chat..."}
            className="h-10 text-sm bg-background/50 border-border/30 focus:border-primary/50 transition-colors"
            disabled={isLoading || !hasCredits(1)}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || !hasCredits(1)}
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
