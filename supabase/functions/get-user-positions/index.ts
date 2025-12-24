import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';

const CLOB_API_URL = Deno.env.get('CLOB_API_URL') || 'https://clob.polymarket.com';
const DATA_API_URL = 'https://data-api.polymarket.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Position {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  outcome: string;
  title: string;
  eventSlug: string;
  eventTitle: string;
  proxyWallet?: string;
  redeemable: boolean;
  mergeable: boolean;
}

interface OpenOrder {
  id: string;
  status: string;
  market: string;
  asset_id: string;
  side: string;
  original_size: string;
  size_matched: string;
  price: string;
  outcome: string;
  created_at: number;
  expiration: number;
  associate_trades: unknown[];
  owner: string;
}

interface UserApiCreds {
  apiKey: string;
  secret: string;
  passphrase: string;
}

// Generate L2 headers for Polymarket CLOB API using provided credentials
// CRITICAL: The signing message format is: timestamp + method + pathOnly (NO query params!)
// This matches the SDK behavior - query params are added to URL but NOT signed
function generateL2Headers(method: string, pathOnly: string, address: string, creds: UserApiCreds): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // HMAC message format: timestamp + method + path (without query params)
  const message = timestamp + method + pathOnly;
  
  console.log(`[HMAC] Signing message: ${message}`);
  
  // CRITICAL: Secret must be base64 decoded before use as HMAC key
  const secretBuffer = Buffer.from(creds.secret, 'base64');
  
  // Generate signature and convert to URL-safe base64
  const signature = createHmac('sha256', secretBuffer)
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return {
    'POLY-ADDRESS': address,
    'POLY-SIGNATURE': signature,
    'POLY-TIMESTAMP': timestamp,
    'POLY-API-KEY': creds.apiKey,
    'POLY-PASSPHRASE': creds.passphrase,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const address = url.searchParams.get('address');
    
    // Get user's API credentials from query params (passed from client)
    const userApiKey = url.searchParams.get('apiKey');
    const userSecret = url.searchParams.get('secret');
    const userPassphrase = url.searchParams.get('passphrase');

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Positions] Fetching data for: ${address}`);
    
    // Build user creds object if provided
    const userCreds: UserApiCreds | null = (userApiKey && userSecret && userPassphrase) 
      ? { apiKey: userApiKey, secret: userSecret, passphrase: userPassphrase }
      : null;
    
    if (userCreds) {
      console.log(`[Positions] Using user-provided API credentials`);
    } else {
      console.log(`[Positions] No user credentials - open orders may not be visible`);
    }

    // Fetch positions from Data API (public, no auth required)
    const positionsPromise = fetchPositions(address);
    
    // Fetch open orders from CLOB API (requires user's auth)
    const ordersPromise = fetchOpenOrders(address, userCreds);

    const [positions, openOrders] = await Promise.all([positionsPromise, ordersPromise]);

    // Calculate totals
    const totalValue = positions.reduce((sum, p) => sum + (p.currentValue || 0), 0);
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
    const totalRealizedPnl = positions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);

    console.log(`[Positions] Found ${positions.length} positions, ${openOrders.length} open orders`);

    return new Response(
      JSON.stringify({
        positions,
        openOrders,
        stats: {
          totalValue,
          totalUnrealizedPnl,
          totalRealizedPnl,
          positionCount: positions.length,
          openOrderCount: openOrders.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Positions] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchPositions(address: string): Promise<Position[]> {
  try {
    // Use the Polymarket Data API to get positions
    const response = await fetch(
      `${DATA_API_URL}/positions?user=${address.toLowerCase()}&sizeThreshold=0.01`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`[Positions] Data API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log(`[Positions] Raw positions count: ${data?.length || 0}`);

    if (!Array.isArray(data)) {
      return [];
    }

    // Map and enrich position data
    return data.map((p: Record<string, unknown>) => ({
      asset: p.asset as string || '',
      conditionId: p.conditionId as string || '',
      size: parseFloat(String(p.size || '0')),
      avgPrice: parseFloat(String(p.avgPrice || '0')),
      curPrice: parseFloat(String(p.curPrice || '0')),
      currentValue: parseFloat(String(p.currentValue || '0')),
      cashPnl: parseFloat(String(p.cashPnl || '0')),
      percentPnl: parseFloat(String(p.percentPnl || '0')),
      realizedPnl: parseFloat(String(p.realizedPnl || '0')),
      outcome: p.outcome as string || 'YES',
      title: p.title as string || p.eventTitle as string || 'Unknown Market',
      eventSlug: p.eventSlug as string || '',
      eventTitle: p.eventTitle as string || '',
      proxyWallet: p.proxyWallet as string,
      redeemable: Boolean(p.redeemable),
      mergeable: Boolean(p.mergeable),
    }));
  } catch (error) {
    console.error('[Positions] Failed to fetch positions:', error);
    return [];
  }
}

async function fetchOpenOrders(address: string, creds: UserApiCreds | null): Promise<OpenOrder[]> {
  try {
    // Check if we have user API credentials
    if (!creds) {
      console.log('[Positions] No user API credentials provided, skipping open orders');
      return [];
    }

    // CRITICAL: Sign only the path, NOT the query params (matches SDK behavior)
    const pathOnly = `/data/orders`;
    const queryParams = `?maker=${address.toLowerCase()}&state=LIVE`;
    const fullUrl = `${CLOB_API_URL}${pathOnly}${queryParams}`;
    
    console.log(`[Positions] Fetching open orders from: ${fullUrl}`);
    console.log(`[Positions] Signing path only: ${pathOnly}`);
    
    // Generate headers with pathOnly (no query params in signature)
    const headers = generateL2Headers('GET', pathOnly, address, creds);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        ...headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Positions] CLOB API returned ${response.status}:`, errorText);
      
      // Try alternative endpoint format if first fails
      if (response.status === 405 || response.status === 404 || response.status === 401) {
        console.log('[Positions] Trying alternative endpoint /orders...');
        return await fetchOpenOrdersAlternative(address, creds);
      }
      return [];
    }

    const data = await response.json();
    console.log(`[Positions] Open orders response:`, JSON.stringify(data).slice(0, 500));

    // Handle both array response and object with orders array
    const orders = Array.isArray(data) ? data : (data.orders || data.data || []);
    console.log(`[Positions] Open orders count: ${orders.length}`);

    return orders as OpenOrder[];
  } catch (error) {
    console.error('[Positions] Failed to fetch open orders:', error);
    return [];
  }
}

// Alternative endpoint format
async function fetchOpenOrdersAlternative(address: string, creds: UserApiCreds): Promise<OpenOrder[]> {
  try {
    // Try the /orders endpoint without /data prefix
    // CRITICAL: Sign only the path, NOT the query params
    const pathOnly = `/orders`;
    const queryParams = `?maker=${address.toLowerCase()}&state=LIVE`;
    const fullUrl = `${CLOB_API_URL}${pathOnly}${queryParams}`;
    
    console.log(`[Positions] Trying alternative: ${fullUrl}`);
    console.log(`[Positions] Signing path only: ${pathOnly}`);
    
    // Generate headers with pathOnly (no query params in signature)
    const headers = generateL2Headers('GET', pathOnly, address, creds);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        ...headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Positions] Alternative endpoint returned ${response.status}:`, errorText);
      return [];
    }

    const data = await response.json();
    const orders = Array.isArray(data) ? data : (data.orders || data.data || []);
    console.log(`[Positions] Alternative endpoint orders count: ${orders.length}`);

    return orders as OpenOrder[];
  } catch (error) {
    console.error('[Positions] Alternative endpoint failed:', error);
    return [];
  }
}
