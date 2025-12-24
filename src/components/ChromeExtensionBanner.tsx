import { Zap, ChevronRight, X } from "lucide-react";
import { useState } from "react";

export const ChromeExtensionBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <section
      aria-label="Chrome extension"
      className="relative z-10 border-b border-border bg-gradient-to-r from-primary/10 via-background to-background"
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.18),transparent_55%)]" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                Get V3RA on any Polymarket page
              </p>
              <p className="text-xs text-muted-foreground">
                One-click analysis, right where you trade.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <a
              href="/extension"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:translate-y-[-1px]"
            >
              Add to Chrome
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </a>

            <button
              onClick={() => setDismissed(true)}
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

