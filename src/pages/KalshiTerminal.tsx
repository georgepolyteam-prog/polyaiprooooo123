import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, 
  PanelLeft, 
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDflowApi, type KalshiMarket, type KalshiEvent } from '@/hooks/useDflowApi';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';

// Components
import { KalshiCandlestickChart } from '@/components/kalshi/KalshiCandlestickChart';
import { KalshiMarketSidebar } from '@/components/kalshi/KalshiMarketSidebar';
import { KalshiAIAgents } from '@/components/kalshi/KalshiAIAgents';
import { KalshiTradingPanel } from '@/components/kalshi/KalshiTradingPanel';
import { KalshiOrderbook } from '@/components/kalshi/KalshiOrderbook';
import { KalshiTradeFeed } from '@/components/kalshi/KalshiTradeFeed';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

import kalshiLogo from '@/assets/kalshi-logo.png';
import solanaLogo from '@/assets/solana-logo.png';

export default function KalshiTerminal() {
  const isMobile = useIsMobile();
  const { connected } = useWallet();
  const { getEvents, getOrderbook } = useDflowApi();
  
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'chart' | 'data' | 'trade'>('chart');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Fetch initial market
  useEffect(() => {
    const fetchInitialMarket = async () => {
      try {
        const events = await getEvents('active');
        if (events.length > 0 && events[0].markets?.length > 0) {
          const allMarkets: KalshiMarket[] = [];
          events.forEach((event: KalshiEvent) => {
            event.markets?.forEach(m => {
              if (!m.title && event.title) m.title = event.title;
              allMarkets.push(m);
            });
          });
          allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
          if (allMarkets.length > 0) {
            setSelectedMarket(allMarkets[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial market:', err);
      }
    };
    
    fetchInitialMarket();
  }, [getEvents]);

  // Poll for price updates every 3 seconds instead of WebSocket
  useEffect(() => {
    if (!selectedMarket) return;
    
    let mounted = true;
    
    const poll = async () => {
      if (!mounted) return;
      try {
        const orderbookData = await getOrderbook(selectedMarket.ticker);
        if (mounted && orderbookData?.yesBid) {
          setLivePrice(orderbookData.yesBid);
        }
      } catch (err) {
        // Silently fail - will retry on next interval
      }
    };
    
    poll(); // Initial fetch
    const interval = setInterval(poll, 3000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedMarket?.ticker, getOrderbook]);

  // Handle price updates from chart
  const handlePriceUpdate = useCallback((price: number) => {
    setLivePrice(price);
  }, []);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <KalshiMarketSidebar
                  selectedTicker={selectedMarket?.ticker}
                  onSelectMarket={(m) => {
                    setSelectedMarket(m);
                    setShowMobileSidebar(false);
                  }}
                />
              </SheetContent>
            </Sheet>
            
            <div className="flex items-center gap-2">
              <img src={kalshiLogo} alt="Kalshi" className="w-5 h-5 rounded" />
              <span className="text-sm font-medium text-foreground">Terminal</span>
            </div>
          </div>
          
          <WalletMultiButton className="!h-8 !text-xs !px-3 !rounded-lg" />
        </div>

        {/* Market Title */}
        {selectedMarket && (
          <div className="px-3 py-2 border-b border-border/30">
            <h1 className="text-sm font-medium text-foreground line-clamp-2">
              {selectedMarket.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                'text-lg font-bold font-mono',
                (livePrice ?? selectedMarket.yesPrice) >= 50 ? 'text-emerald-500' : 'text-red-500'
              )}>
                {livePrice ?? selectedMarket.yesPrice}¢
              </span>
              <span className="text-xs text-muted-foreground">YES</span>
            </div>
          </div>
        )}

        {/* Mobile Tabs */}
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-2 grid grid-cols-3 bg-muted/40">
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="trade">Trade</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="flex-1 m-0 p-3">
            {selectedMarket && (
              <KalshiCandlestickChart
                ticker={selectedMarket.ticker}
                title={selectedMarket.title}
                onPriceUpdate={handlePriceUpdate}
              />
            )}
          </TabsContent>
          
          <TabsContent value="data" className="flex-1 m-0 p-3 space-y-3">
            {selectedMarket && (
              <>
                <KalshiAIAgents market={selectedMarket} compact />
                <KalshiOrderbook ticker={selectedMarket.ticker} compact />
                <KalshiTradeFeed ticker={selectedMarket.ticker} maxTrades={5} />
              </>
            )}
          </TabsContent>
          
          <TabsContent value="trade" className="flex-1 m-0 p-3">
            {selectedMarket && (
              <KalshiTradingPanel market={selectedMarket} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background flex">
      {/* Market Sidebar */}
      <AnimatePresence mode="wait">
        {!sidebarCollapsed ? (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <KalshiMarketSidebar
              selectedTicker={selectedMarket?.ticker}
              onSelectMarket={setSelectedMarket}
              onToggleCollapse={() => setSidebarCollapsed(true)}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 48, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <KalshiMarketSidebar
              selectedTicker={selectedMarket?.ticker}
              onSelectMarket={setSelectedMarket}
              collapsed
              onToggleCollapse={() => setSidebarCollapsed(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/30 backdrop-blur-sm">
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
              <img src={kalshiLogo} alt="Kalshi" className="w-6 h-6 rounded" />
              <span className="text-xs text-muted-foreground">×</span>
              <img src={solanaLogo} alt="Solana" className="w-5 h-5" />
              <span className="font-semibold text-foreground">Terminal</span>
            </div>
            
            <Link to="/kalshi" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Back to Markets
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedMarket && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/30 border border-border/30">
                <span className="text-sm text-muted-foreground line-clamp-1 max-w-[300px]">
                  {selectedMarket.title}
                </span>
                <span className={cn(
                  'text-lg font-bold font-mono',
                  (livePrice ?? selectedMarket.yesPrice) >= 50 ? 'text-emerald-500' : 'text-red-500'
                )}>
                  {livePrice ?? selectedMarket.yesPrice}¢
                </span>
              </div>
            )}
            
            <WalletMultiButton className="!h-9 !text-sm !rounded-xl" />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chart Area */}
          <div className="flex-1 flex flex-col min-w-0 p-4">
            {selectedMarket ? (
              <>
                <KalshiCandlestickChart
                  ticker={selectedMarket.ticker}
                  title={selectedMarket.title}
                  onPriceUpdate={handlePriceUpdate}
                />
                
                {/* Bottom section: Orderbook + Trades */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <KalshiOrderbook ticker={selectedMarket.ticker} compact />
                  <KalshiTradeFeed ticker={selectedMarket.ticker} maxTrades={8} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a market from the sidebar</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Fixed width with shrink */}
          {selectedMarket && (
            <div className="w-72 min-w-0 shrink-0 border-l border-border/30 bg-card/20 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  <KalshiAIAgents market={selectedMarket} compact />
                  <KalshiTradingPanel market={selectedMarket} />
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
