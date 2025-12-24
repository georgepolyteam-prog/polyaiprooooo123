import React from "react";
import { ExternalLink, TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle, Lightbulb, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PolyfactualContentProps {
  content: string;
}

// Parse markdown links [text](url) and convert to styled components
const parseMarkdownLinks = (text: string): React.ReactNode[] => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyCounter = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add the styled link
    parts.push(
      <a
        key={`link-${keyCounter++}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-400/40 hover:decoration-cyan-300 transition-colors"
      >
        {match[1]}
        <ExternalLink className="w-3 h-3 inline opacity-60" />
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
};

// Format inline text with bold, percentages, and dollar amounts
const formatInlineContent = (text: string): React.ReactNode => {
  // First handle markdown links
  const linkParts = parseMarkdownLinks(text);
  
  return linkParts.map((part, partIdx) => {
    if (typeof part !== 'string') return part;
    
    // Handle bold text
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let result: React.ReactNode[] = [];
    let lastIdx = 0;
    let boldMatch;
    
    while ((boldMatch = boldRegex.exec(part)) !== null) {
      if (boldMatch.index > lastIdx) {
        result.push(...formatStatsInText(part.slice(lastIdx, boldMatch.index), `${partIdx}-pre-${lastIdx}`));
      }
      result.push(
        <strong key={`bold-${partIdx}-${boldMatch.index}`} className="font-semibold text-white">
          {formatStatsInText(boldMatch[1], `${partIdx}-bold-${boldMatch.index}`)}
        </strong>
      );
      lastIdx = boldMatch.index + boldMatch[0].length;
    }
    
    if (lastIdx < part.length) {
      result.push(...formatStatsInText(part.slice(lastIdx), `${partIdx}-post-${lastIdx}`));
    }
    
    return result.length > 0 ? result : formatStatsInText(part, `${partIdx}`);
  });
};

// Highlight percentages and dollar amounts
const formatStatsInText = (text: string, keyPrefix: string): React.ReactNode[] => {
  // Match percentages and dollar amounts
  const statsRegex = /(\d+(?:\.\d+)?%|\$[\d,.]+[KMB]?(?:\s*[KMB])?)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let counter = 0;

  while ((match = statsRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const value = match[1];
    const isPercentage = value.includes('%');
    const isDollar = value.includes('$');
    
    parts.push(
      <span
        key={`stat-${keyPrefix}-${counter++}`}
        className={cn(
          "font-semibold px-1.5 py-0.5 rounded-md mx-0.5",
          isPercentage && "bg-purple-500/20 text-purple-300",
          isDollar && "bg-emerald-500/20 text-emerald-300"
        )}
      >
        {value}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
};

// Detect section type and return appropriate styling
const getSectionInfo = (line: string): { icon: React.ReactNode; type: string; color: string } | null => {
  const lowerLine = line.toLowerCase();
  
  if (lowerLine.includes('key finding') || lowerLine.includes('summary') || lowerLine.includes('tldr') || lowerLine.includes('overview')) {
    return { icon: <Target className="w-4 h-4" />, type: 'summary', color: 'cyan' };
  }
  if (lowerLine.includes('market sentiment') || lowerLine.includes('odds') || lowerLine.includes('probability')) {
    return { icon: <BarChart3 className="w-4 h-4" />, type: 'odds', color: 'purple' };
  }
  if (lowerLine.includes('implication') || lowerLine.includes('trader') || lowerLine.includes('takeaway')) {
    return { icon: <Lightbulb className="w-4 h-4" />, type: 'implication', color: 'amber' };
  }
  if (lowerLine.includes('risk') || lowerLine.includes('warning') || lowerLine.includes('caution')) {
    return { icon: <AlertTriangle className="w-4 h-4" />, type: 'risk', color: 'red' };
  }
  if (lowerLine.includes('upside') || lowerLine.includes('bullish') || lowerLine.includes('positive')) {
    return { icon: <TrendingUp className="w-4 h-4" />, type: 'bullish', color: 'green' };
  }
  if (lowerLine.includes('downside') || lowerLine.includes('bearish') || lowerLine.includes('negative')) {
    return { icon: <TrendingDown className="w-4 h-4" />, type: 'bearish', color: 'red' };
  }
  
  return null;
};

// Extract key stats from content for the stats panel
const extractKeyStats = (content: string): { label: string; value: string; color: string }[] => {
  const stats: { label: string; value: string; color: string }[] = [];
  
  // Look for "X% probability" or "X% odds" patterns
  const probMatch = content.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:probability|chance|odds)\s*(?:of\s+)?(?:a\s+)?([^,.\n]+)/i);
  if (probMatch) {
    stats.push({ label: probMatch[2].trim().slice(0, 20), value: `${probMatch[1]}%`, color: 'purple' });
  }
  
  // Look for volume patterns
  const volMatch = content.match(/(?:volume|pool)[:\s]*\$?([\d,.]+[KMB]?)/i);
  if (volMatch) {
    stats.push({ label: 'Volume', value: `$${volMatch[1]}`, color: 'emerald' });
  }
  
  // Look for "no change" or dominant outcome
  const noChangeMatch = content.match(/(?:no change|hold steady)[:\s]*(?:about\s+)?(\d+(?:\.\d+)?)\s*%/i);
  if (noChangeMatch) {
    stats.push({ label: 'No Change', value: `${noChangeMatch[1]}%`, color: 'cyan' });
  }
  
  return stats;
};

export const PolyfactualContent = ({ content }: PolyfactualContentProps) => {
  const lines = content.split('\n');
  const keyStats = extractKeyStats(content);
  
  let currentSection: { icon: React.ReactNode; type: string; color: string } | null = null;
  let sectionContent: string[] = [];
  const sections: React.ReactNode[] = [];
  let sectionIndex = 0;

  const renderSection = (sectionInfo: typeof currentSection, content: string[], key: number) => {
    if (content.length === 0) return null;
    
    const joinedContent = content.join('\n');
    
    if (sectionInfo) {
      const colorClasses = {
        cyan: 'border-cyan-500/30 bg-cyan-500/5',
        purple: 'border-purple-500/30 bg-purple-500/5',
        amber: 'border-amber-500/30 bg-amber-500/5',
        red: 'border-red-500/30 bg-red-500/5',
        green: 'border-emerald-500/30 bg-emerald-500/5',
      };
      
      const textColors = {
        cyan: 'text-cyan-400',
        purple: 'text-purple-400',
        amber: 'text-amber-400',
        red: 'text-red-400',
        green: 'text-emerald-400',
      };
      
      return (
        <div 
          key={key}
          className={cn(
            "p-4 rounded-xl border-l-4 backdrop-blur-sm",
            colorClasses[sectionInfo.color as keyof typeof colorClasses] || 'border-white/20 bg-white/5'
          )}
        >
          <div className={cn("flex items-center gap-2 mb-2", textColors[sectionInfo.color as keyof typeof textColors])}>
            {sectionInfo.icon}
            <span className="font-semibold text-sm uppercase tracking-wide">
              {sectionInfo.type.charAt(0).toUpperCase() + sectionInfo.type.slice(1)}
            </span>
          </div>
          <div className="text-gray-300 text-sm leading-relaxed">
            {formatParagraphs(joinedContent)}
          </div>
        </div>
      );
    }
    
    return (
      <div key={key} className="text-gray-300 text-sm leading-relaxed">
        {formatParagraphs(joinedContent)}
      </div>
    );
  };

  const formatParagraphs = (text: string) => {
    const paragraphs = text.split('\n').filter(p => p.trim());
    
    return paragraphs.map((para, idx) => {
      const trimmed = para.trim();
      
      // Bullet points
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return (
          <div key={idx} className="flex gap-2 my-1.5 ml-1">
            <span className="text-cyan-400 mt-0.5">•</span>
            <span>{formatInlineContent(trimmed.slice(1).trim())}</span>
          </div>
        );
      }
      
      // Regular paragraph
      return (
        <p key={idx} className="my-2">
          {formatInlineContent(trimmed)}
        </p>
      );
    });
  };

  // Process lines into sections
  lines.forEach((line, idx) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      if (sectionContent.length > 0) {
        sectionContent.push('');
      }
      return;
    }
    
    const newSection = getSectionInfo(trimmedLine);
    
    if (newSection && trimmedLine.length < 100) {
      // Render previous section
      if (sectionContent.length > 0) {
        sections.push(renderSection(currentSection, sectionContent, sectionIndex++));
      }
      currentSection = newSection;
      sectionContent = [];
    } else {
      sectionContent.push(trimmedLine);
    }
  });
  
  // Render final section
  if (sectionContent.length > 0) {
    sections.push(renderSection(currentSection, sectionContent, sectionIndex++));
  }

  return (
    <div className="space-y-4">
      {/* Key Stats Panel */}
      {keyStats.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-gradient-to-r from-[#161b22] to-[#1c2128] border border-white/10">
          {keyStats.map((stat, idx) => (
            <div 
              key={idx}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                stat.color === 'purple' && "bg-purple-500/10 border border-purple-500/20",
                stat.color === 'emerald' && "bg-emerald-500/10 border border-emerald-500/20",
                stat.color === 'cyan' && "bg-cyan-500/10 border border-cyan-500/20"
              )}
            >
              {stat.color === 'emerald' && <DollarSign className="w-4 h-4 text-emerald-400" />}
              {stat.color === 'purple' && <BarChart3 className="w-4 h-4 text-purple-400" />}
              {stat.color === 'cyan' && <Target className="w-4 h-4 text-cyan-400" />}
              <span className="text-gray-400 text-xs">{stat.label}</span>
              <span className={cn(
                "font-bold text-sm",
                stat.color === 'purple' && "text-purple-300",
                stat.color === 'emerald' && "text-emerald-300",
                stat.color === 'cyan' && "text-cyan-300"
              )}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Content sections */}
      <div className="space-y-4">
        {sections}
      </div>
    </div>
  );
};
