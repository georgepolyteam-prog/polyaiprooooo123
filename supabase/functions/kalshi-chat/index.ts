import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.52.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= DEEP RESEARCH API =============
const DEEP_RESEARCH_API_KEY = Deno.env.get("DEEP_RESEARCH_API_KEY");

async function getDeepResearch(query: string): Promise<{ answer: string; citations?: any[] } | null> {
  if (!DEEP_RESEARCH_API_KEY) {
    console.log("[DeepResearch] API key not configured");
    return null;
  }

  try {
    console.log(`[DeepResearch] Starting research for: ${query.substring(0, 100)}...`);
    const response = await fetch("https://factsai.org/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEP_RESEARCH_API_KEY}`,
      },
      body: JSON.stringify({
        query: query,
        text: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[DeepResearch] API error: ${response.status}`);
      console.error(`[DeepResearch] Error body: ${errorBody}`);
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      console.error(`[DeepResearch] Failed: ${data.error || "Unknown error"}`);
      return null;
    }

    console.log(`[DeepResearch] ✅ Success, received ${data.data?.answer?.length || 0} chars`);
    return data.data;
  } catch (error) {
    console.error("[DeepResearch] Error:", error);
    return null;
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Claude's native web search tool
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
} as const;

// Kalshi-specific tools
const KALSHI_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_news",
    description: "Search for recent news about a topic. Use this when the user asks about current news, recent developments, or wants to know what's happening with a market topic.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query for finding news",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_deep_research",
    description: "Get in-depth research and analysis on a topic. Use this when user asks for detailed analysis, background information, or comprehensive research on a prediction market topic.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The research query - be specific about what information is needed",
        },
      },
      required: ["query"],
    },
  },
];

// Execute tool calls
async function executeToolCall(
  tool: { name: string; id: string; input: any }
): Promise<string> {
  console.log(`[Tool] Executing ${tool.name} with input:`, tool.input);

  try {
    if (tool.name === "search_news") {
      // Use web search for news - Claude's native web search handles this
      return JSON.stringify({
        note: "Use the web_search tool for current news",
        suggestion: `Search for: ${tool.input.query} news recent`,
      });
    }

    if (tool.name === "get_deep_research") {
      const research = await getDeepResearch(tool.input.query);
      if (research) {
        return JSON.stringify({
          answer: research.answer,
          citations: research.citations || [],
          source: "Deep Research API",
        });
      }
      return JSON.stringify({
        error: "Deep research unavailable",
        fallback: "Use web_search tool to find information instead",
      });
    }

    return JSON.stringify({ error: `Unknown tool: ${tool.name}` });
  } catch (error) {
    console.error(`[Tool] Error executing ${tool.name}:`, error);
    return JSON.stringify({ error: `Tool execution failed: ${error}` });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, marketTitle, yesPrice, noPrice, volume, closeTime, initialAnalysis, useDeepResearch } = await req.json();

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

    const systemMessage = `You are Poly, an expert prediction market analyst and trading advisor. You're having a focused conversation about a specific DFlow/Kalshi-style prediction market. Be helpful, insightful, and actionable.

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
YOUR CAPABILITIES
═══════════════════════════════════════════════════════════════
You have access to powerful tools:
1. **Web Search** - Search the internet for current news, recent events, and real-time information
2. **Deep Research** - Get comprehensive research and analysis on any topic
3. **Market Analysis** - Provide trading insights, entry points, and recommendations

WHEN TO USE TOOLS:
- User asks about recent news → Use web_search
- User asks "what's happening with..." → Use web_search
- User asks for deep analysis or research → Use get_deep_research
- User asks about current events affecting the market → Use web_search

═══════════════════════════════════════════════════════════════
YOUR GUIDELINES
═══════════════════════════════════════════════════════════════
1. Be conversational but substantive - this is a follow-up chat, not a formal report
2. Reference the market context and initial analysis when relevant
3. Provide actionable trading insights when asked
4. USE YOUR TOOLS when the user asks about news, current events, or needs research
5. Be honest about uncertainty - prediction markets are inherently uncertain
6. Remember: On DFlow/Kalshi, users can BUY YES or BUY NO contracts
7. Consider recent news, historical patterns, and market dynamics
8. If the user asks about entry points, discuss price levels and timing
9. When you search for information, summarize the key findings clearly
10. Always cite sources when using research or news data`;

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content
    }));

    console.log('[kalshi-chat] Processing chat with', messages.length, 'messages for market:', marketTitle);
    console.log('[kalshi-chat] Using Claude claude-sonnet-4-20250514 with tools (web search + deep research)');

    // Prepare tools - always include web search and optionally deep research
    const tools: (Anthropic.Tool | typeof WEB_SEARCH_TOOL)[] = [WEB_SEARCH_TOOL];
    
    // Add deep research tool if available
    if (DEEP_RESEARCH_API_KEY) {
      tools.push(KALSHI_TOOLS[1]); // get_deep_research
    }

    // Initial request with tools
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemMessage,
      messages: anthropicMessages,
      tools: tools as any,
    });

    // Handle tool calls in a loop (similar to poly-chat)
    let loopCount = 0;
    const maxLoops = 5;

    while (response.stop_reason === 'tool_use' && loopCount < maxLoops) {
      loopCount++;
      console.log(`[kalshi-chat] Tool use loop ${loopCount}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) break;

      // Build tool results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        console.log(`[kalshi-chat] Processing tool: ${toolBlock.name}`);
        
        // Handle web_search results (they come back automatically in Claude's response)
        if (toolBlock.name === 'web_search') {
          // Web search is handled natively by Claude, just acknowledge it
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: 'Web search completed - results included in response',
          });
        } else {
          // Execute our custom tools
          const result = await executeToolCall({
            name: toolBlock.name,
            id: toolBlock.id,
            input: toolBlock.input,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: result,
          });
        }
      }

      // Continue conversation with tool results
      anthropicMessages.push({
        role: 'assistant',
        content: response.content,
      });

      anthropicMessages.push({
        role: 'user',
        content: toolResults,
      });

      // Get next response
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemMessage,
        messages: anthropicMessages,
        tools: tools as any,
      });
    }

    // Extract final text response
    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      }
    }

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
