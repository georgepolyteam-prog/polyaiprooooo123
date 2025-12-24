import { AlertCircle, X, Copy, Check, Coins } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const BetaBanner = () => {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  const tokenCA = "3smq9FnP4XGK87RNBicAof1W91pm8VNKwDYgTJFUpump";

  const copyCA = () => {
    navigator.clipboard.writeText(tokenCA);
    setCopied(true);
    toast.success("Contract address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[45] bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-primary/30 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left side - Main content */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-foreground">🚀 Poly AI Beta</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Bugs?{" "}
                <a href="mailto:bugs@polyai.tech" className="text-primary hover:underline">
                  bugs@polyai.tech
                </a>
              </span>
            </div>
          </div>

          {/* Right side - Token & Close */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Token CA - Desktop only */}
            <div className="hidden lg:flex items-center gap-2 bg-accent/50 border border-primary/20 rounded-lg px-2.5 py-1">
              <Coins className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">$POLY</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                {tokenCA.slice(0, 6)}...
              </code>
              <button onClick={copyCA} className="p-0.5 hover:bg-muted rounded transition-colors">
                {copied ? (
                  <Check className="w-3 h-3 text-primary" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Close button */}
            <button onClick={() => setDismissed(true)} className="p-1 hover:bg-muted rounded transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
