import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { marketTitle, yesPrice, noPrice, volume, closeTime } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const prompt = `Analyze this prediction market and provide a trading insight:

Market Question: "${marketTitle}"
Current YES Price: ${yesPrice}¢ (${yesPrice}% implied probability)
Current NO Price: ${noPrice}¢ (${noPrice}% implied probability)
Trading Volume: $${(volume || 0).toLocaleString()}
${closeTime ? `Closes: ${new Date(closeTime).toLocaleDateString()}` : ''}

Based on this market data, provide:
1. Your estimated probability (0-100) that YES will win
2. Your sentiment (bullish, bearish, or neutral)
3. Your confidence level (high, medium, low)
4. 3-4 key factors that could influence this outcome
5. Brief reasoning (2-3 sentences)
6. A clear trading recommendation

Respond in this exact JSON format:
{
  "probability": <number 0-100>,
  "sentiment": "<bullish|bearish|neutral>",
  "confidence": "<high|medium|low>",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "reasoning": "<your analysis>",
  "recommendation": "<your recommendation>"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert prediction market analyst. Analyze markets objectively based on available data and general knowledge. Always respond with valid JSON only, no markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
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

    // Parse JSON from response (handle potential markdown code blocks)
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI analysis');
    }

    console.log('AI Analysis complete for:', marketTitle);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Kalshi analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Analysis failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
