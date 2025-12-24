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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect()}
            className="text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg p-2"
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
          className="gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white border-0 shadow-lg shadow-emerald-500/25"
        >
          <Wallet className="w-4 h-4" />
          <span>Connect</span>
        </Button>
      </div>
    );
  }
);
