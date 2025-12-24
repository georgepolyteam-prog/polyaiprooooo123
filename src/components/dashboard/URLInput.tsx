import { useState } from 'react';
import { ArrowRight, Search, BarChart3, Zap, Activity, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import polyLogo from '@/assets/poly-logo-new.png';

interface URLInputProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
}

const EXAMPLE_MARKETS = [
  { label: '🏛️ Fed Chair', url: 'https://polymarket.com/event/who-will-trump-nominate-as-fed-chair' },
  { label: '₿ Bitcoin 2025', url: 'https://polymarket.com/event/what-price-will-bitcoin-hit-in-2025' },
  { label: '🏈 Super Bowl', url: 'https://polymarket.com/event/super-bowl-champion-2026-731' },
  { label: '🗳️ 2028 Election', url: 'https://polymarket.com/event/presidential-election-winner-2028' },
];

const FEATURES = [
  { 
    icon: <BarChart3 className="w-6 h-6" />, 
    title: 'Live Order Book', 
    description: 'Real-time bids & asks',
    gradient: 'from-poly-purple to-poly-cyan'
  },
  { 
    icon: <Activity className="w-6 h-6" />, 
    title: 'Trade Feed', 
    description: 'Every trade as it happens',
    gradient: 'from-poly-cyan to-poly-pink'
  },
  { 
    icon: <Zap className="w-6 h-6" />, 
    title: 'Whale Tracking', 
    description: '$10K+ trade alerts',
    gradient: 'from-poly-pink to-poly-purple'
  },
];

// Cyber particles
function CyberParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(25)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? 'hsl(var(--poly-purple))' : i % 3 === 1 ? 'hsl(var(--poly-cyan))' : 'hsl(var(--poly-pink))',
            boxShadow: i % 3 === 0 ? '0 0 8px hsl(var(--poly-purple))' : i % 3 === 1 ? '0 0 8px hsl(var(--poly-cyan))' : '0 0 8px hsl(var(--poly-pink))',
          }}
          animate={{
            y: [0, -60, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 5 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 4,
          }}
        />
      ))}
    </div>
  );
}

export function URLInput({ onSubmit, isLoading }: URLInputProps) {
  const [url, setUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 pt-8 md:pt-0 relative overflow-hidden">
      <CyberParticles />
      
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-poly-purple/20 rounded-full blur-[150px] animate-pulse-soft" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-poly-cyan/15 rounded-full blur-[150px] animate-pulse-soft" />
      
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10 relative"
      >
        <motion.div 
          className="flex items-center justify-center gap-4 mb-6"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-poly-purple via-poly-cyan to-poly-pink rounded-2xl blur-xl opacity-50 animate-pulse-soft" />
            <img 
              src={polyLogo} 
              alt="Polymarket" 
              className="relative w-16 h-16 object-contain drop-shadow-2xl" 
            />
          </div>
          <div className="text-left">
            <h1 className="text-4xl md:text-5xl font-bold gradient-text-animated">
              Market Dashboard
            </h1>
            <p className="text-lg text-muted-foreground flex items-center gap-2 flex-wrap">
              <Sparkles className="w-4 h-4 text-poly-cyan" />
              <span>Powered by{" "}
                <a 
                  href="https://polymarket.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-foreground/80 hover:text-foreground hover:underline transition-colors font-medium"
                >
                  Polymarket
                </a>
                {" & "}
                <a 
                  href="https://domeapi.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-foreground/80 hover:text-foreground hover:underline transition-colors font-medium"
                >
                  DOME
                </a>
                <span className="text-muted-foreground/70"> (</span>
                <a 
                  href="https://domeapi.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-poly-cyan underline underline-offset-2 decoration-poly-cyan/50 hover:decoration-poly-cyan transition-colors"
                >
                  domeapi.io
                </a>
                <span className="text-muted-foreground/70">)</span>
              </span>
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Premium Input Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-2xl relative"
      >
        {/* Outer glow on focus */}
        <div className={`absolute -inset-1 rounded-3xl bg-gradient-to-r from-poly-purple via-poly-cyan to-poly-pink opacity-0 blur-lg transition-opacity duration-500 ${isFocused ? 'opacity-50' : ''}`} />
        
        <div className="relative glass-card rounded-2xl p-8 border border-border/30">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Search className="w-4 h-4 text-poly-cyan" />
              <span>Paste a Polymarket URL to analyze</span>
            </div>
            
            <div className="flex gap-3">
              <div className="relative flex-1 group">
                <div className={`absolute -inset-0.5 rounded-xl bg-gradient-to-r from-poly-purple to-poly-cyan opacity-0 blur transition-opacity duration-300 ${isFocused ? 'opacity-30' : 'group-hover:opacity-20'}`} />
                <Input
                  type="url"
                  placeholder="https://polymarket.com/event/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="relative h-14 text-lg bg-card/80 border-border/50 focus:border-poly-purple/50 focus:ring-2 focus:ring-poly-purple/20 rounded-xl transition-all"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                size="lg"
                className="h-14 px-8 bg-gradient-to-r from-poly-purple to-poly-cyan hover:opacity-90 text-white border-0 rounded-xl shadow-glow transition-all duration-300 hover:shadow-glow-lg"
                disabled={!url.trim() || isLoading}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-6 h-6" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>

      {/* Example Markets */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center justify-center gap-3 mt-8"
      >
        <span className="text-sm text-muted-foreground">Or try:</span>
        {EXAMPLE_MARKETS.map((market, i) => (
          <motion.div
            key={market.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          >
            <Button
              variant="outline"
              size="default"
              onClick={() => onSubmit(market.url)}
              className="rounded-full border-border/50 hover:border-poly-purple/50 hover:bg-poly-purple/10 transition-all min-h-[44px] px-4"
              disabled={isLoading}
            >
              {market.label}
            </Button>
          </motion.div>
        ))}
      </motion.div>

      {/* Feature Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16 w-full max-w-4xl"
      >
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="glass-card-hover rounded-xl p-6 text-center group cursor-pointer border border-border/30"
          >
            <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 group-hover:shadow-glow transition-all duration-300`}>
              <div className="text-white">{feature.icon}</div>
            </div>
            <h3 className="font-semibold text-lg mb-1 group-hover:gradient-text transition-all">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
