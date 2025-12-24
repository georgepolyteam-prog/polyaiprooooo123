import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectWallet } from "@/components/ConnectWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import polyLogo from "@/assets/poly-logo-new.png";

const Auth = () => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  
  const [step, setStep] = useState<"choose" | "email">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if wallet connected
  useEffect(() => {
    if (isConnected) {
      navigate("/");
    }
  }, [isConnected, navigate]);

  // Check for existing session
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

  const handleBack = () => {
    if (step === "email") {
      setStep("choose");
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            toast.error("This email is already registered. Try logging in.");
            setIsLogin(true);
          } else {
            throw error;
          }
          setIsLoading(false);
          return;
        }
        if (data.session) {
          toast.success("Account created!");
          navigate("/");
          return;
        }
        if (data.user) {
          toast.success("Check your email to confirm your account");
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
