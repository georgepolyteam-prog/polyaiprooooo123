import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export function PandoraLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero skeleton */}
      <div className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <Skeleton className="h-8 w-32 mx-auto mb-6 rounded-full" />
          <Skeleton className="h-16 w-80 mx-auto mb-4" />
          <Skeleton className="h-6 w-64 mx-auto mb-8" />
          
          {/* Category pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          
          {/* Search */}
          <Skeleton className="h-14 w-full max-w-xl mx-auto rounded-2xl" />
        </div>
      </div>
      
      {/* Featured skeleton */}
      <div className="max-w-6xl mx-auto px-4 mb-16">
        <Skeleton className="h-[400px] w-full rounded-3xl" />
      </div>
      
      {/* Trending skeleton */}
      <div className="max-w-6xl mx-auto px-4 mb-16">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="flex-shrink-0 h-48 w-[300px] rounded-2xl" />
          ))}
        </div>
      </div>
      
      {/* Grid skeleton */}
      <div className="max-w-6xl mx-auto px-4 mb-16">
        <Skeleton className="h-8 w-36 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <Skeleton className="h-64 w-full rounded-2xl" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PandoraError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="text-6xl mb-6">😵</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          We couldn't load the markets. This might be a temporary issue with the Pandora API.
        </p>
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </motion.div>
    </div>
  );
}
