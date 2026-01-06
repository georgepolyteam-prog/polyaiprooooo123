import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, marketTitle, yesPrice, noPrice, volume, closeTime, initialAnalysis } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build system message with market context
    const systemMessage = `You are Claude, an expert prediction market analyst having a conversation about a specific market.

MARKET CONTEXT:
- Question: "${marketTitle}"
- Current YES Price: ${yesPrice}¢ (market implies ${yesPrice}% chance)
- Current NO Price: ${noPrice}¢ (market implies ${noPrice}% chance)  
- Trading Volume: $${(volume || 0).toLocaleString()}
${closeTime ? `- Closes: ${new Date(closeTime).toLocaleDateString()}` : ''}

${initialAnalysis ? `INITIAL AI ANALYSIS:
- AI Probability: ${initialAnalysis.probability}%
- Sentiment: ${initialAnalysis.sentiment}
- Confidence: ${initialAnalysis.confidence}
- Recommendation: ${initialAnalysis.recommendation}
- Key Factors: ${initialAnalysis.keyFactors?.join(', ')}
- Reasoning: ${initialAnalysis.reasoning}` : ''}

RULES:
- Keep responses concise and helpful (2-4 sentences max unless asked for detail)
- Be direct about your analysis and reasoning
- If asked about trading strategy, provide actionable advice
- Always remember: Users can only BUY YES or BUY NO contracts (not "sell" for new positions)
- Reference the initial analysis when relevant
- If unsure about something specific, be honest about limitations`;

    // Prepare conversation with system context
    const conversationMessages: ChatMessage[] = [
      { role: 'system', content: systemMessage },
      ...messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content
      }))
    ];

    console.log('[kalshi-chat] Processing chat with', messages.length, 'messages for market:', marketTitle);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'API credits exhausted.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('[kalshi-chat] Response generated successfully');

    return new Response(JSON.stringify({ message: content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Kalshi chat error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Chat failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
