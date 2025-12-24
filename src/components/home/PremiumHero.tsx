import { CheckCircle } from "lucide-react";
import polyLogo from "@/assets/poly-logo-new.png";

interface PremiumHeroProps {
  isAuthenticated: boolean;
}

export const PremiumHero = ({ isAuthenticated }: PremiumHeroProps) => {
  return (
    <div className="relative text-center pt-6 pb-8 sm:pt-8 sm:pb-10">
      {/* Official Builder Badge */}
      <div className="flex items-center justify-center mb-8 animate-fade-in px-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20 backdrop-blur-sm">
          <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-xs font-medium text-primary/90 tracking-wide uppercase">Official Polymarket Builder</span>
        </div>
      </div>

      {/* Logo - Clean & Professional */}
      <div className="relative flex justify-center items-center mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
        {/* Subtle ambient glow */}
        <div className="absolute w-24 h-24 rounded-full bg-primary/10 blur-2xl" />
        
        {/* Logo container */}
        <div className="relative">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/90 p-0.5 shadow-xl shadow-primary/20">
            <div className="w-full h-full rounded-[14px] bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <img src={polyLogo} alt="Poly" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
            </div>
          </div>
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
