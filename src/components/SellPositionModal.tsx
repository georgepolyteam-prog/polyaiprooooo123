import { useState, useMemo } from "react";
import { X, TrendingDown, AlertCircle, Loader2, DollarSign, Percent, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const MIN_ORDER_SIZE = 5; // Polymarket minimum order size

interface Position {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  outcome: string;
  title: string;
  eventSlug: string;
}

interface SellPositionModalProps {
  position: Position;
  onClose: () => void;
  onSell: (amount: number, price: number, isMarketOrder?: boolean) => Promise<void>;
}

export function SellPositionModal({ position, onClose, onSell }: SellPositionModalProps) {
  const [amount, setAmount] = useState(position.size);
  const [price, setPrice] = useState(position.curPrice);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sliderValue, setSliderValue] = useState([100]);
  const [isMarketOrder, setIsMarketOrder] = useState(true); // Default to market order for immediate execution

  // For market orders, use actual market price (SDK handles best execution for FOK orders)
  const effectivePrice = isMarketOrder 
    ? position.curPrice
    : price;

  // Normalize price to valid tick size
  const normalizedPrice = useMemo(() => {
    const rounded = Math.round(effectivePrice * 100) / 100;
    return Math.max(0.01, Math.min(0.99, rounded));
  }, [effectivePrice]);

  const priceWasAdjusted = Math.abs(effectivePrice - normalizedPrice) > 0.001;

  const estimatedProceeds = amount * normalizedPrice;
  const estimatedPnl = (normalizedPrice - position.avgPrice) * amount;
  const pnlPercent = position.avgPrice > 0 ? ((normalizedPrice - position.avgPrice) / position.avgPrice) * 100 : 0;

  // Validation
  const isBelowMinSize = amount < MIN_ORDER_SIZE;
  const isValidAmount = amount > 0 && amount <= position.size;
  const isValidPrice = normalizedPrice > 0 && normalizedPrice <= 1;
  const canSubmit = isValidAmount && isValidPrice && !isBelowMinSize;

  const handleSliderChange = (value: number[]) => {
    setSliderValue(value);
    setAmount(Math.round((position.size * value[0] / 100) * 100) / 100);
  };

  const handleSell = async () => {
    if (!canSubmit) {
      if (isBelowMinSize) {
        toast.error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
      } else if (!isValidAmount) {
        toast.error("Invalid amount");
      } else if (!isValidPrice) {
        toast.error("Price must be between 0.01 and 0.99");
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSell(amount, normalizedPrice, isMarketOrder);
      onClose();
    } catch (error) {
      console.error("Sell failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl shadow-primary/20 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-rose-500/10 to-orange-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Sell Position</h2>
                <p className="text-sm text-gray-400">Exit your position</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Position Info */}
        <div className="p-6 border-b border-white/5">
          <h3 className="text-white font-medium mb-2 line-clamp-2">{position.title}</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-1 rounded-md font-medium ${
              position.outcome === 'Yes' || position.outcome === 'YES'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}>
              {position.outcome}
            </span>
            <span className="text-gray-400">
              {position.size.toFixed(2)} shares @ {(position.avgPrice * 100).toFixed(1)}¢ avg
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-400">
            Current: <span className="text-white font-medium">{(position.curPrice * 100).toFixed(1)}¢</span>
            {" · "}
            P&L: <span className={position.cashPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {position.cashPnl >= 0 ? "+" : ""}${position.cashPnl.toFixed(2)} ({position.percentPnl.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Sell Form */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Order Type Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              {isMarketOrder ? (
                <Zap className="w-5 h-5 text-amber-400" />
              ) : (
                <Clock className="w-5 h-5 text-blue-400" />
              )}
              <div>
                <span className="text-white font-medium">
                  {isMarketOrder ? "Market Order" : "Limit Order"}
                </span>
                <p className="text-xs text-gray-400">
                  {isMarketOrder ? "Sells immediately at best price" : "Sets specific price, may not fill"}
                </p>
              </div>
            </div>
            <Switch
              checked={isMarketOrder}
              onCheckedChange={setIsMarketOrder}
            />
          </div>

          {/* Amount Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Amount to Sell</Label>
              <span className="text-sm text-primary font-medium">{sliderValue[0]}%</span>
            </div>
            <Slider
              value={sliderValue}
              onValueChange={handleSliderChange}
              max={100}
              min={1}
              step={1}
              className="py-2"
            />
            <div className="flex gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <Button
                  key={pct}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSliderChange([pct])}
                  className={`flex-1 ${sliderValue[0] === pct ? 'border-primary text-primary' : ''}`}
                >
                  {pct}%
                </Button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label className="text-gray-300">Shares</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setAmount(Math.min(val, position.size));
                setSliderValue([Math.round((val / position.size) * 100)]);
              }}
              max={position.size}
              min={0.01}
              step={0.01}
              className={`bg-white/5 border-white/10 text-white ${isBelowMinSize ? 'border-rose-500/50' : ''}`}
            />
            {isBelowMinSize && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Minimum order size is {MIN_ORDER_SIZE} shares
              </p>
            )}
          </div>

          {/* Price Input (only for limit orders) */}
          {!isMarketOrder && (
            <div className="space-y-2">
              <Label className="text-gray-300">Limit Price</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  max={0.99}
                  min={0.01}
                  step={0.01}
                  className="bg-white/5 border-white/10 text-white pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  ({(price * 100).toFixed(0)}¢)
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Market price: {(position.curPrice * 100).toFixed(1)}¢
              </p>
            </div>
          )}

          {/* Price Adjustment Warning */}
          {priceWasAdjusted && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-200/80">
                Price adjusted to {(normalizedPrice * 100).toFixed(0)}¢ to match valid tick size.
              </p>
            </div>
          )}

          {/* Preview */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Est. Proceeds
              </span>
              <span className="text-white font-medium">${estimatedProceeds.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Est. P&L
              </span>
              <span className={`font-medium ${estimatedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {estimatedPnl >= 0 ? '+' : ''}${estimatedPnl.toFixed(2)} ({pnlPercent.toFixed(1)}%)
              </span>
            </div>
            {isMarketOrder && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
                <span className="text-gray-400">Sell Price</span>
                <span className="text-amber-400 font-medium">
                  ~{(normalizedPrice * 100).toFixed(0)}¢ (market)
                </span>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/80">
              {isMarketOrder 
                ? "Market orders sell at the best available price for immediate execution."
                : "Limit orders may not fill immediately if the market price moves."}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSell}
              disabled={isSubmitting || !canSubmit}
              className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : (
                <>Sell {amount.toFixed(2)} Shares</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
