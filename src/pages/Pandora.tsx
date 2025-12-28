import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/TopBar';
import { PandoraHero } from '@/components/pandora/PandoraHero';
import { FeaturedMarket } from '@/components/pandora/FeaturedMarket';
import { TrendingMarkets } from '@/components/pandora/TrendingMarkets';
import { MarketsGrid } from '@/components/pandora/MarketsGrid';
import { PandoraLoading, PandoraError } from '@/components/pandora/PandoraStates';
import { usePandoraMarkets } from '@/hooks/usePandoraMarkets';
import { formatVolume, PandoraMarket } from '@/lib/pandora-api';
import { toast } from 'sonner';

export default function Pandora() {
  const navigate = useNavigate();
  const { markets, loading, error, refetch } = usePandoraMarkets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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
    toast.info(`Opening ${market.question.slice(0, 50)}...`);
    // Could navigate to detail page or open modal
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
    </div>
  );
}
