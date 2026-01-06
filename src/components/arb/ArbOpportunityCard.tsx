import { motion } from 'framer-motion';
import { ArrowRight, Clock, TrendingUp, Bell, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArbOpportunity } from '@/hooks/useArbOpportunities';
import kalshiLogo from '@/assets/kalshi-logo.png';
import polyLogo from '@/assets/poly-logo-new.png';

interface ArbOpportunityCardProps {
  opportunity: ArbOpportunity;
  onSetAlert?: () => void;
}

export function ArbOpportunityCard({ opportunity, onSetAlert }: ArbOpportunityCardProps) {
  const {
    eventTitle,
    category,
    spreadPercent,
    buyPlatform,
    sellPlatform,
    buyPrice,
    sellPrice,
    estimatedProfit,
    expiresAt,
    matchScore,
    matchReason,
  } = opportunity;

  const getSpreadColor = (spread: number) => {
    if (spread >= 5) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (spread >= 3) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  };

  const getPlatformLogo = (platform: string) => {
    return platform === 'kalshi' ? kalshiLogo : polyLogo;
  };

  const getPlatformUrl = (platform: string, ticker: string) => {
    if (platform === 'kalshi') {
      return `https://kalshi.com/markets/${ticker}`;
    }
    return `https://polymarket.com/event/${ticker}`;
  };

  const timeRemaining = expiresAt
    ? formatTimeRemaining(new Date(expiresAt).getTime() - Date.now())
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-card/50 border-white/10 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs uppercase">
                  {category}
                </Badge>
                {matchScore && (
                  <Badge variant="secondary" className="text-xs">
                    {matchScore}% match
                  </Badge>
                )}
                {timeRemaining && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {timeRemaining}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-sm text-foreground truncate">
                {eventTitle}
              </h3>
              {matchReason && (
                <p className="text-xs text-muted-foreground mt-0.5">{matchReason}</p>
              )}
            </div>
            <Badge className={cn('text-sm font-bold', getSpreadColor(spreadPercent))}>
              <TrendingUp className="w-3 h-3 mr-1" />
              {spreadPercent.toFixed(1)}%
            </Badge>
          </div>

          {/* Trade Flow */}
          <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
            {/* Buy Side */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={getPlatformLogo(buyPlatform)}
                  alt={buyPlatform}
                  className="w-5 h-5 rounded"
                />
                <span className="text-xs uppercase text-emerald-400 font-semibold">
                  BUY
                </span>
              </div>
              <div className="text-lg font-bold text-emerald-400">
                {buyPrice}¢
              </div>
              <a
                href={getPlatformUrl(buyPlatform, opportunity.buyTicker)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
              >
                {buyPlatform === 'kalshi' ? 'Kalshi' : 'Polymarket'}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>

            {/* Sell Side */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={getPlatformLogo(sellPlatform)}
                  alt={sellPlatform}
                  className="w-5 h-5 rounded"
                />
                <span className="text-xs uppercase text-red-400 font-semibold">
                  SELL
                </span>
              </div>
              <div className="text-lg font-bold text-red-400">
                {sellPrice}¢
              </div>
              <a
                href={getPlatformUrl(sellPlatform, opportunity.sellTicker)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
              >
                {sellPlatform === 'kalshi' ? 'Kalshi' : 'Polymarket'}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="text-xs text-muted-foreground">
              Est. profit after fees:{' '}
              <span className={cn(
                'font-semibold',
                estimatedProfit > 0 ? 'text-emerald-400' : 'text-muted-foreground'
              )}>
                {estimatedProfit > 0 ? `+${estimatedProfit.toFixed(1)}%` : 'Break even'}
              </span>
            </div>
            {onSetAlert && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSetAlert}
                className="h-7 text-xs"
              >
                <Bell className="w-3 h-3 mr-1" />
                Alert
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}
