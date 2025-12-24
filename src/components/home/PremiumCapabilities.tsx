import { Sparkles, Search, LineChart, Activity } from "lucide-react";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import polymarketLogo from "@/assets/polymarket-logo.png";
import domeLogo from "@/assets/dome-logo.png";

const capabilities = [
  { 
    icon: <Sparkles className="w-4 h-4" />, 
    title: "Market Analysis",
    text: "Paste any market URL for instant breakdown"
  },
  { 
    icon: <Search className="w-4 h-4" />, 
    title: "Deep Research",
    hasPolyfactual: true
  },
  { 
    icon: <LineChart className="w-4 h-4" />, 
    title: "Smart Money",
    text: "Track whale activity and flows"
  },
  { 
    icon: <Activity className="w-4 h-4" />, 
    title: "Live Data",
    hasDataPartners: true
  },
];

export const PremiumCapabilities = () => {
  return (
    <div className="mb-8 sm:mb-10 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {capabilities.map((cap, i) => (
          <div 
            key={i} 
            className="bg-card border border-border rounded-xl p-4 text-center"
          >
            <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {cap.icon}
            </div>
            <h3 className="font-semibold text-sm text-foreground mb-1">
              {cap.title}
            </h3>
            {cap.hasPolyfactual ? (
              <div className="flex items-center justify-center gap-1.5">
                <img src={polyfactualLogo} alt="Polyfactual" className="h-3.5 object-contain" />
              </div>
            ) : cap.hasDataPartners ? (
              <div className="flex items-center justify-center gap-2">
                <img src={polymarketLogo} alt="Polymarket" className="h-3.5 object-contain" />
                <span className="text-muted-foreground/40">+</span>
                <div className="flex items-center gap-1">
                  <img src={domeLogo} alt="Dome" className="h-4 object-contain" />
                  <span className="text-xs font-semibold text-[#7C3AED]">Dome</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{cap.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
