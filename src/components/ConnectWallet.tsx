import React, { forwardRef } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ConnectWallet = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function ConnectWallet(props, ref) {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { open } = useWeb3Modal();

    if (isConnected && address) {
      return (
        <div ref={ref} className="flex items-center gap-2" {...props}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-sm">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <span className="text-sm font-semibold text-emerald-400">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect()}
            className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl p-2 h-auto transition-all"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      );
    }

    return (
      <div ref={ref} {...props}>
        <button
          type="button"
          onClick={() => open()}
          className={cn(
            "relative group flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm",
            "bg-gradient-to-r from-primary via-emerald-500 to-primary bg-[length:200%_100%]",
            "text-primary-foreground shadow-lg shadow-primary/25",
            "hover:shadow-primary/40 hover:shadow-xl",
            "transition-all duration-300 ease-out",
            "animate-gradient-x"
          )}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary via-emerald-500 to-primary opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300" />
          
          {/* Animated border */}
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-primary via-white/50 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-full h-full rounded-xl bg-gradient-to-r from-primary via-emerald-500 to-primary" />
          </div>
          
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <Wallet className="w-4 h-4" />
              <Zap className="absolute -top-1 -right-1 w-2.5 h-2.5 text-yellow-300 animate-pulse" />
            </div>
            <span>Connect Wallet</span>
          </div>
        </button>
      </div>
    );
  }
);
