import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { 
  ArrowLeft, Zap, ExternalLink, Loader2, History, Plus, 
  TrendingUp, RefreshCw, ArrowUpRight, Wallet, LogOut, ChevronDown,
  HelpCircle, Flame, CheckCircle2, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DepositCreditsDialog } from "@/components/credits/DepositCreditsDialog";
import { BuyPolyOptions } from "@/components/credits/BuyPolyOptions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CREDITS_PER_POLY = 1;
const POLY_CA = "982rmGDwnrekE1QjdMFGn7y6cm8ajaU5Ziq5BrZtpump";

interface Deposit {
  id: string;
  amount: number;
  tx_signature: string;
  status: string;
  created_at: string;
}

interface UsageRecord {
  id: string;
  credits_used: number;
  created_at: string;
}

interface ActivityItem {
  id: string;
  type: 'deposit' | 'usage';
  amount: number;
  status?: string;
  tx_signature?: string;
  created_at: string;
}

const Credits = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { publicKey, connected } = useWallet();
  const { credits, totalDeposited, totalSpent, isLoading, refetch } = useCredits();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [linking, setLinking] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCA = () => {
    navigator.clipboard.writeText(POLY_CA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Animated counter for balance
  const springValue = useSpring(0, { stiffness: 50, damping: 30 });
  const displayValue = useTransform(springValue, (latest) => 
    Math.round(latest).toLocaleString()
  );

  useEffect(() => {
    springValue.set(credits);
  }, [credits, springValue]);

  // Combine and sort activity
  const activity = useMemo<ActivityItem[]>(() => {
    const depositItems: ActivityItem[] = deposits.map(d => ({
      id: d.id,
      type: 'deposit',
      amount: d.amount,
      status: d.status,
      tx_signature: d.tx_signature,
      created_at: d.created_at
    }));
    const usageItems: ActivityItem[] = usage.map(u => ({
      id: u.id,
      type: 'usage',
      amount: u.credits_used,
      created_at: u.created_at
    }));
    return [...depositItems, ...usageItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15);
  }, [deposits, usage]);

  // Credit status for glow color
  const creditStatus = useMemo(() => {
    if (credits >= 100) return 'high';
    if (credits >= 20) return 'medium';
    if (credits >= 1) return 'low';
    return 'empty';
  }, [credits]);

  const statusColors = {
    high: { text: 'text-emerald-400', glow: 'shadow-emerald-500/30', bg: 'from-emerald-500/20 to-emerald-500/5' },
    medium: { text: 'text-primary', glow: 'shadow-primary/30', bg: 'from-primary/20 to-primary/5' },
    low: { text: 'text-amber-400', glow: 'shadow-amber-500/30', bg: 'from-amber-500/20 to-amber-500/5' },
    empty: { text: 'text-red-400', glow: 'shadow-red-500/30', bg: 'from-red-500/20 to-red-500/5' }
  }[creditStatus];

  // Link Solana wallet to user account
  useEffect(() => {
    const linkWallet = async () => {
      if (!user?.id || !publicKey || !connected) return;
      
      setLinking(true);
      try {
        const walletAddress = publicKey.toString();
        
        const { data: existing } = await supabase
          .from('user_credits')
          .select('id, wallet_address')
          .eq('user_id', user.id)
          .single();
        
        if (existing) {
          if (existing.wallet_address !== walletAddress) {
            await supabase
              .from('user_credits')
              .update({ wallet_address: walletAddress })
              .eq('user_id', user.id);
            toast.success("Solana wallet linked!");
            refetch();
          }
        } else {
          await supabase
            .from('user_credits')
            .insert({
              user_id: user.id,
              wallet_address: walletAddress,
              credits_balance: 0,
              total_deposited: 0,
              total_spent: 0
            });
          toast.success("Solana wallet linked!");
          refetch();
        }
      } catch (err) {
        console.error("Error linking wallet:", err);
      } finally {
        setLinking(false);
      }
    };

    linkWallet();
  }, [user?.id, publicKey, connected, refetch]);

  // Fetch deposit and usage history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return;
      
      setLoadingHistory(true);
      try {
        const [depositsRes, usageRes] = await Promise.all([
          supabase
            .from('credit_deposits')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('credit_usage')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)
        ]);

        if (depositsRes.data) setDeposits(depositsRes.data);
        if (usageRes.data) setUsage(usageRes.data);
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("credit-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const { setVisible: openWalletModal } = useWalletModal();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-8 rounded-3xl bg-card/80 backdrop-blur-2xl border border-border/50 text-center shadow-2xl"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Zap className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-3">Sign In Required</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Please sign in with email to view and manage your credits.
          </p>
          <Button onClick={() => navigate('/auth')} size="lg" className="gap-2 h-14 px-8 text-lg rounded-2xl">
            Sign In
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl",
            `bg-gradient-radial ${statusColors.bg}`
          )} 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full blur-3xl bg-gradient-radial from-primary/20 to-transparent" 
        />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="rounded-2xl w-12 h-12 hover:bg-muted/50 backdrop-blur-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/30 backdrop-blur-xl border border-border/30"
          >
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Credits</span>
          </motion.div>
          
          {/* Wallet Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {connected && publicKey ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 rounded-2xl h-12 px-4 bg-card/80 backdrop-blur-xl border border-border/50 hover:bg-muted/50 font-medium text-sm shadow-lg"
                >
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <span className="text-foreground">
                    {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 rounded-2xl h-12 px-4 bg-card/80 backdrop-blur-xl border border-border/50 hover:bg-muted/50 font-medium text-sm shadow-lg"
                >
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">Connect Wallet</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-xl border-border/50 min-w-[200px]">
              {connected && publicKey ? (
                <>
                  <div className="px-3 py-2 border-b border-border/30">
                    <p className="text-xs text-muted-foreground">Connected</p>
                    <p className="text-sm font-mono text-foreground truncate">
                      {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                    </p>
                  </div>
                  <DropdownMenuItem
                    onClick={() => openWalletModal(true)}
                    className="gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <Wallet className="w-4 h-4" />
                    Change Wallet
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/30" />
                  <DropdownMenuItem
                    onClick={() => {
                      // Disconnect is handled by opening the modal and selecting disconnect
                      openWalletModal(true);
                    }}
                    className="gap-2 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={() => openWalletModal(true)}
                  className="gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* $POLY CA Button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={copyCA}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-2xl h-12",
              "bg-gradient-to-r from-blue-600/20 via-primary/20 to-blue-600/20",
              "border border-blue-500/30 hover:border-blue-400/50",
              "shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20",
              "transition-all duration-300 cursor-pointer group"
            )}
            title="Click to copy POLY token CA"
          >
            <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-primary bg-clip-text text-transparent">$POLY</span>
            <span className="text-xs text-muted-foreground font-mono">
              {POLY_CA.slice(0, 4)}...{POLY_CA.slice(-4)}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
            )}
          </motion.button>
        </motion.div>

        {/* Main Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className={cn(
            "relative p-8 sm:p-10 rounded-[2rem] overflow-hidden",
            "bg-card/60 backdrop-blur-2xl border border-border/30",
            "shadow-2xl",
            statusColors.glow
          )}>
            {/* Subtle inner glow */}
            <div className={cn(
              "absolute inset-0 bg-gradient-radial opacity-40 pointer-events-none",
              statusColors.bg
            )} />
            
            <div className="relative text-center">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Label */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm font-medium text-muted-foreground uppercase tracking-[0.2em] mb-4"
                  >
                    Available Balance
                  </motion.p>

                  {/* Animated Balance */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", delay: 0.2, stiffness: 100 }}
                    className="relative mb-2"
                  >
                    <motion.span 
                      className={cn(
                        "text-7xl sm:text-8xl font-bold tabular-nums tracking-tight",
                        statusColors.text
                      )}
                    >
                      {displayValue}
                    </motion.span>
                    {/* Subtle glow behind number */}
                    <div className={cn(
                      "absolute inset-0 blur-3xl opacity-30 pointer-events-none",
                      statusColors.bg
                    )} />
                  </motion.div>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-muted-foreground text-lg"
                  >
                    Power your AI analysis
                  </motion.p>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 mb-8"
        >
          {[
            { icon: TrendingUp, value: totalDeposited.toLocaleString(), label: "POLY Deposited", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: Zap, value: totalSpent.toLocaleString(), label: "Credits Used", color: "text-amber-400", bg: "bg-amber-500/10" },
            { icon: RefreshCw, value: "1:1", label: "Exchange Rate", color: "text-blue-400", bg: "bg-blue-500/10" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className={cn(
                "p-4 rounded-2xl text-center transition-all",
                "bg-card/60 backdrop-blur-xl border border-border/30",
                "hover:shadow-lg hover:border-border/50"
              )}
            >
              <div className={cn("w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Buy POLY Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-6"
        >
          <div className="p-6 rounded-2xl bg-card/40 backdrop-blur-xl border border-border/30">
            <BuyPolyOptions />
          </div>
        </motion.div>

        {/* Separator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="flex items-center gap-4 mb-6"
        >
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Or deposit existing POLY</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
        </motion.div>

        {/* Deposit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="relative">
            <motion.div whileHover={connected ? { scale: 1.01 } : {}} whileTap={connected ? { scale: 0.99 } : {}}>
              <Button 
                onClick={() => connected && setIsDepositOpen(true)}
                disabled={!connected}
                className={cn(
                  "w-full h-16 text-lg font-semibold rounded-2xl gap-3 relative",
                  connected 
                    ? "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-2xl shadow-primary/20 transition-all duration-300 hover:shadow-primary/40"
                    : "bg-muted/50 text-muted-foreground cursor-not-allowed border border-border/50"
                )}
              >
                <Plus className="w-5 h-5" />
                Deposit POLY
              </Button>
            </motion.div>
            
            {/* Connect Wallet Prompt */}
            <AnimatePresence>
              {!connected && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-3"
                >
                  <motion.div 
                    className={cn(
                      "relative p-4 rounded-2xl overflow-hidden",
                      "bg-card/80 backdrop-blur-xl border border-border/50",
                      "shadow-lg"
                    )}
                  >
                    {/* Subtle animated gradient */}
                    <motion.div
                      animate={{ 
                        opacity: [0.3, 0.5, 0.3],
                        scale: [1, 1.02, 1]
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pointer-events-none"
                    />
                    
                    <div className="relative flex items-center gap-3">
                      {/* Pulsing icon */}
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"
                      >
                        <Wallet className="w-5 h-5 text-primary" />
                      </motion.div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm sm:text-base">Connect wallet first</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Use the button in the top right corner</p>
                      </div>
                      
                      {/* Arrow pointing to top right */}
                      <motion.div
                        animate={{ x: [0, 4, 0], y: [0, -4, 0] }}
                        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                        className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10"
                      >
                        <ArrowUpRight className="w-4 h-4 text-primary" />
                      </motion.div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Activity Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card/40 backdrop-blur-xl rounded-2xl border border-border/30 overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 border-b border-border/30">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold tracking-tight">Recent Activity</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="text-muted-foreground hover:text-foreground rounded-xl"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="divide-y divide-border/20">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activity.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/30 flex items-center justify-center">
                  <History className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-medium text-muted-foreground mb-1">No activity yet</p>
                <p className="text-sm text-muted-foreground/70">Deposit POLY to get started</p>
              </div>
            ) : (
              <AnimatePresence>
                {activity.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        item.type === 'deposit' 
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-primary/10 text-primary"
                      )}>
                        {item.type === 'deposit' ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : (
                          <Zap className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {item.type === 'deposit' ? (
                            <>
                              <span className="text-emerald-400">+{item.amount}</span>
                              <span className="text-muted-foreground">POLY deposited</span>
                            </>
                          ) : (
                            <>
                              <span className="text-primary">-{item.amount}</span>
                              <span className="text-muted-foreground">credit used</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground/70 flex items-center gap-2 mt-0.5">
                          <span>{formatRelativeTime(item.created_at)}</span>
                          {item.type === 'deposit' && item.status === 'confirmed' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">
                              Confirmed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {item.tx_signature && (
                      <button
                        onClick={() => window.open(`https://solscan.io/tx/${item.tx_signature}`, '_blank')}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground/70">
              Each AI analysis costs 1 credit • 1 POLY = 1 credit
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHowItWorks(true)}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              <HelpCircle className="w-4 h-4" />
              How it works
            </Button>
          </div>
          {connected && publicKey && (
            <p className="text-xs text-muted-foreground/50">
              Connected: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-6)}
            </p>
          )}
          <Button
            variant="link"
            asChild
            className="text-muted-foreground/70 hover:text-foreground text-sm"
          >
            <Link to="/about">Learn more about POLY →</Link>
          </Button>
        </motion.div>

        {/* How it Works Modal */}
        <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
          <DialogContent className="max-w-lg bg-card/95 backdrop-blur-2xl border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                How Credits Work
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {/* Step by step */}
              <div className="space-y-4">
                {[
                  { step: "1", title: "Get POLY Tokens", desc: "Buy POLY on Jupiter, Pump.fun, or OKX. It's a Solana token.", icon: Wallet },
                  { step: "2", title: "Deposit to Your Account", desc: "Connect your Solana wallet and deposit POLY tokens.", icon: Plus },
                  { step: "3", title: "Use AI Analysis", desc: "Each AI message costs 1 credit (1 POLY = 1 credit).", icon: Zap },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-semibold text-sm">{item.step}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tokenomics */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <h4 className="font-semibold text-foreground">70/30 Tokenomics</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  When you spend credits:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-destructive/10 text-center">
                    <div className="text-2xl font-bold text-destructive">70%</div>
                    <p className="text-xs text-muted-foreground">Burned Forever</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 text-center">
                    <div className="text-2xl font-bold text-primary">30%</div>
                    <p className="text-xs text-muted-foreground">Development</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setShowHowItWorks(false)} className="flex-1 rounded-xl">
                  Got it
                </Button>
                <Button variant="outline" asChild className="flex-1 rounded-xl">
                  <Link to="/about">Learn More</Link>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Deposit Dialog */}
      <DepositCreditsDialog
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        onSuccess={() => {
          refetch();
          if (user?.id) {
            supabase
              .from('credit_deposits')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10)
              .then(({ data }) => {
                if (data) setDeposits(data);
              });
          }
        }}
      />
    </div>
  );
};

export default Credits;
