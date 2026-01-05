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
  const [amount, setAmount] = useState('10');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const price = side === 'YES' ? market.yesPrice : market.noPrice;
  const shares = amount && price > 0 ? (Number(amount) / (price / 100)).toFixed(2) : '--';
  const potentialWin = amount && price > 0 ? ((Number(amount) / (price / 100)) - Number(amount)).toFixed(2) : '--';

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
        className={cn('rounded-2xl bg-muted/30 border border-border/50 p-4', compact && 'p-3')}
      >
        {/* Header */}
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          Trade
          <a
            href={market.marketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Polymarket
          </a>
        </h3>

        {/* Side selector */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setSide('YES')}
            className={cn(
              'flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium transition-all border',
              side === 'YES'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-muted/30 border-border/30 text-muted-foreground hover:border-emerald-500/40'
            )}
          >
            <TrendingUp className="w-4 h-4" />
            YES {market.yesPrice}¢
          </button>
          <button
            type="button"
            onClick={() => setSide('NO')}
            className={cn(
              'flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium transition-all border',
              side === 'NO'
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-muted/30 border-border/30 text-muted-foreground hover:border-red-500/40'
            )}
          >
            <TrendingDown className="w-4 h-4" />
            NO {market.noPrice}¢
          </button>
        </div>

        {/* Amount */}
        <label className="block text-[10px] text-muted-foreground mb-1">Amount (USD)</label>
        <Input
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-9 text-sm mb-3 bg-muted/40 border-border/30"
          placeholder="10"
        />

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2 text-center text-[11px] mb-4">
          <div className="p-2 rounded-lg bg-background/30 border border-border/20">
            <p className="text-muted-foreground">Est. Shares</p>
            <p className="font-medium text-foreground">{shares}</p>
          </div>
          <div className="p-2 rounded-lg bg-background/30 border border-border/20">
            <p className="text-muted-foreground">Potential Win</p>
            <p className={cn('font-medium', potentialWin !== '--' && '+' + potentialWin !== '--' ? 'text-emerald-400' : 'text-foreground')}>
              {potentialWin !== '--' ? `+$${potentialWin}` : '--'}
            </p>
          </div>
        </div>

        {/* Trade button */}
        <Button
          className={cn(
            'w-full h-11 font-semibold rounded-xl transition-all',
            side === 'YES'
              ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
          )}
          onClick={openTradeModal}
          disabled={loading || !amount || Number(amount) <= 0}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              BUY {side} @ {price}¢
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
            currentPrice: price / 100,
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
