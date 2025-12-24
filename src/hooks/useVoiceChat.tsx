import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  voiceContent?: string;
  audioUrl?: string;
}

interface CurrentMarketContext {
  url?: string;
  question?: string;
  price?: string;
  platform?: 'polymarket';
  lastPolyResponse?: string;
  lastPolyOffer?: 'whale_data' | 'more_analysis' | 'find_similar' | 'search_results';
  lastWhaleOfferTarget?: string;
  searchResults?: Array<{ question: string; yesPrice: number; url: string; volume: number }>;
  lastDiscussedCandidates?: string[];
  pendingFollowUp?: string;
}

interface LoadState {
  isHighLoad: boolean;
  errorCount: number;
  lastErrorTime?: number;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  slowResponse: boolean;
}

interface PendingMessage {
  id: string;
  content: string;
  isAudioReady: boolean;
}

interface UseVoiceChatReturn {
  messages: VoiceMessage[];
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  processingStep: string;
  marketUrl: string;
  isMarketLoaded: boolean;
  currentMarket: CurrentMarketContext | null;
  loadState: LoadState;
  pendingAssistantMessage: PendingMessage | null;
  conversationId: string;
  setMarketUrl: (url: string) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearMessages: () => void;
  sendTextMessage: (text: string) => Promise<void>;
  interruptSpeaking: () => void;
  cancelProcessing: () => void;
  dismissLoadBanner: () => void;
  dismissMaintenanceBanner: () => void;
  dismissSlowResponseBanner: () => void;
}

export const useVoiceChat = (): UseVoiceChatReturn => {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [marketUrl, setMarketUrl] = useState('');
  const [isMarketLoaded, setIsMarketLoaded] = useState(false);
  const [currentMarket, setCurrentMarket] = useState<CurrentMarketContext | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({
    isHighLoad: false,
    errorCount: 0,
    maintenanceMode: false,
    slowResponse: false,
  });
  
  const slowResponseTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Pending message - shows "Preparing..." until audio is ready
  const [pendingAssistantMessage, setPendingAssistantMessage] = useState<{
    id: string;
    content: string;
    isAudioReady: boolean;
  } | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef<boolean>(false);
  const pendingAudioRef = useRef<string | null>(null);
  // Pre-warmed audio element created during user gesture for iOS compatibility
  const prewarmedAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Mobile audio queue for seamless playback
  const mobileAudioQueueRef = useRef<string[]>([]);
  const isMobileQueuePlayingRef = useRef<boolean>(false);
  const mobileQueueRequestIdRef = useRef<string | null>(null);
  
  const conversationIdRef = useRef<string>(crypto.randomUUID());

  // Track errors for high load detection and maintenance mode
  const trackError = useCallback((statusCode?: number, errorMessage?: string) => {
    const now = Date.now();
    
    // Check for AI provider errors that indicate maintenance
    const isAIProviderError = errorMessage?.toLowerCase().includes('overloaded') ||
      errorMessage?.toLowerCase().includes('capacity') ||
      errorMessage?.toLowerCase().includes('rate limit') ||
      errorMessage?.toLowerCase().includes('service unavailable') ||
      statusCode === 529 || statusCode === 503;
    
    setLoadState(prev => {
      const recentError = prev.lastErrorTime && (now - prev.lastErrorTime) < 30000;
      const newErrorCount = recentError ? prev.errorCount + 1 : 1;
      
      // Show high load banner after 2+ errors in 30s, or on 429/503
      const isHighLoad = newErrorCount >= 2 || statusCode === 429 || statusCode === 503;
      
      // Show maintenance mode for AI provider errors or repeated failures
      const maintenanceMode = isAIProviderError || newErrorCount >= 3;
      const maintenanceMessage = isAIProviderError 
        ? "Our AI services are experiencing high demand. We're working on it!"
        : newErrorCount >= 3 
          ? "We're experiencing technical difficulties. Please try again shortly."
          : undefined;
      
      return {
        isHighLoad: isHighLoad && !maintenanceMode,
        errorCount: newErrorCount,
        maintenanceMode,
        maintenanceMessage,
        lastErrorTime: now,
        slowResponse: prev.slowResponse,
      };
    });
  }, []);

  const dismissLoadBanner = useCallback(() => {
    setLoadState(prev => ({ ...prev, isHighLoad: false }));
  }, []);

  const dismissMaintenanceBanner = useCallback(() => {
    setLoadState(prev => ({ ...prev, maintenanceMode: false, maintenanceMessage: undefined }));
  }, []);

  const dismissSlowResponseBanner = useCallback(() => {
    setLoadState(prev => ({ ...prev, slowResponse: false }));
  }, []);
  
  // Start slow response timer when processing begins
  const startSlowResponseTimer = useCallback(() => {
    if (slowResponseTimerRef.current) {
      clearTimeout(slowResponseTimerRef.current);
    }
    slowResponseTimerRef.current = setTimeout(() => {
      setLoadState(prev => ({ ...prev, slowResponse: true }));
    }, 5000); // 5 seconds
  }, []);
  
  // Clear slow response timer and banner when processing ends
  const clearSlowResponseTimer = useCallback(() => {
    if (slowResponseTimerRef.current) {
      clearTimeout(slowResponseTimerRef.current);
      slowResponseTimerRef.current = null;
    }
    setLoadState(prev => ({ ...prev, slowResponse: false }));
  }, []);

  // Pre-create audio element on first user interaction for mobile compatibility
  // NOTE: AudioContext must be created during an explicit user gesture (prewarmAudio).
  // This function ONLY resumes/unlocks an existing context.
  const unlockAudio = useCallback(async () => {
    try {
      if (audioUnlockedRef.current) return;

      const ctx = audioContextRef.current;
      if (!ctx) {
        console.log('[Audio] No AudioContext yet; will be created on next user gesture');
        audioUnlockedRef.current = true;
        return;
      }

      // Handle iOS-specific "interrupted" state and standard "suspended" state
      const state = ctx.state;
      if (state === 'suspended' || (state as any) === 'interrupted') {
        await ctx.resume();
        console.log('[Audio] ✅ AudioContext resumed from state:', state);
      }

      // Silent unlock via oscillator
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.001;
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);

      audioUnlockedRef.current = true;
      console.log('[Audio] ✅ Unlocked audio context successfully via oscillator');
    } catch (e) {
      console.log('[Audio] Unlock attempt failed:', e);
      // Still mark as attempted to avoid repeated failures
      audioUnlockedRef.current = true;
    }
  }, []);


  const createPrewarmedAudioElement = useCallback((): HTMLAudioElement => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.muted = false;
    // @ts-expect-error playsInline for mobile
    audio.playsInline = true;
    audio.setAttribute('webkit-playsinline', 'true');
    return audio;
  }, []);

  // Create a pre-warmed audio element DURING user gesture (critical for iOS and desktop)
  // This must be called synchronously during tap/click, before any async operations
  const prewarmAudio = useCallback(() => {
    try {
      console.log('[Audio] Pre-warming audio element during user gesture');

      // CRITICAL: Create AudioContext ONLY here (user gesture) and only once.
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
          console.log('[Audio] ✅ Created AudioContext during user gesture, state:', audioContextRef.current.state);
        }
      }

      // Resume if suspended/interrupted (still within gesture handler)
      const ctxState = audioContextRef.current?.state;
      if (ctxState === 'suspended' || (ctxState as any) === 'interrupted') {
        audioContextRef.current?.resume()
          .then(() => console.log('[Audio] ✅ AudioContext resumed, state:', audioContextRef.current?.state))
          .catch((err) => console.error('[Audio] Failed to resume AudioContext:', err));
      }

      prewarmedAudioRef.current = createPrewarmedAudioElement();
      console.log('[Audio] ✅ Prewarmed audio element');
    } catch (error) {
      console.error('[Audio] Failed to prewarm audio:', error);
    }
  }, [createPrewarmedAudioElement]);


  // REMOVED: useEffect that auto-registered event listeners for unlockAudio
  // AudioContext is now created ONLY in prewarmAudio() during explicit user actions
  // This prevents the "AudioContext was not allowed to start" error

  const extractMarketFromResponse = useCallback((content: string): Partial<CurrentMarketContext> | null => {
    const isValidQuestion = (q: string): boolean => {
      if (!q || q.length < 10) return false;
      if (/^(s currently|is at|trading|the market|at \d+)/.test(q.toLowerCase())) return false;
      if (q.split(/\s+/).length < 2) return false;
      return true;
    };
    
    const questionMatch = content.match(/[""]([^""]+)[""]\s*(?:is at|trading at|at)\s*(\d+)/i);
    if (questionMatch && isValidQuestion(questionMatch[1])) {
      return {
        question: questionMatch[1],
        price: questionMatch[2] + '¢',
        lastPolyResponse: content.substring(0, 200),
      };
    }
    
    const marketMatch = content.match(/(\w+(?:\s+\w+){1,6})\s+(?:is at|trading at|at)\s*(\d+)\s*(?:cents|%|¢)/i);
    if (marketMatch && isValidQuestion(marketMatch[1].trim())) {
      return {
        question: marketMatch[1].trim(),
        price: marketMatch[2] + '¢',
        lastPolyResponse: content.substring(0, 200),
      };
    }
    
    const headerMatch = content.match(/📊\s*\[?([^\]\n]{10,100})\]?/);
    if (headerMatch && isValidQuestion(headerMatch[1].trim())) {
      const priceMatch = content.match(/(\d+(?:\.\d+)?)\s*%\s*YES/i);
      return {
        question: headerMatch[1].trim(),
        price: priceMatch ? priceMatch[1] + '¢' : undefined,
        lastPolyResponse: content.substring(0, 200),
      };
    }
    
    const analyzingMatch = content.match(/(?:analyzing|looking at|for)\s+(?:the\s+)?[""]?([^"",.!?]{15,80})[""]?/i);
    if (analyzingMatch && isValidQuestion(analyzingMatch[1].trim())) {
      return {
        question: analyzingMatch[1].trim(),
        lastPolyResponse: content.substring(0, 200),
      };
    }
    
    return null;
  }, []);

  const cleanUrl = useCallback((url: string): string => {
    if (!url) return '';
    
    const doubleUrlMatch = url.match(/(https?:\/\/[^\s]+)(https?:\/\/)/);
    if (doubleUrlMatch) {
      url = url.substring(url.indexOf(doubleUrlMatch[2]));
    }
    
    return url.split(/\s/)[0].trim();
  }, []);

  const handleMarketUrlChange = useCallback((url: string) => {
    const cleanedUrl = cleanUrl(url);
    
    setMarketUrl(cleanedUrl);
    const isPolymarket = cleanedUrl.includes('polymarket.com');
    const isValid = isPolymarket;
    setIsMarketLoaded(isValid);
    
    if (isValid) {
      const urlParts = cleanedUrl.split('/');
      const eventIndex = urlParts.findIndex(p => p === 'event');
      const slug = eventIndex >= 0 ? urlParts[eventIndex + 1]?.split('?')[0] : urlParts.pop()?.split('?')[0] || '';
      const question = slug.replace(/-/g, ' ').replace(/\d+$/, '').trim();
      
      setCurrentMarket({
        url: cleanedUrl,
        question: question || 'Loaded market',
        platform: 'polymarket',
      });
    } else if (!cleanedUrl) {
      setCurrentMarket(null);
    }
  }, [cleanUrl]);

  const interruptSpeaking = useCallback(() => {
    pendingAudioRef.current = null;
    mobileQueueRequestIdRef.current = null;
    mobileAudioQueueRef.current = [];
    isMobileQueuePlayingRef.current = false;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Cancel all processing
  const cancelProcessing = useCallback(() => {
    pendingAudioRef.current = null;
    mobileQueueRequestIdRef.current = null;
    mobileAudioQueueRef.current = [];
    isMobileQueuePlayingRef.current = false;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    
    setIsRecording(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    setProcessingStep('');
    setPendingAssistantMessage(null);
  }, []);

const convertToSpeech = async (text: string, messageId: string): Promise<boolean> => {
    const audioRequestId = crypto.randomUUID();
    pendingAudioRef.current = audioRequestId;
    
    // Detect mobile for chunk size optimization
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const maxChunkSize = isMobile ? 600 : 1200; // Shorter chunks on mobile
    
    try {
      console.log('[TTS] Starting speech generation for message:', messageId, isMobile ? '(mobile)' : '(desktop)');
      
      // For mobile with long text, chunk it
      if (isMobile && text.length > maxChunkSize) {
        console.log(`[TTS] Long text on mobile (${text.length} chars), chunking...`);
        return await playChunkedAudio(text, audioRequestId, maxChunkSize);
      }
      
      // Standard single-request TTS
      return await playSingleAudio(text, audioRequestId);
      
    } catch (error) {
      console.error('[TTS] Error:', error);
      if (pendingAudioRef.current === audioRequestId) {
        setIsSpeaking(false);
        trackError();
      }
      return false;
    }
  };

  // Helper to chunk text by sentences
  const chunkText = (text: string, maxSize: number): string[] => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.length > 0 ? chunks : [text];
  };

  // Play chunked audio for mobile with queue system (pre-fetch next while playing current)
  const playChunkedAudio = async (text: string, audioRequestId: string, maxChunkSize: number): Promise<boolean> => {
    const chunks = chunkText(text, maxChunkSize);
    console.log(`[TTS] Split into ${chunks.length} chunks for queued playback`);
    
    setIsSpeaking(true);
    mobileQueueRequestIdRef.current = audioRequestId;
    mobileAudioQueueRef.current = [];
    isMobileQueuePlayingRef.current = false;
    
    // Start fetching all chunks immediately (don't wait for each)
    const fetchPromises = chunks.map(async (chunk, i) => {
      try {
        console.log(`[TTS] Fetching chunk ${i + 1}/${chunks.length}`);
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-voice', {
          body: { text: chunk, voice: 'nova' },
        });
        
        if (ttsError || !ttsData?.audioContent) {
          console.error(`[TTS] Chunk ${i + 1} fetch error:`, ttsError);
          return null;
        }
        
        return { index: i, audio: ttsData.audioContent };
      } catch (err) {
        console.error(`[TTS] Chunk ${i + 1} fetch failed:`, err);
        return null;
      }
    });
    
    // Process results as they arrive
    const processNextInQueue = async (): Promise<void> => {
      if (mobileQueueRequestIdRef.current !== audioRequestId) {
        console.log('[TTS] Queue playback cancelled');
        return;
      }
      
      if (mobileAudioQueueRef.current.length === 0) {
        isMobileQueuePlayingRef.current = false;
        return;
      }
      
      isMobileQueuePlayingRef.current = true;
      const audioContent = mobileAudioQueueRef.current.shift()!;
      
      console.log(`[TTS] Playing from queue, ${mobileAudioQueueRef.current.length} remaining`);
      
      await playAudioBlobQueued(audioContent, audioRequestId, processNextInQueue);
    };
    
    // As each fetch completes, add to queue in order and start playing
    const results: (null | { index: number; audio: string })[] = new Array(chunks.length).fill(null);
    let nextIndexToQueue = 0;
    
    for (const promise of fetchPromises) {
      const result = await promise;
      if (result) {
        results[result.index] = result;
        
        // Add consecutive ready chunks to queue
        while (results[nextIndexToQueue]) {
          mobileAudioQueueRef.current.push(results[nextIndexToQueue]!.audio);
          console.log(`[TTS] Queued chunk ${nextIndexToQueue + 1}, queue size: ${mobileAudioQueueRef.current.length}`);
          nextIndexToQueue++;
          
          // Start playing if not already
          if (!isMobileQueuePlayingRef.current && mobileAudioQueueRef.current.length > 0) {
            processNextInQueue();
          }
        }
      } else {
        // Skip failed chunk
        nextIndexToQueue++;
      }
    }
    
    // Wait for queue to finish
    while (isMobileQueuePlayingRef.current || mobileAudioQueueRef.current.length > 0) {
      await new Promise(r => setTimeout(r, 100));
      if (mobileQueueRequestIdRef.current !== audioRequestId) break;
    }
    
    if (pendingAudioRef.current === audioRequestId) {
      setIsSpeaking(false);
    }
    return true;
  };

  // Play audio blob and call onEnded when done (for queue system)
  const playAudioBlobQueued = async (base64Audio: string, audioRequestId: string, onEnded: () => void): Promise<void> => {
    // Use proper binary decoding for Blob URL (more compatible than Data URI for desktop)
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    if (mobileQueueRequestIdRef.current !== audioRequestId) {
      onEnded();
      return;
    }
    
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // Use pre-warmed or create new
    let audio: HTMLAudioElement;
    if (prewarmedAudioRef.current) {
      audio = prewarmedAudioRef.current;
      prewarmedAudioRef.current = null;
    } else {
      audio = createPrewarmedAudioElement();
    }

    
    audioRef.current = audio;
    audio.volume = 1;
    audio.muted = false;
    audio.src = audioUrl;
    
    return new Promise((resolve) => {
      let attempted = false;
      let playbackStarted = false;
      
      const attemptPlay = async () => {
        if (attempted) return; // Prevent duplicate calls
        attempted = true;
        
        if (mobileQueueRequestIdRef.current !== audioRequestId) {
          onEnded();
          resolve();
          return;
        }

        // Show speaking UI for queued playback too
        setIsSpeaking(true);
        setIsProcessing(false);
        setProcessingStep('speaking');

        try {
          const ctxState = audioContextRef.current?.state;
          if (ctxState === 'suspended' || (ctxState as any) === 'interrupted') {
            await audioContextRef.current?.resume();
          }
          audio.muted = false;
          await audio.play();
          playbackStarted = true;
          console.log('[TTS Queue] Audio playing');
        } catch (err) {
          console.error('[TTS Queue] Play error:', err);
        }
      };
      
      audio.oncanplaythrough = attemptPlay;
      audio.onloadeddata = () => {
        if (audio.readyState >= 2) attemptPlay();
      };
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        onEnded();
        resolve();
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        onEnded();
        resolve();
      };
      
      // Timeout fallback - only fire if playback hasn't started
      setTimeout(() => {
        if (playbackStarted) return;
        if (audio.readyState >= 1) attemptPlay();
      }, 5000);
    });
  };

  // Play single audio request
  const playSingleAudio = async (text: string, audioRequestId: string): Promise<boolean> => {
    console.log('[TTS] 🎤 Starting TTS generation...');
    const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-voice', {
      body: { text, voice: 'nova' },
    });
    console.log('[TTS] 📦 TTS response received', { hasData: !!ttsData, hasError: !!ttsError });

    if (pendingAudioRef.current !== audioRequestId) {
      console.log('[TTS] Request cancelled');
      return false;
    }

    if (ttsError || !ttsData?.audioContent) {
      console.error('[TTS] ❌ Error from text-to-voice:', ttsError);
      trackError();
      return false;
    }

    console.log('[TTS] 🎵 Audio base64 length:', ttsData.audioContent.length);
    return await playAudioBlob(ttsData.audioContent, audioRequestId);
  };

  // Helper to play base64 audio
  const playAudioBlob = async (base64Audio: string, audioRequestId: string): Promise<boolean> => {
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    console.log('[TTS] playAudioBlob called', { isMobile, audioLength: base64Audio.length, hasPrewarmed: !!prewarmedAudioRef.current });

    // Use proper binary decoding for Blob URL (more compatible than Data URI for desktop)
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    if (pendingAudioRef.current !== audioRequestId) {
      return false;
    }

    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    
    // Use pre-warmed audio element if available (critical for iOS and helpful for desktop)
    let audio: HTMLAudioElement;

    if (prewarmedAudioRef.current) {
      console.log('[TTS] 🎵 Using pre-warmed audio element');
      audio = prewarmedAudioRef.current;
      prewarmedAudioRef.current = null; // Consume it

      // Pause any previous silent playback and reset
      audio.pause();
      audio.currentTime = 0;

      // Prepare next element without touching AudioContext (avoids autoplay warnings)
      prewarmedAudioRef.current = createPrewarmedAudioElement();
    } else {
      // No prewarmed element - create new (may be blocked on desktop)
      console.log('[TTS] ⚠️ No prewarmed audio, creating fresh element');
      audio = createPrewarmedAudioElement();
    }

    
    audioRef.current = audio;
    
    // Ensure properties are set
    audio.volume = 1;
    audio.muted = false;
    
    // Set the actual audio source and force load
    audio.src = audioUrl;
    audio.load(); // Force load new src

    return new Promise((resolve) => {
      let settled = false;
      let attempted = false;
      let playbackStarted = false;
      
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      const attemptPlay = async () => {
        if (attempted) return; // Prevent duplicate calls
        attempted = true;
        
        if (pendingAudioRef.current !== audioRequestId) {
          finish(false);
          return;
        }

        console.log('[TTS] Audio ready, attempting playback. AudioContext state:', audioContextRef.current?.state);

        // Show speaking UI immediately
        setIsSpeaking(true);
        setIsProcessing(false);
        setProcessingStep('speaking');

        try {
          // Resume audio context first - handle iOS "interrupted" state
          const ctxState = audioContextRef.current?.state;
          if (ctxState === 'suspended' || (ctxState as any) === 'interrupted') {
            console.log('[TTS] Resuming AudioContext from:', ctxState);
            await audioContextRef.current?.resume();
          }

          audio.muted = false;
          await audio.play();
          playbackStarted = true;
          console.log('[TTS] Audio playing successfully');
        } catch (err) {
          console.error('[TTS] Play error:', err);
          console.log('[TTS] Retrying with fresh audio element');
          try {
            const freshAudio = new Audio(audioUrl);
            freshAudio.volume = 1;
            // @ts-expect-error playsInline for mobile
            freshAudio.playsInline = true;
            freshAudio.setAttribute('webkit-playsinline', 'true');
            audioRef.current = freshAudio;

            // Keep UI in speaking state
            setIsSpeaking(true);
            setIsProcessing(false);
            setProcessingStep('speaking');

            await freshAudio.play();
            playbackStarted = true;
            console.log('[TTS] Audio playing after retry');

            freshAudio.onended = () => {
              console.log('[TTS] Audio ended (retry)');
              setIsSpeaking(false);
              finish(true);
            };
            freshAudio.onerror = () => {
              console.error('[TTS] Audio error (retry)', freshAudio.error);
              setIsSpeaking(false);
              finish(false);
            };
            return;
          } catch (retryErr) {
            console.error('[TTS] Retry also failed:', retryErr);
            setIsSpeaking(false);
            finish(false);
            return;
          }
        }
      };

      // Prefer canplaythrough, but also use loadeddata for ALL browsers (some never fire canplaythrough)
      audio.oncanplaythrough = attemptPlay;
      audio.onloadeddata = () => {
        if (audio.readyState >= 2) {
          console.log('[TTS] loadeddata fired, attempting play');
          attemptPlay();
        }
      };

      audio.onended = () => {
        console.log('[TTS] Audio ended');
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        finish(true);
      };

      audio.onerror = (e) => {
        console.error('[TTS] Audio error:', e, audio.error);
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        finish(false);
      };

      // Hard timeout - only fire if playback hasn't started
      const hardTimeoutMs = isMobile ? 20000 : 12000;
      setTimeout(() => {
        if (settled || playbackStarted) return;
        console.warn('[TTS] Hard timeout waiting for audio playback. readyState:', audio.readyState);
        setIsSpeaking(false);
        finish(false);
      }, hardTimeoutMs);

      // If it's already ready, try immediately
      if (audio.readyState >= 2) {
        attemptPlay();
      }
    });

  };

  const buildConversationHistory = useCallback(() => {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }, [messages]);

  const getPolyResponse = async (userText: string) => {
    setIsProcessing(true);
    setProcessingStep('analyzing');
    startSlowResponseTimer(); // Start 5-second timer for slow response banner

    try {
      let displayText = userText;
      let actualUserText = userText;
      
      if (userText.startsWith('[URL_ANALYZE]')) {
        const url = userText.replace('[URL_ANALYZE]', '').trim();
        const cleanUrlValue = url.replace(/https:\/\/[^\s]+https:\/\//, 'https://');
        actualUserText = `Analyze this market: ${cleanUrlValue}`;
        displayText = '';
      }
      
      if (displayText && displayText.trim().length > 0) {
        const userMessage: VoiceMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: displayText.trim(),
        };
        setMessages(prev => [...prev, userMessage]);
      }

      const conversationHistory = [...buildConversationHistory(), { role: 'user', content: actualUserText }];

      const effectiveMarketUrl = (marketUrl && marketUrl.trim()) || currentMarket?.url || undefined;
      const marketContext = (effectiveMarketUrl || currentMarket?.question) ? {
        url: effectiveMarketUrl || currentMarket?.url,
        question: currentMarket?.question || 'Loaded market',
        price: currentMarket?.price,
        platform: currentMarket?.platform,
        lastPolyOffer: currentMarket?.lastPolyOffer,
        lastWhaleOfferTarget: currentMarket?.lastWhaleOfferTarget,
        searchResults: currentMarket?.searchResults,
        lastDiscussedCandidates: currentMarket?.lastDiscussedCandidates,
        pendingFollowUp: currentMarket?.pendingFollowUp,
      } : null;

      const isUserJustSayingYes = /^(yes|yeah|sure|ok|okay|yep|please|yea|do it|go ahead|continue|tell me more|let's do it|sounds good|that one|this one)\s*[.!?]*$/i.test(userText.trim());
      const isAskingAboutCurrentMarket = /\b(this one|this market|that one|that market|on this|on that|the one|current|same)\b/i.test(userText);
      const isAskingForWhaleData = /\b(whale|whales|big money|smart money|whale activity|whale data)\b/i.test(userText);
      
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
      let explicitContext = '';

      if (effectiveMarketUrl || currentMarket?.question) {
        explicitContext += `USER HAS A LOADED MARKET.\nURL: ${effectiveMarketUrl || currentMarket?.url}\nQUESTION: ${currentMarket?.question || 'Loaded market'}\n`;
      }
      
      if (currentMarket?.searchResults && currentMarket.searchResults.length > 0) {
        explicitContext += `\nSEARCH RESULTS AVAILABLE:\n${currentMarket.searchResults.map((r, i) => `${i + 1}. "${r.question}" at ${r.yesPrice}% - ${r.url}`).join('\n')}\n`;
      }

      if (lastAssistant?.content) {
        explicitContext += `LAST_POLY_AI_MESSAGE: ${lastAssistant.content.substring(0, 300)}\n`;
        
        const whaleOfferMatch = lastAssistant.content.match(/whale\s+(?:activity|data|trades?)?\s+(?:on|for)\s+(?:this\s+)?(?:specific\s+)?(?:outcome|market)?[^?]*\?/i);
        if (whaleOfferMatch) {
          const marketNameMatch = lastAssistant.content.match(/(?:[""]([^""]+)[""]|for\s+([^.?]+))\s*(?:market|outcome)?/i);
          const extractedTarget = marketNameMatch?.[1] || marketNameMatch?.[2] || currentMarket?.question;
          if (extractedTarget) {
            explicitContext += `POLY_AI_JUST_OFFERED_WHALE_DATA_FOR: "${extractedTarget.trim()}". User is now asking about whale data - USE THIS TARGET!\n`;
          }
        }
        
        const offerMatch = lastAssistant.content.match(/market\s+titled\s+"([^"]+)"|analyze\s+that\s+([^.?]+)\s+market/i);
        const offeredTitle = offerMatch?.[1] || offerMatch?.[2];
        if (offeredTitle) {
          explicitContext += `POLY_AI_LAST_OFFERED_SPECIFIC_MARKET: "${offeredTitle.trim()}". If the user now confirms, ANALYZE THIS EXACT MARKET.\n`;
        }
      }
      
      if (currentMarket?.lastPolyOffer) {
        explicitContext += `POLY_LAST_OFFERED: ${currentMarket.lastPolyOffer}\n`;
        if (currentMarket.lastWhaleOfferTarget) {
          explicitContext += `WHALE_OFFER_TARGET: "${currentMarket.lastWhaleOfferTarget}"\n`;
        }
      }
      
      if (currentMarket?.lastDiscussedCandidates && currentMarket.lastDiscussedCandidates.length > 0) {
        explicitContext += `RECENTLY_DISCUSSED: ${currentMarket.lastDiscussedCandidates.join(', ')}\n`;
      }
      
      if (currentMarket?.pendingFollowUp) {
        explicitContext += `PENDING_FOLLOWUP: "${currentMarket.pendingFollowUp}"\n`;
      }
      
      if (isAskingForWhaleData && isAskingAboutCurrentMarket) {
        const target = currentMarket?.lastWhaleOfferTarget || currentMarket?.question || 'the current market';
        explicitContext += `USER_WANTS_WHALE_DATA_ON_CURRENT_MARKET: "${target}"\n`;
      }

      if (isUserJustSayingYes) {
        explicitContext += `USER_IS_CONFIRMING: User replied "${userText}" as confirmation.\n`;
        if (currentMarket?.lastPolyOffer === 'whale_data') {
          const target = currentMarket.lastWhaleOfferTarget || currentMarket.question || 'the current market';
          explicitContext += `ACTION: User wants WHALE DATA for "${target}".\n`;
        }
      } else {
        explicitContext += `RAW_USER_INPUT: ${userText}\n`;
      }

      const voiceResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poly-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: conversationHistory,
          detailMode: 'quick',
          marketUrl: effectiveMarketUrl || undefined,
          currentMarket: marketContext,
          explicitContext,
          voiceMode: true,
          conversationId: conversationIdRef.current,
        }),
      });

      if (!voiceResponse.ok) {
        const errorText = await voiceResponse.text().catch(() => '');
        let errorMessage = 'Failed to get response';
        
        // Parse error message for user-friendly display
        try {
          const errorData = JSON.parse(errorText);
          if (voiceResponse.status === 429) {
            errorMessage = errorData.error || 'Too many requests. Please slow down.';
            toast.warning(errorMessage);
          } else {
            errorMessage = errorData.error || errorMessage;
          }
        } catch { /* not JSON */ }
        
        trackError(voiceResponse.status, errorMessage);
        throw new Error(errorMessage);
      }

      // Check if response is SSE stream or JSON
      const contentType = voiceResponse.headers.get('content-type') || '';
      const isStreaming = contentType.includes('text/event-stream') || contentType.includes('text/plain');
      
      let voiceData: { voiceSummary?: string; currentMarket?: any } = {};
      
      if (isStreaming) {
        // Parse SSE stream
        const reader = voiceResponse.body?.getReader();
        const decoder = new TextDecoder();
        let assistantText = '';

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim();
                if (jsonStr === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    assistantText += content;
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        }
        
        voiceData = { voiceSummary: assistantText };
      } else {
        // Regular JSON response
        voiceData = await voiceResponse.json();
      }

      if (voiceData.voiceSummary) {
        const messageId = crypto.randomUUID();
        
        // Set pending message - will show "Preparing..." 
        setPendingAssistantMessage({
          id: messageId,
          content: voiceData.voiceSummary,
          isAudioReady: false,
        });
        
        // Update market context
        if (voiceData.currentMarket && (voiceData.currentMarket.url || voiceData.currentMarket.question || voiceData.currentMarket.searchResults)) {
          const responseText = voiceData.voiceSummary.toLowerCase();
          let lastPolyOffer: CurrentMarketContext['lastPolyOffer'] = undefined;
          let whaleOfferTarget: string | undefined;
          let discussedCandidates: string[] = [];
          
          const candidateMatches = voiceData.voiceSummary.matchAll(/(?:on|for|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g);
          for (const match of candidateMatches) {
            if (match[1] && match[1].length > 3 && !['Yes', 'No', 'Buy', 'Sell'].includes(match[1])) {
              discussedCandidates.push(match[1]);
            }
          }
          
          if (responseText.includes('whale') && responseText.includes('?')) {
            lastPolyOffer = 'whale_data';
            const whaleTargetMatch = voiceData.voiceSummary.match(/whale\s+(?:activity|data|trades?)?\s+(?:on|for)\s+([^?]+)\?/i);
            if (whaleTargetMatch) {
              whaleOfferTarget = whaleTargetMatch[1].trim();
            } else if (discussedCandidates.length > 0) {
              whaleOfferTarget = discussedCandidates[discussedCandidates.length - 1];
            } else if (voiceData.currentMarket?.question) {
              whaleOfferTarget = voiceData.currentMarket.question;
            }
          } else if (responseText.includes('more detail') || responseText.includes('full breakdown')) {
            lastPolyOffer = 'more_analysis';
          } else if (responseText.includes('which one') || (responseText.includes('found') && responseText.includes('market'))) {
            lastPolyOffer = 'search_results';
          }
          
          let pendingFollowUp: string | undefined;
          const lastQuestionMatch = voiceData.voiceSummary.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[^?]*\?[^?]*$/);
          if (lastQuestionMatch && lastQuestionMatch[1]) {
            pendingFollowUp = lastQuestionMatch[1];
          }
          
          setCurrentMarket({
            url: voiceData.currentMarket.url,
            question: voiceData.currentMarket.question,
            price: voiceData.currentMarket.price,
            platform: voiceData.currentMarket.platform,
            lastPolyResponse: voiceData.voiceSummary.substring(0, 200),
            lastPolyOffer,
            lastWhaleOfferTarget: whaleOfferTarget,
            searchResults: voiceData.currentMarket.searchResults,
            lastDiscussedCandidates: discussedCandidates.length > 0 ? discussedCandidates : undefined,
            pendingFollowUp,
          });
        } else {
          const extractedMarket = extractMarketFromResponse(voiceData.voiceSummary);
          if (extractedMarket) {
            setCurrentMarket(prev => ({
              url: prev?.url,
              platform: prev?.platform,
              searchResults: prev?.searchResults,
              ...extractedMarket,
            }));
          } else {
            setCurrentMarket(prev => prev ? {
              ...prev,
              lastPolyResponse: voiceData.voiceSummary.substring(0, 200),
            } : null);
          }
        }
        
        // Keep processing state active during TTS - message will appear after speaking
        // Update step to indicate we're generating voice
        setProcessingStep('generating_voice');
        
        // Generate TTS and play audio with safety timeout so we never get stuck
        const speakingTimeout = setTimeout(() => {
          console.error('[TTS] ⚠️ Speaking timeout - forcing reset');
          setIsSpeaking(false);
          setIsProcessing(false);
        }, 30000);

        const audioSuccess = await Promise.race([
          convertToSpeech(voiceData.voiceSummary, messageId),
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 31000);
          }),
        ]);

        clearTimeout(speakingTimeout);

        // AFTER TTS completes (or fails), add the message and clear processing
        const assistantMessage: VoiceMessage = {
          id: messageId,
          role: 'assistant',
          content: voiceData.voiceSummary,
          voiceContent: voiceData.voiceSummary,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setPendingAssistantMessage(null);
        setIsProcessing(false);
        setProcessingStep('');
        
        // Audio may silently fail but response is still shown - no error toast needed
}

    } catch (error) {
      console.error('Error getting Poly response:', error);
      // Track error so the maintenance banner can surface repeated issues
      trackError();
      setIsProcessing(false);
      setProcessingStep('');
    } finally {
      clearSlowResponseTimer(); // Clear slow response timer when done
    }
  };

const sendTextMessage = useCallback(async (text: string) => {
    if (isProcessing) return;
    
    // SET UI STATE IMMEDIATELY - before any async operations for instant feedback
    setIsProcessing(true);
    setProcessingStep('analyzing');
    
    // CRITICAL: Pre-warm audio element SYNCHRONOUSLY during user gesture
    prewarmAudio();
    
    if (!text.trim()) {
      setIsProcessing(false);
      setProcessingStep('');
      return;
    }
    
    try {
      await unlockAudio();
      interruptSpeaking();
      await getPolyResponse(text);
    } catch (error) {
      console.error('[Voice] sendTextMessage error:', error);
      setIsProcessing(false);
      setProcessingStep('');
    }
  }, [isProcessing, interruptSpeaking, marketUrl, messages, currentMarket, unlockAudio, prewarmAudio]);

const startRecording = useCallback(async () => {
    // SET UI STATE IMMEDIATELY for responsive feedback
    setIsRecording(true);
    setProcessingStep('listening');
    
    // CRITICAL: Pre-warm audio element SYNCHRONOUSLY during user gesture
    prewarmAudio();
    
    // Unlock audio in parallel (don't block recording start)
    unlockAudio().catch(() => {});
    interruptSpeaking();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      toast.error('Microphone access needed. Please enable it in your browser settings.');
    }
  }, [interruptSpeaking, unlockAudio, prewarmAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setProcessingStep('transcribing');

    try {
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const { data: sttData, error: sttError } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio },
      });

      if (sttError || !sttData?.text) {
        trackError();
        throw new Error('Could not understand audio. Please try again.');
      }

      const userText = sttData.text;

      setProcessingStep('');
      
      await getPolyResponse(userText);

    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Please try again. Tap the mic to speak.');
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentMarket(null);
    interruptSpeaking();
    conversationIdRef.current = crypto.randomUUID();
  }, [interruptSpeaking]);

return {
    messages,
    isRecording,
    isProcessing,
    isSpeaking,
    processingStep,
    marketUrl,
    isMarketLoaded,
    currentMarket,
    loadState,
    pendingAssistantMessage,
    conversationId: conversationIdRef.current,
    setMarketUrl: handleMarketUrlChange,
    startRecording,
    stopRecording,
    clearMessages,
    sendTextMessage,
    interruptSpeaking,
    cancelProcessing,
    dismissLoadBanner,
    dismissMaintenanceBanner,
    dismissSlowResponseBanner,
  };
};
