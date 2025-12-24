import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory queue storage (shared with poly-chat via global Map)
// Note: In production, this would use Redis or a database
const QUEUE_PROCESS_INTERVAL_MS = 5000; // Process 1 request every 5 seconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { queueId } = await req.json();
    
    if (!queueId) {
      return new Response(
        JSON.stringify({ error: 'queueId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Since we can't share memory between edge function instances,
    // we estimate position based on when the request was queued
    // The queueId format: q-{timestamp}-{random}
    const parts = queueId.split('-');
    const queuedAt = parseInt(parts[1]) || Date.now();
    const elapsed = Date.now() - queuedAt;
    
    // Estimate position: each position takes ~5 seconds to process
    const estimatedOriginalPosition = Math.ceil(elapsed / QUEUE_PROCESS_INTERVAL_MS);
    const currentPosition = Math.max(0, 10 - estimatedOriginalPosition); // Assume started at ~10
    
    // After 60 seconds, assume queue has cleared
    const isReady = elapsed > 60000 || currentPosition === 0;
    const estimatedWait = isReady ? 0 : currentPosition * 5;

    console.log(`[QueueStatus] id=${queueId}, elapsed=${elapsed}ms, position=${currentPosition}, ready=${isReady}`);

    return new Response(
      JSON.stringify({
        position: currentPosition,
        estimatedWait,
        ready: isReady,
        elapsed: Math.floor(elapsed / 1000)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[QueueStatus] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check queue status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
