import { TopBar } from "@/components/TopBar";
import { ArrowLeft, ExternalLink, Zap, Database, Search, Brain, Shield, Globe, BarChart3, Activity } from "lucide-react";
import { Link } from "react-router-dom";

import domeLogo from "@/assets/dome-logo.png";
import irysLogo from "@/assets/irys-logo.png";
import polyfactualLogo from "@/assets/polyfactual-logo.png";

const partners = [
  {
    name: "Dome",
    logo: domeLogo,
    role: "Real-Time Data Infrastructure",
    description: "Powers our real-time market data infrastructure with direct access to Polymarket's Central Limit Order Book. Enables live orderbook data, instant trade execution, and real-time analytics.",
    features: [
      { icon: Activity, text: "WebSocket connections for instant updates" },
      { icon: Zap, text: "Direct CLOB API integration" },
      { icon: BarChart3, text: "Live orderflow execution" },
      { icon: Database, text: "Real-time whale monitoring" },
    ],
    link: "https://domeapi.io",
  },
  {
    name: "Irys",
    logo: irysLogo,
    role: "Blockchain Verification",
    description: "Provides permanent, immutable storage for historical market data with cryptographic proofs. Every resolution and price movement is stored on-chain for complete transparency.",
    features: [
      { icon: Shield, text: "Tamper-proof resolution records" },
      { icon: Database, text: "Permanent historical data" },
      { icon: Search, text: "GraphQL-powered queries" },
      { icon: Globe, text: "Verifiable on-chain transactions" },
    ],
    link: "https://irys.xyz",
  },
  {
    name: "Polyfactual",
    logo: polyfactualLogo,
    role: "AI Research Engine",
    description: "Powers deep research mode with web-powered analysis and source citations. Searches the internet, analyzes multiple sources, and provides expert-level insights backed by verifiable data.",
    features: [
      { icon: Globe, text: "Web-powered live research" },
      { icon: Search, text: "Cited sources for claims" },
      { icon: Brain, text: "Expert market analysis" },
      { icon: Zap, text: "Toggle-able deep research" },
    ],
    link: null,
  },
  {
    name: "Claude by Anthropic",
    logo: null,
    role: "AI Intelligence Core",
    description: "Powers the core AI experience with advanced reasoning, tool orchestration, and multi-step analysis. Understands prediction market questions and provides intelligent, contextual responses.",
    features: [
      { icon: Brain, text: "Natural language understanding" },
      { icon: Zap, text: "Multi-step reasoning" },
      { icon: Activity, text: "Tool orchestration" },
      { icon: Globe, text: "Real-time streaming" },
    ],
    link: "https://anthropic.com",
  },
];

const stats = [
  { label: "API Integrations", value: "4+" },
  { label: "Data Sources", value: "10+" },
  { label: "Markets Covered", value: "1000+" },
  { label: "Uptime", value: "99.9%" },
];

const Partnerships = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      
      <main className="container max-w-5xl mx-auto px-4 py-12 pb-24">
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-12"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Hero */}
        <header className="mb-20">
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase mb-3">Infrastructure</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Partners & Integrations
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Built on world-class infrastructure. From real-time trading data to AI intelligence, 
            these integrations power every feature.
          </p>
        </header>

        {/* Partners Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {partners.map((partner) => (
            <article 
              key={partner.name}
              className="group"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                {partner.logo ? (
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                    <img 
                      src={partner.logo} 
                      alt={partner.name} 
                      className="w-6 h-6 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h2 className="font-medium">{partner.name}</h2>
                  <p className="text-sm text-muted-foreground">{partner.role}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                {partner.description}
              </p>

              {/* Features */}
              <ul className="space-y-2.5 mb-5">
                {partner.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-center gap-3 text-sm">
                    <feature.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>

              {/* Link */}
              {partner.link && (
                <a 
                  href={partner.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-muted-foreground transition-colors"
                >
                  Visit website
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </article>
          ))}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20 py-8 border-y border-border">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-semibold mb-1">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-xl font-medium mb-2">Ready to get started?</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Experience all integrations working together seamlessly.
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start Chatting
          </Link>
        </section>
      </main>
    </div>
  );
};

export default Partnerships;
