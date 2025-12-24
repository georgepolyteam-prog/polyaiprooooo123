import { Sparkles, BarChart3, Search, DollarSign, LineChart, Activity, ExternalLink, Zap } from "lucide-react";

const capabilities = [
  { 
    icon: <Sparkles className="w-5 h-5" />, 
    title: "Market Analysis",
    text: "Analyze any market URL - paste it and I'll break it down",
    color: "from-primary to-secondary"
  },
  { 
    icon: <BarChart3 className="w-5 h-5" />, 
    title: "News Research",
    text: "Research recent news and events affecting markets",
    color: "from-secondary to-accent"
  },
  { 
    icon: <Search className="w-5 h-5" />, 
    title: "Smart Money Tracking",
    text: "Track trade activity, historical pricing and smart money movements",
    color: "from-accent to-primary"
  },
  { 
    icon: <DollarSign className="w-5 h-5" />, 
    title: "Value Discovery",
    text: "Compare odds across markets and identify value bets",
    color: "from-primary to-accent"
  },
  { 
    icon: <LineChart className="w-5 h-5" />, 
    title: "Live Orderflow",
    text: "Live orderflow, trades, and market sentiment",
    color: "from-secondary to-primary"
  },
  { 
    icon: <Activity className="w-5 h-5" />, 
    title: "Real-Time Data",
    text: "Powered by Polymarket & Dome",
    hasLinks: true,
    color: "from-accent to-secondary"
  },
];

export const PremiumCapabilities = () => {
  return (
    <div className="mb-16 animate-fade-in hidden md:block" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="h-px flex-1 max-w-20 bg-gradient-to-r from-transparent to-border" />
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">What I can do</p>
        <div className="h-px flex-1 max-w-20 bg-gradient-to-l from-transparent to-border" />
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {capabilities.map((cap, i) => (
          <div 
            key={i} 
            className="group relative p-5 rounded-2xl glass-card-hover cursor-default"
          >
            {/* Gradient border effect on hover */}
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${cap.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            
            <div className="relative flex items-start gap-4">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${cap.color} text-primary-foreground shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                {cap.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {cap.title}
                </h3>
                {cap.hasLinks ? (
                  <span className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                    Powered by{" "}
                    <a 
                      href="https://polymarket.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-0.5 font-medium"
                    >
                      Polymarket
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {" & "}
                    <a 
                      href="https://domeapi.io" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group/dome inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-secondary/20 to-accent/20 border border-secondary/30 text-secondary font-medium transition-all duration-300 hover:from-secondary/30 hover:to-accent/30 hover:border-secondary/50 hover:shadow-glow-cyan"
                    >
                      <Zap className="w-3 h-3" />
                      Dome
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 -ml-0.5 group-hover/dome:opacity-100 group-hover/dome:ml-0 transition-all duration-200" />
                    </a>
                  </span>
                ) : (
                  <p className="text-sm text-muted-foreground">{cap.text}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
