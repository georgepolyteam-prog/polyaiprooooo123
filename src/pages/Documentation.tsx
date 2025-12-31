import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { Footer } from '@/components/Footer';
import {
  MessageSquare,
  BarChart3,
  TrendingUp,
  Wallet,
  BookOpen,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Zap,
  Globe,
  Database,
  Shield,
  Users,
  Activity,
  Target,
  Coins,
  FileText,
  ExternalLink,
  Lightbulb,
  ArrowUp,
  Menu,
  X,
  Flame,
  Wrench,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  subsections?: { id: string; title: string }[];
}

const sections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <Zap className="w-4 h-4" />,
    subsections: [
      { id: 'quick-start', title: 'Quick Start Guide' },
      { id: 'account-setup', title: 'Account Setup' },
      { id: 'interface-overview', title: 'Interface Overview' },
    ]
  },
  {
    id: 'ai-chat',
    title: 'AI Chat Assistant',
    icon: <MessageSquare className="w-4 h-4" />,
    subsections: [
      { id: 'basic-usage', title: 'Basic Usage' },
      { id: 'market-analysis', title: 'Market Analysis' },
      { id: 'deep-research', title: 'Polyfactual Deep Research' },
      { id: 'tips-best-practices', title: 'Tips & Best Practices' },
    ]
  },
  {
    id: 'market-data',
    title: 'Market Data',
    icon: <BarChart3 className="w-4 h-4" />,
    subsections: [
      { id: 'understanding-odds', title: 'Understanding Odds' },
      { id: 'volume-liquidity', title: 'Volume & Liquidity' },
      { id: 'whale-tracking', title: 'Whale Tracking' },
      { id: 'orderbook-analysis', title: 'Orderbook Analysis' },
    ]
  },
  {
    id: 'trading',
    title: 'Trading',
    icon: <Wallet className="w-4 h-4" />,
    subsections: [
      { id: 'connecting-wallet', title: 'Connecting Your Wallet' },
      { id: 'viewing-positions', title: 'Viewing Positions' },
      { id: 'order-management', title: 'Order Management' },
      { id: 'trade-history', title: 'Trade History' },
    ]
  },
  {
    id: 'live-data',
    title: 'Live Data',
    icon: <Activity className="w-4 h-4" />,
    subsections: [
      { id: 'realtime-trades', title: 'Real-time Trades' },
      { id: 'market-heatmap', title: 'Market Heatmap' },
      { id: 'top-traders', title: 'Top Traders' },
    ]
  },
  {
    id: 'poly-token',
    title: '$POLY Token',
    icon: <Coins className="w-4 h-4" />,
    subsections: [
      { id: 'token-utility', title: 'Token Utility' },
      { id: 'payment-system', title: 'Payment System' },
      { id: 'tokenomics', title: 'Tokenomics' },
    ]
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: <HelpCircle className="w-4 h-4" />,
  },
  {
    id: 'legal',
    title: 'Legal',
    icon: <Shield className="w-4 h-4" />,
  },
];

const Documentation = () => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [expandedSections, setExpandedSections] = useState<string[]>(['getting-started']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileNavOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <TopBar />

      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 pb-32 md:pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 px-4 py-2 rounded-full mb-4">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-primary font-medium text-sm">Documentation</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground via-primary to-secondary bg-clip-text text-transparent">
            Poly Documentation
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to know about using Poly for prediction market analysis and trading
          </p>
        </motion.div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-border/50"
            />
          </div>
        </div>

        {/* $POLY Token Hero Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-12"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-background to-secondary/10 border border-primary/20 p-6 md:p-10">
            {/* Animated background orb */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-secondary/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* Content Grid */}
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              {/* Left Side - Token Introduction */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-4">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Powered by $POLY</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  The $POLY token powers everything on this platform
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Every AI analysis, market insight, and trading feature runs on $POLY credits. 
                  <span className="text-foreground font-medium"> 1 POLY = 1 Credit.</span> Simple, transparent, deflationary.
                </p>
                <Link 
                  to="/about" 
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors group"
                >
                  Learn more about $POLY
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              
              {/* Right Side - Tokenomics Split Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* 70% Burned Card */}
                <div className="relative p-5 md:p-6 rounded-2xl bg-background/80 backdrop-blur border border-destructive/20 text-center overflow-hidden group hover:border-destructive/40 transition-all hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-gradient-to-b from-destructive/10 to-transparent opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-destructive/5 to-transparent" />
                  <Flame className="w-7 h-7 text-destructive mx-auto mb-3 relative z-10 group-hover:scale-110 transition-transform" />
                  <div className="text-3xl md:text-4xl font-bold text-foreground mb-1 relative z-10">70%</div>
                  <p className="text-sm text-muted-foreground relative z-10 font-medium">Burned Forever</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 relative z-10">Deflationary mechanism</p>
                </div>
                
                {/* 30% Development Card */}
                <div className="relative p-5 md:p-6 rounded-2xl bg-background/80 backdrop-blur border border-primary/20 text-center overflow-hidden group hover:border-primary/40 transition-all hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
                  <Wrench className="w-7 h-7 text-primary mx-auto mb-3 relative z-10 group-hover:scale-110 transition-transform" />
                  <div className="text-3xl md:text-4xl font-bold text-foreground mb-1 relative z-10">30%</div>
                  <p className="text-sm text-muted-foreground relative z-10 font-medium">Development</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 relative z-10">Platform improvements</p>
                </div>
              </div>
            </div>
            
            {/* Info bar at bottom */}
            <div className="relative mt-8 pt-6 border-t border-border/30 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-destructive" />
                <span>Deflationary tokenomics</span>
              </span>
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">1 POLY = 1 Credit</span>
              </span>
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>No hidden fees</span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* Mobile Nav Toggle */}
        <div className="lg:hidden mb-6">
          <Button
            variant="outline"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Menu className="w-4 h-4" />
              Navigation
            </span>
            {mobileNavOpen ? <X className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 bg-muted/50 rounded-lg border border-border/50 p-4"
            >
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {section.icon}
                  {section.title}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        <div className="flex gap-8">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              {sections.map((section) => (
                <div key={section.id}>
                  <button
                    onClick={() => {
                      scrollToSection(section.id);
                      if (section.subsections) toggleSection(section.id);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors",
                      activeSection === section.id || activeSection.startsWith(section.id)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {section.icon}
                      {section.title}
                    </span>
                    {section.subsections && (
                      expandedSections.includes(section.id)
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {section.subsections && expandedSections.includes(section.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {section.subsections.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => scrollToSection(sub.id)}
                          className={cn(
                            "w-full text-left px-3 py-1.5 rounded text-sm transition-colors",
                            activeSection === sub.id
                              ? "text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {sub.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Getting Started */}
            <section id="getting-started" className="mb-16">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Zap className="w-8 h-8 text-primary" />
                Getting Started
              </h2>

              <div id="quick-start" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Quick Start Guide</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6 space-y-4">
                  <p className="text-muted-foreground">
                    Poly is an AI-powered terminal for analyzing Polymarket prediction markets. Here's how to get started in under 2 minutes:
                  </p>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-semibold">1</span>
                      <span><strong>Connect Your Wallet</strong> - Click the wallet button in the top navigation to connect your Ethereum wallet (MetaMask, WalletConnect, etc.)</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-semibold">2</span>
                      <span><strong>Ask a Question</strong> - Type any question about prediction markets in the chat, or paste a Polymarket URL for instant analysis</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-semibold">3</span>
                      <span><strong>Explore Markets</strong> - Browse trending markets, view live trades, and analyze market data with AI assistance</span>
                    </li>
                  </ol>
                </div>
              </div>

              <div id="account-setup" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Account Setup</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    Poly supports two authentication methods:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary" />
                        Wallet Connection
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Connect your Ethereum wallet to access all features. This also allows you to view your Polymarket positions and execute trades directly.
                      </p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Email Signup
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Create an account with your email for basic access to AI chat and market browsing features.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div id="interface-overview" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Interface Overview</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { icon: MessageSquare, title: 'Chat', desc: 'AI-powered market analysis and Q&A' },
                      { icon: BarChart3, title: 'Markets', desc: 'Browse and discover prediction markets' },
                      { icon: Activity, title: 'Live Trades', desc: 'Real-time trade feed and whale alerts' },
                      { icon: Wallet, title: 'My Trades', desc: 'Your positions, orders, and trade history' },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-lg bg-background/50 border border-border/30">
                        <item.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* AI Chat Section */}
            <section id="ai-chat" className="mb-16">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-primary" />
                AI Chat Assistant
              </h2>

              <div id="basic-usage" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Basic Usage</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    The AI chat is your primary interface for interacting with Poly. You can:
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>Ask questions about any prediction market or topic</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>Paste Polymarket URLs for instant market analysis</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>Request specific data like orderbook depth, whale activity, or price history</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>Get trading recommendations based on market analysis</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div id="market-analysis" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Market Analysis</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    When you share a Polymarket URL or ask about a specific market, Poly provides comprehensive analysis including:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { title: 'Current Odds', desc: 'Real-time probability and price data' },
                      { title: 'Volume Analysis', desc: '24h trading volume and trends' },
                      { title: 'Whale Activity', desc: 'Large trades and smart money movements' },
                      { title: 'Orderbook Depth', desc: 'Bid/ask spread and liquidity analysis' },
                      { title: 'Price History', desc: 'Historical price movements and patterns' },
                      { title: 'AI Insights', desc: 'Synthesized analysis and recommendations' },
                    ].map((item, i) => (
                      <div key={i} className="bg-background/50 rounded-lg p-3 border border-border/30">
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div id="deep-research" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Polyfactual Deep Research</h3>
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/30 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">What is Polyfactual?</h4>
                      <p className="text-muted-foreground mb-4">
                        Polyfactual is our advanced deep research mode that goes beyond basic market data. When enabled, Poly will:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex gap-2">
                          <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                          <span>Search the web for relevant news, articles, and data sources</span>
                        </li>
                        <li className="flex gap-2">
                          <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                          <span>Analyze multiple perspectives and information sources</span>
                        </li>
                        <li className="flex gap-2">
                          <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                          <span>Provide citations and source links for verification</span>
                        </li>
                        <li className="flex gap-2">
                          <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                          <span>Generate more comprehensive and fact-based analysis</span>
                        </li>
                      </ul>
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Tip:</strong> Toggle Polyfactual mode using the button next to the chat input for deeper market research.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div id="tips-best-practices" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Tips & Best Practices</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <div className="grid gap-4">
                    {[
                      { icon: Lightbulb, tip: 'Be specific in your questions for more targeted analysis' },
                      { icon: Target, tip: 'Include the market URL for instant data-rich responses' },
                      { icon: Globe, tip: 'Use Polyfactual mode for complex questions requiring web research' },
                      { icon: TrendingUp, tip: 'Ask about whale activity and smart money for trading signals' },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-lg bg-background/50 border border-border/30">
                        <item.icon className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{item.tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Market Data Section */}
            <section id="market-data" className="mb-16">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-primary" />
                Market Data
              </h2>

              <div id="understanding-odds" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Understanding Odds</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    Polymarket odds represent the market's implied probability of an outcome. Here's how to interpret them:
                  </p>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span><strong>50%</strong> = Market is split, outcome is uncertain</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span><strong>80%+</strong> = Market believes outcome is very likely</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span><strong>20% or below</strong> = Market believes outcome is unlikely</span>
                    </li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-4">
                    Remember: Market odds reflect collective belief, not certainty. Edge opportunities exist when your analysis differs from market consensus.
                  </p>
                </div>
              </div>

              <div id="volume-liquidity" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Volume & Liquidity</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2">Trading Volume</h4>
                      <p className="text-sm text-muted-foreground">
                        Volume indicates how much money has been traded on a market. Higher volume generally means more interest and more reliable price discovery. Look for volume spikes as they often precede major price movements.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Liquidity</h4>
                      <p className="text-sm text-muted-foreground">
                        Liquidity measures how easily you can buy or sell without significantly moving the price. High liquidity means tighter spreads and better execution. Low liquidity markets may have slippage on larger orders.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div id="whale-tracking" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Whale Tracking</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    Poly tracks large trades (whales) to help you understand smart money movements:
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>Trades over $1,000 are highlighted as significant</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>Track wallet addresses of top performers</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>See accumulation patterns before major moves</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div id="orderbook-analysis" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Orderbook Analysis</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    The orderbook shows pending buy and sell orders at different price levels:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30">
                      <h4 className="font-semibold text-emerald-400 mb-2">Bids (Buy Orders)</h4>
                      <p className="text-sm text-muted-foreground">
                        Orders waiting to buy at specific prices. Strong bid support indicates buyers are ready to step in at those levels.
                      </p>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
                      <h4 className="font-semibold text-red-400 mb-2">Asks (Sell Orders)</h4>
                      <p className="text-sm text-muted-foreground">
                        Orders waiting to sell at specific prices. Heavy ask walls may act as resistance for upward price movement.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Trading Section */}
            <section id="trading" className="mb-16">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Wallet className="w-8 h-8 text-primary" />
                Trading
              </h2>

              <div id="connecting-wallet" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Connecting Your Wallet</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    To trade on Polymarket through Poly, you need to connect your Ethereum wallet:
                  </p>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-semibold">1</span>
                      <span className="text-muted-foreground">Click the wallet icon in the top navigation bar</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-semibold">2</span>
                      <span className="text-muted-foreground">Select your wallet provider (MetaMask, WalletConnect, Coinbase Wallet, etc.)</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-semibold">3</span>
                      <span className="text-muted-foreground">Approve the connection in your wallet</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center font-semibold">4</span>
                      <span className="text-muted-foreground">Your Polymarket positions will automatically sync</span>
                    </li>
                  </ol>
                </div>
              </div>

              <div id="viewing-positions" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Viewing Positions</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground">
                    Once connected, navigate to "My Trades" to see your current positions including entry price, current price, unrealized P&L, and position size. Positions update in real-time as market prices change.
                  </p>
                </div>
              </div>

              <div id="order-management" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Order Management</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    Poly supports viewing and managing your open orders:
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>View all pending limit orders</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>See order status and fill progress</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>Cancel unfilled orders</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div id="trade-history" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Trade History</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground">
                    Access your complete trading history including executed trades, realized profits/losses, and historical positions. Use this data to analyze your trading performance and identify patterns.
                  </p>
                </div>
              </div>
            </section>

            {/* Live Data Section */}
            <section id="live-data" className="mb-16">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Activity className="w-8 h-8 text-primary" />
                Live Data
              </h2>

              <div id="realtime-trades" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Real-time Trades</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground">
                    The Live Trades page shows a real-time feed of all trades happening across Polymarket. Filter by market, trade size, or side (buy/sell) to focus on what matters to you. Large trades are highlighted to help you spot whale activity.
                  </p>
                </div>
              </div>

              <div id="market-heatmap" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Market Heatmap</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground">
                    Visualize market activity at a glance with our heatmap feature. See which markets are experiencing the most trading volume and price movement in real-time.
                  </p>
                </div>
              </div>

              <div id="top-traders" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Top Traders</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground">
                    Track the most successful traders on Polymarket. View their performance metrics, trading volume, and recent activity. Learn from the best by analyzing their trading patterns.
                  </p>
                </div>
              </div>
            </section>

            {/* $POLY Token Section */}
            <section id="poly-token" className="mb-16">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Coins className="w-8 h-8 text-primary" />
                $POLY Token
              </h2>

              {/* Token Overview Card */}
              <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-primary/5 via-background to-secondary/5 border border-primary/20">
                <p className="text-muted-foreground leading-relaxed">
                  $POLY is the payment token for accessing Poly platform features. Users deposit $POLY to their account and spend it to use AI chat, trading tools, and market data. The token features deflationary tokenomics where <span className="text-foreground font-medium">70% of spent tokens are permanently burned</span>.
                </p>
                <Link 
                  to="/about" 
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors mt-4 group"
                >
                  View full token details
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div id="token-utility" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Token Utility</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-4">
                    $POLY is the native token of the Poly platform. It powers:
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span><strong className="text-foreground">AI Chat & Analysis</strong> - Every AI-powered market analysis costs 1 credit</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span><strong className="text-foreground">Trading Tools</strong> - Access to orderbook, limit orders, and position tracking</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span><strong className="text-foreground">Premium Features</strong> - Whale tracking, wallet analytics, and advanced data</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div id="payment-system" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Credits System</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    {[
                      { step: "01", title: "Acquire", desc: "Buy POLY on Jupiter, Pump.fun, or OKX Wallet" },
                      { step: "02", title: "Deposit", desc: "Connect your Solana wallet and deposit tokens" },
                      { step: "03", title: "Analyze", desc: "Use credits for AI-powered market insights" },
                    ].map((item, i) => (
                      <div key={i} className="p-4 rounded-xl bg-background/50 border border-border/30">
                        <span className="text-xs font-mono text-primary">{item.step}</span>
                        <h4 className="font-semibold text-foreground mt-1 mb-2">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">1 POLY = 1 Credit</span>
                    <span className="text-sm text-muted-foreground">• No subscription required</span>
                  </div>
                </div>
              </div>

              <div id="tokenomics" className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Tokenomics</h3>
                <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                  <p className="text-muted-foreground mb-6">
                    When users spend $POLY on the platform, tokens are split between burn and development:
                  </p>
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="relative text-center p-6 bg-background/50 rounded-2xl border border-destructive/30 overflow-hidden group hover:border-destructive/50 transition-colors">
                      <div className="absolute inset-0 bg-gradient-to-b from-destructive/10 to-transparent opacity-50" />
                      <Flame className="w-8 h-8 text-destructive mx-auto mb-3 relative z-10" />
                      <p className="text-4xl font-bold text-foreground mb-2 relative z-10">70%</p>
                      <p className="text-sm font-medium text-foreground relative z-10">Permanently Burned</p>
                      <p className="text-xs text-muted-foreground mt-1 relative z-10">Removed from circulation forever, creating deflationary pressure</p>
                    </div>
                    <div className="relative text-center p-6 bg-background/50 rounded-2xl border border-primary/30 overflow-hidden group hover:border-primary/50 transition-colors">
                      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50" />
                      <Wrench className="w-8 h-8 text-primary mx-auto mb-3 relative z-10" />
                      <p className="text-4xl font-bold text-foreground mb-2 relative z-10">30%</p>
                      <p className="text-sm font-medium text-foreground relative z-10">Development Fund</p>
                      <p className="text-xs text-muted-foreground mt-1 relative z-10">Platform improvements, infrastructure, and operational expenses</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/30">
                    <p className="text-sm text-muted-foreground text-center">
                      <span className="text-foreground font-medium">Contract Address:</span>{' '}
                      <code className="bg-background px-2 py-1 rounded text-xs font-mono">982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump</code>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="mb-16">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <HelpCircle className="w-8 h-8 text-primary" />
                Frequently Asked Questions
              </h2>

              <div className="space-y-4">
                {[
                  { q: 'Is Poly free to use?', a: 'Yes, during the beta period all features are completely free. After January 6, 2026, premium features will require $POLY tokens.' },
                  { q: 'Do I need a Polymarket account?', a: 'No, you can browse markets and use AI chat without a Polymarket account. However, to view your positions or trade, you need to connect the same wallet you use on Polymarket.' },
                  { q: 'Is my wallet safe?', a: 'Poly never has access to your private keys. We use standard wallet connection protocols (WalletConnect, MetaMask) that only allow read access to your public data and require your approval for any transactions.' },
                  { q: 'How accurate is the AI analysis?', a: 'Poly AI provides analysis based on real-time market data and web research. However, predictions are not guaranteed. Always do your own research and never trade more than you can afford to lose.' },
                  { q: 'What is the Polymarket Builders Program?', a: 'Poly is an official member of Polymarket\'s Builders Program, which provides direct technical support, marketing collaboration, and access to exclusive builder resources.' },
                  { q: 'How do I get help?', a: 'Visit the Help & Support page to submit a ticket, or reach out on our official X (Twitter) account @trypolyai.' },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl border border-border/50 p-6">
                    <h3 className="font-semibold mb-2">{item.q}</h3>
                    <p className="text-sm text-muted-foreground">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Legal Section */}
            <section id="legal" className="mb-16">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Shield className="w-8 h-8 text-primary" />
                Legal
              </h2>

              <div className="bg-muted/30 rounded-xl border border-border/50 p-6">
                <p className="text-muted-foreground mb-6">
                  Please review our legal documents to understand your rights and responsibilities when using Poly:
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <Link
                    to="/privacy"
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border/30 hover:border-primary/30 transition-colors group"
                  >
                    <span className="font-medium">Privacy Policy</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                  <Link
                    to="/terms"
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border/30 hover:border-primary/30 transition-colors group"
                  >
                    <span className="font-medium">Terms of Service</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                  <Link
                    to="/disclaimer"
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border/30 hover:border-primary/30 transition-colors group"
                  >
                    <span className="font-medium">Disclaimer</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground mt-6 text-center">
                  <strong>Important:</strong> Poly does not provide financial advice. Trading prediction markets involves risk of loss. Only trade what you can afford to lose.
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={scrollToTop}
          className="fixed bottom-28 md:bottom-8 right-4 md:right-8 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center z-50"
        >
          <ArrowUp className="w-5 h-5" />
        </motion.button>
      )}

      <Footer />
    </div>
  );
};

export default Documentation;
