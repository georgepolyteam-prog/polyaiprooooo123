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
  Sparkles,
  Layers
} from 'lucide-react';
import { useRef, useEffect, useState } from 'react';

interface KalshiTabNavProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  className?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'All': <Layers className="w-4 h-4" />,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  
  // Update indicator position when selection changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const selectedIndex = selectedCategory === null ? 0 : allCategories.indexOf(selectedCategory);
    const buttons = container.querySelectorAll('button');
    const selectedButton = buttons[selectedIndex];
    
    if (selectedButton) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left + container.scrollLeft,
        width: buttonRect.width
      });
    }
  }, [selectedCategory, allCategories]);
  
  return (
    <div className={cn("relative", className)}>
      {/* Tab container with scroll */}
      <div 
        ref={containerRef}
        className="relative flex items-center gap-1 overflow-x-auto scrollbar-hide"
      >
        {/* Animated underline indicator */}
        <motion.div
          className="absolute bottom-0 h-0.5 bg-gradient-to-r from-primary via-primary to-primary/70 rounded-full"
          initial={false}
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
        
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
                "relative flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-all duration-200 shrink-0",
                "text-sm font-medium border-b-2 border-transparent",
                isSelected 
                  ? "text-foreground" 
                  : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              {/* Icon with glow on selected */}
              <span className={cn(
                "transition-all duration-200",
                isSelected ? "text-primary drop-shadow-[0_0_6px_rgba(var(--primary),0.5)]" : "text-muted-foreground"
              )}>
                {icon}
              </span>
              
              {/* Text */}
              <span className={cn(
                "transition-all duration-200",
                isSelected && "font-semibold"
              )}>
                {cat}
              </span>
              
              {/* Active dot */}
              {isSelected && (
                <motion.span
                  layoutId="category-dot"
                  className="absolute -top-0.5 right-2 w-1.5 h-1.5 rounded-full bg-primary"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
      
      {/* Fade edges for scroll indication */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none opacity-0 sm:hidden" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none opacity-0 sm:hidden" />
    </div>
  );
}
