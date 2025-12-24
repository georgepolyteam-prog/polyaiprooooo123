import { Clock, X } from "lucide-react";

interface SlowResponseBannerProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export const SlowResponseBanner = ({
  isVisible,
  onDismiss,
}: SlowResponseBannerProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-40 px-4 py-2 animate-in slide-in-from-top duration-300">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-lg border border-primary/30 bg-primary/10 backdrop-blur-sm px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary animate-pulse" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Taking a bit longer than usual
              </p>
              <p className="text-xs text-muted-foreground">
                We're experiencing high demand. Your response is on its way!
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-md hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
