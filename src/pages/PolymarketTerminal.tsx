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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';
import { usePolymarketTerminal } from '@/hooks/usePolymarketTerminal';

// Components
import { PolyOrderbook } from '@/components/polymarket/PolyOrderbook';
import { PolyTradeFeed } from '@/components/polymarket/PolyTradeFeed';
import { PolyMarketSidebar } from '@/components/polymarket/PolyMarketSidebar';
import { PolyMarketChat } from '@/components/polymarket/PolyMarketChat';
import { PolyMarketNews } from '@/components/polymarket/PolyMarketNews';
import { PolyMarketChart } from '@/components/polymarket/PolyMarketChart';
import { PolyTradePanel } from '@/components/polymarket/PolyTradePanel';
import { PolyConnectionHealth } from '@/components/polymarket/PolyConnectionHealth';
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
    error,
    refetchOrderbook,
    reconnect,
    reconnectAttempts,
    lastMessageTime,
  } = usePolymarketTerminal();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<'data' | 'chat' | 'trades'>('data');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [whalesOnly, setWhalesOnly] = useState(false);

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
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
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-card/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <PolyMarketSidebar
                  markets={markets}
                  selectedMarket={selectedMarket}
                  onSelectMarket={(m) => {
                    setSelectedMarket(m);
                    setShowMobileSidebar(false);
                  }}
                  loading={loading}
                />
              </SheetContent>
            </Sheet>
            
            <div className="flex items-center gap-2">
              <img src={polyLogo} alt="Polymarket" className="w-5 h-5 rounded" />
              <span className="text-sm font-semibold text-foreground">Terminal</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <PolyConnectionHealth connected={connected} reconnectAttempts={reconnectAttempts} lastEventTime={lastMessageTime} onReconnect={reconnect} compact />
          </div>
        </div>

        {/* Market Title */}
        {selectedMarket && (
          <header className="px-3 py-2 border-b border-border/30 bg-card/50">
            <h1 className="text-sm font-medium text-foreground line-clamp-2">
              {selectedMarket.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
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
                View on Polymarket
              </a>
            </div>
          </header>
        )}

        {/* Mobile Tabs */}
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-2 grid grid-cols-3 bg-muted/40">
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="chat">AI Chat</TabsTrigger>
          </TabsList>
          
           <TabsContent value="data" className="flex-1 m-0 p-3 space-y-3 overflow-y-auto">
             {selectedMarket ? (
               <>
                 <PolyMarketChart market={selectedMarket} compact />
                 <PolyOrderbook orderbook={orderbook} onRefresh={refetchOrderbook} compact />
                 <PolyMarketNews market={selectedMarket} compact />
               </>
             ) : (
               <div className="flex items-center justify-center py-12">
                 <p className="text-sm text-muted-foreground">Select a market to view data</p>
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
                className="h-7 gap-1 text-[10px]"
              >
                <Filter className="w-3 h-3" /> Whales
              </Button>
            </div>
            <PolyTradeFeed trades={filteredTrades} maxTrades={20} connected={connected} />
            {selectedMarket && <PolyTradePanel market={selectedMarket} compact />}
          </TabsContent>
          
          <TabsContent value="chat" className="flex-1 m-0 p-3">
            {selectedMarket ? (
              <PolyMarketChat market={selectedMarket} />
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Select a market to chat</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background flex">
      {/* Subtle background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      {/* Market Sidebar */}
      <AnimatePresence mode="wait">
        {!sidebarCollapsed ? (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-10"
          >
            <PolyMarketSidebar
              markets={markets}
              selectedMarket={selectedMarket}
              onSelectMarket={setSelectedMarket}
              loading={loading}
              onToggleCollapse={() => setSidebarCollapsed(true)}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 48, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-10"
          >
            <PolyMarketSidebar
              markets={markets}
              selectedMarket={selectedMarket}
              onSelectMarket={setSelectedMarket}
              loading={loading}
              collapsed
              onToggleCollapse={() => setSidebarCollapsed(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top Bar - Premium Design */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-card/60 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            {sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(false)}
                className="h-8 w-8"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            )}
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={polyLogo} alt="Polymarket" className="w-8 h-8 rounded-lg shadow-lg" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-foreground tracking-tight">Polymarket Terminal</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Live Trading Dashboard</p>
              </div>
            </div>
            
            <Link to="/live-trades" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <ArrowLeft className="w-3 h-3" />
              Live Trades
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <PolyConnectionHealth connected={connected} reconnectAttempts={reconnectAttempts} lastEventTime={lastMessageTime} onReconnect={reconnect} />

            <Button
              variant={whalesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setWhalesOnly((p) => !p)}
              className={cn(
                "h-9 gap-2 text-xs font-medium transition-all",
                whalesOnly && "bg-primary shadow-lg shadow-primary/25"
              )}
            >
              {whalesOnly ? '🐋' : <Filter className="w-3.5 h-3.5" />}
              {whalesOnly ? 'Whales Only' : 'All Trades'}
            </Button>
            
            {selectedMarket && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50 backdrop-blur-sm"
              >
                {selectedMarket.image && (
                  <img
                    src={selectedMarket.image}
                    alt={`${selectedMarket.title} market image`}
                    className="w-8 h-8 rounded-lg object-cover shadow-md"
                  />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground line-clamp-1 max-w-[280px]">
                    {selectedMarket.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Vol: {formatVolume(selectedMarket.volume24h || selectedMarket.volume)}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span
                    className={cn(
                      'text-2xl font-bold font-mono',
                      selectedMarket.yesPrice >= 50 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {selectedMarket.yesPrice}¢
                  </span>
                  {selectedMarket.yesPrice >= 50 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
              </motion.div>
            )}

            {selectedMarket && (
              <a
                href={selectedMarket.marketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm font-medium"
              >
                <Zap className="w-4 h-4" />
                Trade
              </a>
            )}
          </div>
        </div>

         {/* Content Area */}
         <main className="flex-1 flex overflow-hidden">
           <h1 className="sr-only">Polymarket trading terminal</h1>
           {/* Main Panel */}
           <div className="flex-1 flex flex-col min-w-0 p-6 overflow-y-auto">
             {error && !selectedMarket ? (
               <div className="flex-1 flex items-center justify-center">
                 <div className="text-center text-muted-foreground">
                   <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                   <p className="text-lg font-medium">{error}</p>
                   <p className="text-sm mt-2">Select a market from the sidebar to continue</p>
                 </div>
               </div>
             ) : selectedMarket ? (
               <>
                 {/* Stats Bar - Premium Glass Design */}
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="flex items-center gap-6 p-5 rounded-2xl bg-gradient-to-r from-card/80 to-card/60 border border-border/50 backdrop-blur-xl mb-6 shadow-xl shadow-black/5"
                 >
                   <div className="flex items-center gap-3">
                     <div className="p-2.5 rounded-xl bg-primary/10">
                       <Activity className="w-5 h-5 text-primary" />
                     </div>
                     <div>
                       <span className="text-xs text-muted-foreground uppercase tracking-wide">Session Trades</span>
                       <p className="text-xl font-bold text-foreground font-mono">{stats.tradeCount}</p>
                     </div>
                   </div>
                   
                   <div className="h-10 w-px bg-border/50" />
                   
                   <div className="flex items-center gap-3">
                     <div className="p-2.5 rounded-xl bg-emerald-500/10">
                       <TrendingUp className="w-5 h-5 text-emerald-500" />
                     </div>
                     <div>
                       <span className="text-xs text-muted-foreground uppercase tracking-wide">Buys</span>
                       <p className="text-xl font-bold text-emerald-500 font-mono">{stats.buyCount}</p>
                     </div>
                   </div>
                   
                   <div className="h-10 w-px bg-border/50" />
                   
                   <div className="flex items-center gap-3">
                     <div className="p-2.5 rounded-xl bg-red-500/10">
                       <TrendingDown className="w-5 h-5 text-red-500" />
                     </div>
                     <div>
                       <span className="text-xs text-muted-foreground uppercase tracking-wide">Sells</span>
                       <p className="text-xl font-bold text-red-500 font-mono">{stats.sellCount}</p>
                     </div>
                   </div>
                   
                   <div className="h-10 w-px bg-border/50" />
                   
                   <div className="flex items-center gap-3">
                     <div className="p-2.5 rounded-xl bg-secondary/10">
                       <BarChart3 className="w-5 h-5 text-secondary" />
                     </div>
                     <div>
                       <span className="text-xs text-muted-foreground uppercase tracking-wide">24h Volume</span>
                       <p className="text-xl font-bold text-foreground font-mono">{formatVolume(selectedMarket.volume24h || selectedMarket.volume)}</p>
                     </div>
                   </div>
                   
                   <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                     <Radio className="w-3 h-3 text-primary animate-pulse" />
                     <span className="text-xs font-medium text-primary">Live Data</span>
                   </div>
                 </motion.div>

                 <PolyMarketChart market={selectedMarket} />

                 {/* Main Grid – 3 columns */}
                 <div className="grid grid-cols-3 gap-6 mt-6">
                   {/* Column 1: Orderbook + Trade Panel */}
                   <div className="space-y-6">
                     <PolyOrderbook orderbook={orderbook} onRefresh={refetchOrderbook} />
                     <PolyTradePanel market={selectedMarket} />
                   </div>
                   {/* Column 2: Trades + News */}
                   <div className="space-y-6">
                     <PolyTradeFeed trades={filteredTrades} maxTrades={12} connected={connected} />
                     <PolyMarketNews market={selectedMarket} />
                   </div>
                   {/* Column 3: AI Chat */}
                   <div className="space-y-6">
                     <PolyMarketChat market={selectedMarket} />
                   </div>
                 </div>
               </>
             ) : (
               <div className="flex-1 flex items-center justify-center">
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="text-center text-muted-foreground"
                 >
                   <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
                     <LayoutGrid className="w-10 h-10 opacity-50" />
                   </div>
                   <p className="text-lg font-medium">Select a market from the sidebar</p>
                   <p className="text-sm mt-2 opacity-70">Choose a market to view live data, charts, and AI analysis</p>
                 </motion.div>
               </div>
             )}
           </div>
         </main>
      </div>
    </div>
  );
}
