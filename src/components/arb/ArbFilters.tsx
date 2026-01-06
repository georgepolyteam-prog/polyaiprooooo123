import { Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ArbFiltersProps {
  category: string;
  onCategoryChange: (category: string) => void;
  minSpread: number;
  onMinSpreadChange: (spread: number) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  lastUpdated?: number | null;
}

const CATEGORIES = [
  { value: 'all', label: 'All Markets' },
  { value: 'politics', label: 'Politics' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'sports', label: 'Sports' },
  { value: 'finance', label: 'Finance' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'general', label: 'Other' },
];

export function ArbFilters({
  category,
  onCategoryChange,
  minSpread,
  onMinSpreadChange,
  onRefresh,
  isLoading,
  lastUpdated,
}: ArbFiltersProps) {
  const formatLastUpdated = () => {
    if (!lastUpdated) return null;
    const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Category Selector */}
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Min Spread Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="w-3.5 h-3.5" />
            Min {minSpread}%
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Minimum Spread</Label>
              <span className="text-sm font-semibold text-primary">
                {minSpread}%
              </span>
            </div>
            <Slider
              value={[minSpread]}
              onValueChange={([value]) => onMinSpreadChange(value)}
              min={0.5}
              max={10}
              step={0.5}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5%</span>
              <span>10%</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Refresh Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
        className="h-9 gap-2"
      >
        <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
        Refresh
      </Button>

      {/* Last Updated */}
      {lastUpdated && (
        <span className="text-xs text-muted-foreground">
          Updated {formatLastUpdated()}
        </span>
      )}
    </div>
  );
}
