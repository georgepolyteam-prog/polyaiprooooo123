import { Sparkles, Search, LineChart, Activity } from "lucide-react";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import polymarketLogo from "@/assets/polymarket-logo.png";
import domeLogo from "@/assets/dome-logo.png";

export const PremiumCapabilities = () => {
  return (
    <div className="mb-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Market Analysis */}
        <div className="bg-card/50 border border-border/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <h3 className="font-medium text-xs text-foreground">Market Analysis</h3>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Paste any URL for instant AI breakdown
          </p>
        </div>

        {/* Deep Research - NEW */}
        <div className="bg-card/50 border border-purple-500/30 rounded-lg p-3 relative overflow-hidden">
          {/* Subtle glow effect */}
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-purple-500/20 rounded-full blur-xl" />
          
          <div className="flex items-center gap-2 mb-1.5 relative">
            <Search className="w-3.5 h-3.5 text-purple-500" />
            <h3 className="font-medium text-xs text-foreground">Deep Research</h3>
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full animate-pulse">
              New
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-2 relative">
            AI research with cited sources
          </p>
          <div className="flex items-center gap-1.5 relative">
            <img src={polyfactualLogo} alt="Polyfactual" className="h-3.5 object-contain opacity-70" />
          </div>
        </div>

        {/* Smart Money */}
        <div className="bg-card/50 border border-border/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <LineChart className="w-3.5 h-3.5 text-emerald-500" />
            <h3 className="font-medium text-xs text-foreground">Smart Money</h3>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Track whale activity and flows
          </p>
        </div>

        {/* Live Data */}
        <div className="bg-card/50 border border-border/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-3.5 h-3.5 text-orange-500" />
            <h3 className="font-medium text-xs text-foreground">Live Data</h3>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
            Real-time market data & analytics
          </p>
          <div className="flex items-center gap-2">
            <img src={polymarketLogo} alt="Polymarket" className="h-3.5 object-contain opacity-70" />
            <span className="text-muted-foreground/40 text-[10px]">+</span>
            <img src={domeLogo} alt="Dome" className="h-3.5 object-contain opacity-70" />
          </div>
        </div>
      </div>
    </div>
  );
};
