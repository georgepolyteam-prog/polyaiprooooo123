import { cn } from '@/lib/utils';

export function KalshiLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-3xl p-6',
            'bg-card/80 border border-border/30'
          )}
        >
          {/* Category skeleton */}
          <div className="h-6 w-20 rounded-full bg-muted/50 animate-pulse mb-4" />
          
          {/* Question skeleton */}
          <div className="space-y-2 mb-6">
            <div className="h-5 w-full rounded-lg bg-muted/50 animate-pulse" />
            <div className="h-5 w-3/4 rounded-lg bg-muted/50 animate-pulse" />
          </div>
          
          {/* Price grid skeleton */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="h-24 rounded-2xl bg-muted/30 animate-pulse" />
            <div className="h-24 rounded-2xl bg-muted/30 animate-pulse" />
          </div>
          
          {/* Stats skeleton */}
          <div className="flex justify-between">
            <div className="h-4 w-20 rounded bg-muted/50 animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted/50 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
