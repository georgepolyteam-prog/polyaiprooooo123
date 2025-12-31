import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DFLOW_API_KEY = Deno.env.get('DFLOW_API_KEY')!;
// Production endpoints (use c. prefix for production, dev- prefix for development)
const DFLOW_METADATA_API = 'https://c.prediction-markets-api.dflow.net';
const DFLOW_QUOTE_API = 'https://c.quote-api.dflow.net';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    
    console.log(`DFlow API action: ${action}`, params);
    
    let url = '';
    let method = 'GET';
    let body = null;
    
    switch (action) {
      // Prediction Market Metadata API endpoints
      case 'getEvents':
        // Get events with nested markets - main discovery endpoint
        const status = params?.status || 'active';
        const limit = params?.limit || 100;
        url = `${DFLOW_METADATA_API}/api/v1/events?withNestedMarkets=true&status=${status}&limit=${limit}`;
        break;
      
      case 'getMarkets':
        // Get all markets
        url = `${DFLOW_METADATA_API}/api/v1/markets`;
        break;
      
      case 'getMarketByTicker':
        // Get single market by ticker
        url = `${DFLOW_METADATA_API}/api/v1/markets/${params.ticker}`;
        break;
      
      case 'getOrderbook':
        // Get orderbook for a market
        url = `${DFLOW_METADATA_API}/api/v1/orderbook/${params.ticker}`;
        break;
      
      case 'getTrades':
        // Get trades for a market
        const tradesLimit = params?.limit || 50;
        url = `${DFLOW_METADATA_API}/api/v1/trades/${params.ticker}?limit=${tradesLimit}`;
        break;
      
      case 'getSeries':
        // Get all series (market groups)
        url = `${DFLOW_METADATA_API}/api/v1/series`;
        break;
      
      case 'getTagsByCategories':
        // Get tags organized by categories
        url = `${DFLOW_METADATA_API}/api/v1/tags/categories`;
        break;
      
      // Quote API endpoints (for trading) - uses GET /order
      case 'getOrder':
        const orderParams = new URLSearchParams({
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: params.amount.toString(),
          slippageBps: (params.slippageBps || 50).toString(),
          userPublicKey: params.userWallet,
        });
        url = `${DFLOW_QUOTE_API}/order?${orderParams.toString()}`;
        method = 'GET';
        break;
      
      case 'getOrderStatus':
        url = `${DFLOW_QUOTE_API}/order-status?signature=${params.signature}`;
        method = 'GET';
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    console.log(`Fetching: ${method} ${url}`);
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'x-api-key': DFLOW_API_KEY,
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      fetchOptions.body = body;
    }
    
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DFlow API error: ${response.status} ${errorText}`);
      throw new Error(`DFlow API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`DFlow API success, response keys:`, Object.keys(data));
    
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
