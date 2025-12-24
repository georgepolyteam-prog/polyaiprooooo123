import { ExternalLink, MessageSquare, DollarSign, Droplets, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from './GlassCard';
import { AnimatedNumber } from './AnimatedNumber';
import { LiveIndicator } from './LiveIndicator';
import { Link } from 'react-router-dom';

interface MarketHeaderProps {
  title: string;
  yesPrice: number;
  noPrice: number;
  yesVolume: number;
  noVolume: number;
  totalVolume: number;
  liquidity: number;
  endDate?: string;
  marketUrl: string;
  lastUpdate: number;
}

export function MarketHeader({
  title,
  yesPrice,
  noPrice,
  yesVolume,
  noVolume,
  totalVolume,
  liquidity,
  endDate,
  marketUrl,
  lastUpdate,
}: MarketHeaderProps) {
  const formatUsd = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <GlassCard className="p-6 relative overflow-hidden" glow cyber>
      {/* Ambient gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 via-secondary/5 to-transparent rounded-full blur-3xl -z-10" />
      
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold leading-tight mb-3 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text break-words">{title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground">Volume:</span>
              <span className="text-foreground font-medium font-mono">{formatUsd(totalVolume)}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30">
              <Droplets className="w-3.5 h-3.5 text-secondary" />
              <span className="text-muted-foreground">Liquidity:</span>
              <span className="text-foreground font-medium font-mono">{formatUsd(liquidity)}</span>
            </div>
            {endDate && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span className="text-muted-foreground">Ends:</span>
                <span className="text-foreground font-medium">{new Date(endDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
        <LiveIndicator lastUpdate={lastUpdate} />
      </div>

      {/* YES/NO Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="relative text-center p-6 rounded-xl overflow-hidden group">
          {/* Glass background */}
          <div className="absolute inset-0 bg-success/10 border border-success/30 rounded-xl transition-all duration-300 group-hover:bg-success/15 group-hover:border-success/50" />
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-success/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          <div className="relative z-10">
            <div className="text-sm text-muted-foreground mb-2 font-medium flex items-center justify-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success" />
              YES
            </div>
            <div className="text-4xl font-bold text-success mb-1">
              <AnimatedNumber 
                value={yesPrice} 
                format={(n) => `${(n * 100).toFixed(1)}%`}
              />
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              {formatUsd(yesVolume)} volume
            </div>
          </div>
        </div>
        
        <div className="relative text-center p-6 rounded-xl overflow-hidden group">
          {/* Glass background */}
          <div className="absolute inset-0 bg-destructive/10 border border-destructive/30 rounded-xl transition-all duration-300 group-hover:bg-destructive/15 group-hover:border-destructive/50" />
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-destructive/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          <div className="relative z-10">
            <div className="text-sm text-muted-foreground mb-2 font-medium flex items-center justify-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              NO
            </div>
            <div className="text-4xl font-bold text-destructive mb-1">
              <AnimatedNumber 
                value={noPrice} 
                format={(n) => `${(n * 100).toFixed(1)}%`}
              />
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              {formatUsd(noVolume)} volume
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link to={`/?url=${encodeURIComponent(marketUrl)}`} className="flex-1">
          <Button className="w-full gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white border-0 shadow-lg shadow-primary/20">
            <MessageSquare className="w-4 h-4" />
            Analyze with AI
          </Button>
        </Link>
        <a href={marketUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button variant="outline" className="w-full gap-2 border-border/50 hover:bg-muted/30 hover:border-border">
            <ExternalLink className="w-4 h-4" />
            Trade on Polymarket
          </Button>
        </a>
      </div>
    </GlassCard>
  );
}
