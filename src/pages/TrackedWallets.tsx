import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, Trash2, ExternalLink, Plus, Search, Edit2, Check, X, 
  Users, Sparkles, Zap, Wallet, HelpCircle, Info, Bell, TrendingUp, Eye
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrackedWallets } from '@/hooks/useTrackedWallets';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

// Cyber Particles Background
function CyberParticles() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-primary/20 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            y: [null, -20, 20],
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="relative overflow-hidden rounded-xl bg-card/50 border border-border/30 p-4"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted/50 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 bg-muted/40 rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted/30 rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-muted/30 rounded animate-pulse" />
          </div>
        </motion.div>
      ))}
      
      <motion.div
        className="flex items-center justify-center gap-3 py-6"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Zap className="w-5 h-5 text-primary" />
        </motion.div>
        <span className="text-sm text-muted-foreground">Loading wallets...</span>
      </motion.div>
    </div>
  );
}

// How It Works Modal
function HowItWorksModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile();

  const content = (
    <div className="space-y-6 p-1">
      <div className="space-y-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20"
        >
          <div className="p-2 rounded-lg bg-primary/20 shrink-0">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold mb-1">Add Wallets</h4>
            <p className="text-sm text-muted-foreground">
              Enter any Polymarket wallet address to start tracking their trades and performance.
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20"
        >
          <div className="p-2 rounded-lg bg-blue-500/20 shrink-0">
            <Eye className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold mb-1">Monitor Activity</h4>
            <p className="text-sm text-muted-foreground">
              View detailed analytics, PnL charts, recent trades, and hot markets for each wallet.
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20"
        >
          <div className="p-2 rounded-lg bg-green-500/20 shrink-0">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h4 className="font-semibold mb-1">Filter Live Trades</h4>
            <p className="text-sm text-muted-foreground">
              Use "Tracked Only" filter in Live Trades to see only trades from wallets you follow.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">Pro Tip</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Click any trade in the Live Trades feed and hit the ⭐ button to quickly track that wallet.
        </p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              How Wallet Tracking Works
            </DrawerTitle>
            <DrawerDescription>Track and analyze any Polymarket wallet</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            How Wallet Tracking Works
          </DialogTitle>
          <DialogDescription>Track and analyze any Polymarket wallet</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

export default function TrackedWallets() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { trackedWallets, loading, trackWallet, untrackWallet, updateNickname } = useTrackedWallets();
  
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const handleAddWallet = async () => {
    if (!newWalletAddress.trim()) return;
    
    // Basic validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(newWalletAddress.trim())) {
      return;
    }
    
    setAdding(true);
    const success = await trackWallet(newWalletAddress.trim(), newNickname.trim() || undefined);
    if (success) {
      setNewWalletAddress('');
      setNewNickname('');
    }
    setAdding(false);
  };

  const handleUpdateNickname = async (walletAddress: string) => {
    await updateNickname(walletAddress, editNickname);
    setEditingWallet(null);
    setEditNickname('');
  };

  const startEditing = (walletAddress: string, currentNickname: string | null) => {
    setEditingWallet(walletAddress);
    setEditNickname(currentNickname || '');
  };

  const filteredWallets = trackedWallets.filter(wallet => 
    wallet.wallet_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (wallet.nickname && wallet.nickname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Not logged in state
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="container mx-auto px-4 pt-24 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center"
          >
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-primary blur-xl opacity-30" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
                <Wallet className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-3">Track Top Wallets</h1>
            <p className="text-muted-foreground mb-6">
              Sign in to track and analyze Polymarket wallets. Follow the best traders and learn from their strategies.
            </p>
            <Button onClick={() => navigate('/auth')} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Sign In to Track Wallets
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CyberParticles />
      <TopBar />

      <main className="container mx-auto px-4 pt-20 pb-24 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary blur-xl opacity-30" />
                <div className="relative p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
                  <Star className="w-6 h-6 text-primary fill-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Tracked Wallets</h1>
                <p className="text-sm text-muted-foreground">
                  {trackedWallets.length} wallet{trackedWallets.length !== 1 ? 's' : ''} tracked
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHowItWorks(true)}
                className="gap-2"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">How it works</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/help')}
                className="text-muted-foreground"
              >
                <Info className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Add Wallet Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl bg-card/50 border border-border/30 backdrop-blur-sm mb-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Add New Wallet</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="0x... wallet address"
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                className="flex-1 bg-background/50 font-mono text-sm"
              />
              <Input
                placeholder="Nickname (optional)"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="sm:w-40 bg-background/50"
              />
              <Button
                onClick={handleAddWallet}
                disabled={adding || !newWalletAddress.trim()}
                className="gap-2"
              >
                {adding ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                    <Zap className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Track
              </Button>
            </div>
          </motion.div>

          {/* Search */}
          {trackedWallets.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search wallets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card/50 border-border/50"
              />
            </div>
          )}
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <LoadingSkeleton />
          ) : filteredWallets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-muted blur-xl opacity-30" />
                <div className="relative p-4 rounded-2xl bg-muted/20 border border-border/30">
                  <Users className="w-10 h-10 text-muted-foreground" />
                </div>
              </div>
              <p className="text-muted-foreground mb-2">
                {searchTerm ? 'No wallets match your search' : 'No wallets tracked yet'}
              </p>
              {!searchTerm && (
                <p className="text-sm text-muted-foreground">
                  Add a wallet address above to start tracking
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {filteredWallets.map((wallet, index) => (
                <motion.div
                  key={wallet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "group relative rounded-xl bg-card/50 border border-border/30",
                    "hover:border-primary/30 transition-all duration-300",
                    "backdrop-blur-sm overflow-hidden"
                  )}
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative p-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div
                      onClick={() => navigate(`/wallet/${wallet.wallet_address}`)}
                      className="cursor-pointer"
                    >
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                          <Bell className="w-2 h-2 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {editingWallet === wallet.wallet_address ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editNickname}
                            onChange={(e) => setEditNickname(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Enter nickname"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateNickname(wallet.wallet_address);
                              if (e.key === 'Escape') setEditingWallet(null);
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateNickname(wallet.wallet_address)}
                            className="h-8 w-8 p-0"
                          >
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingWallet(null)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            {wallet.nickname && (
                              <span className="font-semibold">{wallet.nickname}</span>
                            )}
                            <span className={cn(
                              "font-mono text-sm truncate",
                              wallet.nickname ? "text-muted-foreground" : ""
                            )}>
                              {wallet.wallet_address.slice(0, 8)}...{wallet.wallet_address.slice(-6)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Added {new Date(wallet.created_at || '').toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {editingWallet !== wallet.wallet_address && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(wallet.wallet_address, wallet.nickname)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/wallet/${wallet.wallet_address}`)}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => untrackWallet(wallet.wallet_address)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <HowItWorksModal open={showHowItWorks} onOpenChange={setShowHowItWorks} />
    </div>
  );
}
