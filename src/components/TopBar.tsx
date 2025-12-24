import React, { useState } from "react";
import {
  HelpCircle,
  BarChart3,
  MessageSquare,
  Menu,
  X,
  Trophy,
  Copy,
  Check,
  Receipt,
  ChevronDown,
  Wallet,
  Hammer,
  Store,
  Users,
  Info,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { HowItWorksModal } from "./HowItWorksModal";
import { ConnectWallet } from "./ConnectWallet";
import { Link, useLocation } from "react-router-dom";
import polyLogo from "@/assets/poly-logo-new.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// X (Twitter) logo SVG component
const XLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// POLY Token Contract Address
const POLY_CA: string = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";

export const TopBar = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) => {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  const { isConnected, address } = useAccount();

  const isActive = (path: string) => location.pathname === path;

  const copyCA = () => {
    if (POLY_CA === "Coming Soon") {
      toast.info("Token CA coming soon!");
      return;
    }
    navigator.clipboard.writeText(POLY_CA);
    setCopied(true);
    toast.success("CA copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      <header
        ref={ref}
        className="h-16 backdrop-blur-xl bg-black/20 sticky top-0 z-50 border-b border-white/10"
        {...props}
      >
        <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
          {/* Logo & Branding */}
          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity shrink-0">
              <div className="relative">
                <img src={polyLogo} alt="Poly" className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 object-contain" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 bg-emerald-500 rounded-full border-2 border-[#0f0a1f]" />
              </div>

              <div className="flex flex-col">
                <span className="font-bold text-sm sm:text-base lg:text-lg bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent leading-tight">
                  Poly
                </span>
                <span className="text-[8px] sm:text-[10px] lg:text-xs text-muted-foreground leading-tight whitespace-nowrap">
                  Market Terminal
                </span>
              </div>
            </Link>

            {/* Navigation - Desktop: Chat → Markets → My Trades → Dashboard → Leaderboard */}
            <nav className="hidden md:flex items-center gap-1">
              <Link to="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-sm gap-2 rounded-lg transition-all ${
                    isActive("/") || isActive("/chat")
                      ? "text-black bg-white"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </Button>
              </Link>

              {/* Markets Dropdown - includes Dashboard */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-sm gap-2 rounded-lg transition-all ${
                      isActive("/markets") || isActive("/my-trades") || isActive("/dashboard") || isActive("/trades")
                        ? "text-black bg-white"
                        : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    Markets
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-[#1a1525] border-white/10 min-w-[160px]">
                  <Link to="/markets">
                    <DropdownMenuItem
                      className={`gap-2 cursor-pointer ${isActive("/markets") ? "text-white bg-white/10" : "text-gray-300 hover:text-white focus:text-white focus:bg-white/10"}`}
                    >
                      <Store className="w-4 h-4" />
                      Browse Markets
                    </DropdownMenuItem>
                  </Link>
                  <Link to="/trades">
                    <DropdownMenuItem
                      className={`gap-2 cursor-pointer ${isActive("/trades") ? "text-white bg-white/10" : "text-gray-300 hover:text-white focus:text-white focus:bg-white/10"}`}
                    >
                      <Activity className="w-4 h-4" />
                      Live Trades
                    </DropdownMenuItem>
                  </Link>
                  <Link to="/dashboard">
                    <DropdownMenuItem
                      className={`gap-2 cursor-pointer ${isActive("/dashboard") ? "text-white bg-white/10" : "text-gray-300 hover:text-white focus:text-white focus:bg-white/10"}`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      Dashboard
                    </DropdownMenuItem>
                  </Link>
                  <Link to="/my-trades">
                    <DropdownMenuItem
                      className={`gap-2 cursor-pointer ${isActive("/my-trades") ? "text-white bg-white/10" : "text-gray-300 hover:text-white focus:text-white focus:bg-white/10"}`}
                    >
                      <Receipt className="w-4 h-4" />
                      My Trades
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* About Link */}
              <Link to="/about">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-sm gap-2 rounded-lg transition-all ${
                    isActive("/about") ? "text-black bg-white" : "text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Info className="w-4 h-4" />
                  About
                </Button>
              </Link>

              {/* Leaderboard Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-sm gap-2 rounded-lg transition-all ${
                      isActive("/leaderboard") || isActive("/builders")
                        ? "text-black bg-white"
                        : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                    Leaderboard
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-[#1a1525] border-white/10 min-w-[160px]">
                  <Link to="/leaderboard">
                    <DropdownMenuItem
                      className={`gap-2 cursor-pointer ${isActive("/leaderboard") ? "text-white bg-white/10" : "text-gray-300 hover:text-white focus:text-white focus:bg-white/10"}`}
                    >
                      <Users className="w-4 h-4" />
                      Traders
                    </DropdownMenuItem>
                  </Link>
                  <Link to="/builders">
                    <DropdownMenuItem
                      className={`gap-2 cursor-pointer ${isActive("/builders") ? "text-white bg-white/10" : "text-gray-300 hover:text-white focus:text-white focus:bg-white/10"}`}
                    >
                      <Hammer className="w-4 h-4" />
                      Builders
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          {/* Right Actions - Desktop */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            {/* Official X Page - Follow Button */}
            <a href="https://x.com/trypolyai" target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                className="gap-1.5 rounded-lg bg-white text-black hover:bg-gray-200 font-semibold transition-all shadow-lg shadow-white/20 px-3"
              >
                <XLogo className="w-4 h-4" />
                <span className="hidden lg:inline">Follow</span>
              </Button>
            </a>
          </div>

          {/* Right Actions - Desktop */}
          <div className="hidden md:flex items-center gap-2">
            {/* Wallet Dropdown or Connect */}
            {isConnected && address ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-sm rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                  >
                    <Wallet className="w-4 h-4" />
                    {truncateAddress(address)}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#1a1525] border-white/10">
                  <Link to="/my-trades">
                    <DropdownMenuItem className="gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white focus:bg-white/10">
                      <Receipt className="w-4 h-4" />
                      My Trades
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white focus:bg-white/10"
                    asChild
                  >
                    <div>
                      <ConnectWallet />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <ConnectWallet />
            )}
            <button
              onClick={copyCA}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/30 hover:bg-blue-600/20 transition-all cursor-pointer group"
              title="Click to copy POLY token CA"
            >
              <span className="text-xs font-bold text-blue-400">$POLY</span>
              <span className="text-xs text-muted-foreground font-mono max-w-[80px] truncate">
                {POLY_CA === "Coming Soon" ? "Soon" : `${POLY_CA.slice(0, 4)}...${POLY_CA.slice(-4)}`}
              </span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground group-hover:text-blue-400 transition-colors" />
              )}
            </button>

            {/* Help Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-2 rounded-lg transition-all ${
                    location.pathname === "/help" || location.pathname === "/about"
                      ? "text-black bg-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Help</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1a1525] border-white/10 min-w-[160px]">
                <Link to="/help">
                  <DropdownMenuItem
                    className={`gap-2 cursor-pointer ${isActive("/help") ? "text-white bg-white/10" : "text-gray-300 hover:text-white focus:text-white focus:bg-white/10"}`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    Support
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-[#0f0a1f]/95 backdrop-blur-xl border-b border-white/10 p-4 animate-fade-in">
            <nav className="flex flex-col gap-2">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 ${
                    isActive("/") || isActive("/chat")
                      ? "text-black bg-white"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                  Chat
                </Button>
              </Link>
              {/* Markets Section - Mobile */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
                  <Store className="w-4 h-4" />
                  Markets
                </div>
                <Link to="/markets" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 pl-8 ${
                      isActive("/markets") ? "text-black bg-white" : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Store className="w-5 h-5" />
                    Browse Markets
                  </Button>
                </Link>
                <Link to="/trades" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 pl-8 ${
                      isActive("/trades") ? "text-black bg-white" : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Activity className="w-5 h-5" />
                    Live Trades
                  </Button>
                </Link>
                <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 pl-8 ${
                      isActive("/dashboard")
                        ? "text-black bg-white"
                        : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <BarChart3 className="w-5 h-5" />
                    Dashboard
                  </Button>
                </Link>
                <Link to="/my-trades" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 pl-8 ${
                      isActive("/my-trades")
                        ? "text-black bg-white"
                        : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Receipt className="w-5 h-5" />
                    My Trades
                  </Button>
                </Link>
              </div>

              <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 ${
                    isActive("/about") ? "text-black bg-white" : "text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Info className="w-5 h-5" />
                  About
                </Button>
              </Link>

              {/* Leaderboard Section - Mobile */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
                  <Trophy className="w-4 h-4" />
                  Leaderboard
                </div>
                <Link to="/leaderboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 pl-8 ${
                      isActive("/leaderboard")
                        ? "text-black bg-white"
                        : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    Traders
                  </Button>
                </Link>
                <Link to="/builders" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 pl-8 ${
                      isActive("/builders") ? "text-black bg-white" : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Hammer className="w-5 h-5" />
                    Builders
                  </Button>
                </Link>
              </div>
              <a
                href="https://x.com/trypolyai"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button className="w-full justify-start gap-3 bg-white text-black hover:bg-gray-200 font-semibold">
                  <XLogo className="w-5 h-5" />
                  Follow on X
                </Button>
              </a>
              {/* POLY Token CA - Mobile */}
              <button
                onClick={() => {
                  copyCA();
                }}
                className="flex items-center justify-between gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-purple-400">$POLY CA</span>
                  <span className="text-xs text-gray-400 font-mono">
                    {POLY_CA === "Coming Soon" ? "Coming Soon" : `${POLY_CA.slice(0, 6)}...${POLY_CA.slice(-4)}`}
                  </span>
                </div>
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
              </button>
              <div className="border-t border-white/10 my-2" />
              <Link to="/help" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <HelpCircle className="w-5 h-5" />
                  Help
                </Button>
              </Link>
              <div className="pt-2">
                <ConnectWallet />
              </div>
              {/* Legal Links - Mobile */}
              <div className="flex items-center justify-center gap-4 pt-3 text-xs text-gray-500">
                <Link
                  to="/privacy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-white transition-colors"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-white transition-colors"
                >
                  Terms
                </Link>
                <Link
                  to="/disclaimer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-white transition-colors"
                >
                  Disclaimer
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <HowItWorksModal open={showHowItWorks} onOpenChange={setShowHowItWorks} />
    </>
  );
});

TopBar.displayName = "TopBar";
