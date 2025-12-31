import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3, Users, MessageSquare, Wallet, Menu, X, Activity, HelpCircle, FileText, Star, Info, Zap, Trophy, Hammer, LogIn, LogOut, User, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreditsDisplay } from "@/components/CreditsDisplay";
import { useAuth } from "@/hooks/useAuth";
import { ConnectWallet } from "@/components/ConnectWallet";

const navItems = [
  { id: "markets", label: "Markets", icon: BarChart3, path: "/markets" },
  { id: "live-trades", label: "Live", icon: Activity, path: "/live-trades" },
  { id: "chat", label: "Chat", icon: MessageSquare, path: "/", isCenter: true },
  { id: "my-trades", label: "Trades", icon: Wallet, path: "/my-trades" },
  { id: "menu", label: "Menu", icon: Menu, path: null },
];

const menuItems = [
  { id: "markets", label: "Browse Markets", icon: BarChart3, path: "/markets" },
  { id: "kalshi", label: "Kalshi Markets", icon: LineChart, path: "/kalshi" },
  { id: "live-trades", label: "Live Trades", icon: Activity, path: "/live-trades" },
  { id: "chat", label: "Chat (Home)", icon: MessageSquare, path: "/" },
  { id: "my-trades", label: "My Trades", icon: Wallet, path: "/my-trades" },
  { id: "leaderboard", label: "Top Traders", icon: Trophy, path: "/leaderboard" },
  { id: "builders", label: "Top Builders", icon: Hammer, path: "/builders" },
];

const additionalMenuItems = [
  { id: "credits", label: "Get Credits", icon: Zap, path: "/credits" },
  { id: "tracked-wallets", label: "Tracked Wallets", icon: Star, path: "/tracked-wallets" },
  { id: "about", label: "About", icon: Info, path: "/about" },
  { id: "help", label: "Help & Support", icon: HelpCircle, path: "/help" },
  { id: "docs", label: "Documentation", icon: FileText, path: "/docs" },
];

export function MobileBottomNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, signOut } = useAuth();

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentPath]);

  const isActive = (path: string | null) => {
    if (!path) return false;
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.id === "menu") {
      setIsMenuOpen(true);
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const handleMenuItemClick = (path: string) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="bg-background/80 backdrop-blur-xl border-t border-border/50 shadow-2xl">
          <div className="flex items-end justify-around h-20 px-2 relative">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              if (item.isCenter) {
                return (
                  <div key={item.id} className="flex flex-col items-center relative -mt-4">
                    {/* Elevated Center Button */}
                    <button
                      onClick={() => handleNavClick(item)}
                      className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center",
                        "bg-gradient-to-br from-primary to-secondary",
                        "shadow-[0_0_30px_hsl(var(--primary)/0.4)]",
                        "ring-2 ring-primary/20",
                        "transition-all duration-300",
                        "active:scale-90 hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)]",
                        active && "ring-primary/40"
                      )}
                      aria-label="Navigate to Chat"
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="w-7 h-7 text-primary-foreground" />
                    </button>
                    <span className={cn(
                      "text-xs font-medium mt-1.5",
                      active ? "text-primary" : "text-muted-foreground"
                    )}>
                      {item.label}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "flex flex-col items-center justify-center w-16 h-16 rounded-xl",
                    "transition-all duration-300 active:scale-95",
                    active && "bg-muted/50"
                  )}
                  aria-label={`Navigate to ${item.label}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn(
                    "w-6 h-6 transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-xs mt-1 transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Menu Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 md:hidden flex flex-col"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMenuOpen(false);
          }}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsMenuOpen(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Scrollable Menu Content */}
          <div className="flex-1 overflow-y-auto pt-20 pb-8 px-6">
            <div className="max-w-md mx-auto space-y-6">
              {/* Credits Display at top */}
              <div className="w-full">
                <CreditsDisplay className="w-full justify-center" />
              </div>

              {/* Account Section */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/30">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground">Signed in</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        signOut();
                        setIsMenuOpen(false);
                      }}
                      className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium">Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleMenuItemClick('/auth')}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="text-sm font-medium">Sign In / Sign Up</span>
                  </button>
                )}
              </div>

              {/* Wallet Connection */}
              <div className="flex justify-center">
                <ConnectWallet />
              </div>

              {/* Divider */}
              <div className="border-t border-border/30" />

              {/* Main Navigation */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-3">Navigation</p>
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMenuItemClick(item.path)}
                      className={cn(
                        "w-full h-12 flex items-center gap-4 px-4 rounded-xl",
                        "transition-all duration-200",
                        active 
                          ? "bg-primary/10 border border-primary/30" 
                          : "bg-muted/30 hover:bg-muted/60 border border-transparent"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className={cn(
                        "w-5 h-5",
                        active ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className={cn(
                        "text-sm",
                        active ? "text-primary font-medium" : "text-foreground"
                      )}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-border/30" />

              {/* Additional Links */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-3">More</p>
                {additionalMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMenuItemClick(item.path)}
                      className={cn(
                        "w-full h-12 flex items-center gap-4 px-4 rounded-xl",
                        "transition-all duration-200",
                        active 
                          ? "bg-primary/10 border border-primary/30" 
                          : "bg-muted/30 hover:bg-muted/60 border border-transparent"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className={cn(
                        "w-5 h-5",
                        active ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className={cn(
                        "text-sm",
                        active ? "text-primary font-medium" : "text-foreground"
                      )}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
