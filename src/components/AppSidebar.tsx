import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  LayoutGrid,
  Activity,
  BarChart3,
  Receipt,
  Trophy,
  Hammer,
  FileText,
  Info,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Coins,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarLogo } from './SidebarLogo';
import { SidebarAccount } from './SidebarAccount';
import { CreditsPill } from './credits/CreditsPill';
import { ConnectWallet } from './ConnectWallet';
import { PolyPriceCompact } from './PolyPriceCompact';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const mainNav = [
  { title: 'Chat', url: '/', icon: MessageSquare },
];

const exploreNav = [
  { title: 'Browse Markets', url: '/markets', icon: LayoutGrid },
  { title: 'Live Trades', url: '/trades', icon: Activity },
  { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
  { title: 'My Trades', url: '/my-trades', icon: Receipt },
];

const leaderboardNav = [
  { title: 'Top Traders', url: '/leaderboard', icon: Trophy },
  { title: 'Top Builders', url: '/builders', icon: Hammer },
];

const resourceNav = [
  { title: 'Documentation', url: '/docs', icon: FileText },
  { title: 'About', url: '/about', icon: Info },
  { title: 'Help', url: '/help', icon: HelpCircle },
];

interface NavItemProps {
  item: { title: string; url: string; icon: React.ComponentType<{ className?: string }> };
  isActive: boolean;
  collapsed: boolean;
}

const NavItem = ({ item, isActive, collapsed }: NavItemProps) => {
  const content = (
    <Link
      to={item.url}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
        'text-muted-foreground hover:text-foreground',
        'hover:bg-white/5 hover:translate-x-0.5',
        isActive && [
          'text-foreground bg-primary/10',
          'border-l-2 border-primary -ml-px pl-[calc(0.75rem+1px)]',
          'shadow-[inset_0_0_20px_hsl(var(--primary)/0.1)]',
        ]
      )}
    >
      <item.icon className={cn(
        'w-5 h-5 flex-shrink-0 transition-colors',
        isActive && 'text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]'
      )} />
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-sm font-medium"
        >
          {item.title}
        </motion.span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

interface NavGroupProps {
  label: string;
  items: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[];
  currentPath: string;
  collapsed: boolean;
}

const NavGroup = ({ label, items, currentPath, collapsed }: NavGroupProps) => {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <div className="px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
            {label}
          </span>
        </div>
      )}
      {items.map((item) => (
        <NavItem
          key={item.url}
          item={item}
          isActive={currentPath === item.url || (item.url === '/' && currentPath === '/chat')}
          collapsed={collapsed}
        />
      ))}
    </div>
  );
};

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'hidden md:flex flex-col h-screen sticky top-0 z-50',
        'bg-black/40 backdrop-blur-2xl',
        'border-r border-white/15',
        'shadow-[inset_-1px_0_0_rgba(255,255,255,0.08)]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/15 bg-black/30">
        <SidebarLogo collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'p-1.5 rounded-lg transition-all duration-200',
            'text-muted-foreground hover:text-foreground',
            'hover:bg-white/5',
            collapsed && 'mx-auto'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Main CTA */}
        <div className="space-y-1">
          {mainNav.map((item) => (
            <NavItem
              key={item.url}
              item={item}
              isActive={currentPath === item.url || currentPath === '/chat'}
              collapsed={collapsed}
            />
          ))}
        </div>

        <div className="h-px bg-white/10" />

        <NavGroup
          label="Explore"
          items={exploreNav}
          currentPath={currentPath}
          collapsed={collapsed}
        />

        <NavGroup
          label="Leaderboards"
          items={leaderboardNav}
          currentPath={currentPath}
          collapsed={collapsed}
        />

        <NavGroup
          label="Resources"
          items={resourceNav}
          currentPath={currentPath}
          collapsed={collapsed}
        />
      </nav>

      {/* Footer */}
      <div className={cn(
        'p-3 border-t border-white/15 space-y-2 bg-black/30',
        collapsed && 'flex flex-col items-center'
      )}>
        {/* Poly Price - Only when expanded */}
        {!collapsed && <PolyPriceCompact />}

        {/* Account */}
        <div className={cn(collapsed && 'w-full flex justify-center')}>
          <SidebarAccount collapsed={collapsed} />
        </div>

        {/* Credits */}
        <div className={cn(collapsed && 'w-full flex justify-center')}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-white/15 cursor-pointer hover:bg-white/20 transition-colors">
                  <Coins className="w-4 h-4 text-primary" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Credits</TooltipContent>
            </Tooltip>
          ) : (
            <CreditsPill />
          )}
        </div>

        {/* Wallet */}
        <div className={cn(collapsed && 'w-full flex justify-center')}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-white/15 cursor-pointer hover:bg-white/20 transition-colors">
                  <Wallet className="w-4 h-4 text-foreground/70" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Connect Wallet</TooltipContent>
            </Tooltip>
          ) : (
            <ConnectWallet />
          )}
        </div>
      </div>
    </motion.aside>
  );
};
