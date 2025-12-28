import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ['All', 'Crypto', 'Politics', 'Sports', 'Tech', 'Science', 'Entertainment'];

interface PandoraHeroProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  totalMarkets: number;
  totalVolume: string;
}

export function PandoraHero({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  totalMarkets,
  totalVolume
}: PandoraHeroProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-muted/20 pb-8 pt-20 md:pt-24">
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />
      
      {/* Gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Live badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-sm font-medium text-primary">Live on Sonic</span>
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
        </motion.div>
        
        {/* Main heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-6"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-4">
            Prediction Markets
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Trade on anything. Powered by AI.
          </p>
        </motion.div>
        
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex justify-center gap-8 mb-8"
        >
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{totalMarkets}</div>
            <div className="text-sm text-muted-foreground">Markets</div>
          </div>
          <div className="w-px h-12 bg-border" />
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{totalVolume}</div>
            <div className="text-sm text-muted-foreground">Total Volume</div>
          </div>
        </motion.div>
        
        {/* Category pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                selectedCategory === category
                  ? "bg-foreground text-background shadow-lg"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
              )}
            >
              {category}
            </button>
          ))}
        </motion.div>
        
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="max-w-xl mx-auto"
        >
          <div 
            className={cn(
              "relative rounded-2xl transition-all duration-300",
              isFocused ? "shadow-lg shadow-primary/10" : "shadow-soft"
            )}
          >
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className={cn(
                "w-5 h-5 transition-colors duration-200",
                isFocused ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={cn(
                "w-full pl-12 pr-4 py-4 rounded-2xl text-base",
                "bg-card border transition-all duration-200",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/20",
                isFocused ? "border-primary/50" : "border-border"
              )}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
