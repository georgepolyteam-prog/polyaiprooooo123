import { usePolyPrice } from '@/hooks/usePolyPrice';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, Droplets } from 'lucide-react';

const formatNumber = (num: number, decimals = 2): string => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(decimals)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(decimals)}K`;
  }
  return `$${num.toFixed(decimals)}`;
};

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

export const PolyPriceTicker = () => {
  const { data, isLoading, error } = usePolyPrice();

  if (error) {
    return null; // Silently fail if API is unavailable
  }

  const isPositive = data?.priceChange24h ? data.priceChange24h > 0 : false;

  return (
    <div className="w-full border-y border-white/10 bg-black/20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
          {/* Price */}
          <div className="flex flex-col items-center min-w-[120px]">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-1">
              <DollarSign className="w-3 h-3" />
              $POLY Price
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-blue-400">
              {isLoading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                formatPrice(data?.price || 0)
              )}
            </div>
          </div>

          {/* 24h Change */}
          <div className="flex flex-col items-center min-w-[120px]">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-1">
              <Activity className="w-3 h-3" />
              24h Change
            </div>
            <div className={`flex items-center gap-1 text-xl md:text-2xl font-bold font-mono ${
              isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {isLoading ? (
                <span className="animate-pulse text-gray-400">--</span>
              ) : (
                <>
                  {isPositive ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                  {isPositive ? '+' : ''}{data?.priceChange24h?.toFixed(2) || 0}%
                </>
              )}
            </div>
          </div>

          {/* Market Cap */}
          <div className="flex flex-col items-center min-w-[120px]">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-1">
              <BarChart3 className="w-3 h-3" />
              Market Cap
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-blue-400">
              {isLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                formatNumber(data?.marketCap || 0)
              )}
            </div>
          </div>

          {/* 24h Volume */}
          <div className="flex flex-col items-center min-w-[120px]">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wider mb-1">
              <Droplets className="w-3 h-3" />
              24h Volume
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-blue-400">
              {isLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                formatNumber(data?.volume24h || 0)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
