import { Link } from "react-router-dom";
import { Mail, Wallet, ArrowRight, Coins } from "lucide-react";

interface AuthGateInlineProps {
  variant?: 'compact' | 'full';
}

export const AuthGateInline = ({ variant = 'full' }: AuthGateInlineProps) => {
  // Compact variant for mobile - just a button
  if (variant === 'compact') {
    return (
      <Link 
        to="/auth?step=email"
        className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors"
      >
        <Mail className="w-4 h-4" />
        <span>Sign in with Email</span>
        <ArrowRight className="w-4 h-4 ml-1" />
      </Link>
    );
  }

  // Full variant for desktop
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Clean white card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        {/* Header */}
        <div className="text-center mb-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Sign in to chat
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Email required to access AI-powered analysis
          </p>
        </div>

        {/* Email Sign In Button */}
        <Link 
          to="/auth?step=email"
          className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
        >
          <Mail className="w-4 h-4" />
          <span>Continue with Email</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>

        {/* Why email explanation */}
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            How it works
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Mail className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Email to Chat</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Required for AI analysis & credits</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Coins className="w-3 h-3 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Phantom for Deposits</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Send POLY tokens to add credits</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Wallet className="w-3 h-3 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Polygon Wallet to Trade</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Connect any wallet on Polygon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="text-gray-400 text-xs mt-4 text-center">
          Powered by POLY tokens
        </p>
      </div>
    </div>
  );
};
