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

export async function fetchPandoraMarkets(): Promise<PandoraMarket[]> {
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
    
    if (result?.data?.markets?.items) {
      return result.data.markets.items.map(transformMarket);
    }
    
    return [];
  } catch (error) {
    console.error('Failed to fetch Pandora markets:', error);
    return [];
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
