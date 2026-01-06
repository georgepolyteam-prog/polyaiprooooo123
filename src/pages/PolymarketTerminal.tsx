import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  PanelLeft,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  Briefcase,
  Clock,
  FileText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';
import { usePolymarketTerminal, type Trade } from '@/hooks/usePolymarketTerminal';
import { useAlerts } from '@/hooks/useAlerts';

// Components
import { PolyOrderbook } from '@/components/polymarket/PolyOrderbook';
import { PolyTradeFeed } from '@/components/polymarket/PolyTradeFeed';
import { PolyMarketSidebar } from '@/components/polymarket/PolyMarketSidebar';
import { PolyMarketChat } from '@/components/polymarket/PolyMarketChat';
import { PolyMarketNews } from '@/components/polymarket/PolyMarketNews';
import { PolyMarketChart } from '@/components/polymarket/PolyMarketChart';
import { PolyTradePanel } from '@/components/polymarket/PolyTradePanel';
import { TradeDetailModal } from '@/components/trades/TradeDetailModal';
import { AlertCenter } from '@/components/terminal/AlertCenter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import polyLogo from '@/assets/poly-logo-new.png';

const WHALE_THRESHOLD = 1000;

export default function PolymarketTerminal() {
  const isMobile = useIsMobile();
  const {
    markets,
    selectedMarket,
    setSelectedMarket,
    trades,
    orderbook,
    stats,
    connected,
    loading,
    loadingMarketData,
    loadingMore,
    hasMore,
    loadMoreMarkets,
    error,
    fetchError,
    retryFetch,
    refetchOrderbook,
    lastMessageTime,
  } = usePolymarketTerminal();

  const {
    activeAlerts,
    triggeredAlerts,
    createAlert,
    deleteAlert,
    dismissAlert,
    getAlertsForMarket,
    checkAlerts,
  } = useAlerts();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<'data' | 'chat' | 'trades'>('data');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [whalesOnly, setWhalesOnly] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [rightTab, setRightTab] = useState<'orderbook' | 'trades'>('orderbook');
  const [bottomTab, setBottomTab] = useState<'trades' | 'positions' | 'orders' | 'ai' | 'news'>('trades');

  // Check alerts when market price changes
  const currentPrice = selectedMarket?.yesPrice || 0;
  if (selectedMarket?.conditionId && currentPrice > 0) {
    checkAlerts(selectedMarket.conditionId, currentPrice);
  }

  // Handle alert creation from chart context menu
  const handleCreateAlert = useCallback((price: number, direction: 'above' | 'below') => {
    if (!selectedMarket) return;
    
    createAlert({
      marketSlug: selectedMarket.slug,
      conditionId: selectedMarket.conditionId,
      tokenId: selectedMarket.yesTokenId || '',
      targetPrice: price,
      direction,
      marketTitle: selectedMarket.title,
      marketImage: selectedMarket.image,
    });
  }, [selectedMarket, createAlert]);

  // Get alerts for current market
  const currentMarketAlerts = selectedMarket 
    ? getAlertsForMarket(selectedMarket.slug).filter(a => a.isActive)
    : [];

  const convertTradeForModal = (trade: Trade) => ({
    token_id: trade.token_id || '',
    token_label: trade.token_label || 'YES',
    side: trade.side as 'BUY' | 'SELL',
    market_slug: selectedMarket?.slug || '',
    condition_id: selectedMarket?.conditionId || '',
    shares_normalized: trade.shares_normalized,
    shares: trade.shares,
    price: trade.price,
    tx_hash: trade.id || '',
    title: selectedMarket?.title || '',
    timestamp: trade.timestamp,
    user: trade.user || trade.taker || '',
    image: selectedMarket?.image,
    resolved_url: selectedMarket?.marketUrl,
  });

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatLiquidity = (liq: number) => {
    if (liq >= 1000000) return `$${(liq / 1000000).toFixed(2)}M`;
    if (liq >= 1000) return `$${(liq / 1000).toFixed(1)}K`;
    return `$${liq.toFixed(0)}`;
  };

  const filteredTrades = whalesOnly
    ? trades.filter((t) => t.price * (t.shares_normalized || t.shares) >= WHALE_THRESHOLD)
    : trades;

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-12 px-3 border-b border-border/50 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <PanelLeft className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <PolyMarketSidebar
                  markets={markets}
                  selectedMarket={selectedMarket}
                  onSelectMarket={(m) => {
                    setSelectedMarket(m);
                    setShowMobileSidebar(false);
                  }}
                  loading={loading}
                  onLoadMore={loadMoreMarkets}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                />
              </SheetContent>
            </Sheet>
            <img src={polyLogo} alt="Polymarket" className="w-5 h-5 rounded" />
            <span className="text-sm font-semibold">Terminal</span>
          </div>
          
          <div className="flex items-center gap-2">
            <AlertCenter
              activeAlerts={activeAlerts}
              triggeredAlerts={triggeredAlerts}
              onDeleteAlert={deleteAlert}
              onDismissAlert={dismissAlert}
            />
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-500">Live</span>
            </div>
          </div>
        </header>

        {/* Mobile Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as any)} className="h-full flex flex-col">
            <TabsList className="h-10 px-2 justify-start bg-card border-b border-border/50 rounded-none shrink-0">
              <TabsTrigger value="data" className="text-xs">Chart</TabsTrigger>
              <TabsTrigger value="trades" className="text-xs">Trades</TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">AI</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="flex-1 m-0 overflow-auto">
              {selectedMarket && (
                <div className="p-3 space-y-3">
                  <div className="h-[300px]">
                    <PolyMarketChart 
                      market={selectedMarket}
                      alerts={currentMarketAlerts}
                      onCreateAlert={handleCreateAlert}
                    />
                  </div>
                  <PolyOrderbook orderbook={orderbook} onRefresh={refetchOrderbook} compact loading={loadingMarketData} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="trades" className="flex-1 m-0 overflow-hidden">
              <PolyTradeFeed 
                trades={filteredTrades} 
                maxTrades={30} 
                connected={connected} 
                loading={loadingMarketData}
                onTradeClick={setSelectedTrade}
              />
            </TabsContent>

            <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
              {selectedMarket && <PolyMarketChat market={selectedMarket} />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-screen bg-[hsl(220,20%,4%)] flex overflow-hidden">
      {/* Market Sidebar */}
      <div 
        className={cn(
          "shrink-0 border-r border-border/50 transition-all duration-200 ease-out overflow-hidden",
          sidebarCollapsed ? "w-12" : "w-[260px]"
        )}
      >
        <PolyMarketSidebar
          markets={markets}
          selectedMarket={selectedMarket}
          onSelectMarket={setSelectedMarket}
          loading={loading}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onLoadMore={loadMoreMarkets}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="flex items-center justify-between h-11 px-4 border-b border-border/50 bg-card shrink-0">
          <div className="flex items-center gap-4">
            {sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(false)}
                className="h-7 w-7"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            )}
            
            <div className="flex items-center gap-2">
              <img src={polyLogo} alt="Polymarket" className="w-5 h-5 rounded" />
              <span className="text-sm font-semibold text-foreground">Terminal</span>
            </div>
            
            <nav className="flex items-center gap-1 ml-4">
              <Link to="/" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted/50 transition-colors">
                Home
              </Link>
              <Link to="/live-trades" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted/50 transition-colors">
                Live Trades
              </Link>
              <Link to="/leaderboard" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted/50 transition-colors">
                Leaderboard
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Alert Center */}
            <AlertCenter
              activeAlerts={activeAlerts}
              triggeredAlerts={triggeredAlerts}
              onDeleteAlert={deleteAlert}
              onDismissAlert={dismissAlert}
            />

            {/* Connection Status */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-500">
                {loadingMarketData ? 'Syncing' : 'Live'}
              </span>
            </div>
            
            {selectedMarket && (
              <a
                href={selectedMarket.marketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-medium"
              >
                Trade
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </header>

        {/* Market Info Bar */}
        {selectedMarket && (
          <div className="flex items-center gap-6 h-12 px-4 border-b border-border/50 bg-card/50 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {selectedMarket.image && (
                <img src={selectedMarket.image} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-foreground truncate max-w-[300px]">
                  {selectedMarket.title}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4 ml-auto text-center">
              {/* Price */}
              <div>
                <span className="text-[10px] text-muted-foreground block">YES</span>
                <span className={cn(
                  "text-sm font-bold font-mono",
                  selectedMarket.yesPrice >= 50 ? "text-emerald-400" : "text-red-400"
                )}>
                  {selectedMarket.yesPrice}¢
                </span>
              </div>
              
              <div className="h-6 w-px bg-border/50" />
              
              {/* 24h Volume */}
              <div>
                <span className="text-[10px] text-muted-foreground block">24h Vol</span>
                <span className="text-xs font-semibold text-foreground font-mono">
                  {formatVolume(selectedMarket.volume24h || 0)}
                </span>
              </div>
              
              {/* Liquidity */}
              <div>
                <span className="text-[10px] text-muted-foreground block">Liquidity</span>
                <span className="text-xs font-semibold text-foreground font-mono">
                  {formatLiquidity(selectedMarket.liquidity || 0)}
                </span>
              </div>
              
              {/* Updated */}
              <div>
                <span className="text-[10px] text-muted-foreground block">Updated</span>
                <span className="text-xs text-muted-foreground">
                  {lastMessageTime ? formatDistanceToNow(lastMessageTime, { addSuffix: false }) : '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {fetchError && (
          <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20 shrink-0">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-sm text-destructive flex-1">{fetchError}</span>
            <Button size="sm" variant="outline" onClick={retryFetch} className="h-7 gap-1.5 text-xs">
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0">
          {error && !selectedMarket ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">{error}</p>
                <p className="text-sm mt-2">Select a market from the sidebar</p>
              </div>
            </div>
          ) : selectedMarket ? (
            <>
              {/* Left Column: Chart + Bottom Panel */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-border/50">
                {/* Chart - 40% height */}
                <div className="h-[40%] min-h-[250px] relative border-b border-border/50">
                  <div className="absolute inset-0">
                    <PolyMarketChart 
                      market={selectedMarket}
                      alerts={currentMarketAlerts}
                      onCreateAlert={handleCreateAlert}
                    />
                  </div>
                </div>
                
                {/* Bottom Panel - 60% height with tabs */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center h-9 px-2 bg-card border-b border-border/50 shrink-0">
                    <button
                      onClick={() => setBottomTab('trades')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        bottomTab === 'trades' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Clock className="w-3 h-3" />
                      Trades
                    </button>
                    <button
                      onClick={() => setBottomTab('positions')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        bottomTab === 'positions' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Briefcase className="w-3 h-3" />
                      Positions
                    </button>
                    <button
                      onClick={() => setBottomTab('orders')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        bottomTab === 'orders' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <FileText className="w-3 h-3" />
                      Open Orders
                    </button>
                    <button
                      onClick={() => setBottomTab('ai')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        bottomTab === 'ai' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      AI Analysis
                    </button>
                    <button
                      onClick={() => setBottomTab('news')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        bottomTab === 'news' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      News
                    </button>
                    
                    {bottomTab === 'trades' && (
                      <div className="ml-auto">
                        <Button
                          variant={whalesOnly ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setWhalesOnly((p) => !p)}
                          className="h-6 gap-1 text-[10px] px-2"
                        >
                          🐋 {whalesOnly ? 'On' : 'Off'}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {bottomTab === 'trades' && (
                      <PolyTradeFeed 
                        trades={filteredTrades} 
                        maxTrades={50} 
                        connected={connected} 
                        loading={loadingMarketData}
                        onTradeClick={setSelectedTrade}
                      />
                    )}
                    {bottomTab === 'positions' && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <Briefcase className="w-10 h-10 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">No open positions</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Connect wallet to view positions</p>
                      </div>
                    )}
                    {bottomTab === 'orders' && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <FileText className="w-10 h-10 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">No open orders</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Connect wallet to view orders</p>
                      </div>
                    )}
                    {bottomTab === 'ai' && (
                      <PolyMarketChat market={selectedMarket} />
                    )}
                    {bottomTab === 'news' && (
                      <div className="p-3 overflow-auto h-full">
                        <PolyMarketNews market={selectedMarket} compact />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Orderbook + Trade Panel */}
              <div className="w-[320px] flex flex-col shrink-0">
                {/* Orderbook/Trades Tabs */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center h-9 px-2 bg-card border-b border-border/50 shrink-0">
                    <button
                      onClick={() => setRightTab('orderbook')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        rightTab === 'orderbook' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Order Book
                    </button>
                    <button
                      onClick={() => setRightTab('trades')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        rightTab === 'trades' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Trades
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    {rightTab === 'orderbook' ? (
                      <PolyOrderbook 
                        orderbook={orderbook} 
                        onRefresh={refetchOrderbook} 
                        loading={loadingMarketData}
                      />
                    ) : (
                      <PolyTradeFeed 
                        trades={filteredTrades} 
                        maxTrades={20} 
                        connected={connected} 
                        loading={loadingMarketData} 
                        onTradeClick={setSelectedTrade}
                      />
                    )}
                  </div>
                </div>
                
                {/* Trade Panel */}
                <div className="h-[260px] border-t border-border/50 shrink-0">
                  <PolyTradePanel market={selectedMarket} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-muted/50 flex items-center justify-center">
                  <LayoutGrid className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-lg font-medium">Select a market</p>
                <p className="text-sm mt-1 opacity-70">Choose from the sidebar to start</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <TradeDetailModal
          trade={convertTradeForModal(selectedTrade)}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </div>
  );
}
