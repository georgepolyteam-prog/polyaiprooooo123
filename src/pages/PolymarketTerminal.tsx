import { useState, useCallback } from 'react';
import {
  LayoutGrid,
  PanelLeft,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  Briefcase,
  Clock,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';
import { usePolymarketTerminal, type Trade } from '@/hooks/usePolymarketTerminal';
import { useAlerts } from '@/hooks/useAlerts';
import { useAuth } from '@/hooks/useAuth';

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
import { UserPositionsPanel } from '@/components/terminal/UserPositionsPanel';
import { UserOrdersPanel } from '@/components/terminal/UserOrdersPanel';
import { UserTradesPanel } from '@/components/terminal/UserTradesPanel';
import { TerminalAuthGate } from '@/components/terminal/TerminalAuthGate';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

import polyLogo from '@/assets/poly-logo-new.png';

const WHALE_THRESHOLD = 1000;

export default function PolymarketTerminal() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
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
    isAuthenticated,
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
  const [bottomTab, setBottomTab] = useState<'trades' | 'positions' | 'orders' | 'ai' | 'news'>(
    'trades'
  );

  // Check alerts when market price changes
  const currentPrice = selectedMarket?.yesPrice || 0;
  if (selectedMarket?.conditionId && currentPrice > 0) {
    checkAlerts(selectedMarket.conditionId, currentPrice);
  }

  // Handle alert creation from chart context menu
  const handleCreateAlert = useCallback(
    (price: number, direction: 'above' | 'below') => {
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
    },
    [selectedMarket, createAlert]
  );

  // Get alerts for current market
  const currentMarketAlerts = selectedMarket
    ? getAlertsForMarket(selectedMarket.slug).filter((a) => a.isActive)
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
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
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

        {/* Mobile Content - full height with overflow scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-20">
          <Tabs
            value={mobileTab}
            onValueChange={(v) => setMobileTab(v as any)}
            className="flex flex-col"
          >
            <TabsList className="h-10 px-2 justify-start bg-card border-b border-border/50 rounded-none sticky top-0 z-10">
              <TabsTrigger value="data" className="text-xs">
                Chart
              </TabsTrigger>
              <TabsTrigger value="trades" className="text-xs">
                Trades
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="m-0">
              {selectedMarket && (
                <div className="p-3 space-y-3">
                  <div className="h-[300px]">
                    <PolyMarketChart
                      market={selectedMarket}
                      alerts={currentMarketAlerts}
                      onCreateAlert={handleCreateAlert}
                    />
                  </div>
                  <PolyOrderbook
                    orderbook={orderbook}
                    onRefresh={refetchOrderbook}
                    compact
                    loading={loadingMarketData}
                  />
                  <PolyTradePanel market={selectedMarket} compact />
                </div>
              )}
            </TabsContent>

            <TabsContent value="trades" className="m-0 min-h-[400px]">
              <PolyTradeFeed
                trades={filteredTrades}
                maxTrades={30}
                connected={connected}
                loading={loadingMarketData}
                onTradeClick={setSelectedTrade}
              />
            </TabsContent>

            <TabsContent value="chat" className="m-0 min-h-[400px] p-3">
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
      {/* Market Sidebar - Fixed width, not affected by resize */}
      <div
        className={cn(
          'shrink-0 border-r border-border/50 overflow-hidden transition-[width] duration-200 ease-out',
          sidebarCollapsed ? 'w-12' : 'w-[260px]'
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
              <Link
                to="/"
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted/50 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/live-trades"
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted/50 transition-colors"
              >
                Live Trades
              </Link>
              <Link
                to="/leaderboard"
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted/50 transition-colors"
              >
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

            <Link
              to="/help"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors text-xs font-medium border border-border/50"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Help
            </Link>
          </div>
        </header>

        {/* Market Info Bar */}
        {selectedMarket && (
          <div className="flex items-center gap-6 h-12 px-4 border-b border-border/50 bg-card/50 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {selectedMarket.image && (
                <img
                  src={selectedMarket.image}
                  alt=""
                  className="w-7 h-7 rounded object-cover shrink-0"
                />
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
                <span
                  className={cn(
                    'text-sm font-bold font-mono',
                    selectedMarket.yesPrice >= 50 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
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
                  {lastMessageTime
                    ? formatDistanceToNow(lastMessageTime, { addSuffix: false })
                    : '--'}
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
        <div className="flex-1 flex min-h-0 overflow-hidden">
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
              {/* Left Column: Chart + Bottom Panel (Resizable) */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-border/50 overflow-hidden">
                <ResizablePanelGroup direction="vertical" className="flex-1">
                  {/* Chart Panel */}
                  <ResizablePanel defaultSize={40} minSize={20} maxSize={80}>
                    <div className="h-full relative">
                      <PolyMarketChart
                        market={selectedMarket}
                        alerts={currentMarketAlerts}
                        onCreateAlert={handleCreateAlert}
                      />
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle className="bg-border/30 hover:bg-border/60 transition-colors" />

                  {/* Bottom Panel with tabs */}
                  <ResizablePanel defaultSize={60} minSize={20}>
                    <div className="h-full flex flex-col overflow-hidden">
                      {/* Bottom tabs header */}
                      <div className="flex items-center h-9 px-2 bg-card border-b border-border/50 shrink-0">
                        <button
                          onClick={() => setBottomTab('trades')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                            bottomTab === 'trades'
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Clock className="w-3 h-3" />
                          Trades
                        </button>
                        <button
                          onClick={() => setBottomTab('positions')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                            bottomTab === 'positions'
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Briefcase className="w-3 h-3" />
                          Positions
                        </button>
                        <button
                          onClick={() => setBottomTab('orders')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                            bottomTab === 'orders'
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <FileText className="w-3 h-3" />
                          Open Orders
                        </button>
                        <button
                          onClick={() => setBottomTab('ai')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                            bottomTab === 'ai'
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          AI Analysis
                        </button>
                        <button
                          onClick={() => setBottomTab('news')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                            bottomTab === 'news'
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
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

                      {/* Bottom panel content */}
                      <div className="flex-1 min-h-0 overflow-hidden">
                        {bottomTab === 'trades' && <UserTradesPanel />}
                        {bottomTab === 'positions' && <UserPositionsPanel />}
                        {bottomTab === 'orders' && <UserOrdersPanel />}
                        {bottomTab === 'ai' &&
                          (user ? (
                            <PolyMarketChat market={selectedMarket} />
                          ) : (
                            <TerminalAuthGate
                              title="AI Market Analysis"
                              description="Sign in to get AI-powered insights on this market"
                            />
                          ))}
                        {bottomTab === 'news' && (
                          <div className="p-3 overflow-auto h-full">
                            <PolyMarketNews market={selectedMarket} compact />
                          </div>
                        )}
                      </div>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>

              {/* Right Column: Trade Panel on top, then Orderbook/Trades */}
              <div className="w-[320px] flex flex-col shrink-0 overflow-hidden">
                {/* Trade Panel - at top */}
                <div className="shrink-0 border-b border-border/50 overflow-hidden">
                  <PolyTradePanel market={selectedMarket} />
                </div>

                {/* Orderbook/Trades - fills remaining space */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center h-8 px-2 bg-card border-b border-border/50 shrink-0">
                    <button
                      onClick={() => setRightTab('orderbook')}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded transition-colors',
                        rightTab === 'orderbook'
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Order Book
                    </button>
                    <button
                      onClick={() => setRightTab('trades')}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded transition-colors',
                        rightTab === 'trades'
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
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
                        maxTrades={100}
                        connected={connected}
                        loading={loadingMarketData}
                        onTradeClick={setSelectedTrade}
                      />
                    )}
                  </div>
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
