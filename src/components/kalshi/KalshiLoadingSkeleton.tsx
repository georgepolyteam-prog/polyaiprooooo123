import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

export function KalshiLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-2xl p-5',
            'bg-card/60 border border-border/40',
            'relative overflow-hidden'
          )}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-muted/10 to-transparent" />
          
          {/* Live indicator skeleton */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-muted/40 animate-pulse" />
              <div className="h-3 w-10 rounded bg-muted/40 animate-pulse" />
            </div>
            <div className="h-7 w-7 rounded-lg bg-muted/40 animate-pulse" />
          </div>
          
          {/* Title skeleton */}
          <div className="space-y-1.5 mb-4">
            <div className="h-4 w-full rounded bg-muted/40 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted/40 animate-pulse" />
          </div>
          
          {/* Price boxes skeleton */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 h-16 rounded-xl bg-muted/30 animate-pulse" />
            <div className="flex-1 h-16 rounded-xl bg-muted/30 animate-pulse" />
          </div>
          
          {/* Stats skeleton */}
          <div className="flex justify-between mb-3">
            <div className="h-3 w-14 rounded bg-muted/40 animate-pulse" />
            <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
          </div>
          
          {/* AI Button skeleton */}
          <div className="h-10 w-full rounded-xl bg-primary/20 animate-pulse" />
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
          <Search className="w-5 h-5 text-primary/60 animate-pulse" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Searching markets...</span>
          <span className="text-xs text-muted-foreground font-mono">Scanning prediction markets</span>
        </div>
      </div>
      
      {/* Skeleton cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-2xl p-5',
              'bg-card/40 border border-border/30',
              'relative overflow-hidden',
              'opacity-60'
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Shimmer overlay */}
            <div 
              className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-primary/5 to-transparent" 
              style={{ animationDelay: `${i * 150}ms` }}
            />
            
            {/* Content skeleton */}
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-primary/30 animate-pulse" />
              <div className="h-3 w-10 rounded bg-muted/30 animate-pulse" />
            </div>
            
            <div className="space-y-1.5 mb-4">
              <div className="h-4 w-full rounded bg-muted/30 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-muted/30 animate-pulse" />
            </div>
            
            <div className="flex gap-2 mb-3">
              <div className="flex-1 h-14 rounded-xl bg-muted/20 animate-pulse" />
              <div className="flex-1 h-14 rounded-xl bg-muted/20 animate-pulse" />
            </div>
            
            <div className="h-9 w-full rounded-xl bg-muted/20 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}