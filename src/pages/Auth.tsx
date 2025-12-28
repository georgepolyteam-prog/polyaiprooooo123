import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectWallet } from "@/components/ConnectWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import polyLogo from "@/assets/poly-logo-new.png";

// Bot detection: suspicious email patterns
const SUSPICIOUS_EMAIL_PATTERNS = [
  /^test\d+@/i,
  /^user\d+@/i,
  /^temp/i,
  /\+.*\+/,  // Multiple plus signs
  /^[a-z]{20,}@/i,  // Very long random strings
  /@(tempmail|guerrilla|mailinator|throwaway|fakeinbox|trashmail|10minutemail)/i,
];

const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', 'throwaway.email',
  'fakeinbox.com', 'trashmail.com', '10minutemail.com', 'temp-mail.org',
  'getnada.com', 'mohmal.com', 'emailondeck.com', 'dispostable.com'
];

const isDisposableEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
};

const isSuspiciousEmail = (email: string): boolean => {
  return SUSPICIOUS_EMAIL_PATTERNS.some(pattern => pattern.test(email));
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConnected } = useAccount();
  
  // Support ?step=email to go directly to email form
  const initialStep = searchParams.get('step') === 'email' ? 'email' : 'choose';
  const nextUrl = searchParams.get('next') || '/';
  
  const [step, setStep] = useState<"choose" | "email">(initialStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  // Bot protection: rate limiting
  const signupAttempts = useRef<number[]>([]);
  const MAX_ATTEMPTS = 3;
  const RATE_LIMIT_WINDOW = 60000; // 1 minute

  // Check for existing session - only redirect if user has an account session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate(nextUrl);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate(nextUrl);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, nextUrl]);

  const handleBack = () => {
    if (step === "email") {
      setStep("choose");
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const isRateLimited = (): boolean => {
    const now = Date.now();
    // Clean old attempts
    signupAttempts.current = signupAttempts.current.filter(
      time => now - time < RATE_LIMIT_WINDOW
    );
    return signupAttempts.current.length >= MAX_ATTEMPTS;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Bot protection checks for signup
    if (!isLogin) {
      // Check rate limiting
      if (isRateLimited()) {
        toast.error("Too many signup attempts. Please wait a minute.");
        return;
      }
      
      // Check for disposable emails
      if (isDisposableEmail(email)) {
        toast.error("Please use a valid email address, not a temporary one.");
        return;
      }
      
      // Check for suspicious patterns
      if (isSuspiciousEmail(email)) {
        toast.error("This email address appears invalid. Please use your real email.");
        return;
      }
      
      // Track signup attempt
      signupAttempts.current.push(Date.now());
    }
    
    setIsLoading(true);

    const timeout = setTimeout(() => {
      setIsLoading(false);
      toast.error("Request timed out. Please try again.");
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
            toast.error("Invalid email or password");
          } else if (error.message.includes("Email not confirmed")) {
            toast.error("Please verify your email first");
          } else {
            throw error;
          }
          setIsLoading(false);
          return;
        }
        toast.success("Welcome back!");
        navigate(nextUrl);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        clearTimeout(timeout);
        if (error) {
          if (error.message.includes("User already registered")) {
            toast.error("This email is already registered. Try logging in.");
            setIsLogin(true);
          } else {
            throw error;
          }
          setIsLoading(false);
          return;
        }
        // With auto-confirm enabled, user should have a session immediately
        if (data.session) {
          toast.success("Account created!");
          navigate(nextUrl);
          return;
        }
        // Fallback: if somehow no session but user exists, still redirect
        if (data.user) {
          toast.success("Account created!");
          navigate(nextUrl);
        }
      }
    } catch (error: any) {
      clearTimeout(timeout);
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <img src={polyLogo} alt="Poly" className="w-8 h-8" />
          <span className="font-semibold text-gray-900 dark:text-white">Poly AI</span>
        </div>
        <div className="w-16" />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Auth Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Card Header */}
            <div className="p-8 text-center border-b border-gray-100 dark:border-gray-700">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <img src={polyLogo} alt="Poly" className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                {step === "choose" ? "Welcome to Poly AI" : isLogin ? "Welcome back" : "Create account"}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {step === "choose" 
                  ? "AI-powered prediction market analysis"
                  : isLogin 
                    ? "Sign in to continue" 
                    : "Sign up to get started"
                }
              </p>
            </div>

            {/* Card Body */}
            <div className="p-8">
              {step === "choose" ? (
                <div className="space-y-4">
                  {/* Wallet Option */}
                  <div className="[&>div]:w-full [&>div>button]:w-full [&>div>button]:h-14 [&>div>button]:rounded-xl [&>div>button]:text-base [&>div>button]:font-medium">
                    <ConnectWallet />
                  </div>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white dark:bg-gray-800 px-3 text-gray-500">or</span>
                    </div>
                  </div>

                  {/* Email Option */}
                  <Button
                    onClick={() => setStep("email")}
                    variant="outline"
                    className="w-full h-14 rounded-xl text-base font-medium border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <Mail className="w-5 h-5 mr-2" />
                    Continue with Email
                  </Button>

                  {/* Features */}
                  <div className="pt-6 space-y-3">
                    {[
                      "Real-time market analysis",
                      "AI-powered predictions",
                      "Deep research with sources"
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <Check className="w-4 h-4 text-green-500" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-10 h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium mt-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isLogin ? (
                      "Sign In"
                    ) : (
                      "Create Account"
                    )}
                  </Button>

                  {/* Toggle Login/Signup */}
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {isLogin ? "Sign up" : "Sign in"}
                    </button>
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
