import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ArrowLeft, Copy, Check, Zap, ExternalLink, Loader2, Wallet, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEPOSIT_WALLET_ADDRESS = "BLhwrWVNLAQxr3ZAW3TWiMhNry2RAGGwbdx45jKEGSP7";
const CREDITS_PER_POLY = 10;

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

const Credits = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { publicKey, connected } = useWallet();
  const { credits, totalDeposited, totalSpent, isLoading, refetch } = useCredits();
  const [copied, setCopied] = useState(false);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [linking, setLinking] = useState(false);

  // Link Solana wallet to user account
  useEffect(() => {
    const linkWallet = async () => {
      if (!user?.id || !publicKey || !connected) return;
      
      setLinking(true);
      try {
        const walletAddress = publicKey.toString();
        
        // Check if user already has credits record
        const { data: existing } = await supabase
          .from('user_credits')
          .select('id, wallet_address')
          .eq('user_id', user.id)
          .single();
        
        if (existing) {
          // Update wallet address if different
          if (existing.wallet_address !== walletAddress) {
            await supabase
              .from('user_credits')
              .update({ wallet_address: walletAddress })
              .eq('user_id', user.id);
            toast.success("Solana wallet linked!");
            refetch();
          }
        } else {
          // Create new credits record
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

  const copyAddress = () => {
    navigator.clipboard.writeText(DEPOSIT_WALLET_ADDRESS);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in to view and manage your credits.
            </p>
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Get Credits</h1>
            <p className="text-muted-foreground">Deposit POLY tokens to get AI credits</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Balance Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Your Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-4 bg-muted/50 rounded-lg">
                    <div className="text-5xl font-bold text-foreground tabular-nums">
                      {credits}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">credits available</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                      <div className="font-semibold">{totalDeposited}</div>
                      <div className="text-muted-foreground">POLY deposited</div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg text-center">
                      <div className="font-semibold">{totalSpent}</div>
                      <div className="text-muted-foreground">credits used</div>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg">
                    <strong>1 POLY = {CREDITS_PER_POLY} credits</strong>
                    <br />
                    Each AI analysis costs 1 credit
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deposit Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Deposit POLY
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Solana Wallet Connection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">1. Connect Solana Wallet</label>
                <div className="flex items-center gap-2">
                  <WalletMultiButton className="!bg-primary !text-primary-foreground hover:!bg-primary/90 !rounded-md !h-10 !px-4 !font-medium" />
                  {linking && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  This is separate from your Polymarket trading wallet
                </p>
              </div>

              <Separator />

              {/* Deposit Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium">2. Send POLY to this address</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-md text-xs font-mono break-all">
                    {DEPOSIT_WALLET_ADDRESS}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyAddress}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Instructions */}
              <div className="space-y-2">
                <label className="text-sm font-medium">3. Credits appear automatically</label>
                <p className="text-sm text-muted-foreground">
                  After sending POLY tokens, your credits will be added within 30-60 seconds automatically.
                </p>
              </div>

              {connected && (
                <div className="text-xs text-muted-foreground bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                  ✅ Wallet connected: {publicKey?.toString().substring(0, 4)}...{publicKey?.toString().slice(-4)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History Section */}
        <div className="grid gap-6 md:grid-cols-2 mt-6">
          {/* Deposit History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-4 h-4" />
                Recent Deposits
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : deposits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No deposits yet
                </p>
              ) : (
                <div className="space-y-3">
                  {deposits.map((deposit) => (
                    <div key={deposit.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="font-medium">{deposit.amount} POLY</div>
                        <div className="text-xs text-muted-foreground">
                          +{Math.floor(deposit.amount * CREDITS_PER_POLY)} credits
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={deposit.status === 'confirmed' ? 'default' : 'secondary'}>
                          {deposit.status}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(deposit.created_at)}
                        </div>
                        <a
                          href={`https://solscan.io/tx/${deposit.tx_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 justify-end"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-4 h-4" />
                Recent Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : usage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No usage yet
                </p>
              ) : (
                <div className="space-y-3">
                  {usage.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="font-medium">AI Analysis</div>
                        <div className="text-xs text-muted-foreground">
                          -{record.credits_used} credit{record.credits_used > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(record.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Credits;
