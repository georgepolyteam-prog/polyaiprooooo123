import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log("[STT] Received audio data, processing...");

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    console.log("[STT] Processed audio size:", binaryAudio.length, "bytes");
    
    // Check minimum audio size (roughly 0.1 seconds of audio is ~1600 bytes for webm)
    if (binaryAudio.length < 1000) {
      console.log("[STT] Audio too short, returning empty text");
      return new Response(
        JSON.stringify({ text: "" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try ElevenLabs Scribe first
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (ELEVENLABS_API_KEY) {
      try {
        console.log("[STT] Using ElevenLabs Scribe for speech-to-text");
        
        const formData = new FormData();
        const blob = new Blob([binaryAudio.buffer as ArrayBuffer], { type: 'audio/webm' });
        formData.append('file', blob, 'audio.webm');
        formData.append('model_id', 'scribe_v1');
        formData.append('language_code', 'eng');
        
        const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          console.log("[STT] ElevenLabs transcription result:", result.text);
          
          return new Response(
            JSON.stringify({ text: result.text || "" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const errorText = await response.text();
          console.error("[STT] ElevenLabs API error:", response.status, errorText);
          // Fall through to OpenAI
        }
      } catch (elevenLabsError) {
        console.error("[STT] ElevenLabs error, falling back to OpenAI:", elevenLabsError);
        // Fall through to OpenAI
      }
    }

    // Fallback to OpenAI Whisper
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('No STT API key configured (neither ELEVENLABS_API_KEY nor OPENAI_API_KEY)');
    }

    console.log("[STT] Using OpenAI Whisper as fallback");
    
    const formData = new FormData();
    const blob = new Blob([binaryAudio.buffer as ArrayBuffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('temperature', '0');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[STT] Whisper API error:", response.status, errorText);
      
      // If audio is too short, return empty text instead of error
      if (errorText.includes('audio_too_short')) {
        console.log("[STT] Audio too short for Whisper, returning empty text");
        return new Response(
          JSON.stringify({ text: "" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    console.log("[STT] Whisper transcription result:", result.text);

    return new Response(
      JSON.stringify({ text: result.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[STT] voice-to-text error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
