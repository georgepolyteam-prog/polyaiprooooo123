import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { LaunchModal } from '@/components/LaunchModal';
import okxLogo from "@/assets/okx-logo.png";
import binanceLogo from "@/assets/binance-logo.png";
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
  ChevronDown,
  CheckCircle2,
  BadgeCheck,
  Copy,
  Check,
  Zap,
  Globe,
  Search,
  LineChart,
  ArrowRight,
  ExternalLink,
  Coins,
  Flame
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
    answer: "You can buy POLY on Jupiter, Pump.fun, or OKX Wallet. Visit the Credits page for direct links to all purchase options. Contract address: 982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump"
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

const buyOptions = [
  {
    id: "binance",
    name: "Binance Web3",
    description: "World's largest exchange",
    url: `https://web3.binance.com/sv/token/sol/${CONTRACT_ADDRESS}`,
    logo: binanceLogo,
  },
  {
    id: "pumpfun",
    name: "Pump.fun",
    description: "Community trading",
    url: `https://pump.fun/coin/${CONTRACT_ADDRESS}`,
    logo: "https://pump.fun/icon.png",
  },
  {
    id: "okx",
    name: "OKX Wallet",
    description: "50M+ users worldwide",
    url: `https://www.okx.com/web3/dex-swap#inputChain=501&inputCurrency=So11111111111111111111111111111111111111112&outputChain=501&outputCurrency=${CONTRACT_ADDRESS}`,
    logo: okxLogo,
  },
];

const About = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: priceData, isLoading: priceLoading } = usePolyPrice(30000);

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const copyContract = async () => {
    await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    toast.success('Contract address copied');
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

      {/* Hero */}
      <section className="pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border mb-6">
              <BadgeCheck className="w-4 h-4 text-foreground/70" />
              <span className="text-sm text-muted-foreground">Polymarket Builders Program</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6">
              Poly
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-8">
              The intelligent prediction market terminal. AI analysis, real-time trading, professional tools.
            </p>
            
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/">Get Started</Link>
              </Button>
              <Button variant="outline" asChild size="lg" className="rounded-full">
                <Link to="/markets">
                  Browse Markets
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contract Address */}
      <section className="py-12 md:py-16">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="text-sm text-muted-foreground text-center mb-3">Contract Address</p>
            <button 
              onClick={copyContract}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-muted/50 border border-border hover:border-foreground/20 transition-colors"
            >
              <code className="text-sm font-mono text-foreground break-all text-left">
                {CONTRACT_ADDRESS}
              </code>
              <div className="flex-shrink-0">
                {copied ? (
                  <Check className="w-5 h-5 text-foreground" />
                ) : (
                  <Copy className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Solana SPL Token
            </p>
          </motion.div>
        </div>
      </section>

      {/* Buy Options */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-2xl font-semibold text-foreground text-center mb-8">
              Get $POLY
            </h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              {buyOptions.map((option) => (
                <a
                  key={option.id}
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center p-6 rounded-2xl border border-border bg-card hover:border-foreground/20 transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-4">
                    <img 
                      src={option.logo} 
                      alt={option.name}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <h3 className="font-medium text-foreground mb-1">{option.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{option.description}</p>
                  <span className="text-sm text-foreground/70 group-hover:text-foreground transition-colors flex items-center gap-1">
                    Buy Now
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Token Burn Model */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border mb-4">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Deflationary Model</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
              Token Burn Model
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              How POLY becomes deflationary: Users spend POLY for credits, 70% is burned forever, 30% funds development.
            </p>
          </motion.div>

          {/* Current Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-foreground/20 bg-muted/50 p-6 mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-foreground/70" />
              <span className="text-sm font-medium text-foreground">Current Status</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl md:text-3xl font-semibold text-foreground">~5K</p>
                <p className="text-xs text-muted-foreground">Monthly Active Users</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-semibold text-foreground">~1M</p>
                <p className="text-xs text-muted-foreground">POLY Burned/Month</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-semibold text-foreground">~5%</p>
                <p className="text-xs text-muted-foreground">Supply Burned to Date</p>
              </div>
            </div>
          </motion.div>

          <h3 className="text-lg font-medium text-foreground text-center mb-6">Projected Annual Burn Rates</h3>

          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {[
              {
                tier: "Year 1 (Building)",
                subtitle: "Early Adoption",
                users: "10K",
                multiplier: "2x current",
                avgCredits: 300,
                monthlyBurn: 2100000,
                annualBurn: 25200000,
                annualBurnRate: 2.5,
                accent: "border-border"
              },
              {
                tier: "Year 2 (Growth)",
                subtitle: "Product-Market Fit",
                users: "50K",
                multiplier: "10x current",
                avgCredits: 450,
                monthlyBurn: 15750000,
                annualBurn: 189000000,
                annualBurnRate: 18.9,
                accent: "border-foreground/30 bg-muted/50"
              },
              {
                tier: "Year 3+ (Scale)",
                subtitle: "Mass Adoption",
                users: "250K+",
                multiplier: "50x current",
                avgCredits: 200,
                monthlyBurn: 35000000,
                annualBurn: 250000000,
                annualBurnRate: 25,
                accent: "border-foreground/50 bg-muted/70"
              }
            ].map((scenario, i) => (
              <motion.div
                key={scenario.tier}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`rounded-2xl border ${scenario.accent} bg-card p-6`}
              >
                <div className="mb-6">
                  <h3 className="font-semibold text-foreground">{scenario.tier}</h3>
                  <p className="text-xs text-muted-foreground">{scenario.subtitle}</p>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl font-semibold text-foreground">{scenario.users}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {scenario.multiplier}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Avg Credits/User</span>
                    <span className="font-mono text-sm text-foreground">{scenario.avgCredits}/mo</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      Monthly Burn
                    </span>
                    <span className="font-mono text-sm text-foreground">
                      {(scenario.monthlyBurn / 1000000).toFixed(1)}M
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Annual Burn</span>
                    <span className="font-mono text-sm text-foreground">
                      {(scenario.annualBurn / 1000000).toFixed(0)}M
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Annual Burn Rate</span>
                    <span className="font-mono text-sm text-emerald-500">
                      {scenario.annualBurnRate}%
                    </span>
                  </div>
                </div>

                {scenario.tier === "Year 3+ (Scale)" && (
                  <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50">
                    Burn rate capped at 25% as supply decreases and token value increases
                  </p>
                )}
              </motion.div>
            ))}
          </div>

          {/* Formula explanation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-xl bg-muted/30 border border-border p-5 mb-6"
          >
            <div className="flex flex-wrap gap-x-8 gap-y-3 justify-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Formula:</span>
                <code className="font-mono text-foreground bg-muted px-2 py-0.5 rounded text-xs">
                  Monthly Burn = Users × Credits × 70%
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total Supply:</span>
                <span className="font-mono text-foreground">1B POLY</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Burn Rate:</span>
                <span className="font-mono text-foreground">70%</span>
              </div>
            </div>
          </motion.div>

          {/* Price dynamics note */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="rounded-xl bg-muted/20 border border-border/50 p-4 mb-6"
          >
            <p className="text-sm text-muted-foreground text-center">
              As supply decreases, token value is expected to increase, naturally slowing burn rate. 
              These projections assume stable token price and constant user behavior.
            </p>
          </motion.div>

          <p className="text-xs text-muted-foreground/60 text-center max-w-lg mx-auto">
            Projections are hypothetical scenarios for illustrative purposes only. 
            Actual results depend on market conditions and platform adoption. Not financial advice.
          </p>

          <p className="text-xs text-muted-foreground/40 text-center mt-4">
            Projections updated: January 2026
          </p>
        </div>
      </section>

      {/* Beginner Guide */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-semibold text-foreground text-center mb-2">
              New to Crypto?
            </h2>
            <p className="text-muted-foreground text-center mb-10">
              Follow these steps to get started
            </p>
            
            <div className="space-y-8">
              {[
                {
                  step: "1",
                  title: "Get a Solana Wallet",
                  desc: "Download Phantom Wallet from phantom.app — it's free and works on mobile or desktop.",
                  tip: "Write down your recovery phrase and keep it safe. Never share it."
                },
                {
                  step: "2",
                  title: "Add SOL to Your Wallet",
                  desc: "Inside Phantom, tap \"Buy\" to purchase SOL with card, Apple Pay, or bank transfer.",
                  tip: "Start with $20-50. You'll need a small amount (~$0.01) for transaction fees."
                },
                {
                  step: "3",
                  title: "Swap SOL for POLY",
                  desc: "Click any \"Buy Now\" button above. Connect your wallet, enter the amount, and confirm.",
                  tip: "Pump.fun is the easiest option for beginners."
                },
                {
                  step: "4",
                  title: "Deposit POLY for Credits",
                  desc: "Go to the Credits page, connect your wallet, and deposit tokens. 1 POLY = 1 Credit.",
                  tip: "Credits are used to access AI analysis and trading tools."
                }
              ].map((item, i) => (
                <div key={i} className="flex gap-5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-medium">
                    {item.step}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h3 className="font-medium text-foreground mb-1">{item.title}</h3>
                    <p className="text-muted-foreground text-sm mb-2">{item.desc}</p>
                    <p className="text-xs text-muted-foreground/70">{item.tip}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a 
                href="https://phantom.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm hover:border-foreground/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Get Phantom
              </a>
              <Link 
                to="/credits"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background text-sm hover:bg-foreground/90 transition-colors"
              >
                <Coins className="w-3.5 h-3.5" />
                Deposit Credits
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Token Stats */}
      <section className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-semibold text-foreground">
              Token Stats
            </h2>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
          >
            {[
              { label: "Price", value: priceLoading ? '—' : `$${formatPrice(priceData?.price || 0)}`, change: priceData?.priceChange24h },
              { label: "Market Cap", value: priceLoading ? '—' : formatNumber(priceData?.marketCap || 0) },
              { label: "24h Volume", value: priceLoading ? '—' : formatNumber(priceData?.volume24h || 0) },
              { label: "Liquidity", value: priceLoading ? '—' : formatNumber(priceData?.liquidity || 0) }
            ].map((metric, i) => (
              <div key={i} className="p-5 rounded-xl bg-muted/50 border border-border text-center">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">{metric.label}</p>
                <p className="text-xl font-semibold text-foreground font-mono">
                  {metric.value}
                </p>
                {metric.change !== undefined && (
                  <p className={`text-sm mt-1 ${metric.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
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
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl overflow-hidden border border-border"
          >
            <div className="relative w-full" style={{ paddingBottom: '50%' }}>
              <iframe 
                src="https://dexscreener.com/solana/982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump?embed=1&theme=dark&info=0"
                className="absolute top-0 left-0 w-full h-full border-0"
                title="$POLY Chart"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Platform Features
            </h2>
            <p className="text-muted-foreground">
              Everything you need to trade prediction markets
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: "AI Analysis", desc: "Instant market insights powered by real-time intelligence" },
              { icon: BarChart3, title: "Pro Trading", desc: "Professional terminal with orderbooks and limit orders" },
              { icon: Database, title: "Deep Data", desc: "Comprehensive analytics and real-time price feeds" },
              { icon: Store, title: "Markets", desc: "Browse and filter all prediction markets" },
              { icon: Activity, title: "Portfolio", desc: "Track positions and performance" },
              { icon: TrendingUp, title: "Whale Tracking", desc: "Monitor large trades in real-time" }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="p-6 rounded-xl bg-card border border-border"
              >
                <feature.icon className="w-5 h-5 text-foreground/70 mb-4" />
                <h4 className="font-medium text-foreground mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tokenomics */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Tokenomics
            </h2>
            <p className="text-muted-foreground">
              Total Supply: 1,000,000,000 POLY
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="p-8 rounded-xl bg-muted/50 border border-border text-center"
            >
              <Flame className="w-6 h-6 text-foreground/70 mx-auto mb-4" />
              <div className="text-4xl font-semibold text-foreground mb-2">70%</div>
              <p className="font-medium text-foreground mb-1">Burned</p>
              <p className="text-sm text-muted-foreground">
                Permanently removed when spent
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="p-8 rounded-xl bg-muted/50 border border-border text-center"
            >
              <Zap className="w-6 h-6 text-foreground/70 mx-auto mb-4" />
              <div className="text-4xl font-semibold text-foreground mb-2">30%</div>
              <p className="font-medium text-foreground mb-1">Development</p>
              <p className="text-sm text-muted-foreground">
                Platform improvements
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="max-w-xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Simple Pricing
            </h2>
            <p className="text-muted-foreground mb-10">
              No subscriptions. Pay for what you use.
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-8 rounded-xl bg-card border border-border"
          >
            <div className="text-3xl font-semibold text-foreground mb-2">1 POLY = 1 Credit</div>
            <p className="text-muted-foreground mb-8">Use credits for AI analysis</p>
            <ul className="space-y-3 mb-8 text-left max-w-xs mx-auto">
              {["Full platform access", "AI-powered analysis", "Real-time trading", "No expiration"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-foreground/70 flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="w-full rounded-full">
              <Link to="/credits">Get Credits</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl font-semibold text-foreground">
              Built With
            </h2>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Brave Search", desc: "Real-time web data", icon: Search },
              { name: "Polymarket", desc: "Direct CLOB API", icon: LineChart },
              { name: "Dome API", desc: "Market data feeds", icon: Globe }
            ].map((tech, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center p-6"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <tech.icon className="w-5 h-5 text-foreground/70" />
                </div>
                <h3 className="font-medium text-foreground mb-1">{tech.name}</h3>
                <p className="text-sm text-muted-foreground">{tech.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl font-semibold text-foreground">
              FAQ
            </h2>
          </motion.div>
          
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                <button
                  onClick={() => toggleFAQ(i)}
                  className="w-full flex items-center justify-between p-5 rounded-xl bg-card border border-border text-left hover:border-foreground/20 transition-colors"
                >
                  <span className="font-medium text-foreground pr-4">{item.question}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${openFAQ === i ? 'rotate-180' : ''}`} />
                </button>
                {openFAQ === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-5 py-4 text-sm text-muted-foreground"
                  >
                    {item.answer}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Ready to start?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of traders using AI-powered market analysis
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/">
                  Start Chatting
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button variant="outline" asChild size="lg" className="rounded-full">
                <Link to="/partnerships">View Partners</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default About;
