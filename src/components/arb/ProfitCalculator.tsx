import { useState, useMemo } from 'react';
import { Calculator, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ProfitCalculatorProps {
  buyPrice?: number;
  sellPrice?: number;
  spreadPercent?: number;
}

export function ProfitCalculator({ 
  buyPrice = 60, 
  sellPrice = 65,
  spreadPercent = 8.33,
}: ProfitCalculatorProps) {
  const [investment, setInvestment] = useState<string>('100');

  const calculations = useMemo(() => {
    const investmentAmount = parseFloat(investment) || 0;
    if (investmentAmount <= 0 || buyPrice <= 0) {
      return null;
    }

    // Calculate contracts and profit
    const contracts = Math.floor((investmentAmount * 100) / buyPrice);
    const grossRevenue = (contracts * sellPrice) / 100;
    const grossProfit = grossRevenue - investmentAmount;
    
    // Assume 1% fee per platform (2% total)
    const totalFees = investmentAmount * 0.02;
    const netProfit = grossProfit - totalFees;
    const netRoi = ((netProfit / investmentAmount) * 100);

    return {
      contracts,
      grossRevenue: grossRevenue.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      totalFees: totalFees.toFixed(2),
      netProfit: netProfit.toFixed(2),
      netRoi: netRoi.toFixed(2),
      isProfitable: netProfit > 0,
    };
  }, [investment, buyPrice, sellPrice]);

  return (
    <Card className="bg-card/50 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Profit Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Investment Input */}
        <div className="space-y-2">
          <Label htmlFor="investment" className="text-xs text-muted-foreground">
            Investment Amount
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="investment"
              type="number"
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              className="pl-8"
              placeholder="100"
              min={0}
            />
          </div>
        </div>

        {/* Price Display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
            <div className="text-xs text-emerald-400/70 mb-1">Buy @ Kalshi</div>
            <div className="text-lg font-bold text-emerald-400">{buyPrice}¢</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
            <div className="text-xs text-red-400/70 mb-1">Sell @ Polymarket</div>
            <div className="text-lg font-bold text-red-400">{sellPrice}¢</div>
          </div>
        </div>

        {/* Spread Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/20 border border-primary/30 rounded-full">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-semibold text-primary">
              {spreadPercent.toFixed(1)}% Spread
            </span>
          </div>
        </div>

        {/* Calculations */}
        {calculations && (
          <div className="space-y-2 pt-3 border-t border-white/10">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Contracts</span>
              <span className="font-medium">{calculations.contracts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross Revenue</span>
              <span className="font-medium">${calculations.grossRevenue}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross Profit</span>
              <span className="font-medium text-emerald-400">+${calculations.grossProfit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Fees (~2%)</span>
              <span className="font-medium text-red-400">-${calculations.totalFees}</span>
            </div>
            <div className="h-px bg-white/10 my-2" />
            <div className="flex justify-between text-base">
              <span className="font-semibold">Net Profit</span>
              <span className={cn(
                'font-bold',
                calculations.isProfitable ? 'text-emerald-400' : 'text-red-400'
              )}>
                {calculations.isProfitable ? '+' : ''}${calculations.netProfit}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Net ROI</span>
              <span className={cn(
                'font-semibold',
                calculations.isProfitable ? 'text-emerald-400' : 'text-red-400'
              )}>
                {calculations.isProfitable ? '+' : ''}{calculations.netRoi}%
              </span>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-tight">
            Estimates only. Actual profits depend on execution prices, liquidity, and platform fees.
            Arbitrage carries risk of slippage and market movement.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
