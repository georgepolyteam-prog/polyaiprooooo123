import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position {
  marketTicker: string;
  marketTitle: string;
  side: 'yes' | 'no';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface KalshiPortfolioProps {
  positions: Position[];
  isLoading?: boolean;
}

export function KalshiPortfolio({ positions, isLoading }: KalshiPortfolioProps) {
  const totalValue = positions.reduce((sum, p) => sum + (p.quantity * p.currentPrice), 0);
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const isProfitable = totalPnl >= 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Wallet className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No positions yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Start trading prediction markets to see your positions here.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
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
        {positions.map((position, index) => {
          const isProfit = position.pnl >= 0;
          
          return (
            <motion.div
              key={position.marketTicker}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-5 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/50 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground line-clamp-1">
                    {position.marketTitle}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      position.side === 'yes' 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-red-500/20 text-red-400"
                    )}>
                      {position.side.toUpperCase()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {position.quantity} shares @ {position.avgPrice}¢
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    ${(position.quantity * position.currentPrice / 100).toFixed(2)}
                  </p>
                  <p className={cn(
                    "text-sm font-medium",
                    isProfit ? "text-emerald-400" : "text-red-400"
                  )}>
                    {isProfit ? '+' : ''}{position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(1)}%)
                  </p>
                </div>
              </div>
              
              {/* Price bar */}
              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    position.side === 'yes' ? "bg-emerald-500" : "bg-red-500"
                  )}
                  style={{ width: `${position.currentPrice}%` }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
