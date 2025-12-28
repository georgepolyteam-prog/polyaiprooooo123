const PANDORA_GRAPHQL = 'https://sonicmarketindexer-production.up.railway.app/graphql';

export interface PandoraMarket {
  id: string;
  pollAddress: string;
  marketAddress: string;
  question: string;
  currentOddsYes: number;
  currentOddsNo: number;
  totalVolume: string;
  totalLiquidity: string;
  totalTrades: number;
  status: 'active' | 'resolved' | 'pending';
  category: string;
  endDate: number;
  createdAt: number;
  marketType: 'AMM' | 'PariMutuel';
  image?: string;
}

interface GraphQLMarket {
  id: string;
  pollAddress: string;
  marketAddress: string;
  marketType: string;
  totalVolume: string;
  totalTrades: string;
  status: string;
  yesReserve?: string;
  noReserve?: string;
  question?: string;
  category?: string;
  endDate?: string;
  createdAt?: string;
}

// Mock data for testing when API is unavailable
const MOCK_MARKETS: PandoraMarket[] = [
  {
    id: 'btc-150k-2025',
    pollAddress: '0x1234567890abcdef1234567890abcdef12345678',
    marketAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    question: 'Will Bitcoin reach $150k in 2025?',
    currentOddsYes: 68,
    currentOddsNo: 32,
    totalVolume: '2450000000000', // $2.45M
    totalLiquidity: '735000000000',
    totalTrades: 2341,
    status: 'active',
    category: 'Crypto',
    endDate: Date.now() + (180 * 24 * 60 * 60 * 1000), // 6 months
    createdAt: Date.now() - (30 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'eth-10k-2025',
    pollAddress: '0x2234567890abcdef1234567890abcdef12345678',
    marketAddress: '0xbbcdef1234567890abcdef1234567890abcdef12',
    question: 'Will Ethereum reach $10,000 by end of 2025?',
    currentOddsYes: 42,
    currentOddsNo: 58,
    totalVolume: '1820000000000', // $1.82M
    totalLiquidity: '546000000000',
    totalTrades: 1823,
    status: 'active',
    category: 'Crypto',
    endDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (45 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'trump-2028',
    pollAddress: '0x3234567890abcdef1234567890abcdef12345678',
    marketAddress: '0xcbcdef1234567890abcdef1234567890abcdef12',
    question: 'Will Trump run for President in 2028?',
    currentOddsYes: 23,
    currentOddsNo: 77,
    totalVolume: '8100000000000', // $8.1M
    totalLiquidity: '2430000000000',
    totalTrades: 15234,
    status: 'active',
    category: 'Politics',
    endDate: Date.now() + (900 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (60 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'sol-500-2025',
    pollAddress: '0x4234567890abcdef1234567890abcdef12345678',
    marketAddress: '0xdbcdef1234567890abcdef1234567890abcdef12',
    question: 'Will Solana reach $500 in 2025?',
    currentOddsYes: 35,
    currentOddsNo: 65,
    totalVolume: '1200000000000', // $1.2M
    totalLiquidity: '360000000000',
    totalTrades: 987,
    status: 'active',
    category: 'Crypto',
    endDate: Date.now() + (200 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (20 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'ai-turing-2026',
    pollAddress: '0x5234567890abcdef1234567890abcdef12345678',
    marketAddress: '0xebcdef1234567890abcdef1234567890abcdef12',
    question: 'Will AI pass the Turing test by 2026?',
    currentOddsYes: 71,
    currentOddsNo: 29,
    totalVolume: '950000000000', // $950k
    totalLiquidity: '285000000000',
    totalTrades: 1456,
    status: 'active',
    category: 'Tech',
    endDate: Date.now() + (400 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (90 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'spacex-mars-2030',
    pollAddress: '0x6234567890abcdef1234567890abcdef12345678',
    marketAddress: '0xfbcdef1234567890abcdef1234567890abcdef12',
    question: 'Will SpaceX land humans on Mars by 2030?',
    currentOddsYes: 28,
    currentOddsNo: 72,
    totalVolume: '2100000000000', // $2.1M
    totalLiquidity: '630000000000',
    totalTrades: 3421,
    status: 'active',
    category: 'Science',
    endDate: Date.now() + (1800 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (120 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'fed-rates-3pct',
    pollAddress: '0x7234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x0bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will the Fed cut rates below 3% in 2025?',
    currentOddsYes: 45,
    currentOddsNo: 55,
    totalVolume: '780000000000', // $780k
    totalLiquidity: '234000000000',
    totalTrades: 876,
    status: 'active',
    category: 'Politics',
    endDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (15 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'apple-ar-2025',
    pollAddress: '0x8234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x1bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will Apple release AR glasses in 2025?',
    currentOddsYes: 62,
    currentOddsNo: 38,
    totalVolume: '650000000000', // $650k
    totalLiquidity: '195000000000',
    totalTrades: 723,
    status: 'active',
    category: 'Tech',
    endDate: Date.now() + (300 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (25 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'nvidia-2t-mcap',
    pollAddress: '0x9234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x2bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will Nvidia reach $5T market cap by 2026?',
    currentOddsYes: 38,
    currentOddsNo: 62,
    totalVolume: '1500000000000', // $1.5M
    totalLiquidity: '450000000000',
    totalTrades: 2134,
    status: 'active',
    category: 'Tech',
    endDate: Date.now() + (500 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (40 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'superbowl-chiefs-2026',
    pollAddress: '0xa234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x3bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will the Chiefs win Super Bowl 2026?',
    currentOddsYes: 22,
    currentOddsNo: 78,
    totalVolume: '420000000000', // $420k
    totalLiquidity: '126000000000',
    totalTrades: 567,
    status: 'active',
    category: 'Sports',
    endDate: Date.now() + (400 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (10 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'world-cup-usa-2026',
    pollAddress: '0xb234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x4bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will USA win the 2026 World Cup?',
    currentOddsYes: 8,
    currentOddsNo: 92,
    totalVolume: '890000000000', // $890k
    totalLiquidity: '267000000000',
    totalTrades: 1234,
    status: 'active',
    category: 'Sports',
    endDate: Date.now() + (550 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (35 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'gta6-2025',
    pollAddress: '0xc234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x5bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will GTA 6 release in 2025?',
    currentOddsYes: 85,
    currentOddsNo: 15,
    totalVolume: '340000000000', // $340k
    totalLiquidity: '102000000000',
    totalTrades: 456,
    status: 'active',
    category: 'Entertainment',
    endDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (50 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'sonic-tvl-1b',
    pollAddress: '0xd234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x6bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will Sonic chain TVL exceed $1B in 2025?',
    currentOddsYes: 54,
    currentOddsNo: 46,
    totalVolume: '560000000000', // $560k
    totalLiquidity: '168000000000',
    totalTrades: 892,
    status: 'active',
    category: 'Crypto',
    endDate: Date.now() + (200 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (5 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'openai-agi-2027',
    pollAddress: '0xe234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x7bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will OpenAI announce AGI by 2027?',
    currentOddsYes: 31,
    currentOddsNo: 69,
    totalVolume: '1100000000000', // $1.1M
    totalLiquidity: '330000000000',
    totalTrades: 1567,
    status: 'active',
    category: 'Tech',
    endDate: Date.now() + (730 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (80 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
  {
    id: 'musk-twitter-profitable',
    pollAddress: '0xf234567890abcdef1234567890abcdef12345678',
    marketAddress: '0x8bcdef1234567890abcdef1234567890abcdef12',
    question: 'Will X (Twitter) become profitable in 2025?',
    currentOddsYes: 47,
    currentOddsNo: 53,
    totalVolume: '720000000000', // $720k
    totalLiquidity: '216000000000',
    totalTrades: 934,
    status: 'active',
    category: 'Tech',
    endDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
    createdAt: Date.now() - (70 * 24 * 60 * 60 * 1000),
    marketType: 'AMM',
  },
];

// Set to true to always use mock data (for testing)
const USE_MOCK_DATA = true;

export async function fetchPandoraMarkets(): Promise<PandoraMarket[]> {
  // Use mock data for testing
  if (USE_MOCK_DATA) {
    console.log('[Pandora] Using mock data for testing');
    return MOCK_MARKETS;
  }

  const query = `
    query Markets {
      markets(
        first: 100, 
        orderBy: "totalVolume", 
        orderDirection: "desc"
      ) {
        items {
          id
          pollAddress
          marketAddress
          marketType
          totalVolume
          totalTrades
          status
          yesReserve
          noReserve
        }
      }
    }
  `;
  
  try {
    const response = await fetch(PANDORA_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    
    if (result?.data?.markets?.items?.length > 0) {
      return result.data.markets.items.map(transformMarket);
    }
    
    // Fallback to mock data if API returns empty
    console.log('[Pandora] API returned no markets, using mock data');
    return MOCK_MARKETS;
  } catch (error) {
    console.error('Failed to fetch Pandora markets:', error);
    // Fallback to mock data on error
    return MOCK_MARKETS;
  }
}

function transformMarket(raw: GraphQLMarket): PandoraMarket {
  // Calculate odds from reserves if available
  const yesReserve = parseFloat(raw.yesReserve || '0');
  const noReserve = parseFloat(raw.noReserve || '0');
  const total = yesReserve + noReserve;
  
  let currentOddsYes = 50;
  let currentOddsNo = 50;
  
  if (total > 0) {
    // AMM formula: price = opposite_reserve / total_reserve
    currentOddsYes = Math.round((noReserve / total) * 100);
    currentOddsNo = 100 - currentOddsYes;
  }
  
  // Generate mock questions based on id for demo
  const questions = [
    "Will Bitcoin reach $150k in 2025?",
    "Will ETH flip BTC market cap?",
    "Will Solana reach $500?",
    "Will Trump win 2028 election?",
    "Will AI pass the Turing test by 2026?",
    "Will SpaceX land humans on Mars by 2030?",
    "Will the Fed cut rates below 3%?",
    "Will a new COVID variant emerge?",
    "Will Apple release AR glasses in 2025?",
    "Will Nvidia reach $2T market cap?"
  ];
  
  const categories = ['Crypto', 'Politics', 'Tech', 'Science', 'Sports', 'Entertainment'];
  const hash = raw.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  
  return {
    id: raw.id,
    pollAddress: raw.pollAddress,
    marketAddress: raw.marketAddress,
    question: raw.question || questions[hash % questions.length],
    currentOddsYes,
    currentOddsNo,
    totalVolume: raw.totalVolume || '0',
    totalLiquidity: (parseFloat(raw.totalVolume || '0') * 0.3).toString(),
    totalTrades: parseInt(raw.totalTrades || '0', 10),
    status: (raw.status?.toLowerCase() as 'active' | 'resolved' | 'pending') || 'active',
    category: raw.category || categories[hash % categories.length],
    endDate: raw.endDate ? parseInt(raw.endDate, 10) : Date.now() + (30 * 24 * 60 * 60 * 1000),
    createdAt: raw.createdAt ? parseInt(raw.createdAt, 10) : Date.now(),
    marketType: (raw.marketType as 'AMM' | 'PariMutuel') || 'AMM',
  };
}

export function formatVolume(vol: string | number): string {
  const num = typeof vol === 'string' ? parseFloat(vol) : vol;
  if (isNaN(num)) return '$0';
  
  // Convert from wei/lamports (assuming 6 decimals for USDC)
  const value = num / 1_000_000;
  
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  if (value >= 1) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}

export function formatTimeRemaining(endDate: number): string {
  const now = Date.now();
  const diff = endDate - now;
  
  if (diff < 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}
