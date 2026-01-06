import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";

interface MarketData {
  id: number;
  question: string;
  yesPrice: number;
  volume: number;
  url?: string;
  // Irys blockchain verification fields
  isBlockchainVerified?: boolean;
  txId?: string;
  proofUrl?: string;
  resolvedOutcome?: string | null;
  category?: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "market_selection" | "analysis" | "error";
  event?: {
    title: string;
    slug?: string;
    markets: MarketData[];
    // Irys-specific fields
    source?: 'irys' | 'gamma' | string;
    isBlockchainVerified?: boolean;
    totalCount?: number;
    sampleTxId?: string;
  };
  marketSlug?: string;
  eventSlug?: string;
  marketUrl?: string;
  isStreaming?: boolean;
}

interface LoadState {
  isHighLoad: boolean;
  queuePosition?: number;
  estimatedWait?: number;
}

interface QueueState {
  isQueued: boolean;
  queueId: string | null;
  position: number;
  estimatedWait: number;
  countdown: number;
  cascadeAttempts?: string[];
}

interface CurrentMarketContext {
  slug: string;
  eventSlug?: string;
  question?: string;
  url?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poly-chat`;
const QUEUE_STATUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/queue-status`;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 5000;

export type AnalysisStep = 'idle' | 'analyzing' | 'fetching' | 'news' | 'whales' | 'edge' | 'deep_research' | 'complete';

export type ChatMode = 'regular' | 'polyfactual' | 'historical';

// Keywords that auto-trigger historical/Irys mode
const HISTORICAL_KEYWORDS = [
  'historical', 'history', 'past', 'resolved', 'accuracy',
  'how did', 'how accurate', 'track record', 'performance',
  'previous', 'old markets', 'archived', 'what happened',
  'how well did', 'calibration', 'backtesting', 'past predictions'
];

// Check if a message should trigger historical mode
const isHistoricalQuery = (message: string): boolean => {
  const lower = message.toLowerCase();
  return HISTORICAL_KEYWORDS.some(kw => lower.includes(kw));
};

export const usePolyChat = (session?: Session | null, walletAddress?: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detailMode, setDetailMode] = useState<"advanced" | "quick">("advanced");
  const [mode, setMode] = useState<ChatMode>('regular');
  
  // Derive boolean flags for API compatibility
  const deepResearch = mode === 'polyfactual';
  const irysMode = mode === 'historical';
  const [loadState, setLoadState] = useState<LoadState>({ isHighLoad: false });
  const [retryingIn, setRetryingIn] = useState(0);
  const [currentMarketContext, setCurrentMarketContextState] = useState<CurrentMarketContext | null>(null);
  const [sidebarMarketData, setSidebarMarketData] = useState<any>(null);
  
  // Ref-based context for immediate access in sendMessage (avoids stale closures)
  const immediateContextRef = useRef<CurrentMarketContext | null>(null);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
  const [queueState, setQueueState] = useState<QueueState>({
    isQueued: false,
    queueId: null,
    position: 0,
    estimatedWait: 0,
    countdown: 0,
  });
  
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const queuedMessageRef = useRef<string>('');
  const isAnalyzingRef = useRef(false); // Prevent recursive analysis triggers

  // Always-accurate snapshot of messages to avoid stale closures in async callbacks
  const messagesRef = useRef<Message[]>([]);
  const analysisLockRef = useRef<string | null>(null);
  const lastRequestRef = useRef<{ key: string; at: number } | null>(null);
  const inFlightRef = useRef(false);

  // Stable conversation ID for the session
  const conversationId = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Wrapper to set both state and ref for market context
  const setCurrentMarketContext = useCallback((contextOrUpdater: CurrentMarketContext | null | ((prev: CurrentMarketContext | null) => CurrentMarketContext | null)) => {
    if (typeof contextOrUpdater === 'function') {
      // Callback form - update via state setter and sync ref
      setCurrentMarketContextState(prev => {
        const newContext = contextOrUpdater(prev);
        immediateContextRef.current = newContext;
        return newContext;
      });
    } else {
      // Direct value form
      immediateContextRef.current = contextOrUpdater;
      setCurrentMarketContextState(contextOrUpdater);
    }
  }, []);

  const clearRetryState = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    retryCountRef.current = 0;
    setRetryingIn(0);
    setLoadState({ isHighLoad: false });
    setQueueState({
      isQueued: false,
      queueId: null,
      position: 0,
      estimatedWait: 0,
      countdown: 0,
    });
    queuedMessageRef.current = '';
  }, []);

  // Poll queue status
  const checkQueueStatus = useCallback(async (queueId: string): Promise<{ position: number; estimatedWait: number; ready: boolean }> => {
    try {
      const response = await fetch(QUEUE_STATUS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ queueId }),
      });
      
      if (!response.ok) {
        return { position: 0, estimatedWait: 0, ready: true };
      }
      
      return await response.json();
    } catch (error) {
      console.error('Queue status check failed:', error);
      return { position: 0, estimatedWait: 0, ready: true };
    }
  }, []);

  // Start queue countdown and polling
  const startQueuePolling = useCallback((queueId: string, originalMessage: string) => {
    queuedMessageRef.current = originalMessage;
    
    // Countdown timer - decrement every second
    countdownRef.current = setInterval(() => {
      setQueueState(prev => {
        const newCountdown = Math.max(0, prev.countdown - 1);
        return { ...prev, countdown: newCountdown };
      });
    }, 1000);
    
    // Poll for queue status every 5 seconds
    pollRef.current = setInterval(async () => {
      const status = await checkQueueStatus(queueId);
      
      if (status.ready) {
        console.log('[Queue] Ready! Retrying request...');
        clearRetryState();
        // Small delay then retry
        setTimeout(() => {
          sendMessage(queuedMessageRef.current, true);
        }, 500);
      } else {
        setQueueState(prev => ({
          ...prev,
          position: status.position,
          estimatedWait: status.estimatedWait,
          countdown: status.estimatedWait,
        }));
      }
    }, 5000);
  }, [checkQueueStatus, clearRetryState]);

  const sendMessage = useCallback(async (userMessage: string, isRetry = false, isHiddenAnalysis = false, forceDeepResearch?: boolean) => {
    const normalized = userMessage.trim();
    const requestKey = `${isRetry ? "retry" : "send"}|${isHiddenAnalysis ? "hidden" : "show"}|${normalized}`;

    const now = Date.now();
    const last = lastRequestRef.current;

    // Prevent accidental double-sends (e.g. duplicate triggerAnalysis timers)
    if (last && last.key === requestKey && (inFlightRef.current || now - last.at < 400)) {
      console.log("[Chat] Deduped request:", requestKey);
      return;
    }

    lastRequestRef.current = { key: requestKey, at: now };
    inFlightRef.current = true;

    // For hidden analysis requests, don't show user message but include it in payload
    if (!isRetry && !isHiddenAnalysis) {
      const userMsg: Message = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);
      clearRetryState();
    }

    // Use forceDeepResearch if provided, otherwise fall back to state
    const effectiveDeepResearch = forceDeepResearch ?? deepResearch;
    
    // Auto-detect historical queries and enable irysMode
    const effectiveIrysMode = irysMode || isHistoricalQuery(userMessage);
    if (effectiveIrysMode && !irysMode) {
      console.log('[Chat] Auto-detected historical query, enabling Irys mode');
    }

    setIsLoading(true);
    if (effectiveDeepResearch) {
      setAnalysisStep('deep_research');
    } else {
      setAnalysisStep('analyzing');
    }

    let assistantContent = "";
    let isCurrentlyStreaming = false;
    
    const updateAssistant = (chunk: string, streaming = true) => {
      assistantContent += chunk;
      isCurrentlyStreaming = streaming;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent, isStreaming: streaming } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantContent, isStreaming: streaming }];
      });
    };
    
    // Mark streaming complete
    const finishStreaming = () => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, isStreaming: false } : m
          );
        }
        return prev;
      });
    };

    // CRITICAL: Always include the new message in the payload, even on retry
    const currentMessages = [...messagesRef.current, { role: "user" as const, content: userMessage }];

    // Build auth context - prioritize session token, fallback to wallet
    // IMPORTANT: session.access_token must be fresh; if missing, user needs re-auth
    const authToken = session?.access_token || null;
    const effectiveWallet = walletAddress || null;
    const authType = authToken ? 'supabase' : effectiveWallet ? 'wallet' : 'none';
    
    // Guard: if we have neither auth method, don't send (prevents 401 loop)
    if (!authToken && !effectiveWallet) {
      console.warn('[Chat] No auth credentials available - aborting request');
      toast.error("Please sign in or connect your wallet to chat.");
      setIsLoading(false);
      setAnalysisStep('idle');
      inFlightRef.current = false;
      return;
    }
    
    console.log('[Chat] Auth context:', { 
      hasAuthToken: !!authToken, 
      hasWallet: !!effectiveWallet, 
      authType 
    });

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: currentMessages,
          detailMode,
          conversationId,
          // Use ref for immediate access (avoids stale state from closure)
          currentMarket: immediateContextRef.current || currentMarketContext,
          sidebarData: sidebarMarketData,
          // Auth context for the edge function
          authToken,
          walletAddress: effectiveWallet,
          authType,
          deepResearch: effectiveDeepResearch,
          irysMode: effectiveIrysMode
        }),
      });

      // Handle 202 Accepted - request is queued
      if (response.status === 202) {
        const queueData = await response.json();
        console.log('[Queue] Request queued:', queueData);
        
        setQueueState({
          isQueued: true,
          queueId: queueData.queueId,
          position: queueData.queuePosition,
          estimatedWait: queueData.estimatedWaitSeconds,
          countdown: queueData.estimatedWaitSeconds,
          cascadeAttempts: queueData.cascadeAttempted,
        });
        
        setLoadState({
          isHighLoad: true,
          queuePosition: queueData.queuePosition,
          estimatedWait: queueData.estimatedWaitSeconds,
        });
        
        // Show toast
        toast.info(`High demand - you're #${queueData.queuePosition} in queue`, {
          description: `All servers are busy. We tried ${queueData.cascadeAttempted?.join(', ')}. ETA: ~${queueData.estimatedWaitSeconds}s`,
          duration: 8000,
        });
        
        // Start polling
        startQueuePolling(queueData.queueId, userMessage);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Make blocked/forbidden errors visible in-chat (prevents "endless loading" feel)
        if (response.status === 403) {
          const msg = errorData.error || "Chat is temporarily unavailable.";
          toast.error(msg);
          updateAssistant(
            "I couldn't start the chat request right now. Please refresh and try again in a moment.",
            false
          );
          setIsLoading(false);
          return;
        }

        if (response.status === 429) {
          const queuePosition = errorData.queuePosition || Math.floor(Math.random() * 10) + 1;
          const estimatedWait = errorData.estimatedWait || 30;

          setLoadState({
            isHighLoad: true,
            queuePosition,
            estimatedWait,
          });

          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            const delay = BASE_RETRY_DELAY * retryCountRef.current;
            const delaySeconds = Math.ceil(delay / 1000);

            setRetryingIn(delaySeconds);

            // Countdown
            let remaining = delaySeconds;
            countdownRef.current = setInterval(() => {
              remaining -= 1;
              setRetryingIn(Math.max(0, remaining));
              if (remaining <= 0 && countdownRef.current) {
                clearInterval(countdownRef.current);
              }
            }, 1000);

            toast.info(`High traffic - retrying in ${delaySeconds}s (attempt ${retryCountRef.current}/${MAX_RETRIES})`);

            retryTimeoutRef.current = setTimeout(() => {
              sendMessage(userMessage, true);
            }, delay);

            setIsLoading(false);
            return;
          } else {
            toast.error("Servers are busy. Please try again in a moment.");
            clearRetryState();
          }
        } else if (response.status === 402) {
          const needsCreditsMsg = errorData.needsCredits 
            ? `Out of credits (${errorData.creditsBalance || 0} remaining). Deposit POLY tokens to continue.`
            : "AI credits depleted. Please add more credits to continue.";
          toast.error(needsCreditsMsg, {
            action: {
              label: "Get Credits",
              onClick: () => window.dispatchEvent(new CustomEvent("open-credits-dialog"))
            }
          });
          updateAssistant(
            "You're out of credits. Visit the **[Credits page](/credits)** to deposit POLY tokens and continue chatting.",
            false
          );
        } else {
          toast.error(errorData.error || "Failed to get response from Poly");
        }
        setIsLoading(false);
        return;
      }

      // Success - clear retry state
      clearRetryState();

      // Check content-type to determine response format
      const contentType = response.headers.get("content-type") || "";
      
      // Handle JSON responses (chooser, errors, etc.)
      if (contentType.includes("application/json")) {
        const jsonData = await response.json();
        
        // Update market context if returned
        if (jsonData.marketSlug || jsonData.eventSlug || jsonData.marketUrl) {
          setCurrentMarketContext({
            slug: jsonData.marketSlug || '',
            eventSlug: jsonData.eventSlug,
            question: jsonData.metadata?.market,
            url: jsonData.marketUrl
          });
        }
        
        // Handle market selection with triggerAnalysis flag
        // This means user selected a market from chooser - show message and auto-analyze
        if (jsonData.triggerAnalysis && jsonData.marketUrl) {
          // Prevent duplicated triggers for the same market (e.g. two timers firing)
          if (analysisLockRef.current === jsonData.marketUrl) {
            console.log('[Chat] Duplicate triggerAnalysis blocked for:', jsonData.marketUrl);
            if (jsonData.content) {
              updateAssistant(jsonData.content, false);
            }
            setIsLoading(false);
            setAnalysisStep('idle');
            return;
          }

          // Prevent recursive analysis - check if already analyzing OR if this message was already an analysis request
          const isAlreadyAnalysisRequest = userMessage.toLowerCase().includes('analyze this market');

          if (isAnalyzingRef.current || isAlreadyAnalysisRequest) {
            console.log('[Chat] Skipping recursive trigger - already analyzing or was analysis request');
            if (jsonData.content) {
              updateAssistant(jsonData.content, false);
            }
            setIsLoading(false);
            setAnalysisStep('idle');
            isAnalyzingRef.current = false;
            return;
          }

          console.log('[Chat] Market selected, triggering analysis for:', jsonData.marketUrl);
          isAnalyzingRef.current = true;
          analysisLockRef.current = jsonData.marketUrl;

          // Update market context immediately
          setCurrentMarketContext({
            slug: jsonData.marketSlug || '',
            eventSlug: jsonData.eventSlug,
            question: jsonData.metadata?.market,
            url: jsonData.marketUrl
          });

          // Auto-trigger full analysis after a delay to ensure sidebar loads first
          setTimeout(async () => {
            console.log('[Chat] Sending follow-up analysis request for:', jsonData.marketUrl);
            const analysisPrompt = `Analyze this market in detail: ${jsonData.marketUrl}`;
            try {
              // isHiddenAnalysis=true to include message in payload but not show as user message
              await sendMessage(analysisPrompt, false, true);
            } finally {
              isAnalyzingRef.current = false;
              if (analysisLockRef.current === jsonData.marketUrl) {
                analysisLockRef.current = null;
              }
            }
          }, 500);
          return;
        }

        // Handle multi-market chooser response (both Gamma and Irys)
        if (jsonData.showChooser && jsonData.markets) {
          // Store event slug for follow-up market selections
          if (jsonData.eventSlug) {
            setCurrentMarketContext(prev => ({
              ...prev,
              slug: prev?.slug || '',
              eventSlug: jsonData.eventSlug
            }));
          }
          
          const isIrysSource = jsonData.source === 'irys' || jsonData.isBlockchainVerified;
          
          const marketSelectionMsg: Message = {
            role: "assistant",
            content: jsonData.content || "",
            type: "market_selection",
            event: {
              title: jsonData.eventTitle || "Select a market",
              slug: jsonData.eventSlug,
              markets: jsonData.markets.map((m: any) => ({
                id: m.index,
                question: m.question,
                yesPrice: parseFloat(m.yesPrice) || 0,
                volume: m.volume || 0,
                url: m.url,
                // Irys-specific fields
                isBlockchainVerified: m.isBlockchainVerified || isIrysSource,
                txId: m.txId,
                proofUrl: m.proofUrl,
                resolvedOutcome: m.resolvedOutcome,
                category: m.category,
              })),
              // Irys event-level fields
              source: jsonData.source,
              isBlockchainVerified: isIrysSource,
              totalCount: jsonData.totalCount,
              sampleTxId: jsonData.sampleTxId,
            },
            eventSlug: jsonData.eventSlug
          };
          setMessages((prev) => [...prev, marketSelectionMsg]);
          setIsLoading(false);
          setAnalysisStep('idle');
          return;
        }
        
        if (jsonData.content) {
          updateAssistant(jsonData.content, false);
        } else if (jsonData.error) {
          throw new Error(jsonData.error);
        }
        setIsLoading(false);
        return;
      }

      // Use streaming reader for all devices (including mobile) for real-time updates
      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content, true);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content, true);
          } catch {}
        }
      }
      
      // Mark streaming complete
      finishStreaming();
      
      // Increment chat count on successful message
      const storedChats = localStorage.getItem("poly_chat_count");
      const current = storedChats ? parseInt(storedChats, 10) : 0;
      localStorage.setItem("poly_chat_count", (current + 1).toString());
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to connect to Poly. Please try again.");
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: "Connection hiccup - give me a sec and try again. If this keeps happening, refresh the page." 
        },
      ]);
    } finally {
      setIsLoading(false);
      setAnalysisStep('idle');
      inFlightRef.current = false;
    }
  }, [detailMode, deepResearch, irysMode, clearRetryState, sidebarMarketData, startQueuePolling, conversationId, currentMarketContext, session, walletAddress]);

  const toggleDetailMode = useCallback(() => {
    setDetailMode((prev) => prev === "advanced" ? "quick" : "advanced");
    toast.success(
      detailMode === "advanced" 
        ? "Switched to Quick Analysis mode" 
        : "Switched to Advanced Analysis mode"
    );
  }, [detailMode]);

  // Clear only messages (keeps market context) - used when switching markets in terminal
  const clearMessages = useCallback(() => {
    setMessages([]);
    clearRetryState();
  }, [clearRetryState]);

  // Full reset - clears messages AND market context (for /chat page reset)
  const resetChat = useCallback(() => {
    setMessages([]);
    setCurrentMarketContext(null);
    clearRetryState();
  }, [clearRetryState, setCurrentMarketContext]);

  const dismissLoadBanner = useCallback(() => {
    setLoadState(prev => ({ ...prev, isHighLoad: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    detailMode,
    toggleDetailMode,
    mode,
    setMode,
    deepResearch,
    irysMode,
    clearMessages,
    resetChat,
    loadState,
    retryingIn,
    dismissLoadBanner,
    currentMarketContext,
    setCurrentMarketContext,
    conversationId,
    setSidebarMarketData,
    analysisStep,
    queueState,
  };
};
