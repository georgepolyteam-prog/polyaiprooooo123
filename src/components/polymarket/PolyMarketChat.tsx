import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, User, Sparkles, Lock, Coins, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { usePolyChat } from '@/hooks/usePolyChat';
import { useNavigate } from 'react-router-dom';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { AnalysisStatus } from '@/components/chat/AnalysisStatus';
import { PolyMarketChatExpanded } from './PolyMarketChatExpanded';

import polyLogo from '@/assets/poly-logo-new.png';

interface PolyMarketChatProps {
  market: PolyMarket;
  compact?: boolean;
}

export function PolyMarketChat({ market, compact = false }: PolyMarketChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
    mode,
    setMode,
    analysisStep,
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

  // Show analysis status during loading
  const showAnalysisStatus = isLoading && analysisStep !== 'idle' && analysisStep !== 'complete';

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
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl bg-gradient-to-b from-card/80 to-card/60 border border-border/50 backdrop-blur-xl flex flex-col overflow-hidden shadow-xl shadow-black/5',
          compact ? 'h-[280px]' : 'h-[420px]'
        )}
      >
        {/* Header - Poly Branding */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="relative shrink-0">
            <img src={polyLogo} alt="Poly AI" className="w-7 h-7 rounded-lg shadow-md" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-card animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-foreground">AI Analysis</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Mode Selector */}
            <ModelSelector 
              mode={mode} 
              onModeChange={setMode}
              disabled={isLoading}
            />
            {/* Credits */}
            {!creditsLoading && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/50 border border-border/30">
                <Coins className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-medium text-muted-foreground">{credits}</span>
              </div>
            )}
            {/* Expand Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(true)}
              className="h-7 w-7 rounded-lg hover:bg-muted"
              title="Expand chat"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-3 py-2">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 shadow-lg shadow-primary/10">
                  <img src={polyLogo} alt="Poly" className="w-8 h-8 rounded-lg" />
                </div>
                <p className="text-xs font-medium text-foreground mb-1">
                  Ask Poly anything
                </p>
                <p className="text-[10px] text-muted-foreground mb-3 max-w-[180px]">
                  About "{market.title?.slice(0, 25)}..."
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (inputRef.current) inputRef.current.value = q;
                      }}
                      className="px-2.5 py-1 text-[10px] rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={`${msg.role}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        'flex gap-2',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 shadow-sm">
                          <img src={polyLogo} alt="Poly" className="w-4 h-4 rounded" />
                        </div>
                      )}
                      
                      <div
                        className={cn(
                          'max-w-[85%] px-3 py-2 rounded-xl text-xs whitespace-pre-wrap leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-sm shadow-lg shadow-primary/20'
                            : 'bg-muted/50 text-foreground rounded-bl-sm border border-border/50'
                        )}
                      >
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-block w-1 h-3 ml-0.5 bg-primary/60 animate-pulse" />
                        )}
                      </div>
                      
                      {msg.role === 'user' && (
                        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Analysis Status */}
                {showAnalysisStatus && (
                  <AnalysisStatus className="mt-2" />
                )}
                
                {/* Simple loading indicator when no analysis status */}
                {isLoading && !showAnalysisStatus && messages[messages.length - 1]?.role !== 'assistant' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-2"
                  >
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    </div>
                    <div className="px-3 py-2 rounded-xl rounded-bl-sm bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Analyzing</span>
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
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
        <div className="p-2 border-t border-border/30 bg-muted/20">
          <div className="flex gap-1.5">
            <Input
              ref={inputRef}
              onKeyDown={handleKeyDown}
              placeholder={hasCredits(1) ? "Ask about this market..." : "Add credits..."}
              className="h-9 text-xs bg-background/50 border-border/30 focus:border-primary/50 transition-colors"
              disabled={isLoading || !hasCredits(1)}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isLoading || !hasCredits(1)}
              className="h-9 w-9 shrink-0 shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Expanded Chat Modal */}
      <PolyMarketChatExpanded
        market={market}
        open={isExpanded}
        onClose={() => setIsExpanded(false)}
        messages={messages}
        isLoading={isLoading}
        sendMessage={sendMessage}
        mode={mode}
        setMode={setMode}
        credits={credits}
        creditsLoading={creditsLoading}
        hasCredits={hasCredits}
        analysisStep={analysisStep}
      />
    </>
  );
}
