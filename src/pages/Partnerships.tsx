import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { ArrowLeft, Check, ExternalLink, Zap, Database, Search, Brain, Shield, Globe, BarChart3, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import domeLogo from "@/assets/dome-logo.png";
import irysLogo from "@/assets/irys-logo.png";
import polyfactualLogo from "@/assets/polyfactual-logo.png";

const partners = [
  {
    name: "Dome",
    logo: domeLogo,
    role: "Real-Time Data Infrastructure",
    badge: "Trading API",
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    accentColor: "from-purple-500/20 to-violet-500/20",
    glowColor: "group-hover:shadow-purple-500/20",
    description: "Dome powers our real-time market data infrastructure, providing direct access to Polymarket's Central Limit Order Book (CLOB). This integration enables live orderbook data, instant trade execution, and real-time market analytics that update in milliseconds.",
    features: [
      { icon: Activity, text: "WebSocket connections for instant price updates" },
      { icon: Zap, text: "Direct trading integration via CLOB API" },
      { icon: BarChart3, text: "Live orderflow and trade execution" },
      { icon: Database, text: "Whale trade monitoring in real-time" },
    ],
    link: "https://dome.xyz",
  },
  {
    name: "Irys",
    logo: irysLogo,
    role: "Blockchain Verification & Storage",
    badge: "On-Chain Data",
    badgeColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    accentColor: "from-pink-500/20 to-rose-500/20",
    glowColor: "group-hover:shadow-pink-500/20",
    description: "Irys provides permanent, immutable storage for historical market data with cryptographic proofs. Every market resolution, price movement, and historical record is stored on-chain, ensuring complete transparency and verifiability for all Polymarket data.",
    features: [
      { icon: Shield, text: "Tamper-proof market resolution records" },
      { icon: Database, text: "Permanent historical accuracy data" },
      { icon: Search, text: "GraphQL-powered data queries" },
      { icon: Check, text: "Verifiable transaction IDs on-chain" },
    ],
    link: "https://irys.xyz",
  },
  {
    name: "Polyfactual",
    logo: polyfactualLogo,
    role: "AI Research Engine",
    badge: "Deep Research",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    accentColor: "from-emerald-500/20 to-teal-500/20",
    glowColor: "group-hover:shadow-emerald-500/20",
    description: "Polyfactual powers our deep research mode, enabling web-powered analysis with source citations. When enabled, Poly AI searches the internet for relevant information, analyzes multiple sources, and provides expert-level market insights backed by verifiable citations.",
    features: [
      { icon: Globe, text: "Web-powered research with live data" },
      { icon: Search, text: "Cited sources for every claim" },
      { icon: Brain, text: "Expert-level market analysis" },
      { icon: Check, text: "Toggle-able deep research mode" },
    ],
    link: null,
  },
  {
    name: "Claude by Anthropic",
    logo: null,
    role: "AI Intelligence Core",
    badge: "AI Engine",
    badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    accentColor: "from-orange-500/20 to-amber-500/20",
    glowColor: "group-hover:shadow-orange-500/20",
    description: "Claude by Anthropic powers the core AI experience of Poly. Using advanced reasoning, tool orchestration, and multi-step analysis, Claude understands your questions about prediction markets and provides intelligent, contextual responses with real-time data integration.",
    features: [
      { icon: Brain, text: "Advanced natural language understanding" },
      { icon: Zap, text: "Multi-step reasoning for market analysis" },
      { icon: Activity, text: "Tool orchestration (search, data, trading)" },
      { icon: Globe, text: "Real-time streaming responses" },
    ],
    link: "https://anthropic.com",
  },
];

const Partnerships = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      
      <div className="container max-w-6xl mx-auto px-4 py-8 pb-24">
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </Link>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Powered by the Best
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">Partners</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Poly is built on world-class infrastructure. From real-time trading data to AI intelligence, 
            these integrations power every feature of the platform.
          </p>
        </motion.div>

        {/* Partners Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {partners.map((partner, index) => (
            <motion.div
              key={partner.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-border ${partner.glowColor} hover:shadow-xl h-full`}>
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${partner.accentColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                <CardContent className="relative p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {partner.logo ? (
                        <div className="w-12 h-12 rounded-xl bg-background/50 border border-border/50 flex items-center justify-center overflow-hidden">
                          <img 
                            src={partner.logo} 
                            alt={partner.name} 
                            className="w-8 h-8 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center">
                          <Brain className="w-6 h-6 text-orange-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-lg">{partner.name}</h3>
                        <p className="text-sm text-muted-foreground">{partner.role}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${partner.badgeColor} text-xs`}>
                      {partner.badge}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    {partner.description}
                  </p>

                  {/* Features */}
                  <div className="space-y-3 mb-6">
                    {partner.features.map((feature, fIndex) => (
                      <div key={fIndex} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <feature.icon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm">{feature.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Link */}
                  {partner.link && (
                    <a 
                      href={partner.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      Learn more about {partner.name}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Integration Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
        >
          {[
            { label: "API Integrations", value: "4+" },
            { label: "Data Sources", value: "10+" },
            { label: "Markets Covered", value: "1000+" },
            { label: "Uptime", value: "99.9%" },
          ].map((stat, index) => (
            <Card key={index} className="border-border/50 bg-card/30 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-2">Experience the Power</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                All these integrations work together seamlessly to give you the best prediction market experience.
              </p>
              <Button asChild size="lg">
                <Link to="/">
                  <Zap className="w-4 h-4 mr-2" />
                  Start Chatting with Poly
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Partnerships;
