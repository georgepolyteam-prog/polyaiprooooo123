import React, { forwardRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Loader2 } from 'lucide-react';

export const PrivyConnectWallet = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function PrivyConnectWallet(props, ref) {
    const { ready, authenticated, login, logout, user } = usePrivy();
    const { wallets } = useWallets();

    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
    const address = embeddedWallet?.address;

    if (!ready) {
      return (
        <div ref={ref} {...props}>
          <Button size="sm" disabled className="gap-2 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </Button>
        </div>
      );
    }

    if (authenticated && address) {
      return (
        <div ref={ref} className="flex items-center gap-2" {...props}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-2 h-auto"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      );
    }

    return (
      <div ref={ref} {...props}>
        <Button
          onClick={() => login()}
          size="sm"
          className="gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium px-4"
        >
          <Wallet className="w-4 h-4" />
          <span>Connect</span>
        </Button>
      </div>
    );
  }
);
