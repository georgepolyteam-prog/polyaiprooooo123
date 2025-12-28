import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useChainId } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { TopBar } from '@/components/TopBar';
import { PandoraHero } from '@/components/pandora/PandoraHero';
import { FeaturedMarket } from '@/components/pandora/FeaturedMarket';
import { TrendingMarkets } from '@/components/pandora/TrendingMarkets';
import { MarketsGrid } from '@/components/pandora/MarketsGrid';
import { PandoraLoading, PandoraError } from '@/components/pandora/PandoraStates';
import { NetworkBanner } from '@/components/pandora/NetworkBanner';
import { TradeModal } from '@/components/pandora/TradeModal';
import { usePandoraMarkets } from '@/hooks/usePandoraMarkets';
import { formatVolume, PandoraMarket } from '@/lib/pandora-api';
import { sonic } from '@/config/sonic';
import { toast } from 'sonner';

export default function Pandora() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { open: openWalletModal } = useWeb3Modal();
  const { markets, loading, error, refetch } = usePandoraMarkets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMarket, setSelectedMarket] = useState<PandoraMarket | null>(null);

  // Check if on wrong network (should be on Sonic for Pandora)
  const isWrongNetwork = isConnected && chainId !== sonic.id;

  // Calculate total volume
  const totalVolume = useMemo(() => {
    const total = markets.reduce((sum, m) => sum + parseFloat(m.totalVolume || '0'), 0);
    return formatVolume(total.toString());
  }, [markets]);

  // Filter markets based on search and category
  const filteredMarkets = useMemo(() => {
    return markets.filter(market => {
      const matchesSearch = !searchQuery || 
        market.question.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || 
        market.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [markets, searchQuery, selectedCategory]);

  // Get featured, trending, and all markets
  const featured = filteredMarkets[0];
  const trending = filteredMarkets.slice(1, 6);
  const allMarkets = filteredMarkets.slice(6);

  const handleMarketClick = (market: PandoraMarket) => {
    if (!isConnected) {
      openWalletModal();
      toast.info('Connect your wallet to trade');
      return;
    }
    setSelectedMarket(market);
  };

  const handleAnalyze = (market: PandoraMarket) => {
    navigate('/chat', {
      state: {
        autoAnalyze: true,
        marketContext: {
          eventTitle: market.question,
          outcomeQuestion: market.question,
          currentOdds: market.currentOddsYes / 100,
          volume: parseFloat(market.totalVolume),
          url: `https://pandora.sonic.game/market/${market.marketAddress}`,
          slug: market.id,
          eventSlug: market.id,
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <PandoraLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <PandoraError onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <TopBar />
      
      <main>
        {/* Network check banner */}
        <NetworkBanner isWrongNetwork={isWrongNetwork} />
        
        {/* Hero with search and filters */}
        <PandoraHero
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          totalMarkets={markets.length}
          totalVolume={totalVolume}
        />
        
        {/* Featured market */}
        {featured && (
          <FeaturedMarket
            market={featured}
            onAnalyze={handleAnalyze}
          />
        )}
        
        {/* Trending carousel */}
        {trending.length > 0 && (
          <TrendingMarkets
            markets={trending}
            onMarketClick={handleMarketClick}
          />
        )}
        
        {/* All markets grid */}
        <MarketsGrid
          markets={allMarkets}
          onMarketClick={handleMarketClick}
        />
      </main>
      
      {/* Trade Modal */}
      {selectedMarket && (
        <TradeModal
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
        />
      )}
    </div>
  );
}
