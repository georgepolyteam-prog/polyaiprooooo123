import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DFLOW_API_KEY = Deno.env.get('DFLOW_API_KEY')!;
const DFLOW_PREDICTION_API = 'https://c.prediction-markets-api.dflow.net';
const DFLOW_QUOTE_API = 'https://c.quote-api.dflow.net';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    
    console.log(`DFlow API action: ${action}`, params);
    
    let endpoint = '';
    let method = 'GET';
    let body = null;
    let baseUrl = DFLOW_PREDICTION_API;
    
    switch (action) {
      case 'discoverMarkets':
        endpoint = '/markets';
        break;
      
      case 'getMarketDetails':
        endpoint = `/markets/${params.marketId}`;
        break;
      
      case 'getUserPositions':
        endpoint = `/positions/${params.walletAddress}`;
        break;
      
      case 'getQuote':
        baseUrl = DFLOW_QUOTE_API;
        endpoint = '/quote';
        method = 'POST';
        body = JSON.stringify(params);
        break;
      
      case 'executeSwap':
        baseUrl = DFLOW_QUOTE_API;
        endpoint = '/swap';
        method = 'POST';
        body = JSON.stringify(params);
        break;
      
      case 'settlePosition':
        endpoint = '/settle';
        method = 'POST';
        body = JSON.stringify(params);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    const url = `${baseUrl}${endpoint}`;
    console.log(`Fetching: ${method} ${url}`);
    
    const response = await fetch(url, {
      method,
      headers: {
        'x-api-key': DFLOW_API_KEY,
        'Content-Type': 'application/json',
      },
      ...(body && { body }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DFlow API error: ${response.status} ${errorText}`);
      throw new Error(`DFlow API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`DFlow API response:`, data);
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('DFlow API error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
