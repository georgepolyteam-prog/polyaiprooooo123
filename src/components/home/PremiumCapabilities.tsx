import { Sparkles, Search, LineChart, Activity } from "lucide-react";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import polymarketLogo from "@/assets/polymarket-logo.png";
import domeLogo from "@/assets/dome-logo.png";

export const PremiumCapabilities = () => {
  return (
    <div className="mb-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Market Analysis */}
        <div className="bg-card/50 border border-blue-500/30 rounded-lg p-2.5 sm:p-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-blue-500/20 rounded-full blur-xl" />
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 relative">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" />
            <h3 className="font-medium text-[10px] sm:text-xs text-foreground">Market Analysis</h3>
          </div>
          <p className="text-[9px] sm:text-[11px] text-muted-foreground leading-relaxed relative">
            Paste any URL for instant AI breakdown
          </p>
        </div>

        {/* Deep Research - NEW */}
        <div className="bg-card/50 border border-purple-500/30 rounded-lg p-2.5 sm:p-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-purple-500/20 rounded-full blur-xl" />
          
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 relative flex-wrap">
            <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500" />
            <h3 className="font-medium text-[10px] sm:text-xs text-foreground">Deep Research</h3>
            <span className="px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full animate-pulse">
              New
            </span>
          </div>
          <p className="text-[9px] sm:text-[11px] text-muted-foreground leading-relaxed mb-1.5 relative">
            AI research with cited sources
          </p>
          <div className="flex items-center gap-1.5 relative">
            <img src={polyfactualLogo} alt="Polyfactual" className="h-3 sm:h-3.5 object-contain" />
            <span className="text-[9px] sm:text-[10px] font-medium text-purple-400">Polyfactual</span>
          </div>
        </div>

        {/* Smart Money */}
        <div className="bg-card/50 border border-emerald-500/30 rounded-lg p-2.5 sm:p-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-500/20 rounded-full blur-xl" />
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 relative">
            <LineChart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
            <h3 className="font-medium text-[10px] sm:text-xs text-foreground">Smart Money</h3>
          </div>
          <p className="text-[9px] sm:text-[11px] text-muted-foreground leading-relaxed relative">
            Track whale activity and flows
          </p>
        </div>

        {/* Live Data */}
        <div className="bg-card/50 border border-orange-500/30 rounded-lg p-2.5 sm:p-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-orange-500/20 rounded-full blur-xl" />
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 relative">
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-500" />
            <h3 className="font-medium text-[10px] sm:text-xs text-foreground">Live Data</h3>
          </div>
          <p className="text-[9px] sm:text-[11px] text-muted-foreground leading-relaxed mb-1.5 relative">
            Real-time market data & analytics
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2 relative flex-wrap">
            <div className="flex items-center gap-1">
              <img src={polymarketLogo} alt="Polymarket" className="h-3 sm:h-3.5 object-contain" />
              <span className="text-[9px] sm:text-[10px] font-medium text-orange-400 hidden sm:inline">Polymarket</span>
            </div>
            <span className="text-muted-foreground/40 text-[8px] sm:text-[10px]">+</span>
            <div className="flex items-center gap-1">
              <img src={domeLogo} alt="Dome" className="h-3 sm:h-3.5 object-contain" />
              <span className="text-[9px] sm:text-[10px] font-medium text-orange-400 hidden sm:inline">Dome</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
