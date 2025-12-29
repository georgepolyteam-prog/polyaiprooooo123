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
    if (price < 0.0001) return price.toFixed(6);
    if (price < 0.01) return price.toFixed(5);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <LaunchModal open={launchModalOpen} onOpenChange={setLaunchModalOpen} />

      {/* Hero Section - Apple Style */}
      <section ref={heroRef} className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
        {/* Subtle gradient orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Minimal Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 mb-10">
              <BadgeCheck className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Polymarket Builders Program</span>
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-6xl md:text-8xl lg:text-[7rem] font-semibold tracking-tight text-foreground mb-8 leading-[0.95]"
          >
            Poly.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-2xl md:text-3xl text-muted-foreground mb-12 max-w-3xl mx-auto font-light leading-relaxed"
          >
            The intelligent prediction market terminal.
            <br className="hidden md:block" />
            <span className="text-foreground">AI analysis. Real-time trading. One platform.</span>
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <Button 
              asChild
              size="lg"
              className="px-10 h-14 text-base font-medium rounded-full bg-foreground text-background hover:bg-foreground/90"
            >
              <Link to="/chat">
                Get Started
              </Link>
            </Button>
            <Button 
              variant="ghost"
              size="lg"
              asChild
              className="px-10 h-14 text-base font-medium rounded-full text-muted-foreground hover:text-foreground"
            >
              <Link to="/markets">
                Explore Markets
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Token Metrics Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Token</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-6">
              $POLY
            </h2>
            <button 
              onClick={copyContract}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 text-muted-foreground hover:text-foreground text-xs font-mono transition-colors border border-border/50"
            >
              <span className="truncate max-w-[160px] md:max-w-none">{CONTRACT_ADDRESS}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12"
          >
            {[
              { label: "Price", value: priceLoading ? '...' : `$${formatPrice(priceData?.price || 0)}`, change: priceData?.priceChange24h },
              { label: "Market Cap", value: priceLoading ? '...' : formatNumber(priceData?.marketCap || 0) },
              { label: "24h Volume", value: priceLoading ? '...' : formatNumber(priceData?.volume24h || 0) },
              { label: "Liquidity", value: priceLoading ? '...' : formatNumber(priceData?.liquidity || 0) }
            ].map((metric, i) => (
              <div 
                key={i}
                className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-muted/30 text-center min-w-0"
              >
                <p className="text-[10px] md:text-xs text-muted-foreground mb-2 md:mb-3 uppercase tracking-wide">{metric.label}</p>
                <p className="text-lg md:text-2xl font-semibold text-foreground font-mono truncate">
                  {metric.value}
                </p>
                {metric.change !== undefined && (
                  <p className={`text-xs md:text-sm font-medium mt-1 md:mt-2 ${metric.change >= 0 ? 'text-primary' : 'text-destructive'}`}>
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
            className="rounded-3xl bg-muted/30 overflow-hidden"
          >
            <div id="dexscreener-embed" className="relative w-full" style={{ paddingBottom: '60%' }}>
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
      <section className="py-24 px-6 bg-muted/20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Credits</p>
            
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-6">
              Simple, transparent pricing.
            </h2>
            <p className="text-xl text-muted-foreground mb-16 max-w-2xl mx-auto">
              1 POLY = 1 Credit. Use credits for AI analysis and premium features.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid md:grid-cols-3 gap-8 mb-12"
          >
            {[
              { step: "01", title: "Acquire", desc: "Buy POLY on Jupiter, Pump.fun, or OKX Wallet", icon: Store },
              { step: "02", title: "Deposit", desc: "Connect your Solana wallet and deposit tokens", icon: Zap },
              { step: "03", title: "Analyze", desc: "Use credits for AI-powered market insights", icon: Brain },
            ].map((item, i) => (
              <div key={i} className="text-left p-8 rounded-3xl bg-card border border-border/50">
                <span className="text-xs font-mono text-muted-foreground">{item.step}</span>
                <h4 className="text-xl font-semibold text-foreground mt-2 mb-3">{item.title}</h4>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Button asChild size="lg" className="rounded-full px-10 h-14 text-base font-medium bg-foreground text-background hover:bg-foreground/90">
              <Link to="/credits">
                Get Credits
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>

        </div>
      </section>

      {/* What is Poly */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Overview</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              Everything you need to trade smarter.
            </h2>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                icon: Brain, 
                title: "AI Analysis", 
                desc: "Instant market insights powered by real-time intelligence and data-driven predictions." 
              },
              { 
                icon: BarChart3, 
                title: "Pro Trading", 
                desc: "Professional-grade terminal with orderbooks, limit orders, and direct execution." 
              },
              { 
                icon: Database, 
                title: "Deep Data", 
                desc: "Comprehensive analytics, historical trends, and real-time price feeds." 
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
                  <item.icon className="w-7 h-7 text-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section ref={featuresRef} className="py-24 px-6 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Features</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4">
              Fully operational. Ready now.
            </h2>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Store, title: "Markets", desc: "Browse and filter all prediction markets" },
              { icon: MessageSquare, title: "AI Chat", desc: "Conversational analysis for any market" },
              { icon: TrendingUp, title: "Trading", desc: "Execute trades with real-time pricing" },
              { icon: BookOpen, title: "Orderbook", desc: "Full depth and trade history view" },
              { icon: ClipboardList, title: "Limit Orders", desc: "Set your own price targets" },
              { icon: Activity, title: "Portfolio", desc: "Track positions and performance" }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className="p-8 rounded-3xl bg-card border border-border/50 group hover:bg-muted/50 transition-colors"
              >
                <feature.icon className="w-6 h-6 text-foreground mb-5" />
                <h4 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tokenomics */}
      <section ref={tokenomicsRef} className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={tokenomicsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Tokenomics</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4">
              Deflationary by design.
            </h2>
            <p className="text-xl text-muted-foreground">
              Total Supply: 1,000,000,000 $POLY
            </p>
          </motion.div>
          
          {/* Split Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={tokenomicsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="p-10 rounded-3xl bg-gradient-to-b from-muted/50 to-muted/20 border border-border/50 text-center"
            >
              <div className="text-6xl md:text-7xl font-bold text-foreground mb-4">70%</div>
              <p className="text-lg font-medium text-foreground mb-2">Burned</p>
              <p className="text-muted-foreground">
                Permanently removed from circulation when spent
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={tokenomicsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="p-10 rounded-3xl bg-gradient-to-b from-muted/50 to-muted/20 border border-border/50 text-center"
            >
              <div className="text-6xl md:text-7xl font-bold text-foreground mb-4">30%</div>
              <p className="text-lg font-medium text-foreground mb-2">Development</p>
              <p className="text-muted-foreground">
                Funds platform improvements and maintenance
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section ref={pricingRef} className="py-24 px-6 bg-muted/20">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4">
              Pay for what you use.
            </h2>
            <p className="text-xl text-muted-foreground">
              No subscriptions. No hidden fees.
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={pricingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="p-10 rounded-3xl bg-card border border-border/50 max-w-sm mx-auto"
          >
            <div className="text-5xl font-bold text-foreground mb-2">1:1</div>
            <p className="text-lg text-muted-foreground mb-8">1 POLY = 1 Credit</p>
            <ul className="space-y-4 mb-10 text-left">
              {["Full platform access", "AI-powered analysis", "Real-time trading", "No expiration"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="w-full rounded-full h-12 bg-foreground text-background hover:bg-foreground/90">
              <Link to="/credits">
                Get Started
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Technology</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              Built on the best.
            </h2>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
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
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-5">
                  <tech.icon className="w-6 h-6 text-foreground" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">{tech.name}</h4>
                <p className="text-sm text-muted-foreground">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              Questions? Answers.
            </h2>
          </motion.div>
          
          <div className="space-y-4">
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
                  className="w-full p-6 rounded-2xl bg-card border border-border/50 text-left hover:bg-muted/50 transition-colors"
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
                    <p className="mt-4 text-muted-foreground leading-relaxed">
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
      <section className="py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-foreground mb-6">
              Start trading smarter.
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              AI-powered insights. Professional tools. One platform.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button 
                asChild
                size="lg"
                className="px-10 h-14 text-base font-medium rounded-full bg-foreground text-background hover:bg-foreground/90"
              >
                <Link to="/credits">
                  Get Credits
                </Link>
              </Button>
              <Button 
                asChild
                variant="ghost"
                size="lg"
                className="px-10 h-14 text-base font-medium rounded-full text-muted-foreground hover:text-foreground"
              >
                <Link to="/">
                  Explore Platform
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
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
