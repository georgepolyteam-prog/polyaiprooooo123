import { useMemo, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Use Helius RPC via our edge function proxy to avoid rate limits
const HELIUS_RPC_PROXY = `https://rgmzmtsgpxxzxvdcwsdx.supabase.co/functions/v1/solana-rpc`;

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider = ({ children }: SolanaWalletProviderProps) => {
  const endpoint = useMemo(() => HELIUS_RPC_PROXY, []);
  
  // Use empty array - wallets auto-register via Standard Wallet adapter
  // This removes the "Phantom was registered as Standard Wallet" warning
  const wallets = useMemo(() => [], []);

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
