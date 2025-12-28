import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
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
  Shield,
  Rocket,
  Copy,
  Check,
  Sparkles,
  Zap,
  Globe,
  Search,
  LineChart
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
    question: "When does the $POLY payment system launch?",
    answer: "The $POLY payment integration is currently being implemented and tested. Check our Status page for the latest updates on development progress."
  },
  {
    question: "How do I acquire $POLY tokens?",
    answer: "$POLY is a Solana token available on decentralized exchanges. Contract address: 982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump. After acquiring tokens, you can deposit them directly to your Poly account when the payment system launches."
  },
  {
    question: "What does Polymarket Builders Program membership provide?",
    answer: "As an official Polymarket Builders Program member, Poly receives direct technical support from Polymarket's team, marketing collaboration and promotion, access to exclusive builder resources and APIs, and official recognition as a trusted project building on Polymarket infrastructure."
  },
  {
    question: "Can I use the platform before $POLY integration?",
    answer: "Yes. All platform features are currently live and available for free during the testing phase. You can access AI chat, view markets, analyze orderbooks, execute trades, set limit orders, and monitor positions."
  },
  {
    question: "How does the 70/30 tokenomics work?",
    answer: "When users spend $POLY on the platform, 70% of those tokens are permanently burned (removed from circulation), creating deflationary pressure. The remaining 30% is allocated to the development fund for ongoing platform improvements, infrastructure costs, and operational expenses."
  }
];

const CONTRACT_ADDRESS = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { staggerChildren: 0.1 } 
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
};

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
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-x-hidden">
      <TopBar />
      <LaunchModal open={launchModalOpen} onOpenChange={setLaunchModalOpen} />

      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Builders Program Hero */}
      <section ref={heroRef} className="relative py-20 md:py-32 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#0f172a] to-[#0a0a0a]" />
        <div className="absolute inset-0 cyber-grid opacity-30" />
        
        {/* Glowing orbs */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-20 right-1/4 w-32 h-32 bg-blue-500/30 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute bottom-20 left-1/4 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"
        />
        
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={heroInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-3 mb-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-50 animate-pulse" />
                <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold shadow-2xl shadow-blue-500/30 flex items-center gap-3">
                  <BadgeCheck className="w-5 h-5" />
                  <span>Official Polymarket Builders Program Member</span>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                </div>
              </div>
            </motion.div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight"
          >
            <span className="bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
              AI-Powered
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Prediction Market Terminal
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg md:text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed"
          >
            Official member of the Polymarket Builders Program, 
            receiving direct infrastructure support, marketing collaboration, and exclusive builder resources.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            {[
              { icon: BadgeCheck, text: "Official Badge Holder" },
              { icon: Shield, text: "Direct Technical Support" },
              { icon: Rocket, text: "Marketing Partnership" }
            ].map((item, i) => (
              <motion.div 
                key={i}
                whileHover={{ scale: 1.05, y: -2 }}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 px-5 py-3 rounded-xl text-sm font-medium text-white backdrop-blur-sm"
              >
                <item.icon className="w-4 h-4 text-blue-400" />
                {item.text}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Live Price Section */}
      <section className="py-16 px-4 bg-[#0a0a0a] relative">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-10"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent">
              $POLY Token Metrics
            </h2>
            <button 
              onClick={copyContract}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-mono transition-colors group"
            >
              <span className="truncate max-w-[200px] md:max-w-none">{CONTRACT_ADDRESS}</span>
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
              )}
            </button>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            {[
              { label: "Price (USD)", value: priceLoading ? '...' : `$${formatPrice(priceData?.price || 0)}`, change: priceData?.priceChange24h },
              { label: "Market Cap", value: priceLoading ? '...' : formatNumber(priceData?.marketCap || 0) },
              { label: "24h Volume", value: priceLoading ? '...' : formatNumber(priceData?.volume24h || 0) },
              { label: "Liquidity", value: priceLoading ? '...' : formatNumber(priceData?.liquidity || 0) }
            ].map((metric, i) => (
              <motion.div 
                key={i}
                variants={scaleIn}
                whileHover={{ scale: 1.02, y: -2 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-[#121212] p-5 rounded-xl border border-white/10 hover:border-blue-500/50 transition-all">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-semibold">{metric.label}</p>
                  <p className={`text-xl md:text-2xl font-bold font-mono ${i === 0 ? 'text-blue-400' : 'text-white'}`}>
                    {metric.value}
                  </p>
                  {metric.change !== undefined && (
                    <p className={`text-sm font-semibold mt-1 ${metric.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(2)}%
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-[#121212] rounded-xl border border-white/10 overflow-hidden"
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

      {/* Development Status Section */}
      <section className="py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a2e]/50 via-[#0f0f1a] to-[#0a0a0a]" />
        <div className="absolute inset-0 cyber-grid opacity-20" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-green-400" />
              <span className="text-green-400 font-semibold text-sm">Currently FREE During Beta</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              $POLY Payment Integration
            </h2>
            <p className="text-lg text-gray-400 mb-8">Token Payment System</p>
          </motion.div>

          {/* In Progress Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative max-w-xl mx-auto mb-8"
          >
            {/* Animated glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl animate-pulse" />
            
            <div className="relative bg-gradient-to-br from-[#121212] to-[#0a0a1a] p-8 md:p-10 rounded-2xl border border-blue-500/30 overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.3),transparent_50%)] animate-pulse" />
              </div>
              
              {/* Spinning loader icon */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 p-[3px]"
              >
                <div className="w-full h-full rounded-full bg-[#121212] flex items-center justify-center">
                  <Wrench className="w-7 h-7 text-blue-400" />
                </div>
              </motion.div>
              
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Implementation in Progress
              </h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                We're actively building and testing the $POLY token credit system. Stay tuned for updates!
              </p>
              
              {/* Status link button */}
              <Link to="/status">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
                >
                  <Activity className="w-5 h-5" />
                  Check Development Status
                  <motion.span 
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </motion.button>
              </Link>
            </div>
          </motion.div>

          {/* Explanation Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-gradient-to-br from-[#121212] to-[#0f0f1a] p-6 md:p-8 rounded-2xl border border-white/10 text-left max-w-2xl mx-auto backdrop-blur-sm"
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              What's Coming?
            </h3>
            <div className="space-y-4 text-gray-400 leading-relaxed text-sm">
              <p>
                <strong className="text-white">The Platform is Already Live:</strong> All features (AI chat, trading, markets, orderbooks, limit orders) are currently operational and available for free.
              </p>
              <p>
                <strong className="text-white">Coming Soon:</strong> The $POLY payment system integration. After launch, users will need $POLY tokens to access platform features.
              </p>
              <p>
                <strong className="text-white">70/30 Tokenomics:</strong> When you spend $POLY, 70% is permanently burned (deflationary) and 30% funds ongoing development.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What is Poly Section */}
      <section className="py-16 px-4 relative">
        <div className="max-w-5xl mx-auto">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-3xl md:text-4xl font-bold text-center mb-12 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent"
          >
            What is Poly?
          </motion.h2>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6"
          >
            {[
              { 
                icon: Brain, 
                title: "AI Market Analysis", 
                desc: "Proprietary AI analysis engine delivering instant market insights, event research, and data-driven predictions powered by real-time intelligence." 
              },
              { 
                icon: BarChart3, 
                title: "Enterprise Trading Terminal", 
                desc: "Professional-grade trading interface with real-time orderbooks, position management, limit orders, and direct market execution." 
              },
              { 
                icon: Database, 
                title: "Integrated Market Intelligence", 
                desc: "Seamless data feeds from Brave Search and Dome API delivering comprehensive market analytics, historical data, and real-time price feeds." 
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                variants={scaleIn}
                whileHover={{ scale: 1.02, y: -5 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-7 rounded-2xl bg-gradient-to-br from-[#121212] to-[#0f0f1a] border border-white/10 hover:border-blue-500/50 transition-all h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-5">
                    <item.icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Platform Features Section */}
      <section ref={featuresRef} className="py-16 px-4 bg-black/30 relative">
        <div className="absolute inset-0 cyber-grid opacity-10" />
        
        <div className="relative max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            animate={featuresInView ? "visible" : "hidden"}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent">
              Platform Features
            </h2>
            <p className="text-gray-400">
              All features are fully operational and available now
            </p>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            animate={featuresInView ? "visible" : "hidden"}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {[
              { icon: Store, title: "Markets Dashboard", desc: "Browse all Polymarket markets with advanced filtering and search" },
              { icon: MessageSquare, title: "AI Chat Assistant", desc: "Conversational AI for market analysis and trading strategies" },
              { icon: TrendingUp, title: "Direct Trading", desc: "Execute buy and sell orders with real-time market prices" },
              { icon: BookOpen, title: "Orderbook & Trade Feed", desc: "Real-time orderbook depth and recent trade history" },
              { icon: ClipboardList, title: "Limit Order Management", desc: "Set custom price points and automated trading strategies" },
              { icon: Activity, title: "Position Monitoring", desc: "Track all positions and complete trading history" }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                variants={scaleIn}
                whileHover={{ scale: 1.02 }}
                className="p-5 rounded-xl bg-gradient-to-br from-[#121212] to-[#0f0f1a] border border-white/10 hover:border-blue-500/50 transition-all relative group"
              >
                <div className="absolute top-3 right-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow-lg shadow-green-500/30">
                  LIVE
                </div>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">{feature.title}</h4>
                <p className="text-gray-400 text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Tokenomics Section */}
      <section ref={tokenomicsRef} className="py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a2e]/30 via-transparent to-[#0a0a0a]" />
        
        <div className="relative max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            animate={tokenomicsInView ? "visible" : "hidden"}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent">
              $POLY Tokenomics
            </h2>
            <div className="text-2xl md:text-3xl font-bold text-purple-400">
              Total Supply: 1,000,000,000 $POLY
            </div>
          </motion.div>
          
          {/* Token Flow */}
          <motion.div 
            initial="hidden"
            animate={tokenomicsInView ? "visible" : "hidden"}
            variants={staggerContainer}
            className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-5 mb-12"
          >
            {[
              { step: "1", title: "Deposit", desc: "User deposits $POLY to platform account" },
              { step: "2", title: "Spend", desc: "Use $POLY for platform features" },
              { step: "3", title: "Distribution", desc: "70% burn / 30% development" }
            ].map((item, i) => (
              <motion.div key={i} variants={scaleIn} className="flex items-center gap-4">
                <div className="p-5 bg-gradient-to-br from-[#121212] to-[#0f0f1a] rounded-xl border border-white/10 text-center min-w-[180px]">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-blue-400 font-bold">{item.step}</span>
                  </div>
                  <h4 className="text-lg font-bold mb-2 text-white">{item.title}</h4>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
                {i < 2 && (
                  <motion.div 
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-3xl text-blue-400 hidden md:block"
                  >
                    →
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
          
          {/* Split Cards */}
          <motion.div 
            initial="hidden"
            animate={tokenomicsInView ? "visible" : "hidden"}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-6"
          >
            <motion.div 
              variants={scaleIn}
              whileHover={{ scale: 1.02 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl blur-xl" />
              <div className="relative p-8 rounded-2xl bg-gradient-to-br from-red-500/90 to-red-700/90 text-center overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                <Flame className="w-14 h-14 mx-auto mb-4 text-white drop-shadow-lg" />
                <div className="text-6xl font-black text-white mb-2">70%</div>
                <p className="text-white font-semibold text-lg mb-2">Permanently Burned</p>
                <p className="text-white/80 text-sm leading-relaxed">
                  Tokens removed from circulation forever, creating deflationary pressure
                </p>
              </div>
            </motion.div>
            
            <motion.div 
              variants={scaleIn}
              whileHover={{ scale: 1.02 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl blur-xl" />
              <div className="relative p-8 rounded-2xl bg-gradient-to-br from-blue-500/90 to-blue-700/90 text-center overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                <Wrench className="w-14 h-14 mx-auto mb-4 text-white drop-shadow-lg" />
                <div className="text-6xl font-black text-white mb-2">30%</div>
                <p className="text-white font-semibold text-lg mb-2">Development Fund</p>
                <p className="text-white/80 text-sm leading-relaxed">
                  Funds ongoing platform improvements and infrastructure maintenance
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={pricingRef} className="py-16 px-4 relative">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            animate={pricingInView ? "visible" : "hidden"}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent">
              Pricing Plans
            </h2>
            <p className="text-gray-400">
              Payment system launches January 6, 2026
            </p>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            animate={pricingInView ? "visible" : "hidden"}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-6"
          >
            <motion.div 
              variants={scaleIn}
              whileHover={{ scale: 1.02 }}
              className="p-8 rounded-2xl bg-gradient-to-br from-[#121212] to-[#0f0f1a] border-2 border-white/10 hover:border-blue-500/50 transition-all text-center"
            >
              <h3 className="text-2xl font-bold text-white mb-4">Pay Per Use</h3>
              <div className="text-4xl font-black text-blue-400 mb-6">100 $POLY</div>
              <ul className="space-y-3 mb-8 text-left">
                {["Per AI message", "Pay only for what you use", "No commitment required", "Full platform access"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button 
                onClick={() => setLaunchModalOpen(true)}
                variant="outline" 
                className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10 py-5"
              >
                Get Started
              </Button>
            </motion.div>
            
            <motion.div 
              variants={scaleIn}
              whileHover={{ scale: 1.02 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl" />
              <div className="relative p-8 rounded-2xl bg-gradient-to-br from-[#121212] to-[#0f0f1a] border-2 border-blue-500 text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-xs font-bold text-white shadow-lg shadow-blue-500/30">
                  RECOMMENDED
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Monthly Unlimited</h3>
                <div className="text-4xl font-black text-blue-400 mb-6">25,000 $POLY</div>
                <ul className="space-y-3 mb-8 text-left">
                  {["Unlimited AI conversations", "All platform features", "Best value for active traders", "Priority support"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={() => setLaunchModalOpen(true)}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 py-5 shadow-lg shadow-blue-500/30"
                >
                  Get Started
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-16 px-4 bg-black/30 relative">
        <div className="absolute inset-0 cyber-grid opacity-10" />
        
        <div className="relative max-w-4xl mx-auto">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-3xl md:text-4xl font-bold text-center mb-12 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent"
          >
            Under the Hood
          </motion.h2>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-5"
          >
            {[
              { name: "Brave Search", desc: "Real-time web data and news integration", icon: Search },
              { name: "Polymarket", desc: "Direct CLOB API for orderbooks and trading", icon: LineChart },
              { name: "Dome API", desc: "Comprehensive market data and price feeds", icon: Globe }
            ].map((tech, i) => (
              <motion.div 
                key={i}
                variants={scaleIn}
                whileHover={{ scale: 1.02, y: -2 }}
                className="p-6 rounded-xl bg-gradient-to-br from-[#121212] to-[#0f0f1a] border border-white/10 text-center hover:border-blue-500/50 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <tech.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">{tech.name}</h4>
                <p className="text-gray-400 text-sm">{tech.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-3xl md:text-4xl font-bold text-center mb-12 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent"
          >
            Frequently Asked Questions
          </motion.h2>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-3"
          >
            {faqItems.map((item, index) => (
              <motion.div 
                key={index}
                variants={fadeInUp}
                className="bg-gradient-to-br from-[#121212] to-[#0f0f1a] rounded-xl border border-white/10 overflow-hidden transition-all hover:border-blue-500/30"
              >
                <button
                  className="w-full p-5 text-left flex justify-between items-center hover:bg-white/5 transition-colors"
                  onClick={() => toggleFAQ(index)}
                >
                  <span className="text-base font-semibold text-white pr-4">{item.question}</span>
                  <motion.div
                    animate={{ rotate: openFAQ === index ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFAQ === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="px-5 pb-5 text-gray-400 leading-relaxed text-sm">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-8 px-4 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-400 mb-4">Need more details?</p>
          <Link to="/docs" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors">
            <BookOpen className="w-4 h-4" />
            View Full Documentation
          </Link>
        </div>
      </section>

      {/* Floating CTA for Mobile */}
      <div className="fixed bottom-24 left-4 right-4 z-40 md:hidden">
        <Link to="/chat">
          <Button className="w-full py-4 text-base font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 hover:from-blue-600 hover:via-purple-600 hover:to-blue-600 shadow-2xl shadow-blue-500/30 rounded-xl">
            <MessageSquare className="w-5 h-5 mr-2" />
            Chat with Poly - Free Now
          </Button>
        </Link>
      </div>

      <Footer />
    </div>
  );
};

export default About;
