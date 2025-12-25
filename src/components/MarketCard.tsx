import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, MessageSquare, ExternalLink, ChevronDown, Users, Flame, Crown, ArrowRightLeft, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarketTradeModal } from "@/components/MarketTradeModal";
interface MarketOutcome {
  id: string;
  question: string;
  slug: string;
  yesPrice: number;
  volume: number;
  volume24hr: number;
  liquidity: number;
  // Trading data
  yesTokenId?: string;
  noTokenId?: string;
  conditionId?: string;
}

export interface EventMarket {
  eventSlug: string;
  eventTitle: string;
  category: string;
  image?: string;
  endDate?: string;
  totalVolume: number;
  totalVolume24hr: number;
  totalLiquidity: number;
  outcomes: MarketOutcome[];
}

interface MarketCardProps {
  event: EventMarket;
}

const formatVolume = (vol: number) => {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
};

// Whale indicator based on volume thresholds
const getWhaleIndicator = (volume: number, liquidity: number) => {
  const whaleScore = (volume / 1000000) + (liquidity / 500000);
  if (whaleScore > 5) return { level: "mega", label: "Mega Whale Activity", icon: Crown, color: "text-yellow-500" };
  if (whaleScore > 2) return { level: "high", label: "High Whale Activity", icon: Flame, color: "text-orange-500" };
  if (whaleScore > 0.5) return { level: "moderate", label: "Active Trading", icon: Users, color: "text-primary" };
  return null;
};

export const MarketCard = ({ event }: MarketCardProps) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(event.outcomes.length <= 3);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [loadingSide, setLoadingSide] = useState<'YES' | 'NO' | null>(null);
  const [defaultTradeSide, setDefaultTradeSide] = useState<'YES' | 'NO'>('YES');
  
  const isSingleOutcome = event.outcomes.length === 1;
  const hasMultipleOutcomes = event.outcomes.length > 1;
  const whaleIndicator = getWhaleIndicator(event.totalVolume, event.totalLiquidity);
  
  // Sort outcomes by price (highest first)
  const sortedOutcomes = [...event.outcomes].sort((a, b) => b.yesPrice - a.yesPrice);
  const displayedOutcomes = isExpanded ? sortedOutcomes : sortedOutcomes.slice(0, 4);
  const hiddenCount = sortedOutcomes.length - 4;

  const askAboutEvent = () => {
    navigate(`/?market=${encodeURIComponent(event.eventTitle)}`);
  };

  const askAboutOutcome = (outcome: MarketOutcome, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/?market=${encodeURIComponent(outcome.question)}`);
  };

  const openTradeModal = (outcome: MarketOutcome, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOutcome(outcome);
    setTradeModalOpen(true);
  };

  const openTradeForSingleOutcome = (side: 'YES' | 'NO') => {
    if (sortedOutcomes.length > 0) {
      setLoadingSide(side);
      setDefaultTradeSide(side);
      // Small delay for loading state visibility
      setTimeout(() => {
        setSelectedOutcome(sortedOutcomes[0]);
        setTradeModalOpen(true);
        setLoadingSide(null);
      }, 150);
    }
  };

  // Check if any outcome has trading data
  const hasAnyTradingData = event.outcomes.some(o => o.yesTokenId || o.conditionId);

  return (
    <>
      <div 
        className="group market-card-simple bg-card border border-border rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs font-medium">
                  {event.category}
                </Badge>
                {hasMultipleOutcomes && (
                  <Badge variant="outline" className="text-xs">
                    {event.outcomes.length} outcomes
                  </Badge>
                )}
                {whaleIndicator && (
                  <Badge variant="outline" className={cn("text-xs gap-1", whaleIndicator.color)}>
                    <whaleIndicator.icon className="w-3 h-3" />
                    {whaleIndicator.level === "mega" ? "🐋" : whaleIndicator.level === "high" ? "🔥" : ""}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-lg text-foreground leading-snug">
                {event.eventTitle}
              </h3>
            </div>
            <a
              href={`https://polymarket.com/event/${event.eventSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0 p-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              {formatVolume(event.totalVolume24hr)} 24h
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span>{formatVolume(event.totalVolume)} total</span>
            <span className="text-muted-foreground/30">•</span>
            <span>{formatVolume(event.totalLiquidity)} liquidity</span>
          </div>
        </div>

        {/* Outcomes Section */}
        <div className="border-t border-border/50">
          {isSingleOutcome ? (
            /* Single Outcome - Simple YES/NO Display */
            <div className="p-5">
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <div className="text-4xl font-bold text-primary tabular-nums">
                    {Math.round(sortedOutcomes[0].yesPrice * 100)}%
                  </div>
                  <div className="text-sm font-medium text-primary/70 mt-0.5">YES</div>
                </div>
                <div className="text-xl text-muted-foreground/30">/</div>
                <div>
                  <div className="text-4xl font-bold text-muted-foreground/50 tabular-nums">
                    {Math.round((1 - sortedOutcomes[0].yesPrice) * 100)}%
                  </div>
                  <div className="text-sm font-medium text-muted-foreground mt-0.5">NO</div>
                </div>
              </div>
            </div>
          ) : (
            /* Multi-Outcome - Epic List */
            <div className="divide-y divide-border/30">
              {displayedOutcomes.map((outcome, index) => (
                <div
                  key={outcome.id}
                  className="outcome-row-simple flex items-center gap-3 px-5 py-3 group/item"
                >
                  {/* Rank Badge */}
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
                    index === 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>

                  {/* Outcome Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {outcome.question.replace(event.eventTitle, '').replace(/^[:\-–—]?\s*/, '').trim() || outcome.question}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatVolume(outcome.volume24hr)} 24h</span>
                    </div>
                  </div>

                  {/* Probability Bar */}
                  <div className="w-24 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        outcome.yesPrice >= 0.5 ? "text-emerald-500" : "text-muted-foreground"
                      )}>
                        {Math.round(outcome.yesPrice * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          outcome.yesPrice >= 0.5 ? "bg-emerald-500" : "bg-muted-foreground/50"
                        )}
                        style={{ width: `${outcome.yesPrice * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Trade Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0 h-8 px-2 hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => openTradeModal(outcome, e)}
                    title="Trade"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </Button>

                  {/* Ask Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0 h-8 px-2 hover:bg-secondary/10 hover:text-secondary"
                    onClick={(e) => askAboutOutcome(outcome, e)}
                    title="Ask Poly"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}

              {/* Expand/Collapse Button */}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full px-5 py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                  {isExpanded ? "Show less" : `Show ${hiddenCount} more outcomes`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer CTAs - Inline BUY YES/NO */}
        <div className="p-4 pt-0 border-t border-border/30 flex gap-2">
          {/* BUY YES Button */}
          <Button
            variant="outline"
            className={cn(
              "flex-1 h-11 gap-1.5 font-semibold rounded-xl transition-all duration-200",
              "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            )}
            onClick={() => openTradeForSingleOutcome('YES')}
            disabled={loadingSide !== null}
          >
            {loadingSide === 'YES' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                YES {Math.round(sortedOutcomes[0]?.yesPrice * 100 || 0)}¢
              </>
            )}
          </Button>
          
          {/* BUY NO Button */}
          <Button
            variant="outline"
            className={cn(
              "flex-1 h-11 gap-1.5 font-semibold rounded-xl transition-all duration-200",
              "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/50 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]"
            )}
            onClick={() => openTradeForSingleOutcome('NO')}
            disabled={loadingSide !== null}
          >
            {loadingSide === 'NO' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <TrendingDown className="w-4 h-4" />
                NO {Math.round((1 - (sortedOutcomes[0]?.yesPrice || 0)) * 100)}¢
              </>
            )}
          </Button>

          {/* Analyze Button */}
          <Button
            className="h-11 px-4 gap-2 text-primary-foreground font-semibold rounded-xl border-0 btn-epic-analyze"
            onClick={askAboutEvent}
          >
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Trade Modal */}
      {selectedOutcome && (
        <MarketTradeModal
          open={tradeModalOpen}
          onOpenChange={setTradeModalOpen}
          defaultSide={defaultTradeSide}
          marketData={{
            yesTokenId: selectedOutcome.yesTokenId,
            noTokenId: selectedOutcome.noTokenId,
            conditionId: selectedOutcome.conditionId,
            title: selectedOutcome.question,
            currentPrice: selectedOutcome.yesPrice,
            url: `https://polymarket.com/event/${event.eventSlug}/${selectedOutcome.slug}`,
            eventSlug: event.eventSlug,
            marketSlug: selectedOutcome.slug,
          }}
        />
      )}
    </>
  );
};
