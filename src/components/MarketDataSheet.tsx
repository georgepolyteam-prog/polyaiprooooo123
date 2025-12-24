import { useState } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { MarketDataPanel } from "./MarketDataPanel";
import { cn } from "@/lib/utils";

interface MarketDataSheetProps {
  data: {
    market: {
      question: string;
      odds: number;
      volume: number;
      liquidity: number;
      url: string;
      tokenId?: string;
      noTokenId?: string;
      conditionId?: string;
    };
    whales: Array<{
      id: string;
      wallet: string;
      side: string;
      amount: number;
      price: number;
      timeAgo: string;
    }>;
    orderbook: {
      bids: Array<{ price: number; size: number }>;
      asks: Array<{ price: number; size: number }>;
      spread: number;
      bidTotal: number;
      askTotal: number;
    };
    priceHistory: Array<{ date: string; price: number }>;
    recentTrades: Array<{
      id: string;
      side: string;
      size: number;
      price: number;
      timeAgo: string;
    }>;
    tradeStats: {
      buyPressure: number;
      sellPressure: number;
      netFlow: number;
    };
    arbitrage: {
      isMultiMarket: boolean;
      marketCount: number;
      totalProbability: number;
      hasArbitrage: boolean;
    };
  };
  onClose: () => void;
}

const formatVolume = (vol: number) => {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
};

export function MarketDataSheet({ data, onClose }: MarketDataSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if we have valid data (not stale/loading)
  const isValidData = data?.market?.question && data.priceHistory?.length > 0;

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      {/* Bottom Sheet */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl z-50 transition-all duration-300 ease-out border-t pb-safe",
          isExpanded ? "max-h-[calc(100vh-60px)]" : "h-auto"
        )}
        style={{ height: isExpanded ? 'calc(100vh - 60px)' : 'auto' }}
      >
        {/* Handle - tap to expand/collapse */}
        <div 
          className="p-4 border-b cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-3">
              <h3 className="font-bold text-sm leading-tight line-clamp-1">{data.market.question}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-primary">{data.market.odds.toFixed(1)}%</span>
                <span className="text-xs text-muted-foreground">{formatVolume(data.market.volume)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted rounded-lg transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content - only visible when expanded */}
        {isExpanded && (
          <div className="overflow-hidden h-[calc(100vh-60px-88px)]">
            <MarketDataPanel data={data} onClose={() => setIsExpanded(false)} />
          </div>
        )}
      </div>
    </>
  );
}
