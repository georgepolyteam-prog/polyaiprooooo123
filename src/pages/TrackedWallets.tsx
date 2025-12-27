import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Trash2, ExternalLink, Plus, Search, Edit2, Check, X, Users, Sparkles, Loader2 } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrackedWallets } from '@/hooks/useTrackedWallets';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function TrackedWallets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trackedWallets, loading, trackWallet, untrackWallet, updateNickname } = useTrackedWallets();
  
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddWallet = async () => {
    if (!newWalletAddress.trim()) return;
    
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="glass-card rounded-2xl p-8 text-center max-w-md border border-border/30">
            <Star className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Track Your Favorite Wallets</h2>
            <p className="text-muted-foreground mb-6">
              Sign in to start tracking wallets and filter trades from traders you follow.
            </p>
            <Button 
              onClick={() => navigate('/auth')}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              Sign In to Continue
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <TopBar />
      
      <div className="max-w-4xl mx-auto px-4 py-8 pt-20">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-4 border border-primary/30">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Wallet Tracking</span>
          </div>
          
          <h1 className="text-4xl font-bold gradient-text mb-2">
            Tracked Wallets
          </h1>
          <p className="text-muted-foreground">
            Follow traders and filter live trades by your favorite wallets
          </p>
        </motion.div>

        {/* Add New Wallet Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-6 mb-6 border border-border/30"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add New Wallet
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Wallet address (0x...)"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              className="flex-1 h-12"
            />
            <Input
              placeholder="Nickname (optional)"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              className="sm:w-48 h-12"
            />
            <Button 
              onClick={handleAddWallet}
              disabled={adding || !newWalletAddress.trim()}
              className="h-12 px-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Track
            </Button>
          </div>
        </motion.div>

        {/* Search */}
        {trackedWallets.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search wallets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12"
              />
            </div>
          </motion.div>
        )}

        {/* Wallets List */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card rounded-2xl p-8 text-center border border-border/30"
            >
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground mt-4">Loading your tracked wallets...</p>
            </motion.div>
          ) : filteredWallets.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card rounded-2xl p-12 text-center border border-border/30"
            >
              <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {searchTerm ? 'No wallets found' : 'No tracked wallets yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm 
                  ? 'Try a different search term'
                  : 'Start by adding a wallet address above to track their trades'
                }
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Pro tip: Track whale wallets from the Live Trades page</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl overflow-hidden border border-border/30"
            >
              <div className="p-4 border-b border-border/30 bg-muted/10">
                <span className="text-sm text-muted-foreground">
                  {filteredWallets.length} wallet{filteredWallets.length !== 1 ? 's' : ''} tracked
                </span>
              </div>
              
              <div className="divide-y divide-border/20">
                {filteredWallets.map((wallet, index) => (
                  <motion.div
                    key={wallet.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 hover:bg-muted/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Star Icon */}
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Star className="w-5 h-5 text-primary fill-primary" />
                      </div>
                      
                      {/* Wallet Info */}
                      <div className="flex-1 min-w-0">
                        {editingWallet === wallet.wallet_address ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editNickname}
                              onChange={(e) => setEditNickname(e.target.value)}
                              placeholder="Enter nickname"
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateNickname(wallet.wallet_address);
                                if (e.key === 'Escape') setEditingWallet(null);
                              }}
                            />
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8"
                              onClick={() => handleUpdateNickname(wallet.wallet_address)}
                            >
                              <Check className="w-4 h-4 text-success" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8"
                              onClick={() => setEditingWallet(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              {wallet.nickname && (
                                <span className="font-medium text-foreground">
                                  {wallet.nickname}
                                </span>
                              )}
                              <button
                                onClick={() => startEditing(wallet.wallet_address, wallet.nickname)}
                                className="p-1 hover:bg-muted rounded transition-colors"
                              >
                                <Edit2 className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </div>
                            <button
                              onClick={() => navigate(`/wallet/${wallet.wallet_address}`)}
                              className="font-mono text-sm text-primary hover:underline truncate block"
                            >
                              {wallet.wallet_address.slice(0, 10)}...{wallet.wallet_address.slice(-8)}
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/wallet/${wallet.wallet_address}`)}
                          className="h-9 w-9"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => untrackWallet(wallet.wallet_address)}
                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 p-6 rounded-xl bg-primary/5 border border-primary/20"
        >
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            How Wallet Tracking Works
          </h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Track any wallet address to follow their trading activity</li>
            <li>• Use the "Tracked Only" filter in Live Trades to see only their trades</li>
            <li>• Add nicknames to easily identify wallets</li>
            <li>• Click any trade in the live feed and hit the ⭐ button to track that wallet</li>
          </ul>
        </motion.div>
      </div>
      
      <Footer />
    </div>
  );
}
