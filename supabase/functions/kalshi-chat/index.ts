import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.52.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, marketTitle, yesPrice, noPrice, volume, closeTime, initialAnalysis } = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const anthropic = new Anthropic({ apiKey });

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

    // Convert messages to Anthropic format
    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = messages.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content
    }));

    console.log('[kalshi-chat] Processing chat with', messages.length, 'messages for market:', marketTitle);
    console.log('[kalshi-chat] Using Claude claude-sonnet-4-20250514 via Anthropic SDK');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemMessage,
      messages: anthropicMessages,
    });

    const content = response.content[0]?.type === 'text' 
      ? response.content[0].text 
      : '';

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
