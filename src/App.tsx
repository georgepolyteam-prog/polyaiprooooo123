import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { WalletProvider } from "@/contexts/WalletContext";
import { useUserPresence } from "@/hooks/useUserPresence";
import { HighTrafficBanner } from "@/components/HighTrafficBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { WhaleTicker } from "@/components/WhaleTicker";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import BuilderStats from "./pages/BuilderStats";
import WalletProfile from "./pages/WalletProfile";
import MyTrades from "./pages/MyTrades";
import Markets from "./pages/Markets";
import LiveTrades from "./pages/LiveTrades";
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

const AppContent = () => {
  const { isHighTraffic } = useUserPresence();

  return (
    <>
      <WhaleTicker />
      <HighTrafficBanner isVisible={isHighTraffic} />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/chat" element={<Index />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/trades" element={<LiveTrades />} />
          <Route path="/live-trades" element={<LiveTrades />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/builders" element={<BuilderStats />} />
          <Route path="/my-trades" element={<MyTrades />} />
          <Route path="/wallet/:address" element={<WalletProfile />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/help" element={<Help />} />
          <Route path="/status" element={<Status />} />
          <Route path="/about" element={<About />} />
          <Route path="/capabilities" element={<Capabilities />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/adminpanel" element={<AdminPanel />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <MobileBottomNav />
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <WalletProvider>
    <ThemeProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </ThemeProvider>
  </WalletProvider>
);

export default App;
