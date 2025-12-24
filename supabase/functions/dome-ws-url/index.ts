import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const domeApiKey = Deno.env.get('DOME_API_KEY');
    
    if (!domeApiKey) {
      console.error('DOME_API_KEY not found in secrets');
      return new Response(
        JSON.stringify({ error: 'Dome API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the WebSocket URL with the API key embedded
    const wsUrl = `wss://ws.domeapi.io/${domeApiKey}`;
    
    console.log('Returning Dome WebSocket URL');
    
    return new Response(
      JSON.stringify({ wsUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in dome-ws-url function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
