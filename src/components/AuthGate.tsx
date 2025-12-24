import { useNavigate } from "react-router-dom";
import { User, Wallet, Sparkles, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";
import polyLogo from "@/assets/poly-logo-new.png";

interface AuthGateProps {
  onWalletConnect?: () => void;
}

export const AuthGate = ({ onWalletConnect }: AuthGateProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo with glow */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full blur-2xl opacity-50 animate-pulse" />
            
            {/* Main logo container */}
            <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <img src={polyLogo} alt="Poly" className="w-14 h-14 object-contain" />
            </div>
            
            {/* Lock indicator */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full border-4 border-[#0f0a1f] flex items-center justify-center">
              <Lock className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Sign in to Chat
        </h2>
        <p className="text-gray-400 mb-8 text-sm md:text-base">
          Create an account or connect your wallet to access Poly AI
        </p>

        {/* Benefits */}
        <div className="flex flex-col gap-2 mb-8 text-left">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <Shield className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <span className="text-gray-300 text-sm">Protected from bots & abuse</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <Sparkles className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <span className="text-gray-300 text-sm">Unlimited market analysis</span>
          </div>
        </div>

        {/* Auth Options */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate("/auth")}
            className="w-full h-12 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25"
          >
            <User className="w-5 h-5" />
            Sign Up / Login with Email
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#0f0a1f] px-3 text-gray-500">or</span>
            </div>
          </div>

          <div className="w-full [&>div]:w-full [&>div>button]:w-full [&>div>button]:h-12 [&>div>button]:rounded-xl [&>div>button]:border-white/20 [&>div>button]:bg-white/5 [&>div>button]:hover:bg-white/10 [&>div>button]:transition-all [&>div>button]:duration-300">
            <ConnectWallet />
          </div>
        </div>

        {/* Footer note */}
        <p className="text-gray-500 text-xs mt-6">
          Your data is secure. We never share your information.
        </p>
      </div>
    </div>
  );
};
