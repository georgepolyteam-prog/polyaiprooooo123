import { Sparkles, Search, LineChart, Activity } from "lucide-react";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import polymarketLogo from "@/assets/polymarket-logo.png";

const capabilities = [
  { 
    icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />, 
    title: "Market Analysis",
    text: "Analyze any market URL - paste it and I'll break it down",
    color: "from-primary to-secondary"
  },
  { 
    icon: <Search className="w-4 h-4 sm:w-5 sm:h-5" />, 
    title: "Deep Research",
    text: "AI-powered news & event research",
    hasPolyfactual: true,
    color: "from-accent to-primary"
  },
  { 
    icon: <LineChart className="w-4 h-4 sm:w-5 sm:h-5" />, 
    title: "Smart Money",
    text: "Track whale activity and smart money movements",
    color: "from-secondary to-accent"
  },
  { 
    icon: <Activity className="w-4 h-4 sm:w-5 sm:h-5" />, 
    title: "Live Data",
    text: "",
    hasDataPartners: true,
    color: "from-primary to-accent"
  },
];

export const PremiumCapabilities = () => {
  return (
    <div className="mb-10 sm:mb-12 animate-fade-in" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="h-px flex-1 max-w-16 sm:max-w-20 bg-gradient-to-r from-transparent to-border" />
        <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">What I can do</p>
        <div className="h-px flex-1 max-w-16 sm:max-w-20 bg-gradient-to-l from-transparent to-border" />
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
        {capabilities.map((cap, i) => (
          <div 
            key={i} 
            className="group relative p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card-hover cursor-default active:scale-[0.98] transition-transform"
          >
            {/* Gradient border effect on hover */}
            <div className={`absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br ${cap.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            
            <div className="relative flex flex-col items-center text-center gap-2 sm:gap-3">
              <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br ${cap.color} text-primary-foreground shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                {cap.icon}
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                  {cap.title}
                </h3>
                {cap.hasPolyfactual ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <img src={polyfactualLogo} alt="Polyfactual" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
                    <span className="text-xs text-muted-foreground">Polyfactual</span>
                  </div>
                ) : cap.hasDataPartners ? (
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1">
                      <img src={polymarketLogo} alt="Polymarket" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
                      <span className="text-xs text-muted-foreground">Polymarket</span>
                    </div>
                    <span className="text-muted-foreground/50">•</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-secondary">Dome</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground line-clamp-2">{cap.text}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
