import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import polyLogo from "@/assets/poly-logo-new.png";

interface PremiumHeroProps {
  isAuthenticated: boolean;
}

export const PremiumHero = ({ isAuthenticated }: PremiumHeroProps) => {
  return (
    <div className="relative text-center pt-6 pb-8 sm:pt-8 sm:pb-10">
      {/* Professional Tagline with Learn More Link */}
      <div className="flex items-center justify-center gap-2 mb-8 animate-fade-in px-4">
        <span className="text-sm text-muted-foreground">AI-Powered Market Intelligence</span>
        <Link to="/docs" className="text-sm text-primary hover:underline flex items-center gap-0.5 transition-colors">
          Learn more <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Logo - Clean & Simple like chat */}
      <div className="relative flex justify-center items-center mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black rounded-2xl flex items-center justify-center ring-2 ring-primary/30 shadow-lg shadow-primary/20">
          <img src={polyLogo} alt="Poly" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="animate-fade-in px-4" style={{ animationDelay: '100ms' }}>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-3 text-foreground tracking-tight">
          Meet <span className="text-primary">Poly</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground/80 max-w-sm mx-auto font-light">
          AI-powered market intelligence for Polymarket
        </p>
      </div>
    </div>
  );
};
