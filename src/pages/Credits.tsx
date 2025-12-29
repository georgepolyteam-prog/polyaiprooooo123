import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Zap, ExternalLink, Loader2, Wallet, History, Plus, 
  Sparkles, TrendingUp, Clock, CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DepositCreditsDialog } from "@/components/credits/DepositCreditsDialog";
import { cn } from "@/lib/utils";

const CREDITS_PER_POLY = 1;

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

  const glowColor = {
    high: 'from-emerald-500/30 to-emerald-500/5',
    medium: 'from-primary/30 to-primary/5',
    low: 'from-amber-500/30 to-amber-500/5',
    empty: 'from-red-500/30 to-red-500/5'
  }[creditStatus];

  const statusColor = {
    high: 'text-emerald-400',
    medium: 'text-primary',
    low: 'text-amber-400',
    empty: 'text-red-400'
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
    return formatDate(dateString);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-8 rounded-2xl bg-card border border-border/50 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">
            Please sign in with email to view and manage your credits.
          </p>
          <Button onClick={() => navigate('/auth')} size="lg" className="gap-2">
            Sign In
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={cn(
          "absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-30",
          `bg-gradient-radial ${glowColor}`
        )} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20 bg-gradient-radial from-primary/20 to-transparent" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="rounded-xl hover:bg-muted/50"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                Credits
              </h1>
              <p className="text-sm text-muted-foreground">Power your AI analysis</p>
            </div>
          </div>
          
          <WalletMultiButton className="!bg-card !border !border-border/50 !text-foreground !rounded-xl !h-10 !px-4 hover:!bg-muted/50 !font-medium !text-sm" />
        </motion.div>

        {/* Main Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className={cn(
            "relative p-8 rounded-3xl border border-border/50 overflow-hidden",
            "bg-gradient-to-br from-card via-card to-muted/20"
          )}>
            {/* Glow effect */}
            <div className={cn(
              "absolute inset-0 bg-gradient-radial opacity-50",
              glowColor
            )} />
            
            <div className="relative">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Credits display */}
                  <div className="text-center mb-8">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="relative inline-block"
                    >
                      <Zap className={cn(
                        "w-8 h-8 absolute -top-2 -right-6",
                        statusColor
                      )} />
                      <span className={cn(
                        "text-7xl font-bold tabular-nums tracking-tight",
                        statusColor
                      )}>
                        {credits.toLocaleString()}
                      </span>
                    </motion.div>
                    <p className="text-muted-foreground mt-2">credits available</p>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/30 text-center">
                      <TrendingUp className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
                      <div className="text-2xl font-bold">{totalDeposited}</div>
                      <div className="text-xs text-muted-foreground">POLY deposited</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/30 text-center">
                      <Zap className="w-5 h-5 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold">{totalSpent}</div>
                      <div className="text-xs text-muted-foreground">credits used</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/30 text-center">
                      <Sparkles className="w-5 h-5 mx-auto mb-2 text-amber-400" />
                      <div className="text-2xl font-bold">1:1</div>
                      <div className="text-xs text-muted-foreground">POLY to credit</div>
                    </div>
                  </div>

                  {/* Deposit CTA */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button 
                      onClick={() => setIsDepositOpen(true)}
                      size="lg"
                      className="w-full h-14 text-lg font-semibold rounded-2xl gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
                    >
                      <Plus className="w-5 h-5" />
                      Deposit POLY
                      <Sparkles className="w-4 h-4 opacity-70" />
                    </Button>
                  </motion.div>

                  {/* Wallet status */}
                  {connected ? (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Wallet linked: {publicKey?.toString().substring(0, 6)}...{publicKey?.toString().slice(-4)}</span>
                      {linking && <Loader2 className="w-3 h-3 animate-spin" />}
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="w-4 h-4" />
                      <span>Connect Phantom wallet to deposit</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activity.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No activity yet</p>
                <p className="text-sm">Deposit POLY to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                <AnimatePresence>
                  {activity.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          item.type === 'deposit' 
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-primary/10 text-primary"
                        )}>
                          {item.type === 'deposit' ? (
                            <Plus className="w-5 h-5" />
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
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{formatRelativeTime(item.created_at)}</span>
                            {item.status && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  item.status === 'confirmed' 
                                    ? "border-emerald-500/30 text-emerald-400"
                                    : "border-amber-500/30 text-amber-400"
                                )}
                              >
                                {item.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.tx_signature && (
                        <a
                          href={`https://solscan.io/tx/${item.tx_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <span className="hidden sm:inline">View</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

        {/* Info footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          <p>Each AI analysis costs 1 credit • 1 POLY = 1 credit</p>
        </motion.div>
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