import { Link } from "react-router-dom";
import { Mail, Wallet, ArrowRight, Coins, Zap, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuthGateInlineProps {
  variant?: 'compact' | 'full';
}

export const AuthGateInline = ({ variant = 'full' }: AuthGateInlineProps) => {
  // Compact variant for mobile - just a button
  if (variant === 'compact') {
    return (
      <Link 
        to="/auth?step=email"
        className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors"
      >
        <Mail className="w-4 h-4" />
        <span>Sign in with Email</span>
        <ArrowRight className="w-4 h-4 ml-1" />
      </Link>
    );
  }

  // Full variant - sleek centered design
  return (
    <div className="flex items-center justify-center px-4 py-6">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Main Card */}
        <div className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-card/80 backdrop-blur-2xl",
          "border border-border/50",
          "shadow-2xl shadow-primary/5"
        )}>
          {/* Animated gradient orb */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative p-5 sm:p-6">
            {/* Header - Compact */}
            <div className="text-center mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20"
              >
                <Sparkles className="w-5 h-5 text-primary" />
              </motion.div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Sign in to chat
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Email required for AI analysis
              </p>
            </div>

            {/* Email Sign In Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link 
                to="/auth?step=email"
                className={cn(
                  "flex items-center justify-center gap-2 w-full h-11 px-4 rounded-xl",
                  "bg-gradient-to-r from-primary to-primary/80",
                  "hover:from-primary/90 hover:to-primary/70",
                  "text-primary-foreground font-medium text-sm",
                  "shadow-lg shadow-primary/25",
                  "transition-all duration-200"
                )}
              >
                <Mail className="w-4 h-4" />
                <span>Continue with Email</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* How it works - Horizontal on desktop, stacked on mobile */}
            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Mail, label: "Email", desc: "Chat & Credits", color: "text-primary", bg: "bg-primary/10" },
                  { icon: Coins, label: "Phantom", desc: "Deposit POLY", color: "text-purple-400", bg: "bg-purple-500/10" },
                  { icon: Wallet, label: "Polygon", desc: "Trade", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="text-center p-2 rounded-xl bg-muted/30 border border-border/20"
                  >
                    <div className={cn("w-7 h-7 mx-auto mb-1.5 rounded-lg flex items-center justify-center", item.bg)}>
                      <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                    </div>
                    <p className="text-[10px] sm:text-xs font-medium text-foreground">{item.label}</p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Subtle footer */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <Zap className="w-3 h-3 text-primary/60" />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Powered by <span className="font-medium text-primary/80">$POLY</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
