import { ExternalLink, TrendingUp, ShieldCheck, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Market {
  id: number;
  market_slug: string;
  question: string;
  yes_price: number;
  volume: number;
  hot?: boolean;
  // Irys blockchain verification fields
  isBlockchainVerified?: boolean;
  txId?: string;
  proofUrl?: string;
  resolvedOutcome?: string | null;
  category?: string;
}

interface MarketSelectorProps {
  eventTitle: string;
  eventUrl?: string;
  markets: Market[];
  onSelect: (marketId: number) => void;
  // Irys-specific props
  isBlockchainVerified?: boolean;
  source?: 'irys' | 'gamma' | string;
  totalCount?: number;
  sampleTxId?: string;
}

const formatVolume = (vol: number): string => {
  if (vol >= 1000000) {
    return `${(vol / 1000000).toFixed(1)}M`.replace('.0M', 'M');
  } else if (vol >= 1000) {
    return `${(vol / 1000).toFixed(1)}K`.replace('.0K', 'K');
  }
  return vol.toString();
};

export function MarketSelector({ 
  eventTitle, 
  eventUrl,
  markets, 
  onSelect,
  isBlockchainVerified = false,
  source,
  totalCount,
  sampleTxId
}: MarketSelectorProps) {
  const sortedMarkets = [...markets]
    .sort((a, b) => b.volume - a.volume)
    .map((m, idx) => ({
      ...m,
      hot: m.volume >= 100000 || idx < 3
    }));

  const isIrys = source === 'irys' || isBlockchainVerified;

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className={cn(
        "p-4 rounded-2xl border shadow-soft",
        isIrys 
          ? "bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30" 
          : "bg-card border-border"
      )}>
        {/* Blockchain Badge for Irys */}
        {isIrys && (
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium border border-blue-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Blockchain Verified
            </span>
            <span className="text-xs text-muted-foreground">
              Permanently stored on Irys
            </span>
          </div>
        )}
        
        <p className="text-sm text-muted-foreground mb-1">
          {isIrys ? 'Historical resolved markets' : 'Multiple markets found'}
        </p>
        <h3 className="font-semibold text-foreground">
          {eventTitle}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {totalCount || markets.length} markets available. Select one to {isIrys ? 'view details' : 'analyze'}:
        </p>
      </div>
      
      {/* Market Cards */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sortedMarkets.map((market) => {
          const hasOutcome = market.resolvedOutcome !== null && market.resolvedOutcome !== undefined;
          const isYesWinner = market.resolvedOutcome?.toLowerCase() === 'yes';
          const isNoWinner = market.resolvedOutcome?.toLowerCase() === 'no';
          
          return (
            <button
              key={market.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(market.id);
              }}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all group",
                isIrys || market.isBlockchainVerified
                  ? "bg-card border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/5 hover:shadow-lg hover:shadow-blue-500/10"
                  : "bg-card border-border hover:border-secondary hover:bg-secondary/10 hover:shadow-medium"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Badges row */}
                  {(market.isBlockchainVerified || market.category) && (
                    <div className="flex items-center gap-2 mb-1.5">
                      {market.isBlockchainVerified && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      )}
                      {market.category && (
                        <span className="text-[10px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded-full">
                          {market.category}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <p className={cn(
                    "text-sm font-medium transition-colors",
                    isIrys || market.isBlockchainVerified
                      ? "text-foreground group-hover:text-blue-400"
                      : "text-foreground group-hover:text-secondary"
                  )}>
                    {market.question}
                  </p>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    {/* Resolved Outcome for Irys markets */}
                    {hasOutcome && (
                      <span className={cn(
                        "font-semibold flex items-center gap-1",
                        isYesWinner ? "text-success" : isNoWinner ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {isYesWinner ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : isNoWinner ? (
                          <XCircle className="w-3 h-3" />
                        ) : null}
                        {market.resolvedOutcome}
                      </span>
                    )}
                    
                    {/* Price (only show if no resolved outcome) */}
                    {!hasOutcome && (
                      <span className="font-semibold text-success">
                        {(market.yes_price * 100).toFixed(1)}%
                      </span>
                    )}
                    
                    <span className="text-muted-foreground">
                      ${formatVolume(market.volume)}
                    </span>
                  </div>
                  
                  {/* Proof link for Irys markets */}
                  {market.proofUrl && (
                    <a
                      href={market.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Proof
                    </a>
                  )}
                </div>
                
                {/* Hot badge */}
                {market.hot && market.volume >= 100000 && !isIrys && (
                  <span className="px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Hot
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Footer links */}
      {isIrys && sampleTxId && (
        <a 
          href={`https://gateway.irys.xyz/${sampleTxId}`}
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          View Sample Blockchain Proof
        </a>
      )}
      
      {eventUrl && !isIrys && (
        <a 
          href={eventUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground 
                     hover:text-primary transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View on Polymarket
        </a>
      )}
    </div>
  );
}
