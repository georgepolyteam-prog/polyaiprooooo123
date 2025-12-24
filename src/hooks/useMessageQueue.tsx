import { useState, useCallback, useRef, useEffect } from "react";

interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
  retryCount: number;
}

interface QueueState {
  isQueued: boolean;
  position: number;
  estimatedWait: number;
  retryingIn: number;
}

export const useMessageQueue = () => {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [queueState, setQueueState] = useState<QueueState>({
    isQueued: false,
    position: 0,
    estimatedWait: 0,
    retryingIn: 0,
  });
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const addToQueue = useCallback((content: string): string => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: QueuedMessage = {
      id,
      content,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    setQueue(prev => [...prev, message]);
    return id;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(m => m.id !== id));
  }, []);

  const getNextMessage = useCallback((): QueuedMessage | null => {
    return queue[0] || null;
  }, [queue]);

  const incrementRetry = useCallback((id: string) => {
    setQueue(prev => prev.map(m => 
      m.id === id ? { ...m, retryCount: m.retryCount + 1 } : m
    ));
  }, []);

  const startRetryCountdown = useCallback((seconds: number, onComplete: () => void) => {
    setQueueState(prev => ({ ...prev, isQueued: true, retryingIn: seconds }));
    
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    
    let remaining = seconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setQueueState(prev => ({ ...prev, retryingIn: Math.max(0, remaining) }));
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }, 1000);
    
    retryTimeoutRef.current = setTimeout(() => {
      setQueueState(prev => ({ ...prev, isQueued: false, retryingIn: 0 }));
      onComplete();
    }, seconds * 1000);
  }, []);

  const updateQueuePosition = useCallback((position: number, estimatedWait: number) => {
    setQueueState(prev => ({
      ...prev,
      isQueued: true,
      position,
      estimatedWait,
    }));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueState({
      isQueued: false,
      position: 0,
      estimatedWait: 0,
      retryingIn: 0,
    });
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return {
    queue,
    queueState,
    addToQueue,
    removeFromQueue,
    getNextMessage,
    incrementRetry,
    startRetryCountdown,
    updateQueuePosition,
    clearQueue,
    queueLength: queue.length,
  };
};
