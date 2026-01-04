import type { KalshiMarket, Candlestick, MarketAccounts } from '@/hooks/useDflowApi';

// Mock market accounts template
const MOCK_ACCOUNTS: Record<string, MarketAccounts> = {
  'SOL': {
    yesMint: 'MockYesMint1111111111111111111111111111111111',
    noMint: 'MockNoMint11111111111111111111111111111111111',
  }
};

// Mock markets for when API fails
export const MOCK_MARKETS: KalshiMarket[] = [
  {
    ticker: 'MOCK-BTC-100K',
    title: 'Will Bitcoin reach $100,000 by end of 2026?',
    subtitle: 'Cryptocurrency',
    status: 'active',
    yesPrice: 67,
    noPrice: 33,
    volume: 2450000,
    openInterest: 890000,
    closeTime: '2026-12-31T23:59:59Z',
    accounts: MOCK_ACCOUNTS,
  },
  {
    ticker: 'MOCK-FED-RATE',
    title: 'Will the Fed cut rates by 0.5% or more in 2026?',
    subtitle: 'Economics',
    status: 'active',
    yesPrice: 42,
    noPrice: 58,
    volume: 1850000,
    openInterest: 650000,
    closeTime: '2026-12-31T23:59:59Z',
    accounts: MOCK_ACCOUNTS,
  },
  {
    ticker: 'MOCK-AI-AGI',
    title: 'Will OpenAI announce AGI by 2027?',
    subtitle: 'Technology',
    status: 'active',
    yesPrice: 23,
    noPrice: 77,
    volume: 980000,
    openInterest: 420000,
    closeTime: '2027-12-31T23:59:59Z',
    accounts: MOCK_ACCOUNTS,
  },
  {
    ticker: 'MOCK-ELECTION',
    title: 'Will voter turnout exceed 160M in 2028 election?',
    subtitle: 'Politics',
    status: 'active',
    yesPrice: 55,
    noPrice: 45,
    volume: 3200000,
    openInterest: 1100000,
    closeTime: '2028-11-05T23:59:59Z',
    accounts: MOCK_ACCOUNTS,
  },
  {
    ticker: 'MOCK-SPORTS-1',
    title: 'Will the Lakers win the 2026 NBA Championship?',
    subtitle: 'Sports',
    status: 'active',
    yesPrice: 12,
    noPrice: 88,
    volume: 750000,
    openInterest: 280000,
    closeTime: '2026-06-30T23:59:59Z',
    accounts: MOCK_ACCOUNTS,
  },
  {
    ticker: 'MOCK-ETH-10K',
    title: 'Will Ethereum reach $10,000 in 2026?',
    subtitle: 'Cryptocurrency',
    status: 'active',
    yesPrice: 38,
    noPrice: 62,
    volume: 1650000,
    openInterest: 540000,
    closeTime: '2026-12-31T23:59:59Z',
    accounts: MOCK_ACCOUNTS,
  },
  {
    ticker: 'MOCK-RECESSION',
    title: 'Will the US enter a recession in 2026?',
    subtitle: 'Economics',
    status: 'active',
    yesPrice: 28,
    noPrice: 72,
    volume: 2100000,
    openInterest: 780000,
    closeTime: '2026-12-31T23:59:59Z',
    accounts: MOCK_ACCOUNTS,
  },
  {
    ticker: 'MOCK-SPACE-X',
    title: 'Will SpaceX land humans on Mars by 2030?',
    subtitle: 'Technology',
    status: 'active',
    yesPrice: 15,
    noPrice: 85,
    volume: 890000,
    openInterest: 340000,
    closeTime: '2030-12-31T23:59:59Z',
    accounts: MOCK_ACCOUNTS,
  },
];

// Generate mock candlestick data
export function generateMockCandlesticks(basePrice = 50, count = 100): Candlestick[] {
  const now = Math.floor(Date.now() / 1000);
  const candles: Candlestick[] = [];
  let price = basePrice;

  for (let i = count; i >= 0; i--) {
    const timestamp = now - i * 3600; // 1 hour intervals
    const volatility = 2 + Math.random() * 3;
    const change = (Math.random() - 0.5) * volatility;
    
    const open = price;
    const close = Math.max(1, Math.min(99, price + change));
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    
    price = close;
    
    candles.push({
      timestamp,
      open: Math.round(open * 100) / 100,
      high: Math.round(Math.min(99, high) * 100) / 100,
      low: Math.round(Math.max(1, low) * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(1000 + Math.random() * 50000),
    });
  }

  return candles;
}

// Generate mock orderbook
export function generateMockOrderbook() {
  const baseYesPrice = 45 + Math.random() * 10;
  const spread = 1 + Math.random() * 2;

  const generateLevels = (startPrice: number, ascending: boolean) => {
    const levels = [];
    let price = startPrice;
    for (let i = 0; i < 10; i++) {
      levels.push({
        price: Math.round(price),
        size: Math.floor(100 + Math.random() * 5000),
      });
      price = ascending ? price + 1 + Math.random() : price - 1 - Math.random();
    }
    return levels;
  };

  const yesBidStart = Math.round(baseYesPrice);
  const yesAskStart = Math.round(baseYesPrice + spread);
  const noPrice = 100 - baseYesPrice;

  return {
    yesBids: generateLevels(yesBidStart, false),
    yesAsks: generateLevels(yesAskStart, true),
    noBids: generateLevels(Math.round(noPrice), false),
    noAsks: generateLevels(Math.round(noPrice + spread), true),
  };
}

// Generate mock trades
export function generateMockTrades(count = 20) {
  const now = Math.floor(Date.now() / 1000);
  const trades = [];

  for (let i = 0; i < count; i++) {
    trades.push({
      id: `mock-trade-${i}`,
      side: Math.random() > 0.5 ? 'yes' : 'no' as 'yes' | 'no',
      price: Math.round(30 + Math.random() * 40),
      size: Math.floor(10 + Math.random() * 500),
      timestamp: now - i * (30 + Math.floor(Math.random() * 120)),
    });
  }

  return trades;
}
