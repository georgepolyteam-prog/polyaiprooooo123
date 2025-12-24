import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MaintenanceBannerProps {
  isVisible: boolean;
  message?: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const MaintenanceBanner = ({
  isVisible,
  message,
  onDismiss,
  onRetry,
}: MaintenanceBannerProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-40 px-4 py-2 animate-in slide-in-from-top duration-300">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-lg border border-warning/40 bg-warning/10 backdrop-blur-sm px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="shrink-0 w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-warning" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Temporary Service Issue
              </p>
              <p className="text-xs text-muted-foreground">
                {message || "We're experiencing high demand. Your request may take longer than usual."}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {onRetry && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRetry}
                  className="h-7 px-2 text-xs text-warning hover:text-warning hover:bg-warning/10"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              )}
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-md hover:bg-warning/10 transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
