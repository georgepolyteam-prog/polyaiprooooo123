/**
 * Polymarket Smart Deep-Linking for Trades
 * 
 * Instead of complex on-chain trading that gets blocked by Cloudflare,
 * we redirect users to Polymarket with their trade pre-filled.
 * This approach:
 * 1. Works reliably (no Cloudflare blocking)
 * 2. Tracks referrals via ?r= parameter
 * 3. Better UX - users confirm on Polymarket directly
 */

export interface TradeParams {
  eventSlug: string;
  marketSlug?: string;
  side?: 'yes' | 'no';
  amount?: number;
}

// Your Polymarket Builder referral code (first 8 chars of Builder API key)
const REFERRAL_CODE = '019b3424';

/**
 * Build a Polymarket URL with trade parameters pre-filled
 * 
 * @example
 * buildPolymarketTradeUrl({ eventSlug: 'presidential-election-2024' })
 * // Returns: https://polymarket.com/event/presidential-election-2024?r=poly_ai
 * 
 * @example
 * buildPolymarketTradeUrl({ 
 *   eventSlug: 'presidential-election-2024',
 *   side: 'yes',
 *   amount: 50
 * })
 * // Returns: https://polymarket.com/event/presidential-election-2024?r=poly_ai&side=yes&amount=50
 */
export function buildPolymarketTradeUrl(params: TradeParams): string {
  const { eventSlug, marketSlug, side, amount } = params;
  
  // Build base URL
  let url = `https://polymarket.com/event/${eventSlug}`;
  
  // Add market slug if available (for multi-outcome markets)
  if (marketSlug) {
    url += `/${marketSlug}`;
  }
  
  // Build query parameters
  const queryParams = new URLSearchParams();
  
  // Always add referral code for Builder Program tracking
  queryParams.set('r', REFERRAL_CODE);
  
  // Add trade parameters if provided
  if (side) {
    queryParams.set('side', side);
  }
  
  if (amount && amount > 0) {
    queryParams.set('amount', amount.toString());
  }
  
  return `${url}?${queryParams.toString()}`;
}

/**
 * Extract event and market slugs from a Polymarket URL
 * 
 * @example
 * parsePolymarketUrl('https://polymarket.com/event/presidential-election-2024/will-trump-win')
 * // Returns: { eventSlug: 'presidential-election-2024', marketSlug: 'will-trump-win' }
 */
export function parsePolymarketUrl(url: string): { eventSlug?: string; marketSlug?: string } {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Expected format: /event/{eventSlug}/{marketSlug?}
    if (pathParts[0] === 'event' && pathParts[1]) {
      return {
        eventSlug: pathParts[1],
        marketSlug: pathParts[2] || undefined,
      };
    }
    
    return {};
  } catch {
    return {};
  }
}
