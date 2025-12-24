/**
 * Polymarket Trading Utilities
 * Client-side EIP-712 order signing for Polymarket CLOB API
 */

// Polymarket CLOB Contract Address on Polygon
export const POLYMARKET_CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
export const POLYMARKET_NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

// EIP-712 Domain for Polymarket
export const POLYMARKET_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: 137, // Polygon
  verifyingContract: POLYMARKET_CTF_EXCHANGE,
} as const;

// EIP-712 Order Types
export const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
} as const;

// Order side enum
export enum OrderSide {
  BUY = 0,
  SELL = 1,
}

// Signature type enum
export enum SignatureType {
  EOA = 0,
  POLY_PROXY = 1,
  POLY_GNOSIS_SAFE = 2,
}

export interface OrderPayload {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
}

export interface SignedOrder extends OrderPayload {
  signature: string;
}

/**
 * Generate a random salt for order uniqueness
 */
export function generateSalt(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return '0x' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate amounts based on price and size
 * Price is between 0 and 1 (e.g., 0.65 for 65%)
 * Size is the amount of shares to buy/sell
 */
export function calculateAmounts(price: number, size: number, side: OrderSide): {
  makerAmount: string;
  takerAmount: string;
} {
  // Convert to USDC base units (6 decimals)
  const USDC_DECIMALS = 6;
  const SHARES_DECIMALS = 6;
  
  if (side === OrderSide.BUY) {
    // Buying: pay makerAmount USDC to receive takerAmount shares
    const usdcAmount = price * size;
    const makerAmount = Math.floor(usdcAmount * 10 ** USDC_DECIMALS).toString();
    const takerAmount = Math.floor(size * 10 ** SHARES_DECIMALS).toString();
    return { makerAmount, takerAmount };
  } else {
    // Selling: give makerAmount shares to receive takerAmount USDC
    const usdcAmount = price * size;
    const makerAmount = Math.floor(size * 10 ** SHARES_DECIMALS).toString();
    const takerAmount = Math.floor(usdcAmount * 10 ** USDC_DECIMALS).toString();
    return { makerAmount, takerAmount };
  }
}

/**
 * Build an order payload ready for EIP-712 signing
 */
export function buildOrderPayload(params: {
  tokenId: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
  maker: string;
  feeRateBps?: number;
  expirationSeconds?: number;
}): OrderPayload {
  const orderSide = params.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL;
  const { makerAmount, takerAmount } = calculateAmounts(params.price, params.size, orderSide);
  
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + (params.expirationSeconds || 86400); // Default 24h
  
  return {
    salt: generateSalt(),
    maker: params.maker,
    signer: params.maker, // Same as maker for EOA
    taker: '0x0000000000000000000000000000000000000000', // Open order (anyone can fill)
    tokenId: params.tokenId,
    makerAmount,
    takerAmount,
    expiration: expiration.toString(),
    nonce: now.toString(),
    feeRateBps: (params.feeRateBps || 0).toString(),
    side: orderSide,
    signatureType: SignatureType.EOA,
  };
}

/**
 * Format order for CLOB API submission
 */
export function formatOrderForApi(order: OrderPayload, signature: string): SignedOrder {
  return {
    ...order,
    signature,
  };
}

/**
 * Get the EIP-712 typed data for signing
 */
export function getTypedDataForOrder(order: OrderPayload) {
  return {
    domain: POLYMARKET_DOMAIN,
    types: ORDER_TYPES,
    primaryType: 'Order' as const,
    message: {
      salt: BigInt(order.salt),
      maker: order.maker as `0x${string}`,
      signer: order.signer as `0x${string}`,
      taker: order.taker as `0x${string}`,
      tokenId: BigInt(order.tokenId),
      makerAmount: BigInt(order.makerAmount),
      takerAmount: BigInt(order.takerAmount),
      expiration: BigInt(order.expiration),
      nonce: BigInt(order.nonce),
      feeRateBps: BigInt(order.feeRateBps),
      side: order.side,
      signatureType: order.signatureType,
    },
  };
}
