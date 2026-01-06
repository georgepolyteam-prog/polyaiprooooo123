import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, ExternalLink } from "lucide-react";
import solanaLogo from "@/assets/solana-logo.png";

const CONTRACT_ADDRESS = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";
const DEXSCREENER_URL = "https://dexscreener.com/solana/982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";

const buyLinks = [
  { name: "Binance Web3", url: `https://web3.binance.com/sv/token/sol/${CONTRACT_ADDRESS}` },
  { name: "Pump.fun", url: `https://pump.fun/coin/${CONTRACT_ADDRESS}` },
  { name: "OKX Wallet", url: `https://www.okx.com/web3/dex-swap#inputChain=501&inputCurrency=So11111111111111111111111111111111111111112&outputChain=501&outputCurrency=${CONTRACT_ADDRESS}` },
];

export const MinimalTokenSection = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative px-6 md:px-12 lg:px-20 py-24 md:py-32 bg-muted/20">
      <div className="max-w-6xl mx-auto">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 flex items-center gap-3"
        >
          <img src={solanaLogo} alt="Solana" className="w-4 h-4" />
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
            // $POLY on Solana
          </span>
        </motion.div>

        {/* Contract address - front and center */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <button
            onClick={handleCopy}
            className="group flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors w-full sm:w-auto"
          >
            <code className="font-mono text-xs sm:text-sm text-foreground truncate max-w-[200px] sm:max-w-none">
              {CONTRACT_ADDRESS}
            </code>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            )}
          </button>
        </motion.div>

        {/* Buy links - single row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-4 mb-12"
        >
          {buyLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all font-mono text-sm text-foreground"
            >
              {link.name}
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
          ))}
        </motion.div>

        {/* DEXScreener embed */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-border overflow-hidden bg-card"
        >
          <div className="relative w-full pb-[85%] md:pb-[50%]">
            <iframe
              src={`https://dexscreener.com/solana/${CONTRACT_ADDRESS}?embed=1&theme=dark&info=0`}
              className="absolute top-0 left-0 w-full h-full border-0"
              title="DEXScreener Chart"
            />
          </div>
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              via DEXScreener
            </span>
            <a
              href={DEXSCREENER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 transition-colors"
            >
              View full chart
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
