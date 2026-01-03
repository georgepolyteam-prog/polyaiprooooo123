import { cn } from '@/lib/utils';
import { Search, RefreshCw } from 'lucide-react';

export function KalshiLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-2xl p-5',
            'bg-card/80 border border-border/50',
            'relative overflow-hidden'
          )}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          
          {/* Live indicator skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-muted/50 animate-pulse" />
              <div className="h-4 w-12 rounded bg-muted/50 animate-pulse" />
            </div>
            <div className="h-8 w-8 rounded-lg bg-muted/50 animate-pulse" />
          </div>
          
          {/* Title skeleton */}
          <div className="space-y-2 mb-4">
            <div className="h-5 w-full rounded-lg bg-muted/50 animate-pulse" />
            <div className="h-5 w-3/4 rounded-lg bg-muted/50 animate-pulse" />
          </div>
          
          {/* Price boxes skeleton */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 h-20 rounded-xl bg-muted/30 animate-pulse" />
            <div className="flex-1 h-20 rounded-xl bg-muted/30 animate-pulse" />
          </div>
          
          {/* Stats skeleton */}
          <div className="flex justify-between mb-4">
            <div className="h-4 w-16 rounded bg-muted/50 animate-pulse" />
            <div className="h-4 w-20 rounded bg-muted/50 animate-pulse" />
          </div>
          
          {/* AI Button skeleton */}
          <div className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function KalshiSearchLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search indicator */}
      <div className="flex items-center justify-center gap-3 py-8">
        <div className="relative">
          <Search className="w-6 h-6 text-primary/60 animate-pulse" />
          <div className="absolute inset-0 animate-ping">
            <Search className="w-6 h-6 text-primary/30" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-medium text-foreground">Searching markets...</span>
          <span className="text-sm text-muted-foreground">Scanning 5,000+ prediction markets</span>
        </div>
      </div>
      
      {/* Skeleton cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-2xl p-5',
              'bg-card/60 border border-border/30',
              'relative overflow-hidden',
              'opacity-60'
            )}
            style={{ animationDelay: `${i * 150}ms` }}
          >
            {/* Shimmer overlay */}
            <div 
              className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-primary/5 to-transparent" 
              style={{ animationDelay: `${i * 200}ms` }}
            />
            
            {/* Content skeleton */}
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2.5 w-2.5 rounded-full bg-primary/30 animate-pulse" />
              <div className="h-4 w-12 rounded bg-muted/40 animate-pulse" />
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="h-5 w-full rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-5 w-2/3 rounded-lg bg-muted/40 animate-pulse" />
            </div>
            
            <div className="flex gap-2 mb-4">
              <div className="flex-1 h-16 rounded-xl bg-muted/20 animate-pulse" />
              <div className="flex-1 h-16 rounded-xl bg-muted/20 animate-pulse" />
            </div>
            
            <div className="h-10 w-full rounded-xl bg-muted/30 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
