import { Link } from 'react-router-dom';
import { User, LogIn, LogOut, Receipt, Star, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarAccountProps {
  collapsed?: boolean;
}

export const SidebarAccount = ({ collapsed = false }: SidebarAccountProps) => {
  const { user, signOut } = useAuth();

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'p-2 rounded-lg transition-all duration-200',
                  user
                    ? 'bg-primary/20 text-primary hover:bg-primary/30'
                    : 'bg-white/15 text-foreground/70 hover:bg-white/20 hover:text-foreground'
                )}
              >
                <User className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="bg-[#1a1525] border-white/10 min-w-[180px]">
              {user ? (
                <>
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                  </div>
                  <Link to="/my-trades">
                    <DropdownMenuItem className="gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white focus:bg-white/10">
                      <Receipt className="w-4 h-4" />
                      My Trades
                    </DropdownMenuItem>
                  </Link>
                  <Link to="/tracked-wallets">
                    <DropdownMenuItem className="gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white focus:bg-white/10">
                      <Star className="w-4 h-4" />
                      Tracked Wallets
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="gap-2 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/10"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenuItem>
                </>
              ) : (
                <Link to="/auth">
                  <DropdownMenuItem className="gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white focus:bg-white/10">
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </DropdownMenuItem>
                </Link>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent side="right">
          {user ? user.email?.split('@')[0] : 'Account'}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded view
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-left',
            user
              ? 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
              : 'bg-white/10 border border-white/10 text-muted-foreground hover:bg-white/15 hover:text-foreground'
          )}
        >
          <User className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-sm font-medium truncate">
            {user ? user.email?.split('@')[0] : 'Sign in'}
          </span>
          <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="bg-[#1a1525] border-white/10 min-w-[200px]">
        {user ? (
          <>
            <div className="px-3 py-2 border-b border-white/10">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
            </div>
            <Link to="/my-trades">
              <DropdownMenuItem className="gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white focus:bg-white/10">
                <Receipt className="w-4 h-4" />
                My Trades
              </DropdownMenuItem>
            </Link>
            <Link to="/tracked-wallets">
              <DropdownMenuItem className="gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white focus:bg-white/10">
                <Star className="w-4 h-4" />
                Tracked Wallets
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="gap-2 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </DropdownMenuItem>
          </>
        ) : (
          <Link to="/auth">
            <DropdownMenuItem className="gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white focus:bg-white/10">
              <LogIn className="w-4 h-4" />
              Sign In / Sign Up
            </DropdownMenuItem>
          </Link>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
