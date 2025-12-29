import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, ExternalLink, AlertCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLY_TOKEN = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";
const SOL_TOKEN = "So11111111111111111111111111111111111111112";
const JUPITER_TERMINAL_URL = `https://jup.ag/swap/${SOL_TOKEN}-${POLY_TOKEN}`;

interface JupiterTerminalProps {
  onClose: () => void;
}

export function JupiterTerminal({ onClose }: JupiterTerminalProps) {
  const { publicKey, connected } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Reset loading state when component mounts
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenJupiter = () => {
    window.open(JUPITER_TERMINAL_URL, "_blank");
  };

  if (!connected || !publicKey) {
    return (
      <div className="p-6 pt-4">
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-1">Connect Wallet First</h4>
            <p className="text-sm text-muted-foreground">
              Connect your Solana wallet to swap for POLY tokens
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl"
            >
              Go Back
            </Button>
            <Button
              onClick={() => openWalletModal(true)}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pt-4 space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
        <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground mb-1">Swap SOL for POLY</p>
          <p className="text-muted-foreground text-xs">
            Click below to open Jupiter Exchange. After swapping, return here and deposit your POLY for credits.
          </p>
        </div>
      </div>

      {/* Connected Wallet Display */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Connected</p>
            <p className="text-sm font-mono">
              {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
            </p>
          </div>
        </div>
        <div className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
          Ready
        </div>
      </div>

      {/* Jupiter Link */}
      <div className="relative">
        {/* Preview/placeholder */}
        <div className={cn(
          "relative rounded-xl overflow-hidden border border-border/30",
          "bg-gradient-to-br from-muted/50 to-muted/20",
          "h-[200px] flex flex-col items-center justify-center"
        )}>
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparing swap interface...</p>
            </div>
          ) : (
            <div className="text-center px-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <img 
                  src="https://jup.ag/svg/jupiter-logo.svg" 
                  alt="Jupiter" 
                  className="w-10 h-10"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div>
                <p className="font-medium mb-1">Jupiter Exchange</p>
                <p className="text-xs text-muted-foreground">
                  Best rates across Solana DEXs
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl"
        >
          Cancel
        </Button>
        <Button
          onClick={handleOpenJupiter}
          className={cn(
            "flex-1 h-12 rounded-xl gap-2",
            "bg-gradient-to-r from-emerald-500 to-teal-600",
            "hover:from-emerald-600 hover:to-teal-700",
            "text-white shadow-lg shadow-emerald-500/20"
          )}
        >
          Open Jupiter
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground/60">
        Swap will open in a new tab. Return here to deposit after swapping.
      </p>
    </div>
  );
}
