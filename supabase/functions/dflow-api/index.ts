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
        // Get trades for a market - handled specially below for 404 graceful fallback
        const tradesLimit = params?.limit || 50;
        url = `${DFLOW_METADATA_API}/api/v1/trades/${params.ticker}?limit=${tradesLimit}`;
        break;
      
      case 'filterOutcomeMints':
        // Filter user's token mints to only prediction market outcome mints
        // IMPORTANT: DFlow API expects 'addresses' field, not 'mints'!
        const addressesToFilter = params.mints || [];
        console.log(`[filterOutcomeMints] Filtering ${addressesToFilter.length} addresses`);
        url = `${DFLOW_METADATA_API}/api/v1/filter_outcome_mints`;
        method = 'POST';
        body = JSON.stringify({ addresses: addressesToFilter });
        break;
      
      case 'getMarketsByMints':
        // Batch lookup markets by mint addresses using POST /api/v1/markets/batch
        const batchMints = params.mints || [];
        console.log(`Fetching markets batch for ${batchMints.length} mints...`);
        
        if (batchMints.length === 0) {
          return new Response(JSON.stringify({ markets: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Use the correct POST batch endpoint
        const batchResponse = await fetch(
          `${DFLOW_METADATA_API}/api/v1/markets/batch`,
          {
            method: 'POST',
            headers: {
              'x-api-key': DFLOW_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mints: batchMints }),
          }
        );
        
        if (!batchResponse.ok) {
          const errorText = await batchResponse.text();
          console.error(`Batch markets error: ${batchResponse.status} ${errorText}`);
          
          if (batchResponse.status === 404 || batchResponse.status === 400) {
            return new Response(JSON.stringify({ markets: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          return new Response(JSON.stringify({ error: errorText }), {
            status: batchResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const batchData = await batchResponse.json();
        console.log(`Batch found ${(batchData.markets || []).length} markets`);
        
        return new Response(JSON.stringify(batchData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      
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
          // For prediction markets
          predictionMarketSlippageBps: '50',
        });
        url = `${DFLOW_QUOTE_API}/order?${orderParams.toString()}`;
        method = 'GET';
        break;
      
      case 'getOrderStatus':
        url = `${DFLOW_QUOTE_API}/order-status?signature=${params.signature}`;
        method = 'GET';
        break;
      
      // Search events
      case 'searchEvents':
        const query = encodeURIComponent(params.query || '');
        url = `${DFLOW_METADATA_API}/api/v1/search?q=${query}`;
        break;
      
      // Get candlestick data for charts
      case 'getCandlesticks':
        const now = Math.floor(Date.now() / 1000);
        const startTs = params.startTs || (now - 7 * 24 * 60 * 60); // Default 7 days
        const endTs = params.endTs || now;
        const interval = params.interval || 60; // 1=1min, 60=1hr, 1440=1day
        url = `${DFLOW_METADATA_API}/api/v1/market/${params.ticker}/candlesticks?startTs=${startTs}&endTs=${endTs}&periodInterval=${interval}`;
        break;
      
      // Get market by mint
      case 'getMarketByMint':
        url = `${DFLOW_METADATA_API}/api/v1/market/by-mint/${params.mint}`;
        break;
      
      // Get live sports data
      case 'getLiveData':
        url = `${DFLOW_METADATA_API}/api/v1/live_data/by-event/${params.ticker}`;
        break;
      
      // Get event forecast history
      case 'getForecastHistory':
        url = `${DFLOW_METADATA_API}/api/v1/event/${params.eventId}/forecast-history`;
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
      
      // For getTrades 404, return empty array gracefully (no trades yet)
      if (action === 'getTrades' && response.status === 404) {
        console.log(`No trades found for ticker, returning empty array`);
        return new Response(JSON.stringify({ trades: [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For getMarketsByMints 404, return empty array
      if (action === 'getMarketsByMints' && response.status === 404) {
        return new Response(JSON.stringify({ markets: [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For getOrderStatus 404, return "not_found_yet" status gracefully (order not indexed yet)
      if (action === 'getOrderStatus' && response.status === 404) {
        console.log(`Order not indexed yet, returning not_found_yet status`);
        return new Response(JSON.stringify({ status: 'not_found_yet' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For getMarketByMint 404, return null gracefully (not a market token)
      if (action === 'getMarketByMint' && response.status === 404) {
        return new Response(JSON.stringify({ market: null }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Parse DFlow error response for better error messages
      let errorData: { error: string; code: string; status: number } = { error: errorText, code: 'unknown', status: response.status };
      try {
        const parsed = JSON.parse(errorText);
        errorData = {
          error: parsed.msg || errorText,
          code: parsed.code || 'unknown',
          status: response.status
        };
      } catch {
        // Keep original error text if not JSON
      }
      
      // Return structured error with original status code (not 500)
      return new Response(JSON.stringify(errorData), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const data = await response.json();
    console.log(`DFlow API success for ${action}, response keys:`, Object.keys(data));
    
    // Log specific data for debugging portfolio issues
    if (action === 'filterOutcomeMints') {
      console.log(`[filterOutcomeMints] Found ${(data.outcomeMints || []).length} outcome mints`);
    }
    if (action === 'getMarketsByMints') {
      console.log(`[getMarketsByMints] Found ${(data.markets || []).length} markets`);
    }
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('DFlow API error:', errorMessage);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: 'internal_error',
      status: 500 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
