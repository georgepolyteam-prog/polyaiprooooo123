import { createContext, useContext, ReactNode } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi';
import { WagmiProvider } from 'wagmi';
import { polygon, mainnet, arbitrum, base, optimism } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sonic } from '@/config/sonic';

const projectId = '464ba42d23229961a826ee14993721ec';

const metadata = {
  name: 'PolyAI',
  description: 'AI Analyst for Polymarket & Pandora',
  url: 'https://polyai.pro',
  icons: ['https://polyai.pro/extension/icon128.png']
};

// Support common networks to avoid "unsupported network" error
// Trading features will prompt to switch to Polygon or Sonic as needed
const chains = [polygon, mainnet, arbitrum, base, optimism, sonic] as const;

const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  enableCoinbase: false,
  enableInjected: true,
  enableWalletConnect: true,
});

createWeb3Modal({
  wagmiConfig,
  projectId,
  enableAnalytics: false,
  enableOnramp: false,
  themeMode: 'dark',
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18', // Zerion
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

interface WalletContextType {
  projectId: string;
}

const WalletContext = createContext<WalletContextType>({ projectId });

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletContext.Provider value={{ projectId }}>
          {children}
        </WalletContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
