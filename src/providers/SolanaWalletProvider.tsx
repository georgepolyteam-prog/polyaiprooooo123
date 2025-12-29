import { useMemo, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Use public Solana RPC - no API key needed, supports HTTP + WebSocket
const PUBLIC_RPC_URL = 'https://api.mainnet-beta.solana.com';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider = ({ children }: SolanaWalletProviderProps) => {
  const endpoint = useMemo(() => PUBLIC_RPC_URL, []);
  
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
