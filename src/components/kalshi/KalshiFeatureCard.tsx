import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface KalshiFeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  index?: number;
}

export function KalshiFeatureCard({ icon, title, description, index = 0 }: KalshiFeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1, duration: 0.4 }}
      className={cn(
        'p-6 rounded-3xl',
        'bg-card/30 backdrop-blur-xl',
        'border border-border/30',
        'hover:border-primary/30 transition-all duration-300',
        'hover:shadow-[0_8px_40px_hsl(var(--primary)/0.1)]'
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
