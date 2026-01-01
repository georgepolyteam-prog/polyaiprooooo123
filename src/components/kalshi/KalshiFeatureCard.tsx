import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface KalshiFeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  index?: number;
}

function KalshiFeatureCardComponent({ icon, title, description }: KalshiFeatureCardProps) {
  return (
    <div
      className={cn(
        'p-6 rounded-3xl',
        'bg-card/80 border border-border/30',
        'hover:border-primary/30 transition-colors duration-200',
        'hover:shadow-lg'
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
    </div>
  );
}

export const KalshiFeatureCard = memo(KalshiFeatureCardComponent);
