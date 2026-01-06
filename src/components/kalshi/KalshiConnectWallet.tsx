import { motion } from 'framer-motion';
import { Wallet, TrendingUp, BarChart3, Shield, Sparkles } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { cn } from '@/lib/utils';

export function KalshiConnectWallet() {
  const features = [
    { icon: TrendingUp, text: 'View positions' },
    { icon: BarChart3, text: 'Track P&L' },
    { icon: Sparkles, text: 'Sell shares' },
    { icon: Shield, text: 'Non-custodial' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-6"
    >
      {/* Wallet icon */}
      <div className="relative mb-6">
        <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Wallet className="w-7 h-7 text-primary" />
        </div>
      </div>

      {/* Heading */}
      <h3 className="text-xl font-bold text-foreground mb-2">
        Connect Wallet
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        Connect your Solana wallet to view and manage your positions
      </p>

      {/* Features list */}
      <div className="grid grid-cols-2 gap-3 mb-8 w-full max-w-sm">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i }}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/40"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <feature.icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground">{feature.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Connect button */}
      <WalletMultiButton className={cn(
        "!h-11 !px-8 !rounded-xl",
        "!bg-primary hover:!bg-primary/90",
        "!text-primary-foreground !font-semibold !text-sm",
        "!transition-all !duration-200 !shadow-lg hover:!shadow-xl hover:!shadow-primary/20",
        "!border !border-primary/50"
      )} />

      {/* Security note */}
      <p className="mt-5 text-[11px] text-muted-foreground text-center flex items-center gap-1.5 font-mono">
        <Shield className="w-3 h-3" />
        Non-custodial · Your keys, your funds
      </p>
    </motion.div>
  );
}