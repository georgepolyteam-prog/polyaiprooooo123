import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3, TrendingUp, MessageSquare, Wallet, Menu, X, Settings, HelpCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "markets", label: "Markets", icon: BarChart3, path: "/markets" },
  { id: "live-trades", label: "Live", icon: TrendingUp, path: "/live-trades" },
  { id: "chat", label: "Chat", icon: MessageSquare, path: "/", isCenter: true },
  { id: "my-trades", label: "Trades", icon: Wallet, path: "/my-trades" },
  { id: "menu", label: "Menu", icon: Menu, path: null },
];

const menuItems = [
  { id: "markets", label: "Markets", icon: BarChart3, path: "/markets" },
  { id: "live-trades", label: "Live Trades", icon: TrendingUp, path: "/live-trades" },
  { id: "chat", label: "Chat (Home)", icon: MessageSquare, path: "/" },
  { id: "my-trades", label: "My Trades", icon: Wallet, path: "/my-trades" },
];

const additionalMenuItems = [
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  { id: "help", label: "Help & Support", icon: HelpCircle, path: "/help" },
  { id: "docs", label: "Documentation", icon: FileText, path: "/docs" },
];

export function MobileBottomNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

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
          className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMenuOpen(false);
          }}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsMenuOpen(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Menu Content */}
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto px-8 py-20">
            {/* Main Navigation */}
            <div className="w-full space-y-3">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuItemClick(item.path)}
                    className={cn(
                      "w-full h-14 flex items-center gap-4 px-6 rounded-xl",
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
                      "text-base",
                      active ? "text-primary font-medium" : "text-foreground"
                    )}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="w-full border-t border-border my-6" />

            {/* Additional Links */}
            <div className="w-full space-y-3">
              {additionalMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuItemClick(item.path)}
                    className={cn(
                      "w-full h-14 flex items-center gap-4 px-6 rounded-xl",
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
                      "text-base",
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
      )}
    </>
  );
}
