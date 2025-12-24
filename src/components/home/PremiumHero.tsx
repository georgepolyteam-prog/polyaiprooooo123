import polyLogo from "@/assets/poly-logo-new.png";
import polymarketLogo from "@/assets/polymarket-logo.png";

interface PremiumHeroProps {
  isAuthenticated: boolean;
}

export const PremiumHero = ({ isAuthenticated }: PremiumHeroProps) => {
  return (
    <div className="relative text-center py-8 sm:py-12">
      {/* Backed by Polymarket Badge */}
      <div className="flex items-center justify-center gap-2 mb-6 animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
          <img src={polymarketLogo} alt="Polymarket" className="w-4 h-4 object-contain" />
          <span className="text-xs font-medium text-muted-foreground">Backed by Polymarket</span>
        </div>
      </div>

      {/* Logo - Clean and simple */}
      <div className="flex justify-center mb-6 animate-fade-in">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
          <img src={polyLogo} alt="Poly" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
        </div>
      </div>

      {/* Title - Clean typography */}
      <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 text-foreground tracking-tight">
          Meet <span className="text-primary">Poly</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto">
          AI-powered market intelligence for Polymarket
        </p>
      </div>
    </div>
  );
};
