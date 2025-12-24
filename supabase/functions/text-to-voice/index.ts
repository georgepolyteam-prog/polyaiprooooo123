import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ElevenLabs voice IDs - using MALE voices
const ELEVENLABS_VOICES = {
  nova: 'onwK4e9ZLuTAKqWW03F9', // Daniel - clear male voice (default)
  alloy: 'TX3LPaxmHKxFdv7VOQHJ', // Liam - natural male
  echo: 'JBFqnCBsd6RMkjVDRZzb', // George - authoritative male
  shimmer: 'N2lVS1w4EtoT3dr4eOWO', // Callum - confident male
};

// Clean text for better TTS pronunciation
function prepareSpeechText(text: string): string {
  let cleaned = text;
  
  // Replace standalone uppercase "NO" with lowercase "no" (so it's said as word, not letters)
  cleaned = cleaned.replace(/\bNO\b/g, 'no');
  cleaned = cleaned.replace(/\bYES\b/g, 'yes');
  
  // Replace money abbreviations with natural speech (remove the $ to avoid "dollar thousand")
  cleaned = cleaned.replace(/\$(\d+(?:\.\d+)?)\s*M\b/gi, '$1 million dollars');
  cleaned = cleaned.replace(/\$(\d+(?:\.\d+)?)\s*B\b/gi, '$1 billion dollars');
  cleaned = cleaned.replace(/\$(\d+(?:\.\d+)?)\s*K\b/gi, '$1 thousand dollars');
  
  // Also handle non-currency versions (e.g., "2.8M volume")
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*M\b/gi, '$1 million');
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*B\b/gi, '$1 billion');
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*K\b/gi, '$1 thousand');
  
  // Fix percentage - say "percent" not "%"
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent');
  
  // Replace "¢" with "cents"
  cleaned = cleaned.replace(/(\d+)\s*¢/g, '$1 cents');
  
  // Clean up emojis for cleaner speech
  cleaned = cleaned.replace(/📊|🐋|💰|🔥|⚠️|✅|❌|🎯|💡|📈|📉/g, '');
  
  console.log('[TTS] Original text:', text.substring(0, 100));
  console.log('[TTS] Cleaned text:', cleaned.substring(0, 100));
  
  return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, voice = 'nova' } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    // Aggressively truncate for faster TTS - 800 chars is ~15-20 seconds of speech
    let speechText = text;
    const MAX_LENGTH = 1200;
    if (speechText.length > MAX_LENGTH) {
      const truncated = speechText.substring(0, MAX_LENGTH);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastQuestion = truncated.lastIndexOf('?');
      const breakPoint = Math.max(lastPeriod, lastQuestion);
      speechText = breakPoint > MAX_LENGTH / 2 ? truncated.substring(0, breakPoint + 1) : truncated;
      console.log(`Truncated text from ${text.length} to ${speechText.length} chars for faster TTS`);
    }

    // Apply pronunciation fixes
    speechText = prepareSpeechText(speechText);
    
    console.log("Generating speech for text:", speechText.substring(0, 100) + "...");

    // Try ElevenLabs first for faster response
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (ELEVENLABS_API_KEY) {
      try {
        const voiceId = ELEVENLABS_VOICES[voice as keyof typeof ELEVENLABS_VOICES] || ELEVENLABS_VOICES.nova;
        
        console.log("Using ElevenLabs turbo model for low-latency TTS with male voice");
        
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: speechText,
              model_id: 'eleven_turbo_v2_5', // Fastest model for real-time
              output_format: 'mp3_22050_32', // Smaller file, faster transfer
              voice_settings: {
                stability: 0.6,
                similarity_boost: 0.8,
                style: 0.2, // Professional, less expressive
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64Audio = base64Encode(arrayBuffer);
          
          console.log("ElevenLabs generated audio, size:", arrayBuffer.byteLength, "bytes");

          return new Response(
            JSON.stringify({ audioContent: base64Audio }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        } else {
          const errorText = await response.text();
          console.error("ElevenLabs API error:", response.status, errorText);
          // Fall through to OpenAI fallback
        }
      } catch (elevenLabsError) {
        console.error("ElevenLabs error, falling back to OpenAI:", elevenLabsError);
        // Fall through to OpenAI fallback
      }
    }

    // Fallback to OpenAI TTS - use male voice
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('No TTS API key configured (neither ELEVENLABS_API_KEY nor OPENAI_API_KEY)');
    }

    console.log("Using OpenAI TTS as fallback with male voice (onyx)");

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: speechText,
        voice: 'onyx', // Male voice for OpenAI
        response_format: 'mp3',
        speed: 1.15,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI TTS API error:", response.status, errorText);
      throw new Error(`Failed to generate speech: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(arrayBuffer);

    console.log("OpenAI generated audio, size:", arrayBuffer.byteLength, "bytes");

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error("text-to-voice error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
