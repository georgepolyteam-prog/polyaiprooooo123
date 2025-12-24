import { 
  Search, Brain, LineChart, Activity, TrendingUp, 
  Zap, Shield, Users, BarChart3, Globe, Sparkles,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import polymarketLogo from "@/assets/polymarket-logo.png";
import polyfactualLogo from "@/assets/polyfactual-logo.png";
import domeLogo from "@/assets/dome-logo.png";

const features = [
  {
    icon: Search,
    title: "Instant Market Analysis",
    description: "Paste any Polymarket URL and get a comprehensive breakdown including current odds, volume, liquidity, and price history. Understand market sentiment at a glance.",
    highlight: "Core Feature",
  },
  {
    icon: Brain,
    title: "Deep Research Mode",
    description: "Powered by Polyfactual's advanced AI, get in-depth research reports with source citations, probability assessments, and expert-level analysis on any market.",
    highlight: "AI-Powered",
    partner: "Polyfactual",
  },
  {
    icon: LineChart,
    title: "Smart Money Tracking",
    description: "Follow the whales. Track large trades, identify smart money movements, and see where experienced traders are placing their bets in real-time.",
    highlight: "Pro Feature",
  },
  {
    icon: Activity,
    title: "Live Market Data",
    description: "Real-time price feeds, order book depth, and trade flow directly from Polymarket and Dome. Never miss a market movement.",
    highlight: "Real-time",
    partners: ["Polymarket", "Dome"],
  },
  {
    icon: TrendingUp,
    title: "Price Alerts",
    description: "Set custom price alerts via Telegram. Get notified instantly when markets hit your target prices or experience significant movements.",
    highlight: "Notifications",
  },
  {
    icon: BarChart3,
    title: "Portfolio Dashboard",
    description: "Track all your positions in one place. View P&L, exposure, and performance metrics across your entire Polymarket portfolio.",
    highlight: "Analytics",
  },
  {
    icon: Users,
    title: "Trader Leaderboard",
    description: "See who's winning. Browse the top traders by profit, volume, and win rate. Learn from the best performers on Polymarket.",
    highlight: "Community",
  },
  {
    icon: Shield,
    title: "Risk Analysis",
    description: "Understand your exposure. Get warnings about correlated positions, overconcentration, and potential hedging opportunities.",
    highlight: "Safety",
  },
];

const partners = [
  {
    name: "Polymarket",
    logo: polymarketLogo,
    description: "The world's largest prediction market. Poly AI is built to enhance your Polymarket trading experience.",
    role: "Primary Data Source",
  },
  {
    name: "Polyfactual",
    logo: polyfactualLogo,
    description: "Advanced AI research engine providing deep analysis, source verification, and probability assessments.",
    role: "Research Partner",
  },
  {
    name: "Dome",
    logo: domeLogo,
    logoText: true,
    textColor: "#7C3AED",
    description: "Real-time market data infrastructure powering our live feeds and order book analytics.",
    role: "Data Partner",
  },
];

const stats = [
  { value: "50K+", label: "Markets Analyzed" },
  { value: "Real-time", label: "Data Updates" },
  { value: "24/7", label: "Availability" },
  { value: "100+", label: "Data Points per Market" },
];

const Capabilities = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      
      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-16">
        {/* Header */}
        <div className="mb-12">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-6 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Chat
            </Button>
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              What Can Poly AI Do?
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Your AI-powered companion for Polymarket. Get instant analysis, track smart money, 
            and make more informed trading decisions.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
          {stats.map((stat, i) => (
            <div key={i} className="bg-card/50 rounded-xl p-4 border border-border/50 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">Features</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="bg-card/50 rounded-xl p-5 border border-border/50 hover:border-primary/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">{feature.title}</h3>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {feature.highlight}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                    {feature.partner && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-muted-foreground">Powered by</span>
                        <img src={polyfactualLogo} alt={feature.partner} className="h-4" />
                      </div>
                    )}
                    {feature.partners && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-muted-foreground">Data from</span>
                        <img src={polymarketLogo} alt="Polymarket" className="h-4" />
                        <span className="text-muted-foreground text-xs">+</span>
                        <div className="flex items-center gap-1">
                          <img src={domeLogo} alt="Dome" className="h-4" />
                          <span className="text-xs font-medium text-[#7C3AED]">Dome</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Partners */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">Partner Integrations</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {partners.map((partner, i) => (
              <div 
                key={i} 
                className="bg-card/50 rounded-xl p-5 border border-border/50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <img 
                    src={partner.logo} 
                    alt={partner.name} 
                    className="h-6 object-contain"
                  />
                  {partner.logoText && (
                    <span className="font-semibold" style={{ color: partner.textColor }}>
                      {partner.name}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/50 text-secondary-foreground">
                  {partner.role}
                </span>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                  {partner.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-12 px-6 rounded-2xl bg-gradient-to-br from-primary/10 via-card/50 to-secondary/10 border border-border/50">
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Start analyzing markets, tracking whales, and making smarter trades with Poly AI.
          </p>
          <Link to="/">
            <Button size="lg" className="gap-2">
              <Zap className="w-4 h-4" />
              Start Chatting
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
};

export default Capabilities;
