import { Link } from "react-router-dom";
import { HelpCircle, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import polyLogo from "@/assets/poly-logo-new.png";

interface PremiumHeroProps {
  isAuthenticated: boolean;
}

export const PremiumHero = ({ isAuthenticated }: PremiumHeroProps) => {
  return (
    <div className="relative text-center py-8 sm:py-12">
      {/* Official Builder Badge - Top */}
      <div className="flex items-center justify-center mb-6 animate-fade-in px-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 max-w-full">
          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-xs font-semibold text-primary truncate">Official Polymarket Builder</span>
        </div>
      </div>

      {/* Logo with Reactor Effect */}
      <div className="relative flex justify-center items-center mb-6 animate-fade-in">
        {/* Outer rotating ring */}
        <div 
          className="absolute w-28 h-28 rounded-full border border-dashed border-primary/20"
          style={{ animation: 'spin 20s linear infinite' }}
        />
        
        {/* Pulsing rings */}
        <div 
          className="absolute w-24 h-24 rounded-full bg-primary/5"
          style={{ animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite' }}
        />
        <div 
          className="absolute w-20 h-20 rounded-full bg-primary/10"
          style={{ animation: 'ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite', animationDelay: '0.5s' }}
        />
        
        {/* Core ambient glow */}
        <div className="absolute w-20 h-20 rounded-full bg-primary/20 blur-xl animate-pulse" />
        
        {/* Logo container */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
          <img src={polyLogo} alt="Poly" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
        </div>
      </div>

      {/* Title - Clean typography */}
      <div className="animate-fade-in px-4" style={{ animationDelay: '100ms' }}>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 text-foreground tracking-tight">
          Meet <span className="text-primary">Poly</span>
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-md mx-auto mb-4 break-words">
          AI-powered market intelligence for Polymarket
        </p>
        
        {/* What can I do & Learn More links - temporarily hidden */}
        {/* <div className="flex items-center justify-center gap-2">
          <Link to="/about">
            <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border">
              Learn More
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
          <Link to="/capabilities">
            <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border">
              <HelpCircle className="w-3.5 h-3.5" />
              What can I do?
            </Button>
          </Link>
        </div> */}
      </div>
    </div>
  );
};
