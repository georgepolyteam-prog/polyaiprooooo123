import { motion } from "framer-motion";
import { ExternalLink, TrendingUp, Wallet, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import okxLogo from "@/assets/okx-logo.png";
import binanceLogo from "@/assets/binance-logo.png";

const POLY_TOKEN = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";

const buyOptions = [
  {
    id: "binance",
    name: "Binance",
    description: "Buy via Binance Web3",
    subtitle: "World's largest exchange",
    icon: Building2,
    color: "from-[#F0B90B] to-[#C99400]",
    hoverGlow: "group-hover:shadow-[#F0B90B]/40",
    action: "link" as const,
    url: `https://web3.binance.com/sv/token/sol/${POLY_TOKEN}`,
    logo: binanceLogo
  },
  {
    id: "pumpfun",
    name: "Pump.fun",
    description: "Trade on Pump",
    subtitle: "Community favorite",
    icon: TrendingUp,
    color: "from-slate-700 to-slate-900",
    hoverGlow: "group-hover:shadow-slate-500/40",
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
    color: "from-zinc-800 to-black",
    hoverGlow: "group-hover:shadow-zinc-500/40",
    action: "link" as const,
    url: `https://www.okx.com/web3/dex-swap#inputChain=501&inputCurrency=So11111111111111111111111111111111111111112&outputChain=501&outputCurrency=${POLY_TOKEN}`,
    logo: okxLogo
  }
];

export function BuyPolyOptions() {
  const handleOptionClick = (option: typeof buyOptions[0]) => {
    if (option.url) {
      window.open(option.url, "_blank");
    }
  };

  return (
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
              "relative p-4 sm:p-5 rounded-2xl overflow-hidden transition-all duration-300",
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
                      className={cn(
                        "object-contain",
                        option.id === "okx" ? "w-10 h-10 rounded-lg" : 
                        option.id === "binance" ? "w-9 h-9" : "w-8 h-8"
                      )}
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
                  Visit Site
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
  );
}
