import { Link } from "react-router-dom";
import { Wallet, Mail, ArrowRight } from "lucide-react";
import { ConnectWallet } from "./ConnectWallet";

export const AuthGateInline = () => {
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Clean white card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Sign in to chat
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Connect to access AI-powered market analysis
          </p>
        </div>

        {/* Auth Options - Two columns on larger screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Wallet Option */}
          <div className="relative">
            <div className="[&>div]:w-full [&>div>button]:w-full [&>div>button]:h-12 [&>div>button]:rounded-xl [&>div>button]:justify-start [&>div>button]:px-4">
              <ConnectWallet />
            </div>
          </div>

          {/* Email Option */}
          <Link 
            to="/auth"
            className="flex items-center gap-3 h-12 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
          >
            <Mail className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Email</span>
            <ArrowRight className="w-4 h-4 text-gray-400 ml-auto" />
          </Link>
        </div>

        {/* Subtle footer */}
        <p className="text-gray-400 text-xs mt-4 text-center">
          Free to use • No credit card required
        </p>
      </div>
    </div>
  );
};
