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
        <Link to="/about" className="text-sm text-primary hover:underline flex items-center gap-0.5 transition-colors">
          Learn more <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Logo - Clean & Simple like chat */}
      <div className="relative flex justify-center items-center mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <img 
          src={polyLogo} 
          alt="Poly" 
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-contain" 
        />
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
