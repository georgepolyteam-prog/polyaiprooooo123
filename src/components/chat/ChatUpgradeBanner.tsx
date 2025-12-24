import { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "poly_chat_upgrade_banner_dismissed_v1";

function getInitialDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function ChatUpgradeBanner() {
  const initial = useMemo(() => getInitialDismissed(), []);
  const [dismissed, setDismissed] = useState<boolean>(initial);

  if (dismissed) return null;

  return (
    <div className="sticky top-16 z-30 px-4 pt-3">
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-pink-500/10" />
          <div className="relative flex items-start justify-between gap-3 p-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white/90 font-medium leading-snug">
                  We’re upgrading the analysis experience.
                </p>
                <p className="text-xs text-gray-400 leading-snug">
                  Chat may be a bit unstable for a short time. <span className="text-purple-300">Updates on X @trypolyai</span>.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl hover:bg-white/10"
              onClick={() => {
                try {
                  localStorage.setItem(STORAGE_KEY, "1");
                } catch {
                  // ignore
                }
                setDismissed(true);
              }}
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4 text-gray-300" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
