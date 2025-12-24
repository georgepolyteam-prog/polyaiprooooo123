import { useState } from "react";
import { ChevronDown, TrendingUp, ExternalLink, AlertTriangle, Target, BarChart3, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MarketOutcomeAnalysis {
  title: string;
  yesOdds: number;
  noOdds: number;
  volume: string;
  analysis: string;
  recommendation: "BUY" | "SELL" | "SKIP";
  edge: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  risk: string;
}

interface MarketAnalysisCardProps {
  eventTitle: string;
  outcomes: MarketOutcomeAnalysis[];
  overallAnalysis?: string;
}

// Utility to strip citation markup like <cite index="..."> from AI responses
const stripCitations = (content: string): string => {
  if (!content) return content;
  try {
    return content.replace(/<cite[^>]*>(.*?)<\/cite>/gis, "$1");
  } catch {
    return content;
  }
};

// Parse the AI response to extract structured market data
export const parseMarketAnalysis = (content: string): MarketAnalysisCardProps | null => {
  const cleanedContent = stripCitations(content);
  
  // Check if this looks like a multi-outcome market analysis
  const outcomeBlocks = cleanedContent.split(/---\n?/).filter(block => block.includes("📊") || block.includes("Current:"));
  
  if (outcomeBlocks.length < 2) return null;
  
  const outcomes: MarketOutcomeAnalysis[] = [];
  let eventTitle = "";
  let overallAnalysis = "";
  
  for (const block of outcomeBlocks) {
    // Extract title from 📊 line
    const titleMatch = block.match(/📊\s*(.+?)(?:\?|\n)/);
    if (!titleMatch) {
      // Check if this is the overall analysis section
      if (block.includes("Overall Event Analysis") || block.includes("overall analysis")) {
        overallAnalysis = block.replace(/Overall Event Analysis:?\s*/i, "").trim();
      }
      continue;
    }
    
    const title = titleMatch[1].trim();
    
    // Extract odds
    const oddsMatch = block.match(/Current:\s*(\d+(?:\.\d+)?)\s*%?\s*YES\s*\/\s*(\d+(?:\.\d+)?)\s*%?\s*NO/i);
    const yesOdds = oddsMatch ? parseFloat(oddsMatch[1]) : 50;
    const noOdds = oddsMatch ? parseFloat(oddsMatch[2]) : 50;
    
    // Extract volume
    const volumeMatch = block.match(/Volume:\s*\$?([\d.,]+[KMB]?)/i);
    const volume = volumeMatch ? `$${volumeMatch[1]}` : "N/A";
    
    // Extract analysis (MY TAKE section)
    const analysisMatch = block.match(/(?:MY TAKE|🎯[^:]*:)\s*(.+?)(?=THE PLAY|Edge:|Confidence:|⚠️|$)/is);
    const analysis = analysisMatch ? analysisMatch[1].trim() : "";
    
    // Extract recommendation
    let recommendation: "BUY" | "SELL" | "SKIP" = "SKIP";
    if (block.includes("THE PLAY: BUY") || block.includes("THE PLAY:**BUY")) recommendation = "BUY";
    else if (block.includes("THE PLAY: SELL") || block.includes("THE PLAY:**SELL")) recommendation = "SELL";
    
    // Extract edge
    const edgeMatch = block.match(/Edge:\s*([^\n]+)/i);
    const edge = edgeMatch ? edgeMatch[1].trim() : null;
    
    // Extract confidence
    let confidence: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    if (block.includes("Confidence: HIGH") || block.includes("Confidence:**HIGH")) confidence = "HIGH";
    else if (block.includes("Confidence: LOW") || block.includes("Confidence:**LOW")) confidence = "LOW";
    
    // Extract risk
    const riskMatch = block.match(/⚠️\s*Risk:\s*(.+?)(?:\n|$)/i);
    const risk = riskMatch ? riskMatch[1].trim() : "";
    
    outcomes.push({
      title,
      yesOdds,
      noOdds,
      volume,
      analysis,
      recommendation,
      edge,
      confidence,
      risk,
    });
  }
  
  if (outcomes.length === 0) return null;
  
  // Try to extract event title from first line
  const firstLine = cleanedContent.split('\n')[0];
  if (firstLine && !firstLine.includes("📊")) {
    eventTitle = firstLine.replace(/^[^a-zA-Z]*/, "").trim();
  }
  
  return { eventTitle, outcomes, overallAnalysis };
};

const OutcomeCard = ({ outcome, index, isExpanded, onToggle }: { 
  outcome: MarketOutcomeAnalysis; 
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case "BUY": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "SELL": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getConfidenceStyle = (conf: string) => {
    switch (conf) {
      case "HIGH": return "text-green-400";
      case "MEDIUM": return "text-yellow-400";
      case "LOW": return "text-red-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50 hover:border-border transition-colors">
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Rank */}
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
          index === 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {index + 1}
        </div>

        {/* Title & Odds */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">
            {outcome.title}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-primary tabular-nums">
                {outcome.yesOdds}%
              </span>
              <span className="text-xs text-muted-foreground">YES</span>
            </div>
            <div className="h-1.5 flex-1 max-w-[80px] bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full"
                style={{ width: `${outcome.yesOdds}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge 
            variant="outline" 
            className={cn("text-xs font-medium", getRecommendationStyle(outcome.recommendation))}
          >
            {outcome.recommendation}
          </Badge>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )} />
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border/30 p-4 space-y-4 bg-muted/10 animate-in slide-in-from-top-2 duration-200">
          {/* Stats Row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Volume:</span>
              <span className="font-medium text-foreground">{outcome.volume}</span>
            </div>
            {outcome.edge && outcome.edge !== "N/A" && (
              <div className="flex items-center gap-1.5 text-sm">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Edge:</span>
                <span className="font-medium text-primary">{outcome.edge}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Confidence:</span>
              <span className={cn("font-medium", getConfidenceStyle(outcome.confidence))}>
                {outcome.confidence}
              </span>
            </div>
          </div>

          {/* Analysis */}
          {outcome.analysis && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Zap className="w-4 h-4 text-primary" />
                Poly AI's Take
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {outcome.analysis}
              </p>
            </div>
          )}

          {/* Risk Warning */}
          {outcome.risk && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200/80">{outcome.risk}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const MarketAnalysisCard = ({ eventTitle, outcomes, overallAnalysis }: MarketAnalysisCardProps) => {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set([0])); // First one open by default
  const [showAll, setShowAll] = useState(false);

  const toggleOutcome = (index: number) => {
    setExpandedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (showAll) {
      setExpandedIndices(new Set([0]));
    } else {
      setExpandedIndices(new Set(outcomes.map((_, i) => i)));
    }
    setShowAll(!showAll);
  };

  // Sort by odds (highest first)
  const sortedOutcomes = [...outcomes].sort((a, b) => b.yesOdds - a.yesOdds);

  return (
    <div className="space-y-4">
      {/* Header */}
      {eventTitle && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">{eventTitle}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {outcomes.length} outcomes analyzed
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      )}

      {/* Outcomes List */}
      <div className="space-y-2">
        {sortedOutcomes.map((outcome, index) => (
          <OutcomeCard
            key={index}
            outcome={outcome}
            index={index}
            isExpanded={expandedIndices.has(index)}
            onToggle={() => toggleOutcome(index)}
          />
        ))}
      </div>

      {/* Overall Analysis */}
      {overallAnalysis && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
            <BarChart3 className="w-4 h-4" />
            Overall Event Analysis
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {overallAnalysis}
          </p>
        </div>
      )}

      {/* Polymarket Link */}
      <a
        href="https://polymarket.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        View on Polymarket
      </a>
    </div>
  );
};
