import { useNavigate } from "react-router-dom";
import { User, Wallet, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";

interface AuthGateProps {
  onWalletConnect?: () => void;
}

export const AuthGate = ({ onWalletConnect }: AuthGateProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full">
        {/* Clean white card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <User className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Sign in to continue
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Create an account or connect your wallet to access Poly AI
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 text-sm">Protected from bots & abuse</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <Zap className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 text-sm">Unlimited market analysis</span>
            </div>
          </div>

          {/* Auth Options */}
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/auth")}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl flex items-center justify-center gap-2"
            >
              <User className="w-5 h-5" />
              Sign Up / Login with Email
            </Button>

            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-gray-800 px-3 text-gray-500">or</span>
              </div>
            </div>

            <div className="w-full [&>div]:w-full [&>div>button]:w-full [&>div>button]:h-12 [&>div>button]:rounded-xl [&>div>button]:bg-gray-100 [&>div>button]:dark:bg-gray-700 [&>div>button]:text-gray-900 [&>div>button]:dark:text-white [&>div>button]:border-gray-200 [&>div>button]:dark:border-gray-600 [&>div>button]:hover:bg-gray-200 [&>div>button]:dark:hover:bg-gray-600">
              <ConnectWallet />
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-gray-400 text-xs mt-4 text-center">
          Your data is secure. We never share your information.
        </p>
      </div>
    </div>
  );
};
