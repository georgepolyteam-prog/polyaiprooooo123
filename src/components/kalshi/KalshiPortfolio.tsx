import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, DollarSign, ChevronDown, Bug, Clock, RefreshCw, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface Position {
  marketTicker: string;
  marketTitle: string;
  side: 'yes' | 'no';
  quantity: number;
  avgPrice: number;
  currentPrice: number; // in cents (0-100)
  pnl: number;
  pnlPercent: number;
  // For selling
  sideMint?: string;
  decimals?: number;
  rawAmount?: string;
}

interface DebugInfo {
  tokenkegCount: number;
  token2022Count: number;
  eligibleCount: number;
  excludedHits: string[];
  sampleMints: { mint: string; amount: string }[];
  outcomeMints: string[];
  error?: string;
}

interface RecentOrder {
  signature: string;
  ticker: string;
  side: 'YES' | 'NO';
  amountUSDC: number;
  estimatedShares: string;
  timestamp: number;
  status?: 'pending' | 'open' | 'closed' | 'failed' | 'expired' | 'unknown';
}

interface KalshiPortfolioProps {
  positions: Position[];
  isLoading?: boolean;
  debugInfo?: DebugInfo | null;
  recentOrders?: RecentOrder[];
  onSendDebugReport?: () => void;
  onClearCompletedOrders?: () => void;
  onRefreshPositions?: () => void;
  onSellPosition?: (position: Position) => void;
}

export function KalshiPortfolio({ 
  positions, 
  isLoading,
  debugInfo,
  recentOrders = [],
  onSendDebugReport,
  onClearCompletedOrders,
  onRefreshPositions,
  onSellPosition,
}: KalshiPortfolioProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  
  // Value = quantity * currentPrice / 100 (prices are in cents, we want dollars)
  const totalValue = positions.reduce((sum, p) => sum + (p.quantity * p.currentPrice / 100), 0);
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const isProfitable = totalPnl >= 0;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'closed': return 'text-emerald-400';
      case 'failed': case 'expired': return 'text-red-400';
      case 'open': case 'pending': return 'text-amber-400';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'closed': return 'Filled';
      case 'failed': return 'Failed';
      case 'expired': return 'Expired';
      case 'open': return 'Open';
      case 'pending': return 'Pending';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recent Orders Section - Always show if there are any */}
      {recentOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Orders ({recentOrders.length})
            </h3>
            <div className="flex items-center gap-2">
              {onClearCompletedOrders && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearCompletedOrders}
                  className="h-7 text-xs"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear Completed
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            {recentOrders.slice(0, 5).map((order) => (
              <div
                key={order.signature}
                className="p-3 rounded-xl bg-card/50 border border-border/50 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      order.side === 'YES' 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-red-500/20 text-red-400"
                    )}>
                      {order.side}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {order.ticker}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${order.amountUSDC.toFixed(2)} → ~{order.estimatedShares} shares
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs font-medium", getStatusColor(order.status))}>
                    {getStatusText(order.status)}
                  </span>
                  <a
                    href={`https://solscan.io/tx/${order.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty State with Explanation */}
      {positions.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No positions found</h3>
          
          {debugInfo && (
            <div className="text-sm text-muted-foreground max-w-md space-y-1 mb-4">
              {debugInfo.tokenkegCount + debugInfo.token2022Count === 0 ? (
                <p>No token accounts found in your wallet.</p>
              ) : debugInfo.eligibleCount === 0 ? (
                <p>
                  Found {debugInfo.tokenkegCount + debugInfo.token2022Count} token accounts, 
                  but none are prediction market tokens (after excluding USDC/SOL/USDT).
                </p>
              ) : debugInfo.outcomeMints.length === 0 ? (
                <p>
                  Found {debugInfo.eligibleCount} non-zero tokens, but none matched 
                  prediction market outcome mints.
                </p>
              ) : (
                <p>Matched {debugInfo.outcomeMints.length} outcome mints but no positions built.</p>
              )}
            </div>
          )}
          
          {debugInfo?.error && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-4">
              <AlertCircle className="w-4 h-4" />
              <span>{debugInfo.error}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {onRefreshPositions && (
              <Button variant="outline" size="sm" onClick={onRefreshPositions}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>
          
          <p className="text-muted-foreground text-sm mt-4">
            Trade prediction markets to see your positions here.
          </p>
        </motion.div>
      )}

      {/* Portfolio Summary - Only show if positions exist */}
      {positions.length > 0 && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="p-6 rounded-3xl bg-card/50 backdrop-blur-xl border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Total Value</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                ${totalValue.toFixed(2)}
              </p>
            </div>
            
            <div className={cn(
              "p-6 rounded-3xl backdrop-blur-xl border",
              isProfitable 
                ? "bg-emerald-500/10 border-emerald-500/30" 
                : "bg-red-500/10 border-red-500/30"
            )}>
              <div className="flex items-center gap-2 mb-2">
                {isProfitable ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  isProfitable ? "text-emerald-400" : "text-red-400"
                )}>
                  Total P&L
                </span>
              </div>
              <p className={cn(
                "text-3xl font-bold",
                isProfitable ? "text-emerald-400" : "text-red-400"
              )}>
                {isProfitable ? '+' : ''}{totalPnl.toFixed(2)}
              </p>
            </div>
          </motion.div>

          {/* Positions List */}
          <div className="space-y-3">
            {positions.map((position) => {
              const isProfit = position.pnl >= 0;
              const positionValue = position.quantity * position.currentPrice / 100;
              const formattedQuantity = position.quantity < 1 
                ? position.quantity.toFixed(4) 
                : position.quantity < 100 
                  ? position.quantity.toFixed(2) 
                  : Math.round(position.quantity);
              
              return (
                <div
                  key={`${position.marketTicker}-${position.side}`}
                  className="p-5 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground line-clamp-1">
                        {position.marketTitle}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          position.side === 'yes' 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-red-500/20 text-red-400"
                        )}>
                          {position.side.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formattedQuantity} shares @ {position.currentPrice}¢
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-semibold text-foreground">
                        ${positionValue.toFixed(2)}
                      </p>
                      <p className={cn(
                        "text-sm font-medium",
                        isProfit ? "text-emerald-400" : "text-red-400"
                      )}>
                        {position.pnl !== 0 
                          ? `${isProfit ? '+' : ''}$${position.pnl.toFixed(2)} (${position.pnlPercent.toFixed(1)}%)`
                          : '—'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Price bar + Sell button */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          position.side === 'yes' ? "bg-emerald-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(position.currentPrice, 100)}%` }}
                      />
                    </div>
                    
                    {onSellPosition && position.sideMint && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSellPosition(position)}
                        className="h-7 px-3 text-xs rounded-lg border-border/50 hover:border-red-500/50 hover:text-red-400"
                      >
                        Sell
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Debug Panel - Collapsible */}
      {debugInfo && (
        <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Bug className="w-4 h-4" />
                Debug Details
              </span>
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                debugOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3 text-sm"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">Tokenkeg Accounts</p>
                  <p className="font-mono text-foreground">{debugInfo.tokenkegCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Token-2022 Accounts</p>
                  <p className="font-mono text-foreground">{debugInfo.token2022Count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Eligible (non-zero)</p>
                  <p className="font-mono text-foreground">{debugInfo.eligibleCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Outcome Mints Found</p>
                  <p className="font-mono text-foreground">{debugInfo.outcomeMints.length}</p>
                </div>
              </div>
              
              {debugInfo.excludedHits.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Excluded Mints Hit</p>
                  <p className="font-mono text-xs text-foreground">
                    {debugInfo.excludedHits.join(', ')}
                  </p>
                </div>
              )}
              
              {debugInfo.sampleMints.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Sample Token Mints</p>
                  <div className="space-y-1">
                    {debugInfo.sampleMints.map((m, i) => (
                      <p key={i} className="font-mono text-xs text-foreground">
                        {m.mint} = {m.amount}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              
              {debugInfo.error && (
                <div className="text-destructive">
                  <p className="font-medium">Error</p>
                  <p className="text-xs">{debugInfo.error}</p>
                </div>
              )}
              
              {onSendDebugReport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSendDebugReport}
                  className="w-full mt-2"
                >
                  <Bug className="w-4 h-4 mr-2" />
                  Send Debug Report
                </Button>
              )}
            </motion.div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
