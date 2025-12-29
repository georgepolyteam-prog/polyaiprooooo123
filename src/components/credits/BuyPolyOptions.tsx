import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Zap, TrendingUp, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JupiterTerminal } from "./JupiterTerminal";
import { cn } from "@/lib/utils";

const POLY_TOKEN = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";

const buyOptions = [
  {
    id: "jupiter",
    name: "Jupiter",
    description: "Swap instantly",
    subtitle: "Best rates, direct swap",
    icon: Zap,
    color: "from-emerald-500 to-teal-600",
    hoverGlow: "group-hover:shadow-emerald-500/40",
    action: "swap" as const,
    logo: "https://jup.ag/svg/jupiter-logo.svg"
  },
  {
    id: "pumpfun",
    name: "Pump.fun",
    description: "Trade on Pump",
    subtitle: "Community favorite",
    icon: TrendingUp,
    color: "from-purple-500 to-pink-600",
    hoverGlow: "group-hover:shadow-purple-500/40",
    action: "link" as const,
    url: `https://pump.fun/coin/${POLY_TOKEN}`,
    logo: "https://pump.fun/icon.png"
  },
  {
    id: "okx",
    name: "OKX Wallet",
    description: "Buy via wallet",
    subtitle: "50M+ users",
    icon: Wallet,
    color: "from-blue-500 to-indigo-600",
    hoverGlow: "group-hover:shadow-blue-500/40",
    action: "link" as const,
    url: `https://www.okx.com/web3/dex-swap#inputChain=501&inputCurrency=So11111111111111111111111111111111111111112&outputChain=501&outputCurrency=${POLY_TOKEN}`,
    logo: null
  }
];

export function BuyPolyOptions() {
  const [showJupiter, setShowJupiter] = useState(false);

  const handleOptionClick = (option: typeof buyOptions[0]) => {
    if (option.action === "swap") {
      setShowJupiter(true);
    } else if (option.action === "link" && option.url) {
      window.open(option.url, "_blank");
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold tracking-tight mb-1">Get POLY Tokens</h3>
          <p className="text-sm text-muted-foreground">Choose your preferred method</p>
        </div>

        {/* Three Option Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {buyOptions.map((option, i) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleOptionClick(option)}
              className="group relative"
            >
              {/* Glow effect */}
              <div className={cn(
                "absolute inset-0 rounded-2xl bg-gradient-to-r opacity-0 blur-xl transition-opacity duration-500",
                option.color,
                option.hoverGlow
              )} />

              {/* Card */}
              <div className={cn(
                "relative p-5 rounded-2xl overflow-hidden transition-all duration-300",
                "bg-card/60 backdrop-blur-xl border border-border/30",
                "hover:border-border/60 hover:shadow-xl"
              )}>
                {/* Logo */}
                <div className="flex justify-center mb-4">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center",
                    "bg-gradient-to-br",
                    option.color
                  )}>
                    {option.logo ? (
                      <img
                        src={option.logo}
                        alt={option.name}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const sibling = e.currentTarget.nextElementSibling;
                          if (sibling) sibling.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <option.icon className={cn("w-7 h-7 text-white", option.logo && "hidden")} />
                  </div>
                </div>

                {/* Content */}
                <div className="text-center">
                  <h4 className="font-bold text-lg mb-0.5 group-hover:text-foreground transition-colors">
                    {option.name}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-1">
                    {option.description}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    {option.subtitle}
                  </p>
                </div>

                {/* Action indicator */}
                <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground/70">
                  <span className="group-hover:text-foreground transition-colors">
                    {option.action === "swap" ? "Open Terminal" : "Visit Site"}
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Info text */}
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          After purchasing POLY, return here to deposit it for credits
        </p>
      </div>

      {/* Jupiter Terminal Modal */}
      <Dialog open={showJupiter} onOpenChange={setShowJupiter}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-border/50">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              Swap for POLY
            </DialogTitle>
          </DialogHeader>
          <JupiterTerminal onClose={() => setShowJupiter(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
