import { Bell, BellOff, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useArbAlerts, ArbAlert } from '@/hooks/useArbAlerts';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ArbAlertsListProps {
  onCreateAlert: () => void;
}

export function ArbAlertsList({ onCreateAlert }: ArbAlertsListProps) {
  const { user } = useAuth();
  const { alerts, isLoading, toggleAlert, deleteAlert } = useArbAlerts();

  if (!user) {
    return (
      <Card className="bg-card/50 border-white/10">
        <CardContent className="py-8 text-center">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Log in to create and manage alerts
          </p>
          <Button variant="outline" size="sm" disabled>
            Login Required
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-white/10">
        <CardContent className="py-8 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-white/10">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Your Alerts
        </CardTitle>
        <Button size="sm" variant="outline" onClick={onCreateAlert} className="h-7 text-xs">
          + New Alert
        </Button>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="py-6 text-center">
            <BellOff className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No alerts yet. Create one to get notified.
            </p>
            <Button variant="outline" size="sm" onClick={onCreateAlert}>
              Create Alert
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onToggle={() => toggleAlert(alert.id)}
                  onDelete={() => deleteAlert(alert.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AlertItemProps {
  alert: ArbAlert;
  onToggle: () => void;
  onDelete: () => void;
}

function AlertItem({ alert, onToggle, onDelete }: AlertItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border',
        alert.isActive
          ? 'bg-primary/5 border-primary/20'
          : 'bg-muted/30 border-white/10 opacity-60'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] uppercase">
            {alert.sport || 'All Sports'}
          </Badge>
          <span className="text-xs font-semibold text-primary">
            ≥ {alert.minSpreadPercent}%
          </span>
        </div>
        {alert.lastTriggeredAt && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last triggered {formatDistanceToNow(new Date(alert.lastTriggeredAt))} ago
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Switch
          checked={alert.isActive}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-primary"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}
