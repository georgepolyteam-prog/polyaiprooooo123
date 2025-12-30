import { useState, useEffect, useRef, useMemo } from "react";
import { ThumbsUp, ThumbsDown, Copy, TrendingUp, TrendingDown, BarChart2, ExternalLink, ChevronDown, AlertTriangle, SkipForward, Newspaper, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MarketSelector } from "./MarketSelector";
import { PolyfactualResultHeader } from "./PolyfactualResultHeader";
import { PolyfactualSourceCard } from "./PolyfactualSourceCard";
import { PolyfactualContent } from "./PolyfactualContent";
import polyLogo from "@/assets/poly-logo-new.png";
interface MarketData {
  id: number;
  question: string;
  yesPrice: number;
  volume: number;
  url?: string;
  // Irys blockchain verification fields
  isBlockchainVerified?: boolean;
  txId?: string;
  proofUrl?: string;
  resolvedOutcome?: string | null;
  category?: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  type?: "market_selection" | "analysis" | "error";
  event?: {
    title: string;
    slug?: string;
    markets: MarketData[];
    // Irys-specific fields
    source?: 'irys' | 'gamma' | string;
    isBlockchainVerified?: boolean;
    totalCount?: number;
    sampleTxId?: string;
  };
  onSendMessage?: (message: string) => void;
  isLatest?: boolean;
  onContentChange?: () => void;
  isStreaming?: boolean;
}

// Parse market selector from Poly's response
interface MarketSelectorData {
  eventTitle: string;
  eventUrl?: string;
  markets: Array<{
    id: number;
    market_slug: string;
    question: string;
    yes_price: number;
    volume: number;
  }>;
}

const parseMarketSelector = (text: string): MarketSelectorData | null => {
  const selectorMatch = text.match(/(?:This event has \d+ markets|Which (?:one )?would you like me to analyze)/i);
  if (!selectorMatch) return null;
  
  const titleMatch = text.match(/(?:Here's my analysis for|analyzing|Found|event:?)\s*["']?([^"'\n]+?)["']?\s*(?:\.|:|\n|$)/i);
  const eventTitle = titleMatch?.[1]?.trim() || "Select a market";
  
  const marketPattern = /(\d+)\)\s*(?:\[)?([^\]—\n]+?)(?:\])?\s*—\s*([\d.]+)%\s*YES\s*\((?:Vol:\s*)?\$?([\d.]+[KM]?)\)/gi;
  const markets: MarketSelectorData["markets"] = [];
  let match;
  
  while ((match = marketPattern.exec(text)) !== null) {
    const volumeStr = match[4];
    let volume = parseFloat(volumeStr);
    if (volumeStr.endsWith('K')) volume *= 1000;
    if (volumeStr.endsWith('M')) volume *= 1000000;
    
    markets.push({
      id: parseInt(match[1]),
      market_slug: match[2].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      question: match[2].trim(),
      yes_price: parseFloat(match[3]) / 100,
      volume: volume
    });
  }
  
  if (markets.length === 0) return null;
  
  const urlMatch = text.match(/https?:\/\/polymarket\.com\/event\/([^\s\n]+)/i);
  const eventUrl = urlMatch?.[0];
  
  return { eventTitle, eventUrl, markets };
};

// Parse market data from Poly's response
interface MarketCard {
  question: string;
  yesPrice: string;
  noPrice: string;
  volume: string;
  edge?: string;
  confidence?: string;
  recommendation?: string;
  url?: string;
  polyProb?: string;
  myTake?: string;
  risk?: string;
  isExpired?: boolean;
  isMultiOutcome?: boolean;
  candidates?: { name: string; odds: string }[];
}

const formatVolume = (vol: string): string => {
  let numStr = vol.replace(/[$,]/g, '');
  let multiplier = 1;
  
  if (numStr.endsWith('K')) {
    numStr = numStr.slice(0, -1);
    multiplier = 1000;
  } else if (numStr.endsWith('M')) {
    numStr = numStr.slice(0, -1);
    multiplier = 1000000;
  }
  
  const num = parseFloat(numStr) * multiplier;
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`.replace('.0M', 'M');
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`;
  }
  return num.toString();
};

// Parse Polyfactual deep research results
interface PolyfactualResult {
  isPolyfactual: boolean;
  content: string;
  sources: Array<{ title: string; url: string }>;
}

const parsePolyfactualResult = (text: string): PolyfactualResult | null => {
  // Check if this is a Polyfactual deep research result
  // Support both new clean format (## Summary) and legacy emoji format
  const isPolyfactual = text.includes("Deep Research Results") || 
                        text.includes("📊 **Deep Research") ||
                        (text.includes("## Summary") && text.includes("## Sources"));
  if (!isPolyfactual) {
    return null;
  }
  
  const sources: Array<{ title: string; url: string }> = [];
  
  // Extract sources section - look for numbered sources with URLs
  // Support both new format (## Sources) and legacy emoji format
  const sourcesMatch = text.match(/(?:##\s*Sources|📚\s*\*?\*?Sources:?\*?\*?|Sources:)\s*([\s\S]*?)$/i);
  if (sourcesMatch) {
    const sourcesText = sourcesMatch[1];
    
    // Parse sources - they can be in format:
    // 1. Title - URL
    // 1. [Title](URL)
    // 1. Title (URL)
    // 1. URL
    const sourceLines = sourcesText.split('\n').filter(line => line.trim());
    
    sourceLines.forEach(line => {
      // Try markdown link format: [Title](URL)
      const mdMatch = line.match(/\d+\.\s*\[([^\]]+)\]\(([^)]+)\)/);
      if (mdMatch) {
        sources.push({ title: mdMatch[1].trim(), url: mdMatch[2].trim() });
        return;
      }
      
      // Try format: Title - URL or Title: URL
      const titleUrlMatch = line.match(/\d+\.\s*([^-:]+)[-:]\s*(https?:\/\/[^\s]+)/);
      if (titleUrlMatch) {
        sources.push({ title: titleUrlMatch[1].trim(), url: titleUrlMatch[2].trim() });
        return;
      }
      
      // Try format: Just URL
      const urlOnlyMatch = line.match(/\d+\.\s*(https?:\/\/[^\s]+)/);
      if (urlOnlyMatch) {
        const url = urlOnlyMatch[1].trim();
        // Extract domain as title
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          sources.push({ title: domain, url });
        } catch {
          sources.push({ title: 'Source', url });
        }
        return;
      }
      
      // Try broken markdown format: Title](URL) - missing opening bracket
      const brokenMdMatch = line.match(/([^(\[]+)\]\((https?:\/\/[^)]+)\)/);
      if (brokenMdMatch) {
        const title = brokenMdMatch[1].replace(/^\d+\.\s*/, '').trim();
        sources.push({ title: title || 'Source', url: brokenMdMatch[2].trim() });
        return;
      }
      
      // Try format: Title only (no URL) - skip these
      const titleOnlyMatch = line.match(/\d+\.\s*(.+)/);
      if (titleOnlyMatch && !titleOnlyMatch[1].startsWith('http')) {
        // Check if there's a URL embedded anywhere
        const embeddedUrl = titleOnlyMatch[1].match(/(https?:\/\/[^\s\)]+)/);
        if (embeddedUrl) {
          // Clean up title by removing URL and brackets
          let title = titleOnlyMatch[1]
            .replace(embeddedUrl[1], '')
            .replace(/[\[\]\(\)]/g, '')
            .trim();
          if (!title) {
            try { title = new URL(embeddedUrl[1]).hostname.replace('www.', ''); } 
            catch { title = 'Source'; }
          }
          sources.push({ title, url: embeddedUrl[1] });
        }
      }
    });
  }
  
  // Remove sources section and header from content
  // Support both new clean format and legacy emoji format
  let content = text
    .replace(/📊\s*\*?\*?Deep Research Results\*?\*?\s*/i, '')
    .replace(/(?:##\s*Sources|📚\s*\*?\*?Sources:?\*?\*?|Sources:)\s*[\s\S]*$/i, '')
    .trim();
  
  return {
    isPolyfactual: true,
    content,
    sources
  };
};
const parseMarketCards = (text: string): { markets: MarketCard[]; introText: string; summaryText: string } => {
  const markets: MarketCard[] = [];
  const sections = text.split(/---+/).filter(s => s.trim());
  let overallAnalysis = "";
  
  sections.forEach((section) => {
    const marketMatch = section.match(/📊\s*\[?([^\]\n]+)\]?\s*\n(?:\s*Platform:\s*[^\n]+\s*\n)?\s*Current:\s*([\d.]+)%\s*YES\s*\/\s*([\d.]+)%\s*NO[\s\S]*?Volume:\s*\$?([\d,.]+[KM]?)/i);
    const multiOutcomeMatch = section.match(/📊\s*\[?([^\]\n]+)\]?\s*\n(?:\s*Platform:\s*[^\n]+\s*\n)?[\s\S]*?Leading\s+Candidates:[\s\S]*?(?:Total\s+)?Volume:\s*\$?([\d,.]+[KM]?)/i);
    
    if (marketMatch) {
      const yesPrice = parseFloat(marketMatch[2]);
      const noPrice = parseFloat(marketMatch[3]);
      const isExpired = Math.abs(yesPrice - 50) < 0.5 && Math.abs(noPrice - 50) < 0.5;
      if (isExpired) return;
      
      const market: MarketCard = {
        question: marketMatch[1].trim(),
        yesPrice: marketMatch[2],
        noPrice: marketMatch[3],
        volume: marketMatch[4],
      };
      
      const urlMatch = section.match(/URL:\s*(https?:\/\/(?:polymarket\.com|kalshi\.com)\/[^\s\n]+)/i);
      if (urlMatch) market.url = urlMatch[1].trim().replace(/[,.]$/, '');
      
      const takeMatch = section.match(/🎯\s*MY TAKE:\s*([\s\S]*?)(?=THE PLAY:|$)/i);
      if (takeMatch) market.myTake = takeMatch[1].trim();
      
      const riskMatch = section.match(/⚠️\s*Risk:\s*([^\n]+)/i);
      if (riskMatch) market.risk = riskMatch[1].trim();
      
      const edgeMatch = section.match(/Edge:\s*([^\n|]+)/i);
      if (edgeMatch) {
        const edgeValue = edgeMatch[1].match(/([+-]?[\d.]+)%?/);
        if (edgeValue) market.edge = edgeValue[1];
      }
      
      const confMatch = section.match(/Conf(?:idence)?:\s*(HIGH|MEDIUM|MED|LOW)/i);
      if (confMatch) {
        let conf = confMatch[1].toUpperCase();
        if (conf === "MED") conf = "MEDIUM";
        market.confidence = conf;
      }
      
      const recMatch = section.match(/THE PLAY:\s*([^\n|]+)/i);
      if (recMatch) market.recommendation = recMatch[1].trim();
      
      markets.push(market);
    } else if (multiOutcomeMatch) {
      const market: MarketCard = {
        question: multiOutcomeMatch[1].trim(),
        yesPrice: "0",
        noPrice: "0",
        volume: multiOutcomeMatch[2],
        isMultiOutcome: true,
        candidates: [],
      };
      
      const candidatePattern = /[•\-]\s*([^:\n]+):\s*([\d.]+)%\s*(?:YES)?/gi;
      let candMatch;
      while ((candMatch = candidatePattern.exec(section)) !== null) {
        const name = candMatch[1].trim();
        if (name.length < 50 && !name.includes("ELIMINATED")) {
          market.candidates?.push({ name, odds: candMatch[2] });
        }
      }
      
      market.candidates?.sort((a, b) => parseFloat(b.odds) - parseFloat(a.odds));
      if (market.candidates && market.candidates.length > 0) {
        market.yesPrice = market.candidates[0].odds;
        markets.push(market);
      }
    }
  });

  if (markets.length === 0) {
    return { markets: [], introText: text.trim(), summaryText: "" };
  }
  
  const firstMarketPos = text.indexOf('📊');
  let introText = firstMarketPos > 0 ? text.substring(0, firstMarketPos).trim() : "";
  
  const lastSeparatorIdx = text.lastIndexOf('---');
  let summaryText = "";
  if (lastSeparatorIdx !== -1) {
    const afterLastSeparator = text.substring(lastSeparatorIdx + 3).trim();
    const summaryMatch = afterLastSeparator.match(/🏁\s*\*?\*?SUMMARY[\s\S]*/i);
    if (summaryMatch) summaryText = summaryMatch[0].trim();
  }

  return { markets, introText, summaryText };
};

// Modern Market Card Component
const MarketCardComponent = ({ market, defaultExpanded = true }: { market: MarketCard; defaultExpanded?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const yesPrice = parseFloat(market.yesPrice);
  const edge = market.edge ? parseFloat(market.edge) : null;
  const hasPositiveEdge = edge && edge > 0;
  const formattedVolume = formatVolume(market.volume);
  
  const getRecStyle = (rec?: string) => {
    if (!rec) return { bg: "bg-muted", text: "text-muted-foreground", label: "Analyzing" };
    const upper = rec.toUpperCase();
    if (upper.includes("BUY YES")) return { bg: "bg-success/10", text: "text-success", label: "Buy YES" };
    if (upper.includes("BUY NO")) return { bg: "bg-destructive/10", text: "text-destructive", label: "Buy NO" };
    if (upper.includes("SKIP")) return { bg: "bg-muted", text: "text-muted-foreground", label: "Skip" };
    return { bg: "bg-muted", text: "text-muted-foreground", label: rec };
  };
  
  const recStyle = getRecStyle(market.recommendation);

  return (
    <div
      className={cn(
        "rounded-2xl bg-card border border-border shadow-soft overflow-hidden transition-all",
        isExpanded && "shadow-medium"
      )}
    >
      {/* Header */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground leading-tight mb-2">
              {market.question}
            </h3>
            
            {/* Quick stats row */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "font-bold text-lg",
                  yesPrice > 50 ? "text-success" : "text-muted-foreground"
                )}>
                  {market.yesPrice}%
                </span>
                <span className="text-muted-foreground">YES</span>
              </div>
              
              <div className="h-4 w-px bg-border" />
              
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <BarChart2 className="w-4 h-4" />
                <span>${formattedVolume}</span>
              </div>
              
              {edge !== null && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className={cn(
                    "flex items-center gap-1 font-medium",
                    hasPositiveEdge ? "text-success" : "text-destructive"
                  )}>
                    {hasPositiveEdge ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{edge > 0 ? "+" : ""}{edge}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Recommendation Badge */}
          <div className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium shrink-0",
            recStyle.bg, recStyle.text
          )}>
            {recStyle.label}
          </div>
        </div>
        
        {/* Expand indicator */}
        <ChevronDown className={cn(
          "w-5 h-5 text-muted-foreground mx-auto mt-2 transition-transform",
          isExpanded && "rotate-180"
        )} />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4 animate-fade-in">
          {/* Multi-outcome candidates */}
          {market.isMultiOutcome && market.candidates && market.candidates.length > 0 && (
            <div className="space-y-2">
              {market.candidates.slice(0, 5).map((candidate, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {candidate.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full",
                          idx === 0 ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                        style={{ width: `${candidate.odds}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-sm font-medium w-12 text-right",
                      idx === 0 ? "text-primary" : "text-muted-foreground"
                    )}>
                      {candidate.odds}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Analysis */}
          {market.myTake && (
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {market.myTake}
              </p>
            </div>
          )}
          
          {/* Risk warning */}
          {market.risk && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-warning">{market.risk}</p>
            </div>
          )}
          
          {/* Market link */}
          {market.url && (
            <a
              href={market.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              View on {market.url.includes('kalshi.com') ? 'Kalshi' : 'Polymarket'}
            </a>
          )}
        </div>
      )}
    </div>
  );
};

// Format text with inline styles
const formatInlineText = (text: string): React.ReactNode => {
  const boldRegex = /\*\*(.*?)\*\*/g;
  const tempText = text.replace(boldRegex, (_, content) => `<<<BOLD_START>>>${content}<<<BOLD_END>>>`);
  const parts = tempText.split(/(<<<BOLD_START>>>.*?<<<BOLD_END>>>)/);

  return parts.map((part, idx) => {
    if (part.startsWith("<<<BOLD_START>>>") && part.endsWith("<<<BOLD_END>>>")) {
      const content = part.slice(16, -14);
      return <strong key={idx} className="font-semibold text-foreground">{content}</strong>;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(part)) {
      const urlParts = part.split(urlRegex);
      return urlParts.map((urlPart, i) => {
        if (urlRegex.test(urlPart)) {
          return (
            <a
              key={`${idx}-${i}`}
              href={urlPart}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {urlPart}
            </a>
          );
        }
        return urlPart;
      });
    }

    return part;
  });
};

const formatText = (text: string) => {
  const lines = text.split("\n");

  return lines.map((line, index) => {
    const trimmedLine = line.trim();
    
    // Empty lines - spacing
    if (trimmedLine === "") return <div key={index} className="h-2" />;
    
    // Main header: ## Title
    if (trimmedLine.startsWith("## ")) {
      const headerText = trimmedLine.slice(3);
      return (
        <h2 key={index} className="text-lg font-bold text-foreground mt-5 mb-2 first:mt-0">
          {formatInlineText(headerText)}
        </h2>
      );
    }
    
    // Sub header: ### Subtitle
    if (trimmedLine.startsWith("### ")) {
      const headerText = trimmedLine.slice(4);
      return (
        <h3 key={index} className="text-base font-semibold text-foreground mt-4 mb-1.5 border-l-2 border-primary/50 pl-3">
          {formatInlineText(headerText)}
        </h3>
      );
    }
    
    // Key-value bold line at start: **Label:** Value (like "Current Odds: 25%")
    if (trimmedLine.startsWith("**") && trimmedLine.includes(":**")) {
      return (
        <div key={index} className="py-1.5 px-3 my-1 rounded-lg bg-muted/40 text-sm">
          {formatInlineText(trimmedLine)}
        </div>
      );
    }

    // Emoji headers
    if (/^[🎯💭⚠️📊🏁📈⚡🔥✨💡🚨]/.test(trimmedLine)) {
      return (
        <div key={index} className="font-semibold text-foreground mt-4 mb-1.5">
          {formatInlineText(trimmedLine)}
        </div>
      );
    }
    
    // Bullet points
    if (trimmedLine.startsWith("• ") || trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      const bulletContent = trimmedLine.slice(2);
      return (
        <div key={index} className="flex gap-2 ml-3 my-1">
          <span className="text-primary mt-0.5">•</span>
          <span className="text-muted-foreground text-sm leading-relaxed">{formatInlineText(bulletContent)}</span>
        </div>
      );
    }
    
    // Numbered lists (1., 2., etc.)
    const numberMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
    if (numberMatch) {
      return (
        <div key={index} className="flex gap-2 ml-3 my-1">
          <span className="text-primary/70 font-medium min-w-[1.2rem] text-sm">{numberMatch[1]}.</span>
          <span className="text-muted-foreground text-sm leading-relaxed">{formatInlineText(numberMatch[2])}</span>
        </div>
      );
    }
    
    // For YES/For NO special handling
    if (trimmedLine.toLowerCase().startsWith("for yes") || 
        trimmedLine.toLowerCase().startsWith("for no") ||
        trimmedLine.toLowerCase().startsWith("bottom line")) {
      return (
        <div key={index} className="font-semibold text-foreground mt-3 mb-1 text-sm">
          {formatInlineText(trimmedLine)}
        </div>
      );
    }

    // Regular paragraph
    return (
      <p key={index} className="text-muted-foreground my-1.5 leading-relaxed text-sm">
        {formatInlineText(trimmedLine)}
      </p>
    );
  });
};

export const ChatMessage = ({ role, content, type, event, onSendMessage, isLatest = false, onContentChange, isStreaming = false }: ChatMessageProps) => {
  const navigate = useNavigate();
  const isUser = role === "user";
  const isOutOfCredits = content.toLowerCase().includes("out of credits") || content.toLowerCase().includes("you're out of credits");
  const [displayedContent, setDisplayedContent] = useState(isUser ? content : '');
  const [isTyping, setIsTyping] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const typingRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const prevContentLengthRef = useRef(0);

  // Typing effect for assistant messages - DISABLED during active streaming to prevent spazzing
  useEffect(() => {
    if (isUser || !isLatest) {
      setDisplayedContent(content);
      return;
    }

    // During streaming, display content directly without typing animation
    if (isStreaming) {
      setDisplayedContent(content);
      setIsTyping(false);
      // Clear any running typing interval
      if (typingRef.current) {
        clearInterval(typingRef.current);
        typingRef.current = null;
      }
      // Trigger scroll periodically during streaming
      if (content.length - prevContentLengthRef.current > 20) {
        prevContentLengthRef.current = content.length;
        onContentChange?.();
      }
      return;
    }

    // If content changed and we're still typing or skipped, update immediately
    if (skipped || contentRef.current !== content) {
      contentRef.current = content;
      if (skipped) {
        setDisplayedContent(content);
        return;
      }
    }

    // Only run typing animation for NON-streaming, complete messages
    // Skip typing if content is already long (likely loaded from history)
    if (content.length > 200) {
      setDisplayedContent(content);
      return;
    }

    // Start typing animation for new content
    setIsTyping(true);
    let index = 0;
    
    if (typingRef.current) {
      clearInterval(typingRef.current);
    }

    typingRef.current = setInterval(() => {
      if (index < content.length) {
        setDisplayedContent(content.slice(0, index + 1));
        index++;
        
        // Trigger scroll every ~15 characters for smooth auto-scroll during typing
        if (index % 15 === 0) {
          onContentChange?.();
        }
      } else {
        setIsTyping(false);
        onContentChange?.(); // Final scroll when typing completes
        if (typingRef.current) {
          clearInterval(typingRef.current);
          typingRef.current = null;
        }
      }
    }, 8); // Fast typing speed

    return () => {
      if (typingRef.current) {
        clearInterval(typingRef.current);
        typingRef.current = null;
      }
    };
  }, [content, isUser, isLatest, skipped, isStreaming]);

  const handleSkip = () => {
    setSkipped(true);
    setDisplayedContent(content);
    setIsTyping(false);
    if (typingRef.current) {
      clearInterval(typingRef.current);
      typingRef.current = null;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const handleThumbsUp = () => {
    toast.success("Thanks for the feedback!");
  };

  const handleThumbsDown = () => {
    toast.info("Feedback noted. I'll try to do better!");
  };

  const hasStructuredMarkets = type === "market_selection" && event?.markets && event.markets.length > 0;
  const marketSelector = !isUser && !hasStructuredMarkets ? parseMarketSelector(displayedContent) : null;
  
  // Memoize parsing to prevent expensive regex on every stream chunk
  const { markets, introText, summaryText, polyfactualResult } = useMemo(() => {
    if (isUser) return { markets: [], introText: content, summaryText: "", polyfactualResult: null };
    // Skip parsing short content during streaming to reduce flicker
    if (isStreaming && displayedContent.length < 50) {
      return { markets: [], introText: displayedContent, summaryText: "", polyfactualResult: null };
    }
    
    // Check for Polyfactual deep research results first
    const polyfactual = parsePolyfactualResult(displayedContent);
    if (polyfactual) {
      return { markets: [], introText: "", summaryText: "", polyfactualResult: polyfactual };
    }
    
    return { ...parseMarketCards(displayedContent), polyfactualResult: null };
  }, [displayedContent, isUser, isStreaming]);

  // User message - clean bubble
  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div 
          className="message-user px-3 py-2 sm:px-4 sm:py-3 rounded-2xl rounded-br-sm text-white max-w-[85%] sm:max-w-lg shadow-soft text-sm sm:text-base overflow-hidden break-words"
          style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        >
          {content}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-start gap-2 sm:gap-3 animate-fade-in group">
      {/* Poly Avatar */}
      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-xl gradient-bg flex items-center justify-center shadow-soft overflow-hidden">
        <img src={polyLogo} alt="Poly" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
      </div>
      
      {/* Message content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Structured Market Selector UI */}
        {hasStructuredMarkets && onSendMessage ? (
          <MarketSelector
            eventTitle={event.title}
            markets={event.markets.map(m => ({
              id: m.id,
              market_slug: m.url?.split('/').pop() || '',
              question: m.question,
              yes_price: m.yesPrice / 100,
              volume: m.volume,
              // Pass through Irys fields
              isBlockchainVerified: (m as any).isBlockchainVerified,
              txId: (m as any).txId,
              proofUrl: (m as any).proofUrl,
              resolvedOutcome: (m as any).resolvedOutcome,
              category: (m as any).category,
            }))}
            onSelect={(id) => {
              if (id === -1) {
                onSendMessage("A");
              } else {
                onSendMessage(id.toString());
              }
            }}
            // Irys event-level fields
            source={event.source}
            isBlockchainVerified={event.isBlockchainVerified}
            totalCount={event.totalCount}
            sampleTxId={event.sampleTxId}
          />
        ) : marketSelector && marketSelector.markets.length > 0 && onSendMessage ? (
          <MarketSelector
            eventTitle={marketSelector.eventTitle}
            eventUrl={marketSelector.eventUrl}
            markets={marketSelector.markets}
            onSelect={(id) => {
              if (id === -1) {
                onSendMessage("A");
              } else {
                onSendMessage(id.toString());
              }
            }}
          />
        ) : polyfactualResult ? (
          /* Polyfactual Deep Research Results */
          <div className="space-y-5">
            {/* Branded header */}
            <PolyfactualResultHeader />
            
            {/* Research content with enhanced formatting */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#0d1117] to-[#161b22] border border-cyan-500/20 shadow-lg shadow-cyan-500/5 backdrop-blur-sm overflow-hidden">
              <PolyfactualContent content={polyfactualResult.content} />
            </div>
            
            {/* Source cards with favicons - 2 column grid */}
            {polyfactualResult.sources.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                      <Newspaper className="w-3.5 h-3.5 text-white" />
                    </span>
                    Sources
                  </h4>
                  <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                    {polyfactualResult.sources.length} sources
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {polyfactualResult.sources.map((source, i) => (
                    <PolyfactualSourceCard 
                      key={i} 
                      title={source.title} 
                      url={source.url} 
                      index={i} 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Intro text */}
            {introText && (
              <div className="p-3 sm:p-4 rounded-2xl rounded-tl-sm bg-muted/60 border border-border/60 shadow-soft backdrop-blur-sm overflow-hidden">
                <div className="text-sm leading-relaxed break-words" style={{ overflowWrap: 'anywhere' }}>
                  {formatText(introText)}
                </div>
                
                {/* Get Credits button when out of credits */}
                {isOutOfCredits && (
                  <button
                    onClick={() => navigate('/credits')}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium hover:opacity-90 transition-all shadow-lg"
                  >
                    <Coins className="w-5 h-5" />
                    Get Credits
                  </button>
                )}
              </div>
            )}

            {/* Market cards */}
            {markets.length > 0 && (
              <div className="flex flex-col gap-3">
                {markets.map((market, i) => (
                  <MarketCardComponent key={i} market={market} defaultExpanded={true} />
                ))}
              </div>
            )}

            {/* Summary */}
            {summaryText && (
              <div className="p-3 sm:p-4 rounded-2xl bg-muted/50 border border-border">
                <div className="text-sm leading-relaxed">
                  {formatText(summaryText)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Skip button - shows while typing */}
        {isTyping && isLatest && (
          <button
            onClick={handleSkip}
            className="fixed bottom-24 right-4 z-50 sm:relative sm:bottom-auto sm:right-auto sm:z-auto flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-all shadow-lg sm:shadow-none border border-primary/20 sm:border-0"
          >
            <SkipForward className="w-4 h-4" />
            <span>Skip</span>
          </button>
        )}

        {/* Action buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleThumbsUp}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-success transition-colors"
            aria-label="Good response"
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleThumbsDown}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Bad response"
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Copy"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
