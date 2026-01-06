import { Bell, Trash2, X, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PriceAlert } from '@/hooks/useAlerts';

interface AlertCenterProps {
  activeAlerts: PriceAlert[];
  triggeredAlerts: PriceAlert[];
  onDeleteAlert: (alertId: string) => void;
  onDismissAlert: (alertId: string) => void;
}

export function AlertCenter({
  activeAlerts,
  triggeredAlerts,
  onDeleteAlert,
  onDismissAlert,
}: AlertCenterProps) {
  const totalCount = activeAlerts.length + triggeredAlerts.length;
  const triggeredCount = triggeredAlerts.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="w-4 h-4" />
          {triggeredCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {triggeredCount}
            </span>
          )}
          {triggeredCount === 0 && totalCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Tabs defaultValue="active" className="w-full">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold">Price Alerts</span>
            <TabsList className="h-7">
              <TabsTrigger value="active" className="text-xs h-6 px-2">
                Active ({activeAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="triggered" className="text-xs h-6 px-2">
                Triggered ({triggeredAlerts.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active" className="m-0">
            <ScrollArea className="max-h-[300px]">
              {activeAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Bell className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No active alerts</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Right-click on the chart to set price alerts
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {activeAlerts.map((alert) => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      onDelete={() => onDeleteAlert(alert.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="triggered" className="m-0">
            <ScrollArea className="max-h-[300px]">
              {triggeredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Bell className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No triggered alerts</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {triggeredAlerts.map((alert) => (
                    <TriggeredAlertItem
                      key={alert.id}
                      alert={alert}
                      onDismiss={() => onDismissAlert(alert.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function AlertItem({
  alert,
  onDelete,
}: {
  alert: PriceAlert;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        alert.direction === 'above' ? "bg-emerald-500/10" : "bg-red-500/10"
      )}>
        {alert.direction === 'above' ? (
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{alert.marketTitle}</p>
        <p className="text-xs text-muted-foreground">
          {alert.direction === 'above' ? 'Above' : 'Below'} {alert.targetPrice}¢
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onDelete}
      >
        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}

function TriggeredAlertItem({
  alert,
  onDismiss,
}: {
  alert: PriceAlert;
  onDismiss: () => void;
}) {
  const triggeredAt = alert.triggeredAt ? new Date(alert.triggeredAt) : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-emerald-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{alert.marketTitle}</p>
        <p className="text-xs text-emerald-600">
          Hit {alert.triggeredPrice ? `${Math.round(alert.triggeredPrice)}¢` : `${alert.targetPrice}¢`}
          {triggeredAt && ` • ${triggeredAt.toLocaleTimeString()}`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onDismiss}
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}
