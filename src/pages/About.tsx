import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { Footer } from '@/components/Footer';
import { LaunchModal } from '@/components/LaunchModal';
import { 
  Brain, 
  BarChart3, 
  Database, 
  Store, 
  MessageSquare, 
  TrendingUp, 
  BookOpen, 
  ClipboardList, 
  Activity,
  Flame,
  Wrench,
  ChevronDown,
  CheckCircle2,
  BadgeCheck,
  Copy,
  Check,
  Zap,
  Globe,
  Search,
  LineChart,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePolyPrice } from '@/hooks/usePolyPrice';
import { toast } from 'sonner';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "What is $POLY used for?",
    answer: "$POLY is the payment token for accessing Poly platform features. Users deposit $POLY to their account and spend it to use AI chat, trading tools, and market data. 70% of spent tokens are permanently burned, creating deflationary pressure."
  },
  {
    question: "How do I get credits?",
    answer: "1) Buy POLY tokens on Jupiter, Pump.fun, or OKX Wallet. 2) Visit the Credits page and connect your Solana wallet. 3) Deposit POLY to your account. 1 POLY = 1 credit. Each AI analysis costs 1 credit."
  },
  {
    question: "How do I acquire $POLY tokens?",
    answer: "You can buy POLY on Jupiter (best rates), Pump.fun, or OKX Wallet. Visit the Credits page for direct links to all purchase options. Contract address: 982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump"
  },
  {
    question: "What does Polymarket Builders Program membership provide?",
    answer: "As an official Polymarket Builders Program member, Poly receives direct technical support from Polymarket's team, marketing collaboration and promotion, access to exclusive builder resources and APIs, and official recognition as a trusted project building on Polymarket infrastructure."
  },
  {
    question: "How does the 70/30 tokenomics work?",
    answer: "When users spend $POLY on the platform, 70% of those tokens are permanently burned (removed from circulation), creating deflationary pressure. The remaining 30% is allocated to the development fund for ongoing platform improvements, infrastructure costs, and operational expenses."
  },
  {
    question: "What features are available?",
    answer: "AI chat for market analysis, live trading dashboard, orderbook view, limit orders, position tracking, whale trade monitoring, and wallet analytics. All features require credits to use."
  }
];

const CONTRACT_ADDRESS = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";

const About = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: priceData, isLoading: priceLoading } = usePolyPrice(30000);

  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const tokenomicsRef = useRef(null);
  const pricingRef = useRef(null);
  
  const heroInView = useInView(heroRef, { once: true });
  const featuresInView = useInView(featuresRef, { once: true, margin: "-100px" });
  const tokenomicsInView = useInView(tokenomicsRef, { once: true, margin: "-100px" });
  const pricingInView = useInView(pricingRef, { once: true, margin: "-100px" });

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const copyContract = async () => {
    await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    toast.success('Contract address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPrice = (price: number) => {
    if (price < 0.0001) return price.toFixed(10);
    if (price < 0.01) return price.toFixed(8);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <LaunchModal open={launchModalOpen} onOpenChange={setLaunchModalOpen} />

      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Builders Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <BadgeCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Polymarket Builders Program</span>
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground mb-6"
          >
            AI-Powered Prediction
            <br />
            <span className="text-muted-foreground">Market Terminal.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            Trade smarter with real-time AI analysis, professional-grade tools, and direct market execution.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <Button 
              onClick={() => setLaunchModalOpen(true)}
              size="lg"
              className="px-8 h-12 text-base font-medium rounded-full"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="outline"
              size="lg"
              asChild
              className="px-8 h-12 text-base font-medium rounded-full"
            >
              <Link to="/markets">View Markets</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Token Metrics Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              $POLY Token
            </h2>
            <button 
              onClick={copyContract}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-mono transition-colors"
            >
              <span className="truncate max-w-[200px] md:max-w-none">{CONTRACT_ADDRESS}</span>
              {copied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
          >
            {[
              { label: "Price", value: priceLoading ? '...' : `$${formatPrice(priceData?.price || 0)}`, change: priceData?.priceChange24h },
              { label: "Market Cap", value: priceLoading ? '...' : formatNumber(priceData?.marketCap || 0) },
              { label: "24h Volume", value: priceLoading ? '...' : formatNumber(priceData?.volume24h || 0) },
              { label: "Liquidity", value: priceLoading ? '...' : formatNumber(priceData?.liquidity || 0) }
            ].map((metric, i) => (
              <div 
                key={i}
                className="p-6 rounded-2xl bg-card border border-border text-center"
              >
                <p className="text-sm text-muted-foreground mb-2">{metric.label}</p>
                <p className="text-2xl font-semibold text-foreground font-mono">
                  {metric.value}
                </p>
                {metric.change !== undefined && (
                  <p className={`text-sm font-medium mt-1 ${metric.change >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(2)}%
                  </p>
                )}
              </div>
            ))}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl bg-card border border-border overflow-hidden"
          >
            <div id="dexscreener-embed" className="relative w-full" style={{ paddingBottom: '65%' }}>
              <iframe 
                src="https://dexscreener.com/solana/982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump?embed=1&theme=dark&info=0"
                className="absolute top-0 left-0 w-full h-full border-0"
                title="$POLY Chart"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Credits System - Live */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-foreground">Credits System Live</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              How Credits Work
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Pay with POLY tokens, use AI features
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="p-8 rounded-2xl bg-card border border-border mb-8"
          >
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {[
                { step: "1", title: "Buy POLY", desc: "Get tokens on Jupiter, Pump.fun, or OKX", icon: Store },
                { step: "2", title: "Deposit", desc: "Connect wallet & deposit to your account", icon: Zap },
                { step: "3", title: "Use AI", desc: "1 credit per AI message (1 POLY = 1 credit)", icon: Brain },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <span className="text-primary font-bold">{item.step}</span>
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
            
            <Button asChild size="lg" className="rounded-full px-8">
              <Link to="/credits" className="inline-flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Get Credits Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-6 rounded-2xl bg-muted/50 text-left"
          >
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              70/30 Tokenomics
            </h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">70% Burned:</span> Permanently removed from circulation when spent.</p>
              <p><span className="font-medium text-foreground">30% Development:</span> Funds ongoing platform improvements.</p>
              <p><span className="font-medium text-foreground">Exchange Rate:</span> 1 POLY = 1 credit, always.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What is Poly */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-semibold tracking-tight text-center text-foreground mb-12"
          >
            What is Poly?
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { 
                icon: Brain, 
                title: "AI Market Analysis", 
                desc: "Instant market insights and data-driven predictions powered by real-time intelligence." 
              },
              { 
                icon: BarChart3, 
                title: "Trading Terminal", 
                desc: "Professional-grade interface with orderbooks, limit orders, and direct execution." 
              },
              { 
                icon: Database, 
                title: "Market Intelligence", 
                desc: "Comprehensive analytics, historical data, and real-time price feeds." 
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="p-8 rounded-2xl bg-card border border-border"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section ref={featuresRef} className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Platform Features
            </h2>
            <p className="text-muted-foreground">
              All features fully operational and available now
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Store, title: "Markets Dashboard", desc: "Browse all markets with advanced filtering" },
              { icon: MessageSquare, title: "AI Chat Assistant", desc: "Conversational AI for market analysis" },
              { icon: TrendingUp, title: "Direct Trading", desc: "Execute orders with real-time prices" },
              { icon: BookOpen, title: "Orderbook & Trades", desc: "Real-time depth and trade history" },
              { icon: ClipboardList, title: "Limit Orders", desc: "Set custom price points" },
              { icon: Activity, title: "Position Tracking", desc: "Monitor all positions and history" }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className="p-6 rounded-2xl bg-card border border-border group hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    Live
                  </span>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tokenomics */}
      <section ref={tokenomicsRef} className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={tokenomicsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Tokenomics
            </h2>
            <p className="text-xl text-muted-foreground">
              Total Supply: 1,000,000,000 $POLY
            </p>
          </motion.div>
          
          {/* Token Flow */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
            {[
              { step: "1", title: "Deposit", desc: "User deposits $POLY" },
              { step: "2", title: "Spend", desc: "Use for platform features" },
              { step: "3", title: "Split", desc: "70% burn / 30% dev" }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={tokenomicsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="p-6 bg-card rounded-2xl border border-border text-center min-w-[160px]">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <span className="text-primary font-semibold">{item.step}</span>
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                {i < 2 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground hidden md:block" />
                )}
              </motion.div>
            ))}
          </div>
          
          {/* Split Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={tokenomicsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="p-8 rounded-2xl bg-destructive text-destructive-foreground text-center"
            >
              <Flame className="w-12 h-12 mx-auto mb-4 opacity-90" />
              <div className="text-5xl font-bold mb-2">70%</div>
              <p className="text-lg font-medium mb-2">Permanently Burned</p>
              <p className="text-sm opacity-80">
                Tokens removed from circulation forever
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={tokenomicsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="p-8 rounded-2xl bg-primary text-primary-foreground text-center"
            >
              <Wrench className="w-12 h-12 mx-auto mb-4 opacity-90" />
              <div className="text-5xl font-bold mb-2">30%</div>
              <p className="text-lg font-medium mb-2">Development Fund</p>
              <p className="text-sm opacity-80">
                Funds ongoing improvements and maintenance
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section ref={pricingRef} className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Simple Pricing
            </h2>
            <p className="text-muted-foreground">
              Pay only for what you use
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="p-8 rounded-2xl bg-card border-2 border-primary text-center max-w-md mx-auto"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Pay Per Use</h3>
            <div className="text-4xl font-bold text-foreground mb-2">1 POLY = 1 Credit</div>
            <p className="text-muted-foreground mb-6">Each AI analysis costs 1 credit</p>
            <ul className="space-y-3 mb-8 text-left">
              {["No subscription required", "Pay only for what you use", "70% of spent tokens burned", "Full platform access"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="w-full rounded-full h-12">
              <Link to="/credits">
                Get Credits
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-semibold tracking-tight text-center text-foreground mb-12"
          >
            Under the Hood
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Brave Search", desc: "Real-time web data and news", icon: Search },
              { name: "Polymarket", desc: "Direct CLOB API integration", icon: LineChart },
              { name: "Dome API", desc: "Market data and price feeds", icon: Globe }
            ].map((tech, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-card border border-border text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <tech.icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">{tech.name}</h4>
                <p className="text-sm text-muted-foreground">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-semibold tracking-tight text-center text-foreground mb-12"
          >
            Frequently Asked Questions
          </motion.h2>
          
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full p-5 rounded-2xl bg-card border border-border text-left hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground pr-4">{item.question}</span>
                    <ChevronDown 
                      className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                        openFAQ === index ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                  {openFAQ === index && (
                    <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                      {item.answer}
                    </p>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Ready to trade smarter?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Get POLY tokens and start using AI-powered market analysis.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button 
                asChild
                size="lg"
                className="px-10 h-12 text-base font-medium rounded-full"
              >
                <Link to="/credits">
                  <Zap className="w-4 h-4 mr-2" />
                  Get Credits
                </Link>
              </Button>
              <Button 
                onClick={() => setLaunchModalOpen(true)}
                variant="outline"
                size="lg"
                className="px-10 h-12 text-base font-medium rounded-full"
              >
                Explore Platform
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
