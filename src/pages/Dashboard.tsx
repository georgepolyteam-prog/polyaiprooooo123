import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { URLInput } from '@/components/dashboard/URLInput';
import { MarketHeader } from '@/components/dashboard/MarketHeader';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { OrderBook } from '@/components/dashboard/OrderBook';
import { TradeFeed } from '@/components/dashboard/TradeFeed';
import { PriceChart } from '@/components/dashboard/PriceChart';
import { TopTraders } from '@/components/dashboard/TopTraders';
import { MarketInfoCard } from '@/components/dashboard/MarketInfoCard';
import { CyberLoader } from '@/components/dashboard/CyberLoader';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MarketSelector } from '@/components/chat/MarketSelector';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/dashboard/GlassCard';

export default function Dashboard() {
  const [marketUrl, setMarketUrl] = useState<string | null>(null);
  
  const {
    market,
    trades,
    orderbook,
    priceHistory,
    stats,
    topTraders,
    topTraderStats,
    marketInfo,
    multiMarketData,
    lastUpdate,
    isLoading,
    error,
    refresh,
  } = useDashboardData(marketUrl);

  const handleAnalyze = (url: string) => {
    setMarketUrl(url);
  };

  const handleBack = () => {
    setMarketUrl(null);
  };

  const handleMarketSelect = (marketId: number) => {
    if (!multiMarketData) return;
    
    if (marketId === -1) {
      // "Analyze all" - for now, just pick the first market
      const firstMarket = multiMarketData.markets[0];
      if (firstMarket) {
        const newUrl = `https://polymarket.com/event/${multiMarketData.eventSlug}/${firstMarket.market_slug}`;
        setMarketUrl(newUrl);
      }
    } else {
      const selected = multiMarketData.markets.find(m => m.id === marketId);
      if (selected) {
        const newUrl = `https://polymarket.com/event/${multiMarketData.eventSlug}/${selected.market_slug}`;
        setMarketUrl(newUrl);
      }
    }
  };

  // Show URL input if no market selected
  if (!marketUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative overflow-x-hidden">
        {/* Animated gradient mesh background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 -right-40 w-96 h-96 bg-pink-500/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        <TopBar />
        <URLInput onSubmit={handleAnalyze} isLoading={isLoading} />
      </div>
    );
  }

  // Show market selector for multi-market events
  if (multiMarketData?.needsSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative overflow-x-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 -right-40 w-96 h-96 bg-pink-500/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 relative">
          <Button 
            variant="ghost" 
            onClick={handleBack} 
            className="mb-6 text-gray-300 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <MarketSelector
            eventTitle={multiMarketData.eventTitle}
            eventUrl={multiMarketData.eventUrl}
            markets={multiMarketData.markets}
            onSelect={handleMarketSelect}
          />
        </main>
      </div>
    );
  }

  // Loading state with premium CyberLoader
  if (isLoading && !market) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative overflow-x-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 -right-40 w-96 h-96 bg-pink-500/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        <TopBar />
        <main className="max-w-6xl mx-auto px-4 py-8 relative">
          <CyberLoader />
        </main>
      </div>
    );
  }

  // Error state
  if (error && !market) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative overflow-x-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
        </div>
        <TopBar />
        <main className="max-w-6xl mx-auto px-4 py-8 relative">
          <Button variant="ghost" onClick={handleBack} className="mb-6 text-gray-300 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <GlassCard className="p-8 text-center" cyber>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Failed to Load Market</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={() => setMarketUrl(null)} className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white border-0">
              Try Another Market
            </Button>
          </GlassCard>
        </main>
      </div>
    );
  }

  // Check for recent whale activity
  const recentWhaleActivity = trades.some(t => t.isWhale && t.timeAgo.includes('Just now'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative overflow-x-hidden">
      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-pink-500/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      
      {/* Cyber grid overlay */}
      <div className="fixed inset-0 cyber-grid-animated opacity-30 pointer-events-none" />
      
      <TopBar />
      
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6 relative">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={handleBack} 
            className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refresh}
            disabled={isLoading}
            className="gap-2 border-border/50 hover:border-border hover:bg-muted/50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Market Header */}
        {market && (
          <MarketHeader
            title={market.title}
            yesPrice={market.yesPrice}
            noPrice={market.noPrice}
            yesVolume={market.yesVolume}
            noVolume={market.noVolume}
            totalVolume={market.totalVolume}
            liquidity={market.liquidity}
            endDate={market.endDate}
            marketUrl={market.marketUrl}
            lastUpdate={lastUpdate}
          />
        )}

        {/* Market Info Card */}
        {marketInfo && (
          <MarketInfoCard
            description={marketInfo.description}
            resolutionSource={marketInfo.resolutionSource}
            tags={marketInfo.tags}
            endDate={market?.endDate}
            createdDate={marketInfo.createdDate}
          />
        )}

        {/* Stats Grid */}
        <StatsGrid
          volume24h={stats.volume24h}
          uniqueTraders={stats.uniqueTraders}
          avgTradeSize={stats.avgTradeSize}
          whaleCount={stats.whaleCount}
          whaleVolume={stats.whaleVolume}
          priceChange1h={stats.priceChange1h}
          priceChange24h={stats.priceChange24h}
          priceChange7d={stats.priceChange7d}
          buyPressure={stats.buyPressure}
          recentWhaleActivity={recentWhaleActivity}
        />

        {/* Order Book & Trade Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OrderBook
            bids={orderbook.bids}
            asks={orderbook.asks}
            spread={orderbook.spread}
            midPrice={orderbook.midPrice}
          />
          <TradeFeed
            trades={trades}
            buyPressure={stats.buyPressure}
          />
        </div>

        {/* Top Traders */}
        <TopTraders
          traders={topTraders}
          whaleCount={topTraderStats.whaleCount}
          whaleVolume={topTraderStats.whaleVolume}
          totalVolume={stats.volume24h}
          whaleThreshold={topTraderStats.whaleThreshold}
        />

        {/* Price Chart */}
        <PriceChart
          history={priceHistory}
          currentPrice={(market?.yesPrice || 0.5) * 100}
          priceChange7d={stats.priceChange7d}
        />

        {/* Footer Attribution */}
        <div className="text-center py-6 text-xs text-muted-foreground">
          <span>Powered by </span>
          <a 
            href="https://polymarket.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-foreground/80 hover:text-foreground hover:underline transition-colors font-medium"
          >
            Polymarket
          </a>
          <span> & </span>
          <a 
            href="https://domeapi.io" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-foreground/80 hover:text-foreground hover:underline transition-colors font-medium"
          >
            DOME
          </a>
          <span className="text-muted-foreground/70"> (</span>
          <a 
            href="https://domeapi.io" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-muted-foreground/70 hover:text-foreground hover:underline transition-colors"
          >
            domeapi.io
          </a>
          <span className="text-muted-foreground/70">)</span>
        </div>
      </main>
    </div>
  );
}
