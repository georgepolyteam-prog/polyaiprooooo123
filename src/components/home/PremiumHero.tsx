import { Sparkles, Zap, TrendingUp, Shield, Activity } from "lucide-react";
import polyLogo from "@/assets/poly-logo-new.png";
import polymarketLogo from "@/assets/polymarket-logo.png";
import polyfactualLogo from "@/assets/polyfactual-logo.png";

interface PremiumHeroProps {
  isAuthenticated: boolean;
}

export const PremiumHero = ({ isAuthenticated }: PremiumHeroProps) => {
  return (
    <div className="relative">
      {/* Premium Badge Row */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6 animate-fade-in">
        {/* Backed by Polymarket Badge */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 backdrop-blur-sm">
          <img src={polymarketLogo} alt="Polymarket" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
          <span className="text-[10px] sm:text-xs font-semibold text-primary">Backed by Polymarket</span>
          <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
        </div>

        {/* Polyfactual Deep Research Badge */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-accent/10 to-secondary/10 border border-accent/20 backdrop-blur-sm">
          <img src={polyfactualLogo} alt="Polyfactual" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
          <span className="text-[10px] sm:text-xs font-semibold text-accent">Deep Research</span>
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />
        </div>
      </div>

      {/* Logo with Premium Effects */}
      <div className="flex justify-center mb-4 sm:mb-6 animate-fade-in">
        <div className="relative">
          {/* Outer glow rings - smaller on mobile */}
          <div className="absolute inset-[-12px] sm:inset-[-20px] rounded-full bg-gradient-to-r from-primary/30 via-secondary/20 to-accent/30 blur-xl sm:blur-2xl animate-pulse" />
          <div className="absolute inset-[-24px] sm:inset-[-40px] rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-[-36px] sm:inset-[-60px] rounded-full border border-secondary/10 animate-ping hidden sm:block" style={{ animationDuration: '4s', animationDelay: '1s' }} />
          
          {/* Holographic shine effect */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" style={{ animationDuration: '3s' }} />
          </div>
          
          {/* Main logo - smaller on mobile */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gradient-to-br from-primary via-secondary to-accent rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 ring-2 sm:ring-4 ring-primary/20 ring-offset-2 sm:ring-offset-4 ring-offset-background">
            <img src={polyLogo} alt="Poly" className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain drop-shadow-2xl" />
          </div>
          
          {/* Live indicator */}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 bg-success rounded-full border-2 sm:border-4 border-background flex items-center justify-center shadow-lg shadow-success/50">
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-success-foreground animate-pulse" />
          </div>
        </div>
      </div>

      {/* Title with Gradient */}
      <div className="text-center mb-4 sm:mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-3 sm:mb-4 tracking-tight">
          <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
            Meet{" "}
          </span>
          <span className="gradient-text-animated">Poly</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
          Your AI-powered analyst for{" "}
          <span className="text-primary font-semibold">Polymarket</span>
        </p>
      </div>

      {/* Stats Ticker - horizontal scroll on mobile */}
      <div className="flex items-center justify-start sm:justify-center gap-3 sm:gap-6 mb-6 sm:mb-8 animate-fade-in overflow-x-auto pb-2 px-4 -mx-4 sm:mx-0 sm:px-0 scrollbar-hide" style={{ animationDelay: '200ms' }}>
        <StatBadge icon={<TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} value="$7.2B+" label="Volume" />
        <StatBadge icon={<Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} value="Real-time" label="Data" />
        <StatBadge icon={<Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} value="AI-Powered" label="Analysis" />
      </div>
    </div>
  );
};

const StatBadge = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm flex-shrink-0 active:scale-95 transition-transform">
    <div className="text-primary">{icon}</div>
    <div className="text-left">
      <p className="text-xs sm:text-sm font-bold text-foreground whitespace-nowrap">{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{label}</p>
    </div>
  </div>
);
