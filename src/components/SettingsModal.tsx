import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, RefreshCw } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Settings {
  notifications: boolean;
  autoRefresh: boolean;
}

export const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem("poly-ai-settings");
    return stored ? JSON.parse(stored) : { notifications: true, autoRefresh: true };
  });

  useEffect(() => {
    localStorage.setItem("poly-ai-settings", JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key: keyof Settings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="notifications" className="font-medium">Notifications</Label>
                <p className="text-sm text-muted-foreground">Get alerts for market opportunities</p>
              </div>
            </div>
            <Switch
              id="notifications"
              checked={settings.notifications}
              onCheckedChange={(checked) => updateSetting("notifications", checked)}
            />
          </div>

          {/* Auto Refresh */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="autoRefresh" className="font-medium">Auto Refresh</Label>
                <p className="text-sm text-muted-foreground">Auto-update market data every 30s</p>
              </div>
            </div>
            <Switch
              id="autoRefresh"
              checked={settings.autoRefresh}
              onCheckedChange={(checked) => updateSetting("autoRefresh", checked)}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Poly AI v1.0 Beta • December 2025
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
