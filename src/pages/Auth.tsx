import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PolyLogo } from "@/components/PolyLogo";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useAccount } from 'wagmi';
import { usePolyPrice } from "@/hooks/usePolyPrice";
import { 
  Loader2, 
  Wallet, 
  Mail, 
  ArrowLeft,
  Sparkles, 
  Check,
  Copy,
  ExternalLink,
  Zap,
  Shield,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CONTRACT_ADDRESS = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";
const LAUNCH_DATE = new Date('2026-01-06T00:00:00Z');

const features = [
  { icon: <BarChart3 className="w-4 h-4" />, text: "AI Market Analysis" },
  { icon: <TrendingUp className="w-4 h-4" />, text: "Whale Tracking" },
  { icon: <Shield className="w-4 h-4" />, text: "Smart Alerts" },
];

const Auth = () => {
  const [step, setStep] = useState<'wallet' | 'email'>('wallet');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const { data: priceData, isLoading: priceLoading } = usePolyPrice(30000);

  // Redirect if already authenticated with wallet
  useEffect(() => {
    if (isConnected && address) {
      navigate("/");
    }
  }, [isConnected, address, navigate]);

  // Also check Supabase session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = LAUNCH_DATE.getTime() - now.getTime();
      
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown({ days, hours, minutes });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  const copyContract = async () => {
    await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    toast({ title: "Copied!", description: "Contract address copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPrice = (price: number) => {
    if (price < 0.0001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    return price.toFixed(4);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Timeout fallback - prevent endless loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Request timed out",
        description: "Please try again. If this persists, refresh the page.",
        variant: "destructive",
      });
    }, 15000);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        clearTimeout(timeout);

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Login Failed",
              description: "Invalid email or password. Don't have an account? Switch to Sign Up below.",
              variant: "destructive",
            });
          } else if (error.message.includes("Email not confirmed")) {
            toast({
              title: "Email Not Verified",
              description: "Please check your email and verify your account first.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          setIsLoading(false);
          return;
        }

        toast({ title: "Welcome back!", description: "Successfully logged in." });
        setIsLoading(false);
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        clearTimeout(timeout);

        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Account Exists",
              description: "This email is already registered. Try logging in instead.",
              variant: "destructive",
            });
            setIsLogin(true);
          } else {
            throw error;
          }
          setIsLoading(false);
          return;
        }

        // If we got a session, we can navigate immediately.
        if (data.session) {
          toast({
            title: "Account created!",
            description: "You're in — taking you to chat.",
          });
          setIsLoading(false);
          navigate("/");
          return;
        }

        // Email confirmation required
        if (data.user) {
          toast({
            title: "Check your email!",
            description: "We sent you a confirmation link. Click it to complete signup.",
          });
          setIsLoading(false);
          return;
        }

        // Fallback
        toast({
          title: "Signup started",
          description: "Please try logging in if you don't get redirected.",
        });
        setIsLoading(false);
      }
    } catch (error: any) {
      clearTimeout(timeout);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[180px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Back Button - Fixed Top */}
      <div className="fixed top-4 left-4 z-50">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={handleBack}
          className="group flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">Back</span>
        </motion.button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row relative z-10">
        {/* Left Side - Auth Form */}
        <div className="flex-1 flex items-center justify-center p-6 pt-20 lg:pt-6 lg:p-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            {/* Logo with glow */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full blur-2xl opacity-30" />
                <PolyLogo size="lg" showText className="justify-center relative" />
              </div>
            </div>

            {/* Free Beta Banner */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-6"
            >
              <div className="relative">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500/50 to-cyan-500/50 rounded-full blur-sm" />
                <div className="relative flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0a0a0a] border border-emerald-500/30 rounded-full">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-full" />
                  <Sparkles className="w-4 h-4 text-emerald-400 relative" />
                  <span className="text-emerald-400 font-semibold text-sm relative">FREE BETA</span>
                  <div className="w-px h-4 bg-white/10 relative" />
                  <Link to="/about" className="text-gray-400 text-sm relative hover:text-purple-400 transition-colors">Learn more →</Link>
                </div>
              </div>
            </motion.div>

            {/* Feature pills - Mobile only */}
            <div className="flex flex-wrap justify-center gap-2 mb-6 lg:hidden">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400"
                >
                  <span className="text-purple-400">{feature.icon}</span>
                  {feature.text}
                </motion.div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 'wallet' ? (
                <motion.div
                  key="wallet-step"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-5"
                >
                  {/* Wallet Connection Card */}
                  <div className="relative group">
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl opacity-50 group-hover:opacity-75 transition-opacity blur-sm" />
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl opacity-75" />
                    <div className="relative bg-[#0f0a1f] rounded-2xl p-6 space-y-4">
                      <div className="text-center">
                        <div className="relative inline-block mb-3">
                          <div className="absolute inset-0 bg-purple-500/30 rounded-full blur-xl" />
                          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
                            <Wallet className="w-8 h-8 text-purple-400" />
                          </div>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Connect Wallet</h2>
                        <p className="text-gray-500 text-sm">
                          Recommended for full access
                        </p>
                      </div>
                      <ConnectWallet />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <span className="text-gray-600 text-xs font-medium px-2">or</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>

                  {/* Email Option */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep('email')}
                    className="w-full group relative"
                  >
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/50 to-pink-500/50 rounded-xl opacity-0 group-hover:opacity-50 transition-opacity" />
                    <div className="relative flex items-center justify-center gap-3 px-4 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-gray-300 hover:text-white transition-all">
                      <Mail className="w-5 h-5 text-cyan-400" />
                      <span className="font-medium">Continue with email</span>
                    </div>
                  </motion.button>

                  {/* Learn Link */}
                  <Link 
                    to="/about" 
                    className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-purple-400 transition-colors group"
                  >
                    <Zap className="w-3 h-3" />
                    Learn about $POLY
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              ) : (
                <motion.div
                  key="email-step"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Email Form Card */}
                  <div className="relative">
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500 to-pink-500 rounded-2xl opacity-50" />
                    <div className="relative bg-[#0f0a1f] rounded-2xl p-6">
                      <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div className="text-center mb-4">
                          <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-cyan-500/30 flex items-center justify-center mb-3">
                            <Mail className="w-6 h-6 text-cyan-400" />
                          </div>
                          <h2 className="text-xl font-bold text-white">
                            {isLogin ? "Welcome back" : "Create account"}
                          </h2>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="email" className="text-gray-400 text-sm">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-white/5 border-white/10 focus:border-cyan-500/50 rounded-xl h-12 text-white placeholder:text-gray-600"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="password" className="text-gray-400 text-sm">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="bg-white/5 border-white/10 focus:border-cyan-500/50 rounded-xl h-12 text-white placeholder:text-gray-600"
                          />
                        </div>

                        <Button 
                          type="submit" 
                          className="w-full rounded-xl h-12 bg-gradient-to-r from-cyan-600 to-pink-600 hover:from-cyan-500 hover:to-pink-500 text-white font-semibold border-0 shadow-lg shadow-cyan-500/25" 
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : isLogin ? (
                            "Sign in"
                          ) : (
                            "Create account"
                          )}
                        </Button>

                        <button
                          type="button"
                          onClick={() => setIsLogin(!isLogin)}
                          className="w-full text-center text-sm text-gray-500 hover:text-white transition-colors py-1"
                        >
                          {isLogin ? "Need an account? Sign up" : "Have an account? Sign in"}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Back to Wallet */}
                  <motion.button
                    whileHover={{ x: -3 }}
                    onClick={() => setStep('wallet')}
                    className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to wallet options
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Right Side - POLY Info Panel (Desktop Only) */}
        <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-[#0f0a1f] to-cyan-900/20" />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />

          {/* Floating orbs */}
          <motion.div 
            animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/30 rounded-full blur-3xl"
          />
          <motion.div 
            animate={{ y: [0, 15, 0], x: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl"
          />
          <motion.div 
            animate={{ y: [0, -10, 0], x: [0, -10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-1/2 right-1/3 w-24 h-24 bg-pink-500/20 rounded-full blur-2xl"
          />

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="relative z-10 max-w-md p-8"
          >
            {/* Header Badge */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 px-4 py-2 rounded-full mb-6"
            >
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 font-semibold text-sm">$POLY Token</span>
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-3xl font-bold text-white mb-3"
            >
              Power Your
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Predictions
              </span>
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-gray-400 leading-relaxed mb-8"
            >
              $POLY is the utility token for Poly. After launch, you'll use $POLY to access AI chat, market analysis, and trading features.
            </motion.p>

            {/* Features */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-2 mb-8"
            >
              {features.map((feature, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300"
                >
                  <span className="text-purple-400">{feature.icon}</span>
                  {feature.text}
                </div>
              ))}
            </motion.div>

            {/* Stats Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="relative group"
            >
              <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500/30 to-cyan-500/30 rounded-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Price</p>
                    <p className="text-white font-mono font-semibold">
                      {priceLoading ? '...' : `$${formatPrice(priceData?.price || 0)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">24h</p>
                    <p className={`font-semibold ${(priceData?.priceChange24h || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {priceLoading ? '...' : `${(priceData?.priceChange24h || 0) >= 0 ? '+' : ''}${(priceData?.priceChange24h || 0).toFixed(2)}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">MCap</p>
                    <p className="text-white font-mono font-semibold">
                      {priceLoading ? '...' : formatNumber(priceData?.marketCap || 0)}
                    </p>
                  </div>
                </div>

                {/* Contract */}
                <div className="pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500 text-xs">Contract</span>
                    <button
                      onClick={copyContract}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-gray-400 truncate">
                    {CONTRACT_ADDRESS}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Launch Countdown */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-6 text-center py-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-2xl"
            >
              <p className="text-gray-500 text-xs mb-1">Payments launch in</p>
              <div className="flex items-center justify-center gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{countdown.days}</p>
                  <p className="text-[10px] text-gray-500">DAYS</p>
                </div>
                <span className="text-white/30">:</span>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{countdown.hours}</p>
                  <p className="text-[10px] text-gray-500">HRS</p>
                </div>
                <span className="text-white/30">:</span>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{countdown.minutes}</p>
                  <p className="text-[10px] text-gray-500">MIN</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Mobile Footer - POLY Info */}
      <div className="lg:hidden p-4 border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm relative z-10">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <span className="text-gray-400 text-xs">$POLY</span>
              <p className="text-white font-mono text-sm">
                {priceLoading ? '...' : `$${formatPrice(priceData?.price || 0)}`}
              </p>
            </div>
          </div>
          <Link 
            to="/about" 
            className="flex items-center gap-1 text-purple-400 text-xs hover:text-purple-300 transition-colors"
          >
            Learn more
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
