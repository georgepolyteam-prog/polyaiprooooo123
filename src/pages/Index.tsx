import { useEffect, useRef, useCallback, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { BarChart3, Zap, TrendingUp, Search, Loader2, Send, Sparkles, LineChart, DollarSign, Activity, Target, ExternalLink, Layers, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TopBar } from "@/components/TopBar";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { AnalysisStatus } from "@/components/chat/AnalysisStatus";
import { ChatUpgradeBanner } from "@/components/chat/ChatUpgradeBanner";
import { UnifiedInput } from "@/components/UnifiedInput";
import { MarketDataPanel } from "@/components/MarketDataPanel";
import { MarketDataSheet } from "@/components/MarketDataSheet";
import { AuthGateInline } from "@/components/AuthGateInline";

import { usePolyChat } from "@/hooks/usePolyChat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "wagmi";
import polyLogo from "@/assets/poly-logo-new.png";

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
    gradient: "from-purple-500/10 to-cyan-500/10",
    glowColor: "purple",
    oddsColor: "text-purple-400",
    icon: <BarChart3 className="w-6 h-6" />,
    image: FALLBACK_IMAGES["who-will-trump-nominate-as-fed-chair"],
  },
  {
    title: "Bitcoin Price 2025",
    subtitle: "What price will it hit?",
    odds: "12%",
    volume: "$8.2M",
    url: "https://polymarket.com/event/what-price-will-bitcoin-hit-in-2025?tid=1765983317043",
    gradient: "from-purple-500/10 to-cyan-500/10",
    glowColor: "purple",
    oddsColor: "text-purple-400",
    icon: <DollarSign className="w-6 h-6" />,
    image: FALLBACK_IMAGES["what-price-will-bitcoin-hit-in-2025"],
  },
  {
    title: "Super Bowl 2026",
    subtitle: "Championship Winner",
    odds: "48%",
    volume: "$2.1M",
    url: "https://polymarket.com/event/super-bowl-champion-2026-731?tid=1765983295435",
    gradient: "from-purple-500/10 to-cyan-500/10",
    glowColor: "purple",
    oddsColor: "text-purple-400",
    icon: <Target className="w-6 h-6" />,
    image: FALLBACK_IMAGES["super-bowl-champion-2026-731"],
  },
  {
    title: "2028 Election",
    subtitle: "Presidential Winner",
    odds: "23%",
    volume: "$5.4M",
    url: "https://polymarket.com/event/presidential-election-winner-2028?tid=1765983270320",
    gradient: "from-purple-500/10 to-cyan-500/10",
    glowColor: "purple",
    oddsColor: "text-purple-400",
    icon: <TrendingUp className="w-6 h-6" />,
    image: FALLBACK_IMAGES["presidential-election-winner-2028"],
  },
];

const capabilities = [
  { icon: <Sparkles className="w-5 h-5 text-purple-400" />, text: "Analyze any market URL - paste it and I'll break it down" },
  { icon: <BarChart3 className="w-5 h-5 text-purple-400" />, text: "Research recent news and events affecting markets" },
  { icon: <Search className="w-5 h-5 text-purple-400" />, text: "Track trade activity, historical pricing and smart money movements" },
  { icon: <DollarSign className="w-5 h-5 text-purple-400" />, text: "Compare odds across markets and identify value bets" },
  { icon: <LineChart className="w-5 h-5 text-purple-400" />, text: "Live orderflow, trades, and market sentiment" },
  { icon: <Activity className="w-5 h-5 text-purple-400" />, text: "Real-time data powered by Polymarket & Dome", hasLinks: true },
];

const quickQuestions = [
  "What's the edge on Trump Fed Chair?",
  "Show me recent whale trades",
  "Any arbitrage opportunities?",
  "What's the latest news on Bitcoin markets?",
];

const Index = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  // Auth state
  const { user, session, isLoading: authLoading } = useAuth();
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  
  // Check if user is authenticated (either via email or wallet)
  // For session auth: require both session AND access_token to be present
  // Wallet must have both isConnected=true AND a valid address
  const hasValidSession = !!session?.access_token;
  const hasValidWallet = isWalletConnected && !!walletAddress;
  const isAuthenticated = hasValidSession || hasValidWallet;
  
  // Pass wallet address only when actually connected
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

  // Lock sidebar to an explicit user-selected market to prevent auto-detection overrides
  const [userSelectedMarketUrl, setUserSelectedMarketUrl] = useState<string | null>(null);
  const userSelectedMarketUrlRef = useRef<string | null>(null);
  // Markets data - start empty to prevent flash of stale default data
  const [markets, setMarkets] = useState<ExampleMarket[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

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
        // Use server-side proxy to fetch market data
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
            // Prefer API image, then fallback image, then default
            image: apiData.image || fallbackImage || defaultMarkets[index].image,
            // Multi-market indicator
            isMultiMarket: apiData.isMultiMarket || false,
            marketCount: apiData.marketCount || 1,
          };
        });

        setFailedImages(new Set()); // Reset failed images for fresh data
        setMarkets(results);
      } catch (error) {
        console.error("Failed to fetch market data:", error);
      } finally {
        setLoadingMarkets(false);
      }
    };

    fetchMarketData();
  }, []);

  // Detect Polymarket URL in message
  const detectMarketUrl = (message: string): string | null => {
    const urlPattern = /https:\/\/polymarket\.com\/(event|market)\/[^\s]+/i;
    const match = message.match(urlPattern);
    return match ? match[0] : null;
  };

  // Fetch market data
  const fetchMarketDataForSidebar = async (url: string) => {
    if (url === currentMarketUrl && marketData) return;
    
    // Clear old data immediately to prevent stale content display
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

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [messages, isLoading]);

  // Helper to check if URL has a specific market slug
  const urlHasMarketSlug = (url: string): boolean => {
    const pathParts = url.split('/').filter(Boolean);
    return pathParts.length >= 5;
  };

  // Check messages for market URLs and auto-open sidebar
  // IMPORTANT: never override an explicit user-selected market
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
  // Use currentMarketContext from usePolyChat - tracks user's explicit market selection
  useEffect(() => {
    if (currentMarketContext?.url) {
      const url = currentMarketContext.url;
      const hasMarketSlug = urlHasMarketSlug(url);
      console.log(`[Sidebar] Context URL - hasMarketSlug: ${hasMarketSlug}`, url);
      if (hasMarketSlug) {
        // Set ref immediately to prevent race conditions with the URL scan effect
        userSelectedMarketUrlRef.current = url;
        setUserSelectedMarketUrl(url); // also store in state for debugging/visibility
        fetchMarketDataForSidebar(url);
      }
    }
  }, [currentMarketContext?.url]);

  // Handle autoAnalyze from Markets page navigation
  useEffect(() => {
    const state = location.state as { 
      initialMessage?: string;
      autoAnalyze?: boolean;
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
    
    if (state?.autoAnalyze && state?.marketContext && !hasAskedRef.current && messages.length === 0) {
      hasAskedRef.current = true;
      const { marketContext } = state;
      
      // Send the analyze message
      sendMessage(`Analyze this market: ${marketContext.url}`);
      
      // Open the sidebar with market data
      fetchMarketDataForSidebar(marketContext.url);
      
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
    } else if (state?.initialMessage && !hasAskedRef.current && messages.length === 0) {
      hasAskedRef.current = true;
      sendMessage(state.initialMessage);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, sendMessage, messages.length]);

  // Handle market context from URL
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
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-pink-500/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <TopBar />
      <ChatUpgradeBanner />

      <div className="flex flex-1 relative min-h-0">
        {/* Main Chat Area */}
        <main className={`relative flex-1 flex flex-col pb-32 overflow-y-auto min-h-0 ${showSidebar && marketData ? 'lg:pr-[40%]' : ''}`}>
          {!hasMessages ? (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Logo with glow and pulse rings */}
                <div className="flex justify-center mb-8 animate-fade-in">
                  <div className="relative">
                    {/* Animated pulse rings */}
                    <div className="absolute inset-[-12px] rounded-full border-2 border-purple-500/30 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-[-24px] rounded-full border border-cyan-500/20 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                    <div className="absolute inset-[-36px] rounded-full border border-pink-500/10 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
                    
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full blur-2xl opacity-50 animate-pulse" />
                    
                    {/* Main logo container */}
                    <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/30">
                      <img src={polyLogo} alt="Poly" className="w-14 h-14 object-contain" />
                    </div>
                    
                    {/* Online indicator */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[#0f0a1f] flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Heading */}
                <div className="text-center mb-10 animate-fade-in animate-delay-100">
                  <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
                    Hey, I'm Poly
                  </h1>
                  <p className="text-xl text-gray-400">
                    Your AI analyst for Polymarket markets
                  </p>
                </div>

                {/* Capabilities - Hidden on mobile */}
                <div className="mb-12 animate-fade-in animate-delay-200 hidden md:block">
                  <p className="text-gray-400 mb-6 text-center">I can help you with:</p>
                  <div className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                    {capabilities.map((cap, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5">
                        {cap.icon}
                        {cap.hasLinks ? (
                          <span className="text-gray-300 text-sm flex items-center gap-1 flex-wrap">
                            Real-time data powered by{" "}
                            <a 
                              href="https://polymarket.com" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-0.5"
                            >
                              Polymarket
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {" & "}
                            <a 
                              href="https://domeapi.io" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 font-medium transition-all duration-300 hover:from-cyan-500/30 hover:to-purple-500/30 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                            >
                              <Zap className="w-3 h-3" />
                              Dome
                              <ExternalLink className="w-2.5 h-2.5 opacity-0 -ml-0.5 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200" />
                            </a>
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">{cap.text}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example Markets */}
                <div className="mb-10 animate-fade-in animate-delay-300">
                  <p className="text-gray-400 mb-6 text-center font-medium">Try analyzing these live markets:</p>
                  
                  {loadingMarkets ? (
                    // Skeleton loading state
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div 
                          key={i} 
                          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                        >
                          <Skeleton className="h-24 w-full bg-white/10" />
                          <div className="p-4 space-y-3">
                            <Skeleton className="h-4 w-3/4 bg-white/10" />
                            <Skeleton className="h-3 w-1/2 bg-white/10" />
                            <div className="flex justify-between items-center">
                              <Skeleton className="h-5 w-14 bg-white/10" />
                              <Skeleton className="h-3 w-12 bg-white/10" />
                            </div>
                            <Skeleton className="h-8 w-full rounded-lg bg-white/10" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Actual market cards
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {markets.map((market, i) => (
                        <button
                          key={i}
                          onClick={() => handleMarketClick(market.url)}
                          className={`group relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden text-left transition-all duration-300 hover:shadow-xl hover:shadow-${market.glowColor}-500/20 hover:-translate-y-1 hover:border-${market.glowColor}-500/50`}
                        >
                          {/* Gradient background */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${market.gradient} opacity-50 group-hover:opacity-100 transition-opacity duration-300`} />
                          
                          {/* Market Image or Icon */}
                          {market.image && !failedImages.has(i) ? (
                            <div className="h-24 w-full overflow-hidden relative">
                              <img 
                                key={market.image}
                                src={market.image} 
                                alt={market.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                onError={() => {
                                  setFailedImages(prev => new Set(prev).add(i));
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0a1f] via-transparent to-transparent" />
                            </div>
                          ) : (
                            <div className={`h-24 w-full bg-gradient-to-br ${market.gradient} flex items-center justify-center`}>
                              <div className="text-white/30 group-hover:text-white/50 transition-colors">
                                {market.icon}
                              </div>
                            </div>
                          )}
                          
                          <div className="relative p-4">
                            <h3 className="font-bold text-white mb-1 text-sm line-clamp-1">{market.title}</h3>
                            <p className="text-xs text-gray-400 mb-3 line-clamp-1">{market.subtitle}</p>
                            <div className="flex items-center justify-between text-sm mb-3">
                              {market.isMultiMarket ? (
                                <>
                                  <span className="text-purple-400 font-medium flex items-center gap-1">
                                    <Layers className="w-3 h-3" />
                                    {market.marketCount} outcomes
                                  </span>
                                  <span className="text-gray-500 text-xs">{market.volume}</span>
                                </>
                              ) : (
                                <>
                                  <span className={`font-bold ${market.oddsColor}`}>{market.odds}</span>
                                  <span className="text-gray-500 text-xs">{market.volume}</span>
                                </>
                              )}
                            </div>
                            <div className={`w-full py-1.5 rounded-lg text-center text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${isAuthenticated ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-gray-400'}`}>
                              {!isAuthenticated && <Lock className="w-3 h-3" />}
                              Analyze
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Questions */}
                <div className="animate-fade-in animate-delay-400">
                  <p className="text-gray-400 mb-4 text-center text-sm">Or ask me anything:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {quickQuestions.map((question, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickQuestion(question)}
                        disabled={isProcessing}
                        className={`px-4 py-2 border rounded-full text-sm transition-all duration-300 flex items-center gap-1.5 ${
                          isAuthenticated 
                            ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-purple-500/50 text-gray-300 hover:text-white' 
                            : 'bg-white/5 border-white/5 text-gray-500'
                        }`}
                      >
                        {!isAuthenticated && <Lock className="w-3 h-3" />}
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
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

          {/* Input Area - Show auth gate or input based on auth status */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0f0a1f] via-[#0f0a1f]/95 to-transparent pointer-events-none">
            <div className={`max-w-4xl mx-auto pointer-events-auto ${showSidebar && marketData ? 'lg:mr-[40%]' : ''}`}>
              {isAuthenticated ? (
                <UnifiedInput
                  onSubmit={handleSubmit}
                  disabled={isProcessing}
                  deepResearch={deepResearch}
                  onToggleDeepResearch={toggleDeepResearch}
                />
              ) : (
                <AuthGateInline />
              )}
            </div>
          </div>
        </main>

        {/* Market Data Sidebar - Desktop (Fixed) */}
        {showSidebar && (
          <aside className="hidden lg:flex lg:flex-col w-2/5 border-l border-white/10 fixed right-0 top-16 bottom-0 overflow-hidden bg-[#0f0a1f]/95 backdrop-blur-xl z-40">
            {loadingMarket ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Loading market data...</p>
                </div>
              </div>
            ) : marketData ? (
              <MarketDataPanel data={marketData} onClose={closeSidebar} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400">Failed to load market data</p>
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
