import React, { forwardRef } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut } from 'lucide-react';

export const ConnectWallet = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function ConnectWallet(props, ref) {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { open } = useWeb3Modal();

    if (isConnected && address) {
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
            onClick={() => disconnect()}
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
          onClick={() => open()}
          size="sm"
          className="gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium px-4"
        >
          <Wallet className="w-4 h-4" />
          <span>Connect Wallet</span>
        </Button>
      </div>
    );
  }
);
