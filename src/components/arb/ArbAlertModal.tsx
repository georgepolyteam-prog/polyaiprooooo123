import { useState } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useArbAlerts } from '@/hooks/useArbAlerts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ArbAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SPORTS = [
  { value: 'all', label: 'All Sports' },
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'soccer', label: 'Soccer' },
];

export function ArbAlertModal({ open, onOpenChange }: ArbAlertModalProps) {
  const { user } = useAuth();
  const { createAlert } = useArbAlerts();
  const { toast } = useToast();
  
  const [sport, setSport] = useState<string>('all');
  const [minSpread, setMinSpread] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Please log in to create alerts',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createAlert({
        alertType: sport === 'all' ? 'spread_threshold' : 'sport_filter',
        sport: sport === 'all' ? null : sport,
        minSpreadPercent: minSpread,
        isActive: true,
      });

      toast({
        title: 'Alert created',
        description: `You'll be notified when spreads exceed ${minSpread}%`,
      });
      
      onOpenChange(false);
      setSport('all');
      setMinSpread(3);
    } catch (error) {
      console.error('Failed to create alert:', error);
      toast({
        title: 'Error',
        description: 'Failed to create alert. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Create Arbitrage Alert
          </DialogTitle>
          <DialogDescription>
            Get notified when arbitrage opportunities meet your criteria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sport Filter */}
          <div className="space-y-2">
            <Label>Sport</Label>
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Minimum Spread */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Minimum Spread</Label>
              <span className="text-sm font-semibold text-primary">
                {minSpread}%
              </span>
            </div>
            <Slider
              value={[minSpread]}
              onValueChange={([value]) => setMinSpread(value)}
              min={1}
              max={15}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1%</span>
              <span>15%</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Browser notifications will be sent when opportunities matching your criteria are found. 
              Make sure to allow notifications in your browser.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !user}>
            {isSubmitting ? 'Creating...' : 'Create Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
