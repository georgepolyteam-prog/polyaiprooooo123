import { Sparkles, Search, LineChart, Activity } from "lucide-react";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import polymarketLogo from "@/assets/polymarket-logo.png";
import domeLogo from "@/assets/dome-logo.png";

export const PremiumCapabilities = () => {
  return (
    <div className="mb-8 sm:mb-10 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Market Analysis */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="w-10 h-10 mb-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-foreground mb-1.5">Market Analysis</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Paste any Polymarket URL for instant AI breakdown of odds, sentiment & edge
          </p>
        </div>

        {/* Deep Research - Featured with Polyfactual */}
        <div className="bg-card border border-border rounded-xl p-5 ring-1 ring-purple-200 dark:ring-purple-800/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Search className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h3 className="font-semibold text-foreground mb-1.5">Deep Research</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            AI-powered research with real-time cited sources for informed decisions
          </p>
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Powered by</span>
            <img src={polyfactualLogo} alt="Polyfactual" className="h-5 object-contain" />
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Polyfactual</span>
          </div>
        </div>

        {/* Smart Money */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="w-10 h-10 mb-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <LineChart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-semibold text-foreground mb-1.5">Smart Money</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Track whale activity, large trades & capital flows across markets
          </p>
        </div>

        {/* Live Data - Partners */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="w-10 h-10 mb-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="font-semibold text-foreground mb-1.5">Live Data</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Real-time market data, order books & analytics from official sources
          </p>
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <img src={polymarketLogo} alt="Polymarket" className="h-5 object-contain" />
              <span className="text-xs font-medium text-muted-foreground">API</span>
            </div>
            <span className="text-muted-foreground/40">+</span>
            <div className="flex items-center gap-1">
              <img src={domeLogo} alt="Dome" className="h-5 object-contain" />
              <span className="text-xs font-semibold text-[#7C3AED]">Dome</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
