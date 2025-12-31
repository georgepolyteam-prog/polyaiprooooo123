import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, Shield, ArrowRight, RefreshCw, Search, Sparkles, Wallet, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDflowApi, type KalshiMarket, type KalshiEvent } from '@/hooks/useDflowApi';
import { KalshiMarketCard } from '@/components/kalshi/KalshiMarketCard';
import { KalshiTradingModal } from '@/components/kalshi/KalshiTradingModal';
import { KalshiFeatureCard } from '@/components/kalshi/KalshiFeatureCard';
import { KalshiLoadingSkeleton } from '@/components/kalshi/KalshiLoadingSkeleton';
import { KalshiPortfolio } from '@/components/kalshi/KalshiPortfolio';
import { KalshiAIInsight } from '@/components/kalshi/KalshiAIInsight';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// Demo markets for when API is unavailable
const DEMO_MARKETS: KalshiMarket[] = [
  {
    ticker: 'BTCUSD-25DEC31',
    title: 'Will Bitcoin exceed $100,000 by end of 2025?',
    subtitle: 'BTC Price Prediction',
    status: 'active',
    yesPrice: 67,
    noPrice: 33,
    volume: 1250000,
    closeTime: '2025-12-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'FEDRATE-25JAN',
    title: 'Will the Fed cut rates in January 2025?',
    subtitle: 'Federal Reserve Policy',
    status: 'active',
    yesPrice: 23,
    noPrice: 77,
    volume: 890000,
    closeTime: '2025-01-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'STARSHIP-25Q1',
    title: 'Will SpaceX Starship reach orbit in Q1 2025?',
    subtitle: 'Space Technology',
    status: 'active',
    yesPrice: 82,
    noPrice: 18,
    volume: 567000,
    closeTime: '2025-03-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'TIKTOK-25MAR',
    title: 'Will there be a TikTok ban in the US by March 2025?',
    subtitle: 'Tech Policy',
    status: 'active',
    yesPrice: 45,
    noPrice: 55,
    volume: 2100000,
    closeTime: '2025-03-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'SPX-25JAN6K',
    title: 'Will the S&P 500 close above 6,000 in January?',
    subtitle: 'Stock Market',
    status: 'active',
    yesPrice: 58,
    noPrice: 42,
    volume: 1780000,
    closeTime: '2025-01-31T00:00:00Z',
    accounts: {},
  },
  {
    ticker: 'GPT5-25Q1',
    title: 'Will OpenAI release GPT-5 in Q1 2025?',
    subtitle: 'AI & Technology',
    status: 'active',
    yesPrice: 31,
    noPrice: 69,
    volume: 920000,
    closeTime: '2025-03-31T00:00:00Z',
    accounts: {},
  },
];

export default function Kalshi() {
  const { connected, publicKey } = useWallet();
  const { getEvents, getMarkets, loading, error } = useDflowApi();
  const [markets, setMarkets] = useState<KalshiMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);
  const [aiMarket, setAiMarket] = useState<KalshiMarket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('markets');
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    setIsLoading(true);
    try {
      // Try to get events with nested markets first
      const events = await getEvents('active');
      
      // Flatten events into markets
      const allMarkets: KalshiMarket[] = [];
      events.forEach((event: KalshiEvent) => {
        if (event.markets && event.markets.length > 0) {
          event.markets.forEach(market => {
            // Add event info to market if title is missing
            if (!market.title && event.title) {
              market.title = event.title;
            }
            allMarkets.push(market);
          });
        }
      });
      
      if (allMarkets.length > 0) {
        setMarkets(allMarkets);
      } else {
        // Fallback to direct markets endpoint
        const directMarkets = await getMarkets();
        setMarkets(directMarkets.length > 0 ? directMarkets : DEMO_MARKETS);
      }
    } catch (err) {
      console.error('Failed to fetch markets:', err);
      // Use demo markets as fallback
      setMarkets(DEMO_MARKETS);
      toast.info('Showing demo markets');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMarkets = markets.filter(market =>
    (market.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (market.subtitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (market.ticker || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        
        {/* Animated Orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Powered by DFlow on Solana</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-foreground">Kalshi</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-purple-400 to-secondary bg-clip-text text-transparent">
                Markets
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl sm:text-2xl text-muted-foreground mb-10 leading-relaxed">
              Trade the future on Solana.
              <br />
              <span className="text-foreground font-medium">Fast. Simple. Powerful.</span>
            </p>
            
            {/* Wallet Button */}
            {!connected ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <WalletMultiButton className="!h-14 !px-8 !rounded-2xl !bg-primary hover:!bg-primary/90 !text-primary-foreground !font-semibold !text-lg !transition-all !duration-300 !shadow-lg hover:!shadow-xl hover:!shadow-primary/20" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30"
              >
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-medium">
                  {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <KalshiFeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Lightning Fast"
              description="Solana-native trading with sub-second execution and minimal fees"
              index={0}
            />
            <KalshiFeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Deep Liquidity"
              description="Powered by Kalshi's institutional-grade prediction markets"
              index={1}
            />
            <KalshiFeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Secure & Simple"
              description="Non-custodial SPL token trading with your Solana wallet"
              index={2}
            />
          </div>
        </div>
      </section>

      {/* Markets Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-muted/30 p-1 rounded-2xl">
              <TabsTrigger 
                value="markets" 
                className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Markets
              </TabsTrigger>
              <TabsTrigger 
                value="portfolio" 
                className="rounded-xl px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                disabled={!connected}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Portfolio
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64 h-11 rounded-xl bg-muted/30 border-border/50"
                />
              </div>
              
              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchMarkets}
                disabled={isLoading}
                className="h-11 w-11 rounded-xl border-border/50"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          <TabsContent value="markets" className="mt-0">
            {/* Markets Grid */}
            {isLoading ? (
              <KalshiLoadingSkeleton />
            ) : filteredMarkets.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">No markets found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarkets.map((market, index) => (
                  <KalshiMarketCard
                    key={market.ticker}
                    market={market}
                    onClick={() => setSelectedMarket(market)}
                    onAIAnalysis={() => setAiMarket(market)}
                    index={index}
                  />
                ))}
              </div>
            )}

            {/* View All Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12 text-center"
            >
              <Button
                variant="outline"
                className="h-12 px-8 rounded-2xl border-border/50 hover:border-primary/50 group"
              >
                View All Markets
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          </TabsContent>

          <TabsContent value="portfolio" className="mt-0">
            <KalshiPortfolio positions={positions} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </section>

      {/* Trading Modal */}
      {selectedMarket && (
        <KalshiTradingModal
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
        />
      )}

      {/* AI Analysis Modal */}
      {aiMarket && (
        <KalshiAIInsight
          market={aiMarket}
          onClose={() => setAiMarket(null)}
        />
      )}
    </div>
  );
}
