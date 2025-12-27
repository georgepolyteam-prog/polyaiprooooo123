import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown, Target, BarChart2, Clock, Zap, AlertTriangle, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import polyLogo from "@/assets/poly-logo-new.png";

interface AnalyzedMarket {
  id: string;
  title: string;
  currentOdds: number;
  volume24h: number;
  liquidity: number;
  slug: string;
  category: string;
  polyProbability: number;
  edge: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  recommendation: "BUY YES" | "BUY NO" | "HOLD";
  reasoning?: string;
  edgeScore?: number;
  endDate?: string;
  imageUrl?: string;
}

interface MarketAnalysisModalProps {
  market: AnalyzedMarket | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatVolume = (vol: number) => {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
  if (vol >= 1000) return `$${Math.round(vol / 1000).toLocaleString()}K`;
  return `$${vol.toFixed(0)}`;
};

const getCategoryIcon = (category: string): string => {
  const cat = category?.toLowerCase() || "";
  if (cat.includes("sport") || cat.includes("nfl") || cat.includes("nba") || cat.includes("soccer")) return "🏈";
  if (cat.includes("politic") || cat.includes("election") || cat.includes("trump") || cat.includes("biden"))
    return "🏛️";
  if (cat.includes("crypto") || cat.includes("bitcoin") || cat.includes("eth")) return "💰";
  if (cat.includes("tech") || cat.includes("ai")) return "🤖";
  if (cat.includes("entertainment") || cat.includes("movie") || cat.includes("oscar")) return "🎬";
  if (cat.includes("science") || cat.includes("space")) return "🚀";
  return "📊";
};

export const MarketAnalysisModal = ({ market, isOpen, onClose }: MarketAnalysisModalProps) => {
  if (!market) return null;

  const generateDetailedAnalysis = (m: AnalyzedMarket): string => {
    const absEdge = Math.abs(m.edge);
    const isUnderpriced = m.edge > 0;

    let analysis = "";

    // Market assessment
    if (absEdge >= 10) {
      analysis += `This market shows significant mispricing. `;
    } else if (absEdge >= 5) {
      analysis += `Moderate edge detected in this market. `;
    } else {
      analysis += `This market appears fairly priced with minimal edge. `;
    }

    // Direction explanation
    if (m.recommendation === "BUY YES") {
      analysis += `The current YES price of ${m.currentOdds}% appears undervalued. My probability estimate is ${m.polyProbability}%, suggesting YES shares offer value at current levels. `;
    } else if (m.recommendation === "BUY NO") {
      analysis += `The current YES price of ${m.currentOdds}% appears overvalued. My probability estimate is ${m.polyProbability}%, suggesting NO shares offer better value. `;
    } else {
      analysis += `At ${m.currentOdds}%, this market is close to fair value. Waiting for better entry is recommended. `;
    }

    // Volume context
    if (m.volume24h >= 500000) {
      analysis += `High volume ($${(m.volume24h / 1000000).toFixed(1)}M) indicates strong market interest and liquidity. `;
    } else if (m.volume24h >= 100000) {
      analysis += `Decent volume supports trade execution. `;
    } else {
      analysis += `Lower volume may impact execution. Consider position sizing. `;
    }

    // Risk factors
    if (m.confidence === "HIGH") {
      analysis += `High confidence in this analysis based on available data and market conditions.`;
    } else if (m.confidence === "MEDIUM") {
      analysis += `Medium confidence - some uncertainty remains. Consider reducing position size.`;
    } else {
      analysis += `Lower confidence signal - high uncertainty. Small position or skip recommended.`;
    }

    return analysis;
  };

  const getKeyFactors = (m: AnalyzedMarket): string[] => {
    const factors: string[] = [];

    if (Math.abs(m.edge) >= 10) factors.push("Strong edge detected");
    if (m.volume24h >= 500000) factors.push("High liquidity market");
    if (m.confidence === "HIGH") factors.push("High model confidence");
    if (m.currentOdds < 20 || m.currentOdds > 80) factors.push("Extreme odds - higher risk");
    if (m.polyProbability !== m.currentOdds) factors.push("Price-probability divergence");

    return factors.length > 0 ? factors : ["Market shows normal trading patterns"];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-50 rounded-full p-2 bg-muted hover:bg-muted/80 transition-colors md:hidden"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
        <DialogHeader>
          <div className="flex items-start gap-4">
            {market.imageUrl ? (
              <img
                src={market.imageUrl}
                alt={market.title}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <span className={cn("text-3xl", market.imageUrl && "hidden")}>{getCategoryIcon(market.category)}</span>
            <div className="flex-1">
              <div className="text-xs text-primary font-medium mb-1">{market.category}</div>
              <DialogTitle className="text-xl font-semibold text-foreground leading-tight">{market.title}</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Market Odds</div>
              <div className="text-2xl font-bold font-mono text-foreground">{market.currentOdds}%</div>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Poly's Estimate</div>
              <div className="text-2xl font-bold font-mono text-primary">{market.polyProbability}%</div>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Edge</div>
              <div
                className={cn(
                  "text-2xl font-bold font-mono flex items-center justify-center gap-1",
                  market.edge > 0 ? "text-primary" : market.edge < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {market.edge > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {market.edge > 0 ? "+" : ""}
                {market.edge}%
              </div>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Score</div>
              <div
                className={cn(
                  "text-2xl font-bold font-mono",
                  market.edgeScore && market.edgeScore >= 80 ? "text-primary" : "text-foreground",
                )}
              >
                {market.edgeScore || 50}
              </div>
            </div>
          </div>

          {/* Recommendation Banner */}
          <div
            className={cn(
              "rounded-xl p-5 flex items-center gap-4",
              market.recommendation === "BUY YES" && "bg-primary/10 border border-primary/30",
              market.recommendation === "BUY NO" && "bg-destructive/10 border border-destructive/30",
              market.recommendation === "HOLD" && "bg-muted border border-border",
            )}
          >
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center",
                market.recommendation === "BUY YES" && "bg-primary/20",
                market.recommendation === "BUY NO" && "bg-destructive/20",
                market.recommendation === "HOLD" && "bg-muted",
              )}
            >
              {market.recommendation === "BUY YES" && <TrendingUp className="w-7 h-7 text-primary" />}
              {market.recommendation === "BUY NO" && <TrendingDown className="w-7 h-7 text-destructive" />}
              {market.recommendation === "HOLD" && <Target className="w-7 h-7 text-muted-foreground" />}
            </div>
            <div>
              <div
                className={cn(
                  "text-xl font-bold",
                  market.recommendation === "BUY YES" && "text-primary",
                  market.recommendation === "BUY NO" && "text-destructive",
                  market.recommendation === "HOLD" && "text-muted-foreground",
                )}
              >
                {market.recommendation}
              </div>
              <div className="text-sm text-muted-foreground">
                {market.recommendation === "BUY YES" && "Market undervalued - opportunity to buy YES"}
                {market.recommendation === "BUY NO" && "Market overvalued - opportunity to buy NO"}
                {market.recommendation === "HOLD" && "No clear edge - wait for better entry"}
              </div>
            </div>
            <div
              className={cn(
                "ml-auto px-4 py-2 rounded-full text-sm font-semibold",
                market.confidence === "HIGH" && "bg-primary/20 text-primary",
                market.confidence === "MEDIUM" && "bg-warning/20 text-warning",
                market.confidence === "LOW" && "bg-muted text-muted-foreground",
              )}
            >
              {market.confidence} Confidence
            </div>
          </div>

          {/* Poly AI's Analysis */}
          <div className="bg-accent/50 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <img src={polyLogo} alt="Poly" className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-primary mb-2">Poly's Analysis</div>
                <p className="text-sm text-foreground leading-relaxed">
                  {market.reasoning || generateDetailedAnalysis(market)}
                </p>
              </div>
            </div>
          </div>

          {/* Key Factors */}
          <div>
            <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Key Factors
            </div>
            <div className="flex flex-wrap gap-2">
              {getKeyFactors(market).map((factor, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-muted rounded-full text-xs text-foreground flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3 h-3 text-primary" />
                  {factor}
                </span>
              ))}
            </div>
          </div>

          {/* Market Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <BarChart2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">24h Volume</div>
                <div className="font-semibold text-foreground">{formatVolume(market.volume24h)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Liquidity</div>
                <div className="font-semibold text-foreground">{formatVolume(market.liquidity)}</div>
              </div>
            </div>
          </div>

          {/* Risk Warning */}
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning">
              This is AI-generated analysis for informational purposes. Always do your own research before trading. Past
              performance doesn't guarantee future results.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
