import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  Flame, 
  Globe, 
  Vote, 
  Coins, 
  Trophy, 
  BarChart2,
  Sparkles 
} from 'lucide-react';

interface KalshiTabNavProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  className?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'All': <TrendingUp className="w-4 h-4" />,
  'Trending': <Flame className="w-4 h-4" />,
  'Politics': <Vote className="w-4 h-4" />,
  'Crypto': <Coins className="w-4 h-4" />,
  'Sports': <Trophy className="w-4 h-4" />,
  'Economics': <BarChart2 className="w-4 h-4" />,
  'Tech': <Sparkles className="w-4 h-4" />,
  'World': <Globe className="w-4 h-4" />,
};

export function KalshiTabNav({ categories, selectedCategory, onSelectCategory, className }: KalshiTabNavProps) {
  const allCategories = ['All', ...categories.slice(0, 7)];
  
  return (
    <div className={cn("relative", className)}>
      {/* Fade edges for scroll indication */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none opacity-0 sm:opacity-0" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none opacity-0 sm:opacity-0" />
      
      {/* Tab container */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
        {allCategories.map((cat, index) => {
          const isSelected = cat === 'All' ? selectedCategory === null : selectedCategory === cat;
          const icon = CATEGORY_ICONS[cat] || <TrendingUp className="w-4 h-4" />;
          
          return (
            <motion.button
              key={cat}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelectCategory(cat === 'All' ? null : cat)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-200 shrink-0",
                "text-sm font-medium",
                isSelected 
                  ? "text-foreground" 
                  : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              {/* Background for selected state */}
              {isSelected && (
                <motion.div
                  layoutId="kalshi-tab-bg"
                  className="absolute inset-0 bg-muted/80 rounded-xl border border-border/50"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              
              {/* Icon and text */}
              <span className={cn(
                "relative z-10 transition-colors",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                {icon}
              </span>
              <span className="relative z-10">{cat}</span>
              
              {/* Underline indicator */}
              {isSelected && (
                <motion.div
                  layoutId="kalshi-tab-underline"
                  className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50 rounded-full"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
