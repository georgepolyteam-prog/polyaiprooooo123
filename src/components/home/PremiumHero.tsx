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
      <div className="flex flex-wrap items-center justify-center gap-3 mb-8 animate-fade-in">
        {/* Backed by Polymarket Badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 backdrop-blur-sm">
          <img src={polymarketLogo} alt="Polymarket" className="w-5 h-5 object-contain" />
          <span className="text-xs font-semibold text-primary">Backed by Polymarket</span>
          <Shield className="w-3.5 h-3.5 text-primary" />
        </div>

        {/* Polyfactual Deep Research Badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-accent/10 to-secondary/10 border border-accent/20 backdrop-blur-sm">
          <img src={polyfactualLogo} alt="Polyfactual" className="w-5 h-5 object-contain" />
          <span className="text-xs font-semibold text-accent">Deep Research</span>
          <Sparkles className="w-3.5 h-3.5 text-accent" />
        </div>
      </div>

      {/* Logo with Premium Effects */}
      <div className="flex justify-center mb-10 animate-fade-in">
        <div className="relative">
          {/* Outer glow rings */}
          <div className="absolute inset-[-20px] rounded-full bg-gradient-to-r from-primary/30 via-secondary/20 to-accent/30 blur-2xl animate-pulse" />
          <div className="absolute inset-[-40px] rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-[-60px] rounded-full border border-secondary/10 animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
          
          {/* Holographic shine effect */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" style={{ animationDuration: '3s' }} />
          </div>
          
          {/* Main logo */}
          <div className="relative w-28 h-28 bg-gradient-to-br from-primary via-secondary to-accent rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 ring-4 ring-primary/20 ring-offset-4 ring-offset-background">
            <img src={polyLogo} alt="Poly" className="w-20 h-20 object-contain drop-shadow-2xl" />
          </div>
          
          {/* Live indicator */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-success rounded-full border-4 border-background flex items-center justify-center shadow-lg shadow-success/50">
            <Activity className="w-4 h-4 text-success-foreground animate-pulse" />
          </div>
        </div>
      </div>

      {/* Title with Gradient */}
      <div className="text-center mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 tracking-tight">
          <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
            Meet{" "}
          </span>
          <span className="gradient-text-animated">Poly</span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Your AI-powered analyst for{" "}
          <span className="text-primary font-semibold">Polymarket</span>
        </p>
      </div>

      {/* Stats Ticker */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-10 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <StatBadge icon={<TrendingUp className="w-4 h-4" />} value="$7.2B+" label="Volume Analyzed" />
        <StatBadge icon={<Zap className="w-4 h-4" />} value="Real-time" label="Data Sync" />
        <StatBadge icon={<Sparkles className="w-4 h-4" />} value="AI-Powered" label="Analysis" />
      </div>
    </div>
  );
};

const StatBadge = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
    <div className="text-primary">{icon}</div>
    <div className="text-left">
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);
