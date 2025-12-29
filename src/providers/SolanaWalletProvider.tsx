import { useMemo, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Use Helius RPC via our edge function proxy to avoid rate limits
const HELIUS_RPC_PROXY = `https://rgmzmtsgpxxzxvdcwsdx.supabase.co/functions/v1/solana-rpc`;

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider = ({ children }: SolanaWalletProviderProps) => {
  const endpoint = useMemo(() => HELIUS_RPC_PROXY, []);
  
  // Explicitly register wallets for reliable click handling in the modal
  // The "registered as Standard Wallet" warning is informational and harmless
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
