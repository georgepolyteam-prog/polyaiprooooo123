import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, User, X, Coins, Sparkles, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ModelSelector, type ChatMode } from '@/components/chat/ModelSelector';
import { AnalysisStatus, type AnalysisStats } from '@/components/chat/AnalysisStatus';
import type { Message, AnalysisStep } from '@/hooks/usePolyChat';

import polyLogo from '@/assets/poly-logo-new.png';

// Markdown formatting helper (matches /chat page format)
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
    
    if (trimmedLine === "") return <div key={index} className="h-2" />;
    
    // Main header: ## Title
    if (trimmedLine.startsWith("## ")) {
      const headerText = trimmedLine.slice(3);
      return (
        <h2 key={index} className="text-base font-bold text-foreground mt-4 mb-2 first:mt-0">
          {formatInlineText(headerText)}
        </h2>
      );
    }
    
    // Sub header: ### Subtitle
    if (trimmedLine.startsWith("### ")) {
      const headerText = trimmedLine.slice(4);
      return (
        <h3 key={index} className="text-sm font-semibold text-foreground mt-3 mb-1 border-l-2 border-primary/50 pl-2">
          {formatInlineText(headerText)}
        </h3>
      );
    }
    
    // Key-value bold line: **Label:** Value
    if (trimmedLine.startsWith("**") && trimmedLine.includes(":**")) {
      return (
        <div key={index} className="py-1 px-2 my-0.5 rounded bg-muted/40 text-sm">
          {formatInlineText(trimmedLine)}
        </div>
      );
    }

    // Emoji headers
    if (/^[🎯💭⚠️📊🏁📈⚡🔥✨💡🚨]/.test(trimmedLine)) {
      return (
        <div key={index} className="font-semibold text-foreground mt-3 mb-1 text-sm">
          {formatInlineText(trimmedLine)}
        </div>
      );
    }
    
    // Bullet points
    if (trimmedLine.startsWith("• ") || trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      const bulletContent = trimmedLine.slice(2);
      return (
        <div key={index} className="flex gap-2 ml-2 my-0.5">
          <span className="text-primary mt-0.5 text-xs">•</span>
          <span className="text-foreground/90 text-sm leading-relaxed">{formatInlineText(bulletContent)}</span>
        </div>
      );
    }
    
    // Numbered lists
    const numberMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
    if (numberMatch) {
      return (
        <div key={index} className="flex gap-2 ml-2 my-0.5">
          <span className="text-primary/70 font-medium min-w-[1.2rem] text-sm">{numberMatch[1]}.</span>
          <span className="text-foreground/90 text-sm leading-relaxed">{formatInlineText(numberMatch[2])}</span>
        </div>
      );
    }

    // Regular paragraph
    return (
      <p key={index} className="text-foreground/90 my-1 leading-relaxed text-sm">
        {formatInlineText(trimmedLine)}
      </p>
    );
  });
};

interface PolyMarketChatExpandedProps {
  market: PolyMarket;
  open: boolean;
  onClose: () => void;
  // Shared state from usePolyChat
  messages: Message[];
  isLoading: boolean;
  sendMessage: (message: string) => void;
  setCurrentMarketContext: (context: { slug: string; eventSlug?: string; question?: string; url?: string; } | null) => void;
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  credits: number;
  creditsLoading: boolean;
  hasCredits: (amount: number) => boolean;
  analysisStep?: AnalysisStep;
}

export function PolyMarketChatExpanded({
  market,
  open,
  onClose,
  messages,
  isLoading,
  sendMessage,
  setCurrentMarketContext,
  mode,
  setMode,
  credits,
  creditsLoading,
  hasCredits,
  analysisStep = 'idle',
}: PolyMarketChatExpandedProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = () => {
    const input = inputRef.current;
    if (!input || !input.value.trim() || isLoading) return;
    
    const message = input.value.trim();
    input.value = '';
    
    // Ensure context is set right before sending (handles any timing issues)
    setCurrentMarketContext({
      slug: market.slug,
      eventSlug: market.eventSlug,
      question: market.title,
      url: market.marketUrl,
    });
    
    // Small delay to ensure context is set in ref before sendMessage reads it
    setTimeout(() => {
      sendMessage(message);
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    'What are the key factors affecting this market?',
    'Analyze whale activity and smart money moves',
    'What does recent news say about this?',
    'Should I buy YES or NO? Give me your take.',
  ];

  // Show analysis status during loading
  const showAnalysisStatus = isLoading && analysisStep !== 'idle' && analysisStep !== 'complete';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 gap-0 bg-gradient-to-b from-card to-background border-border/50 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Chat with Poly AI about {market.title}</DialogTitle>
        </VisuallyHidden>
        
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="relative">
            <img src={polyLogo} alt="Poly AI" className="w-10 h-10 rounded-xl shadow-lg" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-base font-semibold text-foreground">Chat with Poly</span>
            <p className="text-xs text-muted-foreground truncate max-w-md">
              {market.title}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ModelSelector 
              mode={mode} 
              onModeChange={setMode}
              disabled={isLoading}
            />
            {!creditsLoading && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/30">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-muted-foreground">{credits}</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-6 py-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-xl shadow-primary/10">
                  <img src={polyLogo} alt="Poly" className="w-14 h-14 rounded-xl" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">
                  Ask Poly anything about this market
                </p>
                <p className="text-sm text-muted-foreground mb-8 max-w-md">
                  I can analyze news, whale activity, trade flow, and help you make informed decisions.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (inputRef.current) {
                          inputRef.current.value = q;
                          inputRef.current.focus();
                        }
                      }}
                      className="px-4 py-3 text-sm text-left rounded-xl bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-2xl mx-auto">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={`${msg.role}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        'flex gap-4',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 shadow-md">
                          <img src={polyLogo} alt="Poly" className="w-6 h-6 rounded-lg" />
                        </div>
                      )}
                      
                      <div
                        className={cn(
                          'max-w-[80%] px-5 py-3 rounded-2xl leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md shadow-lg shadow-primary/20 text-sm'
                            : 'bg-muted/50 rounded-bl-md border border-border/50'
                        )}
                      >
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <div className="prose-compact">{formatText(msg.content)}</div>
                        )}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse" />
                        )}
                      </div>
                      
                      {msg.role === 'user' && (
                        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Analysis Status */}
                {showAnalysisStatus && (
                  <AnalysisStatus className="mt-4" />
                )}
                
                {/* Simple loading indicator when no analysis status */}
                {isLoading && !showAnalysisStatus && messages[messages.length - 1]?.role !== 'assistant' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-4"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-md">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                    <div className="px-5 py-3 rounded-2xl rounded-bl-md bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Thinking</span>
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
        <div className="p-4 border-t border-border/30 bg-muted/10">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Input
              ref={inputRef}
              onKeyDown={handleKeyDown}
              placeholder={hasCredits(1) ? "Ask about this market..." : "Add credits to continue chatting..."}
              className="h-12 text-sm bg-background/50 border-border/30 focus:border-primary/50 transition-colors rounded-xl"
              disabled={isLoading || !hasCredits(1)}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isLoading || !hasCredits(1)}
              className="h-12 w-12 shrink-0 rounded-xl shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          {mode === 'polyfactual' && (
            <p className="text-xs text-center text-emerald-400/80 mt-2">
              Deep research mode - uses 3 credits per message
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}