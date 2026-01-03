import { motion } from 'framer-motion';
import { Wallet, TrendingUp, BarChart3, Shield, Sparkles } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { cn } from '@/lib/utils';

export function KalshiConnectWallet() {
  const features = [
    { icon: TrendingUp, text: 'View your positions' },
    { icon: BarChart3, text: 'Track profit & loss' },
    { icon: Sparkles, text: 'Sell your shares' },
    { icon: Shield, text: 'Non-custodial trading' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      {/* Glowing wallet icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl animate-pulse" />
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border-2 border-primary/30 flex items-center justify-center">
          <Wallet className="w-10 h-10 text-primary" />
        </div>
      </div>

      {/* Heading */}
      <h3 className="text-2xl font-bold text-foreground mb-3">
        Connect Your Wallet
      </h3>
      <p className="text-muted-foreground text-center max-w-sm mb-8">
        Connect your Solana wallet to view and manage your prediction market positions
      </p>

      {/* Features list */}
      <div className="grid grid-cols-2 gap-4 mb-10 w-full max-w-md">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * i }}
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <feature.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">{feature.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Connect button */}
      <WalletMultiButton className={cn(
        "!h-14 !px-10 !rounded-2xl",
        "!bg-gradient-to-r !from-primary !to-purple-500",
        "hover:!opacity-90 !text-primary-foreground !font-semibold !text-lg",
        "!transition-all !duration-300 !shadow-xl hover:!shadow-2xl hover:!shadow-primary/30",
        "!border-0"
      )} />

      {/* Security note */}
      <p className="mt-6 text-xs text-muted-foreground text-center flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5" />
        Your keys, your funds. We never store your private keys.
      </p>
    </motion.div>
  );
}
