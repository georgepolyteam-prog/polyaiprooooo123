import { usePolyPrice } from '@/hooks/usePolyPrice';
import { TrendingUp, TrendingDown } from 'lucide-react';

const formatPrice = (price: number): string => {
  if (price < 0.0001) {
    return `$${price.toFixed(8)}`;
  } else if (price < 0.01) {
    return `$${price.toFixed(6)}`;
  } else if (price < 1) {
    return `$${price.toFixed(4)}`;
  }
  return `$${price.toFixed(2)}`;
};

export const PolyPriceCompact = () => {
  const { data, isLoading, error } = usePolyPrice();

  if (error || isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 text-xs">
        <span className="text-muted-foreground">$POLY</span>
        <span className="text-muted-foreground animate-pulse">--</span>
      </div>
    );
  }

  const isPositive = data?.priceChange24h ? data.priceChange24h > 0 : false;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 text-xs">
      <span className="text-muted-foreground font-medium">$POLY</span>
      <span className="font-mono font-semibold text-foreground">
        {formatPrice(data?.price || 0)}
      </span>
      <span className={`flex items-center gap-0.5 font-medium ${
        isPositive ? 'text-emerald-400' : 'text-red-400'
      }`}>
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        {Math.abs(data?.priceChange24h || 0).toFixed(1)}%
      </span>
    </div>
  );
};
