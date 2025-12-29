import { useMemo, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Use Helius RPC for better reliability
const HELIUS_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=d0f6e13a-6ef9-4d9d-b06e-80ab8e54b60a';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider = ({ children }: SolanaWalletProviderProps) => {
  const endpoint = useMemo(() => HELIUS_RPC_URL, []);
  
  // Empty array - wallets like Phantom auto-register as Standard Wallets
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
