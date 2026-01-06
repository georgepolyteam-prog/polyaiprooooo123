import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type PolyMarket } from '@/hooks/usePolymarketTerminal';
import { MarketTradeModal } from '@/components/MarketTradeModal';

interface PolyTradePanelProps {
  market: PolyMarket;
  compact?: boolean;
}

export function PolyTradePanel({ market, compact = false }: PolyTradePanelProps) {
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [amount, setAmount] = useState('10');
  const [limitPrice, setLimitPrice] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const marketPrice = side === 'YES' ? market.yesPrice : market.noPrice;
  const effectivePrice = orderType === 'limit' && limitPrice ? Number(limitPrice) : marketPrice;
  const shares = amount && effectivePrice > 0 ? (Number(amount) / (effectivePrice / 100)).toFixed(2) : '--';
  const potentialWin = amount && effectivePrice > 0 ? ((Number(amount) / (effectivePrice / 100)) - Number(amount)).toFixed(2) : '--';

  const openTradeModal = () => {
    setLoading(true);
    setShowModal(true);
    setTimeout(() => setLoading(false), 200);
  };

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('bg-card/50 p-3 h-full overflow-auto', compact && 'p-2')}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-foreground">Trade</h3>
          <a
            href={market.marketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            Open
          </a>
        </div>

        {/* Side selector */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => setSide('YES')}
            className={cn(
              'flex items-center justify-center gap-1 h-8 rounded-lg text-[11px] font-medium transition-all border',
              side === 'YES'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-muted/30 border-border/30 text-muted-foreground hover:border-emerald-500/40'
            )}
          >
            <TrendingUp className="w-3 h-3" />
            YES {market.yesPrice}¢
          </button>
          <button
            type="button"
            onClick={() => setSide('NO')}
            className={cn(
              'flex items-center justify-center gap-1 h-8 rounded-lg text-[11px] font-medium transition-all border',
              side === 'NO'
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-muted/30 border-border/30 text-muted-foreground hover:border-red-500/40'
            )}
          >
            <TrendingDown className="w-3 h-3" />
            NO {market.noPrice}¢
          </button>
        </div>

        {/* Order Type Toggle */}
        <div className="flex items-center gap-1 mb-2 p-0.5 rounded-lg bg-muted/30 border border-border/30">
          <button
            type="button"
            onClick={() => setOrderType('market')}
            className={cn(
              'flex-1 py-1 text-[10px] font-medium rounded transition-all',
              orderType === 'market'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Market
          </button>
          <button
            type="button"
            onClick={() => setOrderType('limit')}
            className={cn(
              'flex-1 py-1 text-[10px] font-medium rounded transition-all',
              orderType === 'limit'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Limit
          </button>
        </div>

        {/* Amount & Limit Price */}
        <div className={cn('grid gap-2 mb-2', orderType === 'limit' ? 'grid-cols-2' : 'grid-cols-1')}>
          <div>
            <label className="block text-[9px] text-muted-foreground mb-0.5">Amount (USD)</label>
            <Input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-7 text-xs bg-muted/40 border-border/30"
              placeholder="10"
            />
          </div>
          {orderType === 'limit' && (
            <div>
              <label className="block text-[9px] text-muted-foreground mb-0.5">Limit Price (¢)</label>
              <Input
                type="number"
                min={1}
                max={99}
                step={1}
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="h-7 text-xs bg-muted/40 border-border/30"
                placeholder={String(marketPrice)}
              />
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-1.5 text-center text-[10px] mb-2">
          <div className="p-1.5 rounded-lg bg-background/30 border border-border/20">
            <p className="text-muted-foreground text-[9px]">Est. Shares</p>
            <p className="font-medium text-foreground">{shares}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-background/30 border border-border/20">
            <p className="text-muted-foreground text-[9px]">Potential Win</p>
            <p className={cn('font-medium', potentialWin !== '--' ? 'text-emerald-400' : 'text-foreground')}>
              {potentialWin !== '--' ? `+$${potentialWin}` : '--'}
            </p>
          </div>
        </div>

        {/* Trade button */}
        <Button
          className={cn(
            'w-full h-9 font-semibold rounded-lg transition-all text-xs',
            side === 'YES'
              ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
          )}
          onClick={openTradeModal}
          disabled={loading || !amount || Number(amount) <= 0 || (orderType === 'limit' && (!limitPrice || Number(limitPrice) <= 0))}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              {orderType === 'limit' ? 'LIMIT' : 'BUY'} {side} @ {effectivePrice}¢
            </>
          )}
        </Button>
      </motion.section>

      {showModal && (
        <MarketTradeModal
          open={showModal}
          onOpenChange={setShowModal}
          marketData={{
            yesTokenId: market.yesTokenId ?? null,
            noTokenId: market.noTokenId ?? null,
            conditionId: market.conditionId,
            title: market.title,
            currentPrice: effectivePrice / 100,
            url: market.marketUrl,
            eventSlug: market.eventSlug,
            marketSlug: market.slug,
          }}
          defaultSide={side}
        />
      )}
    </>
  );
}
