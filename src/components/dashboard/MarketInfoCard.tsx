import { GlassCard } from './GlassCard';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, ExternalLink, Tag } from 'lucide-react';

interface MarketInfoCardProps {
  description?: string | null;
  resolutionSource?: string | null;
  tags?: string[];
  endDate?: string | null;
  createdDate?: string;
}

export function MarketInfoCard({ 
  description, 
  resolutionSource, 
  tags = [], 
  endDate,
  createdDate 
}: MarketInfoCardProps) {
  // Calculate days until resolution
  const getDaysUntil = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const end = new Date(dateStr);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntil = getDaysUntil(endDate);
  const hasContent = description || resolutionSource || tags.length > 0 || endDate;

  if (!hasContent) {
    return null;
  }

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Market Info</h3>
      </div>

      <div className="space-y-3">
        {/* Description */}
        {description && (
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {/* Resolution info */}
        <div className="flex flex-wrap gap-4 text-sm">
          {/* End date */}
          {endDate && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Resolves: </span>
                <span className="text-foreground font-medium">{endDate}</span>
                {daysUntil !== null && daysUntil > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({daysUntil} day{daysUntil !== 1 ? 's' : ''})
                  </span>
                )}
                {daysUntil !== null && daysUntil <= 0 && (
                  <span className="text-warning ml-1">(Ending soon)</span>
                )}
              </div>
            </div>
          )}

          {/* Resolution source */}
          {resolutionSource && (
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Source: </span>
                <span className="text-foreground">{resolutionSource}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-muted-foreground" />
            {tags.map((tag, idx) => (
              <Badge 
                key={idx} 
                variant="secondary" 
                className="text-xs bg-primary/10 text-primary border-primary/20"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
