import { useEffect, useRef, useCallback, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { BarChart3, Zap, TrendingUp, Search, Loader2, DollarSign, Target, Layers, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TopBar } from "@/components/TopBar";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { AnalysisStatus } from "@/components/chat/AnalysisStatus";
// ChatUpgradeBanner removed - was unprofessional
import { UnifiedInput } from "@/components/UnifiedInput";
import { MarketDataPanel } from "@/components/MarketDataPanel";
import { MarketDataSheet } from "@/components/MarketDataSheet";
import { AuthGateInline } from "@/components/AuthGateInline";
import { AnimatedBackground } from "@/components/home/AnimatedBackground";
import { PremiumHero } from "@/components/home/PremiumHero";
import { PremiumCapabilities } from "@/components/home/PremiumCapabilities";
import { PremiumMarketCards } from "@/components/home/PremiumMarketCards";


import { usePolyChat } from "@/hooks/usePolyChat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "wagmi";

interface MarketData {
  market: {
    question: string;
    odds: number;
    volume: number;
    liquidity: number;
    url: string;
  };
  whales: Array<{
    id: string;
    wallet: string;
    side: string;
    amount: number;
    price: number;
    timeAgo: string;
  }>;
  orderbook: {
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
    spread: number;
    bidTotal: number;
    askTotal: number;
  };
  priceHistory: Array<{ date: string; price: number }>;
  recentTrades: Array<{
    id: string;
    side: string;
    size: number;
    price: number;
    timeAgo: string;
  }>;
  tradeStats: {
    buyPressure: number;
    sellPressure: number;
    netFlow: number;
    totalCount?: number;
    largestTrade?: number;
    buyVolume?: number;
    sellVolume?: number;
    totalVolume24h?: number;
    yesVolume24h?: number;
    noVolume24h?: number;
    uniqueTraders24h?: number;
  };
  topTraders?: Array<{
    address: string;
    totalVolume: number;
    tradeCount: number;
    winRate: number;
    lastTrade: string;
  }>;
  arbitrage: {
    isMultiMarket: boolean;
    marketCount: number;
    totalProbability: number;
    hasArbitrage: boolean;
  };
}

interface ExampleMarket {
  title: string;
  subtitle: string;
  odds: string;
  volume: string;
  url: string;
  gradient: string;
  glowColor: string;
  oddsColor: string;
  icon: React.ReactNode;
  image?: string;
  isMultiMarket?: boolean;
  marketCount?: number;
}

// Hardcoded fallback images from Polymarket CDN (known good URLs)
const FALLBACK_IMAGES: Record<string, string> = {
  "who-will-trump-nominate-as-fed-chair": "https://polymarket-upload.s3.us-east-2.amazonaws.com/who-will-be-the-next-federal-reserve-chair.png",
  "what-price-will-bitcoin-hit-in-2025": "https://polymarket-upload.s3.us-east-2.amazonaws.com/bitcoin-2025-price-prediction.png",
  "super-bowl-champion-2026-731": "https://polymarket-upload.s3.us-east-2.amazonaws.com/super-bowl-lix-champion.png",
  "presidential-election-winner-2028": "https://polymarket-upload.s3.us-east-2.amazonaws.com/2028-presidential-election.png",
};

const defaultMarkets: ExampleMarket[] = [
  {
    title: "Trump Fed Chair",
    subtitle: "Kevin Hassett",
    odds: "54%",
    volume: "$3.8M",
    url: "https://polymarket.com/event/who-will-trump-nominate-as-fed-chair?tid=1765983335375",
    gradient: "from-primary/10 to-secondary/10",
    glowColor: "primary",
    oddsColor: "text-primary",
    icon: <BarChart3 className="w-6 h-6" />,
    image: FALLBACK_IMAGES["who-will-trump-nominate-as-fed-chair"],
  },
  {
    title: "Bitcoin Price 2025",
    subtitle: "What price will it hit?",
    odds: "12%",
    volume: "$8.2M",
    url: "https://polymarket.com/event/what-price-will-bitcoin-hit-in-2025?tid=1765983317043",
    gradient: "from-secondary/10 to-accent/10",
    glowColor: "secondary",
    oddsColor: "text-secondary",
    icon: <DollarSign className="w-6 h-6" />,
    image: FALLBACK_IMAGES["what-price-will-bitcoin-hit-in-2025"],
  },
  {
    title: "Super Bowl 2026",
    subtitle: "Championship Winner",
    odds: "48%",
    volume: "$2.1M",
    url: "https://polymarket.com/event/super-bowl-champion-2026-731?tid=1765983295435",
    gradient: "from-accent/10 to-primary/10",
    glowColor: "accent",
    oddsColor: "text-accent",
    icon: <Target className="w-6 h-6" />,
    image: FALLBACK_IMAGES["super-bowl-champion-2026-731"],
  },
  {
    title: "2028 Election",
    subtitle: "Presidential Winner",
    odds: "23%",
    volume: "$5.4M",
    url: "https://polymarket.com/event/presidential-election-winner-2028?tid=1765983270320",
    gradient: "from-primary/10 to-accent/10",
    glowColor: "primary",
    oddsColor: "text-primary",
    icon: <TrendingUp className="w-6 h-6" />,
    image: FALLBACK_IMAGES["presidential-election-winner-2028"],
  },
];


const POLYFACTUAL_HINT_KEY = "poly-polyfactual-intro-seen";

const Index = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  // Auth state
  const { user, session, isLoading: authLoading } = useAuth();
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  
  const hasValidSession = !!session?.access_token;
  const hasValidWallet = isWalletConnected && !!walletAddress;
  const isAuthenticated = hasValidSession || hasValidWallet;
  
  const effectiveWalletAddress = hasValidWallet ? walletAddress : null;
  
  const { messages, isLoading, sendMessage, currentMarketContext, setSidebarMarketData, deepResearch, toggleDeepResearch } = usePolyChat(session, effectiveWalletAddress);
  const { toast } = useToast();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAskedRef = useRef(false);
  
  // Market sidebar state
  const [showSidebar, setShowSidebar] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [currentMarketUrl, setCurrentMarketUrl] = useState<string | null>(null);

  const [userSelectedMarketUrl, setUserSelectedMarketUrl] = useState<string | null>(null);
  const userSelectedMarketUrlRef = useRef<string | null>(null);
  const [markets, setMarkets] = useState<ExampleMarket[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  // Polyfactual hint state - show for first-time authenticated users with no messages
  const [showPolyfactualHint, setShowPolyfactualHint] = useState(false);
  
  useEffect(() => {
    // Show hint only if: authenticated, no messages, and hasn't been shown before
    const hasSeenHint = localStorage.getItem(POLYFACTUAL_HINT_KEY) === "true";
    if (isAuthenticated && messages.length === 0 && !hasSeenHint && !authLoading) {
      setShowPolyfactualHint(true);
    } else {
      setShowPolyfactualHint(false);
    }
  }, [isAuthenticated, messages.length, authLoading]);

  const dismissPolyfactualHint = useCallback(() => {
    setShowPolyfactualHint(false);
    localStorage.setItem(POLYFACTUAL_HINT_KEY, "true");
  }, []);

  // Wrap toggleDeepResearch to also dismiss hint
  const handleToggleDeepResearch = useCallback(() => {
    dismissPolyfactualHint();
    toggleDeepResearch();
  }, [toggleDeepResearch, dismissPolyfactualHint]);

  // Fetch example markets data via server-side proxy (bypasses CORS)
  useEffect(() => {
    const fetchMarketData = async () => {
      const eventSlugs = [
        "who-will-trump-nominate-as-fed-chair",
        "what-price-will-bitcoin-hit-in-2025",
        "super-bowl-champion-2026-731",
        "presidential-election-winner-2028",
      ];

      try {
        const { data, error } = await supabase.functions.invoke("get-market-previews", {
          body: { eventSlugs }
        });

        if (error) {
          console.error("Edge function error:", error);
          setLoadingMarkets(false);
          return;
        }

        const results = eventSlugs.map((slug, index) => {
          const apiData = data?.markets?.[index];
          const fallbackImage = FALLBACK_IMAGES[slug];
          
          if (!apiData) return defaultMarkets[index];

          return {
            ...defaultMarkets[index],
            title: apiData.title || defaultMarkets[index].title,
            subtitle: apiData.subtitle || defaultMarkets[index].subtitle,
            odds: apiData.odds ? `${apiData.odds}%` : defaultMarkets[index].odds,
            volume: apiData.volume 
              ? `$${(apiData.volume / 1000000).toFixed(1)}M`
              : defaultMarkets[index].volume,
            image: apiData.image || fallbackImage || defaultMarkets[index].image,
            isMultiMarket: apiData.isMultiMarket || false,
            marketCount: apiData.marketCount || 1,
          };
        });

        setFailedImages(new Set());
        setMarkets(results);
      } catch (error) {
        console.error("Failed to fetch market data:", error);
      } finally {
        setLoadingMarkets(false);
      }
    };

    fetchMarketData();
  }, []);

  const detectMarketUrl = (message: string): string | null => {
    const urlPattern = /https:\/\/polymarket\.com\/(event|market)\/[^\s]+/i;
    const match = message.match(urlPattern);
    return match ? match[0] : null;
  };

  const fetchMarketDataForSidebar = async (url: string) => {
    if (url === currentMarketUrl && marketData) return;
    
    setMarketData(null);
    setLoadingMarket(true);
    setCurrentMarketUrl(url);
    
    try {
      const { data, error } = await supabase.functions.invoke("market-dashboard", {
        body: { marketUrl: url }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      if (data.needsMarketSelection) {
        console.log(`[Sidebar] Multi-market event detected (${data.marketCount} markets), waiting for user selection`);
        setMarketData(null);
        setShowSidebar(false);
        setSidebarMarketData(null);
        return;
      }
      
      setMarketData(data);
      setShowSidebar(true);
      setSidebarMarketData(data);
    } catch (err) {
      console.error("Failed to fetch market data:", err);
      setMarketData(null);
      setShowSidebar(false);
    } finally {
      setLoadingMarket(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [messages, isLoading]);

  const urlHasMarketSlug = (url: string): boolean => {
    const pathParts = url.split('/').filter(Boolean);
    return pathParts.length >= 5;
  };

  useEffect(() => {
    const lockedUrl = userSelectedMarketUrlRef.current || userSelectedMarketUrl;
    const contextHasSlug = !!(currentMarketContext?.url && urlHasMarketSlug(currentMarketContext.url));

    if (lockedUrl || contextHasSlug) {
      console.log('[Sidebar] Skipping URL scan - explicit market lock active');
      return;
    }

    let bestUrl: string | null = null;
    let bestHasMarketSlug = false;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      if (msg.event?.markets && Array.isArray(msg.event.markets)) {
        for (const market of msg.event.markets) {
          if (market.url) {
            const hasMarketSlug = urlHasMarketSlug(market.url);
            if (hasMarketSlug) {
              bestUrl = market.url;
              bestHasMarketSlug = true;
              break;
            } else if (!bestUrl) {
              bestUrl = market.url;
            }
          }
        }
        if (bestHasMarketSlug) break;
      }

      const urlPattern = /https:\/\/polymarket\.com\/(event|market)\/[^\s\)\]]+/gi;
      const urls = msg.content.match(urlPattern) || [];

      for (const url of urls) {
        const cleanUrl = url.replace(/[.,;:!?\]\)]+$/, '');
        const hasMarketSlug = urlHasMarketSlug(cleanUrl);

        if (hasMarketSlug) {
          bestUrl = cleanUrl;
          bestHasMarketSlug = true;
          break;
        } else if (!bestUrl) {
          bestUrl = cleanUrl;
        }
      }

      if (bestHasMarketSlug) break;
    }

    if (bestUrl) {
      console.log(`[Sidebar] Detected URL - hasMarketSlug: ${bestHasMarketSlug}`, bestUrl);
      fetchMarketDataForSidebar(bestUrl);
    }
  }, [messages, userSelectedMarketUrl, currentMarketContext?.url]);

  useEffect(() => {
    if (currentMarketContext?.url) {
      const url = currentMarketContext.url;
      const hasMarketSlug = urlHasMarketSlug(url);
      console.log(`[Sidebar] Context URL - hasMarketSlug: ${hasMarketSlug}`, url);
      if (hasMarketSlug) {
        userSelectedMarketUrlRef.current = url;
        setUserSelectedMarketUrl(url);
        fetchMarketDataForSidebar(url);
      }
    }
  }, [currentMarketContext?.url]);

  useEffect(() => {
    const state = location.state as { 
      initialMessage?: string;
      autoAnalyze?: boolean;
      deepResearch?: boolean;
      marketContext?: {
        eventTitle: string;
        outcomeQuestion: string;
        currentOdds: number;
        volume: number;
        url: string;
        slug: string;
        eventSlug: string;
      };
    } | null;
    
    // Use location.key to prevent re-triggering on the same navigation
    const stateKey = state ? `${state.marketContext?.url}-${state.deepResearch}-${location.key}` : null;
    
    if (state?.autoAnalyze && state?.marketContext && !hasAskedRef.current) {
      hasAskedRef.current = true;
      const { marketContext } = state;
      
      // Enable deep research UI toggle if flag is set
      if (state.deepResearch && !deepResearch) {
        toggleDeepResearch();
      }
      
      // Build the message - for deep research, include the market question so backend has it for research query
      const marketQuestion = marketContext.outcomeQuestion || marketContext.eventTitle;
      const messageText = state.deepResearch && marketQuestion
        ? `Analyze this market: "${marketQuestion}" ${marketContext.url}`
        : `Analyze this market: ${marketContext.url}`;
      
      // Pass deepResearch directly to sendMessage to avoid race condition
      sendMessage(messageText, false, false, state.deepResearch);
      fetchMarketDataForSidebar(marketContext.url);
      window.history.replaceState({}, document.title);
    } else if (state?.initialMessage && !hasAskedRef.current && messages.length === 0) {
      hasAskedRef.current = true;
      sendMessage(state.initialMessage);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, location.key, sendMessage, messages.length, deepResearch, toggleDeepResearch]);

  useEffect(() => {
    const marketQuery = searchParams.get("market");
    const questionQuery = searchParams.get("q");

    if (marketQuery && !hasAskedRef.current && messages.length === 0) {
      hasAskedRef.current = true;
      if (marketQuery.includes("polymarket.com")) {
        sendMessage(`Analyze this Polymarket market: ${marketQuery}`);
        fetchMarketDataForSidebar(marketQuery);
      } else {
        sendMessage(`Tell me about this market: ${marketQuery}`);
      }
    } else if (questionQuery && !hasAskedRef.current && messages.length === 0) {
      hasAskedRef.current = true;
      sendMessage(questionQuery);
    }
  }, [searchParams, sendMessage, messages.length]);

  const handleSubmit = useCallback((message: string, isVoice: boolean, audioBlob?: Blob) => {
    if (isVoice && audioBlob) {
      console.log("[Voice] Received audio blob for processing");
    } else if (message.trim()) {
      const url = detectMarketUrl(message);
      if (url && urlHasMarketSlug(url)) {
        fetchMarketDataForSidebar(url);
      } else if (url) {
        console.log('[Sidebar] Event-only URL detected, waiting for market selection');
      }
      sendMessage(message);
    }
  }, [sendMessage]);

  const handleQuickQuestion = (question: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Connect to chat",
        description: "Connect your wallet or sign up to chat with Poly",
      });
      return;
    }
    sendMessage(question);
  };

  const handleMarketClick = (url: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Connect to analyze",
        description: "Connect your wallet or sign up to analyze markets",
      });
      return;
    }
    sendMessage(`Analyze this market: ${url}`);
    fetchMarketDataForSidebar(url);
  };

  const closeSidebar = () => {
    setShowSidebar(false);
  };

  const hasMessages = messages.length > 0;
  const isProcessing = isLoading;

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <AnimatedBackground />

      <TopBar />
      {/* Removed ChatUpgradeBanner - was unprofessional */}

      <div className="flex flex-1 relative overflow-hidden">
        {/* Main Chat Area */}
        <main className={`relative flex-1 flex flex-col pb-36 sm:pb-32 overflow-y-auto ${showSidebar && marketData ? 'lg:pr-[40%]' : ''}`}>
          {!hasMessages ? (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto px-4 py-8 sm:py-16">
                <PremiumHero isAuthenticated={isAuthenticated} />
                <PremiumCapabilities />
                <PremiumMarketCards
                  markets={markets}
                  loadingMarkets={loadingMarkets}
                  failedImages={failedImages}
                  isAuthenticated={isAuthenticated}
                  onMarketClick={handleMarketClick}
                  onImageError={(index) => setFailedImages(prev => new Set(prev).add(index))}
                />
              </div>
            </div>
          ) : (
            /* Messages Container */
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-3xl mx-auto px-4 pt-6">
                <div className="flex flex-col gap-4">
                  {messages.map((msg, i) => (
                    <ChatMessage 
                      key={i} 
                      role={msg.role} 
                      content={msg.content} 
                      type={msg.type}
                      event={msg.event}
                      onSendMessage={sendMessage}
                      isLatest={i === messages.length - 1 && msg.role === 'assistant'}
                      isStreaming={msg.isStreaming}
                      onContentChange={
                        i === messages.length - 1 && msg.role === 'assistant'
                          ? () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
                          : undefined
                      }
                    />
                  ))}

                  {/* Processing States */}
                  {isLoading && (
                    <AnalysisStatus 
                      stats={marketData ? {
                        tradeCount: marketData.recentTrades?.length || 0,
                        whaleCount: marketData.whales?.length || 0,
                        buyPressure: marketData.tradeStats?.buyPressure,
                        volume24h: marketData.market?.volume,
                      } : undefined}
                    />
                  )}

                  <div ref={messagesEndRef} className="h-4" />
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
            <div className={`max-w-4xl mx-auto pointer-events-auto ${showSidebar && marketData ? 'lg:mr-[40%]' : ''}`}>
              {isAuthenticated ? (
                <UnifiedInput
                  onSubmit={handleSubmit}
                  disabled={isProcessing}
                  deepResearch={deepResearch}
                  onToggleDeepResearch={handleToggleDeepResearch}
                  showPolyfactualHint={showPolyfactualHint}
                  onDismissHint={dismissPolyfactualHint}
                />
              ) : (
                <AuthGateInline />
              )}
            </div>
          </div>
        </main>

        {/* Market Data Sidebar - Desktop (Fixed) */}
        {showSidebar && (
          <aside className="hidden lg:flex lg:flex-col w-2/5 border-l border-border/50 fixed right-0 top-16 bottom-0 overflow-hidden bg-background/95 backdrop-blur-xl z-40">
            {loadingMarket ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Loading market data...</p>
                </div>
              </div>
            ) : marketData ? (
              <MarketDataPanel data={marketData} onClose={closeSidebar} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Failed to load market data</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Market Data Bottom Sheet - Mobile */}
      {showSidebar && marketData && !loadingMarket && (
        <div className="lg:hidden">
          <MarketDataSheet data={marketData} onClose={closeSidebar} />
        </div>
      )}
    </div>
  );
};

export default Index;
