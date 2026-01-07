import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { WalletProvider } from "@/contexts/WalletContext";
import { SolanaWalletProvider } from "@/providers/SolanaWalletProvider";
import { useUserPresence } from "@/hooks/useUserPresence";
import { HighTrafficBanner } from "@/components/HighTrafficBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import BuilderStats from "./pages/BuilderStats";
import WalletProfile from "./pages/WalletProfile";
import MyTrades from "./pages/MyTrades";
import Markets from "./pages/Markets";
import LiveTrades from "./pages/LiveTrades";
import TrackedWallets from "./pages/TrackedWallets";
import Status from "./pages/Status";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Disclaimer from "./pages/Disclaimer";
import Help from "./pages/Help";
import AdminPanel from "./pages/AdminPanel";
import About from "./pages/About";
import Capabilities from "./pages/Capabilities";
import Documentation from "./pages/Documentation";
import Credits from "./pages/Credits";
import Pandora from "./pages/Pandora";
import Kalshi from "./pages/Kalshi";
import KalshiTerminal from "./pages/KalshiTerminal";
import KalshiDisclaimer from "./pages/KalshiDisclaimer";
import PolymarketTerminal from "./pages/PolymarketTerminal";
import ArbIntelligence from "./pages/ArbIntelligence";
import SportsArbFinder from "./pages/SportsArbFinder";
import Partnerships from "./pages/Partnerships";

const AppContent = () => {
  const { isHighTraffic } = useUserPresence();
  const location = useLocation();
  
  // Hide main sidebar on terminal pages (they have their own sidebar)
  const isTerminalRoute = location.pathname === '/terminal' || 
                          location.pathname === '/kalshi-terminal';

  return (
    <>
      <HighTrafficBanner isVisible={isHighTraffic} />
      <Toaster />
      <Sonner />
      <div className="min-h-screen flex w-full">
        {/* Desktop Sidebar - Hide on terminal routes */}
        {!isTerminalRoute && <AppSidebar />}
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0">
          <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/chat" element={<Index />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/trades" element={<LiveTrades />} />
              <Route path="/live-trades" element={<LiveTrades />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/builders" element={<BuilderStats />} />
              <Route path="/my-trades" element={<MyTrades />} />
              <Route path="/tracked-wallets" element={<TrackedWallets />} />
              <Route path="/wallet/:address" element={<WalletProfile />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/disclaimer" element={<Disclaimer />} />
              <Route path="/help" element={<Help />} />
              <Route path="/status" element={<Status />} />
              <Route path="/about" element={<About />} />
              <Route path="/capabilities" element={<Capabilities />} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/credits" element={<Credits />} />
              <Route path="/pandora" element={<Pandora />} />
              <Route path="/kalshi" element={<Kalshi />} />
              <Route path="/kalshi-disclaimer" element={<KalshiDisclaimer />} />
              <Route path="/terminal" element={<PolymarketTerminal />} />
              <Route path="/kalshi-terminal" element={<KalshiTerminal />} />
              <Route path="/partnerships" element={<Partnerships />} />
              <Route path="/arb" element={<ArbIntelligence />} />
              <Route path="/sports-arb" element={<SportsArbFinder />} />
              <Route path="/adminpanel" element={<AdminPanel />} />
              <Route path="/adminpanel" element={<AdminPanel />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
        {!isTerminalRoute && <MobileBottomNav />}
    </>
  );
};

const App = () => (
  <SolanaWalletProvider>
    <WalletProvider>
      <ThemeProvider>
        <TooltipProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </WalletProvider>
  </SolanaWalletProvider>
);

export default App;
