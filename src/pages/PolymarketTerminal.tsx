import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  PanelLeft,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Activity,
  Filter,
  Zap,
  BarChart3,
  Radio,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';
import { usePolymarketTerminal, type Trade } from '@/hooks/usePolymarketTerminal';

// Components
import { PolyOrderbook } from '@/components/polymarket/PolyOrderbook';
import { PolyTradeFeed } from '@/components/polymarket/PolyTradeFeed';
import { PolyMarketSidebar } from '@/components/polymarket/PolyMarketSidebar';
import { PolyMarketChat } from '@/components/polymarket/PolyMarketChat';
import { PolyMarketNews } from '@/components/polymarket/PolyMarketNews';
import { PolyMarketChart } from '@/components/polymarket/PolyMarketChart';
import { PolyTradePanel } from '@/components/polymarket/PolyTradePanel';
import { TradeDetailModal } from '@/components/trades/TradeDetailModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import polyLogo from '@/assets/poly-logo-new.png';

const WHALE_THRESHOLD = 1000; // $1k+

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
    reconnect,
    reconnectAttempts,
    lastMessageTime,
  } = usePolymarketTerminal();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<'data' | 'chat' | 'trades'>('data');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [whalesOnly, setWhalesOnly] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [rightTab, setRightTab] = useState<'orderbook' | 'trades'>('orderbook');

  // Convert terminal Trade to TradeDetailModal format
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

  // Filter trades for whale trades
  const filteredTrades = whalesOnly
    ? trades.filter((t) => t.price * (t.shares_normalized || t.shares) >= WHALE_THRESHOLD)
    : trades;

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-card sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 bg-card border-border">
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
            
            <div className="flex items-center gap-2">
              <img src={polyLogo} alt="Polymarket" className="w-5 h-5 rounded" />
              <span className="text-sm font-semibold text-foreground">Terminal</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {connected && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-500">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Market Title */}
        {selectedMarket && (
          <div className="px-3 py-2 border-b border-border/50 bg-card">
            <h1 className="text-sm font-medium text-foreground line-clamp-1">
              {selectedMarket.title}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={cn(
                  'text-lg font-bold font-mono',
                  selectedMarket.yesPrice >= 50 ? 'text-emerald-500' : 'text-red-500',
                )}
              >
                {selectedMarket.yesPrice}¢
              </span>
              <span className="text-xs text-muted-foreground">YES</span>
              <a
                href={selectedMarket.marketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-primary flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Trade
              </a>
            </div>
          </div>
        )}

        {/* Mobile Tabs */}
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-2 grid grid-cols-3 bg-muted/50 h-9">
            <TabsTrigger value="data" className="text-xs">Chart</TabsTrigger>
            <TabsTrigger value="trades" className="text-xs">Trades</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs">AI</TabsTrigger>
          </TabsList>
          
          <TabsContent value="data" className="flex-1 m-0 p-3 space-y-3 overflow-y-auto">
            {selectedMarket ? (
              <>
                <PolyMarketChart market={selectedMarket} />
                <PolyOrderbook orderbook={orderbook} onRefresh={refetchOrderbook} compact loading={loadingMarketData} />
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Select a market</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="trades" className="flex-1 m-0 p-3 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Recent Trades</span>
              <Button
                variant={whalesOnly ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setWhalesOnly((p) => !p)}
                className="h-6 gap-1 text-[10px] px-2"
              >
                <Filter className="w-3 h-3" /> Whales
              </Button>
            </div>
            <PolyTradeFeed trades={filteredTrades} maxTrades={20} connected={connected} loading={loadingMarketData} onTradeClick={setSelectedTrade} />
            {selectedMarket && <PolyTradePanel market={selectedMarket} compact />}
          </TabsContent>
          
          <TabsContent value="chat" className="flex-1 m-0 p-3">
            {selectedMarket ? (
              <PolyMarketChat market={selectedMarket} />
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Select a market</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop layout - Hyperliquid-inspired professional trading terminal
  return (
    <div className="h-screen bg-[hsl(220,20%,4%)] flex overflow-hidden">
      {/* Market Sidebar - Collapsible */}
      <AnimatePresence mode="wait">
        {!sidebarCollapsed ? (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="shrink-0 border-r border-border/50"
          >
            <PolyMarketSidebar
              markets={markets}
              selectedMarket={selectedMarket}
              onSelectMarket={setSelectedMarket}
              loading={loading}
              onToggleCollapse={() => setSidebarCollapsed(true)}
              onLoadMore={loadMoreMarkets}
              hasMore={hasMore}
              loadingMore={loadingMore}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 48, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="shrink-0 border-r border-border/50"
          >
            <PolyMarketSidebar
              markets={markets}
              selectedMarket={selectedMarket}
              onSelectMarket={setSelectedMarket}
              loading={loading}
              collapsed
              onToggleCollapse={() => setSidebarCollapsed(false)}
              onLoadMore={loadMoreMarkets}
              hasMore={hasMore}
              loadingMore={loadingMore}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="flex items-center justify-between h-12 px-4 border-b border-border/50 bg-card shrink-0">
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
              <img src={polyLogo} alt="Polymarket" className="w-6 h-6 rounded" />
              <span className="font-semibold text-foreground">Terminal</span>
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
          <div className="flex items-center gap-6 h-14 px-4 border-b border-border/50 bg-card/50 shrink-0">
            {/* Market Title with dropdown indicator */}
            <div className="flex items-center gap-2 min-w-0">
              {selectedMarket.image && (
                <img src={selectedMarket.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-foreground truncate max-w-[300px]">
                  {selectedMarket.title}
                </h1>
              </div>
            </div>
            
            {/* Stats Row - Hyperliquid style */}
            <div className="flex items-center gap-6 ml-auto">
              {/* Yes Price */}
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">Yes</span>
                <span className={cn(
                  "text-lg font-bold font-mono",
                  selectedMarket.yesPrice >= 50 ? "text-emerald-400" : "text-red-400"
                )}>
                  {selectedMarket.yesPrice}¢
                </span>
              </div>
              
              {/* No Price */}
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">No</span>
                <span className={cn(
                  "text-lg font-bold font-mono",
                  selectedMarket.noPrice >= 50 ? "text-emerald-400" : "text-red-400"
                )}>
                  {selectedMarket.noPrice}¢
                </span>
              </div>
              
              <div className="h-8 w-px bg-border/50" />
              
              {/* 24h Volume */}
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">24h Volume</span>
                <span className="text-sm font-semibold text-foreground font-mono">
                  {formatVolume(selectedMarket.volume24h || 0)}
                </span>
              </div>
              
              {/* Liquidity */}
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">Liquidity</span>
                <span className="text-sm font-semibold text-foreground font-mono">
                  {formatLiquidity(selectedMarket.liquidity || 0)}
                </span>
              </div>
              
              {/* Total Volume */}
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">Total Vol</span>
                <span className="text-sm font-semibold text-foreground font-mono">
                  {formatVolume(selectedMarket.volume || 0)}
                </span>
              </div>
              
              {/* Trades Count */}
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">Trades</span>
                <span className="text-sm font-semibold text-foreground font-mono">
                  {stats.tradeCount}
                </span>
              </div>
              
              {/* Last Update */}
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground block">Updated</span>
                <span className="text-xs text-muted-foreground">
                  {lastMessageTime ? formatDistanceToNow(lastMessageTime, { addSuffix: false }) : '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert Banner */}
        {fetchError && (
          <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
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
              {/* Left Column: Chart */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-border/50">
                {/* Chart - uses absolute positioning to fill container */}
                <div className="flex-1 min-h-[300px] relative">
                  <div className="absolute inset-0">
                    <PolyMarketChart market={selectedMarket} />
                  </div>
                </div>
                
                {/* Bottom Tabs: AI Chat + News */}
                <div className="h-[280px] border-t border-border/50 shrink-0">
                  <Tabs defaultValue="chat" className="h-full flex flex-col">
                    <TabsList className="h-9 px-2 justify-start bg-card border-b border-border/50 rounded-none w-full">
                      <TabsTrigger value="chat" className="text-xs h-7 px-3 data-[state=active]:bg-muted">
                        AI Analysis
                      </TabsTrigger>
                      <TabsTrigger value="news" className="text-xs h-7 px-3 data-[state=active]:bg-muted">
                        News
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="chat" className="flex-1 m-0 min-h-0 overflow-hidden">
                      <PolyMarketChat market={selectedMarket} />
                    </TabsContent>
                    <TabsContent value="news" className="flex-1 m-0 p-3 overflow-y-auto">
                      <PolyMarketNews market={selectedMarket} compact />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              {/* Right Column: Orderbook + Trades + Trade Panel */}
              <div className="w-[340px] flex flex-col shrink-0">
                {/* Orderbook/Trades Tabs */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center h-9 px-2 bg-card border-b border-border/50">
                    <button
                      onClick={() => setRightTab('orderbook')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        rightTab === 'orderbook' 
                          ? "bg-muted text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Order Book
                    </button>
                    <button
                      onClick={() => setRightTab('trades')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        rightTab === 'trades' 
                          ? "bg-muted text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Trades
                    </button>
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
                <div className="h-[280px] border-t border-border/50 shrink-0">
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
