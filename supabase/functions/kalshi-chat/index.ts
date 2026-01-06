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

    // Build comprehensive system message with full market context
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemMessage = `You are Claude, an expert prediction market analyst and trading advisor. You're having a focused conversation about a specific Kalshi/DFlow prediction market. Be helpful, insightful, and actionable.

TODAY'S DATE: ${currentDate}

═══════════════════════════════════════════════════════════════
MARKET BEING DISCUSSED
═══════════════════════════════════════════════════════════════
📊 Question: "${marketTitle}"
💰 Current YES Price: ${yesPrice}¢ (market implies ${yesPrice}% probability)
💰 Current NO Price: ${noPrice}¢ (market implies ${noPrice}% probability)
📈 Trading Volume: $${(volume || 0).toLocaleString()}
${closeTime ? `⏰ Market Closes: ${new Date(closeTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}

${initialAnalysis ? `═══════════════════════════════════════════════════════════════
INITIAL AI ANALYSIS (for reference)
═══════════════════════════════════════════════════════════════
🎯 AI Probability Estimate: ${initialAnalysis.probability}%
📊 Market Sentiment: ${initialAnalysis.sentiment}
🔒 Confidence Level: ${initialAnalysis.confidence}
💡 Recommendation: ${initialAnalysis.recommendation}
${initialAnalysis.keyFactors?.length ? `🔑 Key Factors:\n${initialAnalysis.keyFactors.map((f: string) => `   • ${f}`).join('\n')}` : ''}
${initialAnalysis.reasoning ? `\n📝 Reasoning: ${initialAnalysis.reasoning}` : ''}` : ''}

═══════════════════════════════════════════════════════════════
YOUR GUIDELINES
═══════════════════════════════════════════════════════════════
1. Be conversational but substantive - this is a follow-up chat, not a formal report
2. Reference the market context and initial analysis when relevant
3. Provide actionable trading insights when asked
4. Explain your reasoning clearly
5. Be honest about uncertainty - prediction markets are inherently uncertain
6. Remember: On Kalshi/DFlow, users can BUY YES or BUY NO contracts
7. Consider recent news, historical patterns, and market dynamics
8. If the user asks about entry points, discuss price levels and timing
9. Keep responses focused but thorough - aim for 2-4 paragraphs unless more detail is requested`;

    // Prepare full conversation with system context
    const conversationMessages: ChatMessage[] = [
      { role: 'system', content: systemMessage },
      ...messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content
      }))
    ];

    console.log('[kalshi-chat] Processing chat with', messages.length, 'messages for market:', marketTitle);
    console.log('[kalshi-chat] Using openai/gpt-5 for high-quality responses');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error('[kalshi-chat] API error:', status);
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'API credits exhausted. Please try again later.' }), {
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

    console.log('[kalshi-chat] ✅ Response generated successfully, length:', content.length);

    return new Response(JSON.stringify({ message: content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[kalshi-chat] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Chat failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
