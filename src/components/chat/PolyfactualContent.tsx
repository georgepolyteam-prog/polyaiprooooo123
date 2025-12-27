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
    
    // Add the styled link - truncate long URLs to prevent overflow
    const displayText = match[1].length > 50 
      ? match[1].slice(0, 47) + '...' 
      : match[1];
    
    parts.push(
      <a
        key={`link-${keyCounter++}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40 hover:decoration-primary/60 transition-colors break-all max-w-full"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
        title={match[1]} // Show full text on hover
      >
        <span className="truncate max-w-[200px] sm:max-w-[300px]">{displayText}</span>
        <ExternalLink className="w-3 h-3 inline opacity-60 flex-shrink-0" />
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
        <strong key={`bold-${partIdx}-${boldMatch.index}`} className="font-semibold text-foreground">
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

// Highlight percentages and dollar amounts - using muted accent styling
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
    
    // Use consistent muted styling for all stats
    parts.push(
      <span
        key={`stat-${keyPrefix}-${counter++}`}
        className="font-semibold px-1.5 py-0.5 rounded-md mx-0.5 bg-primary/10 text-primary"
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

// Detect section type and return appropriate styling - simplified to primary color only
const getSectionInfo = (line: string): { icon: React.ReactNode; type: string } | null => {
  const lowerLine = line.toLowerCase();
  const trimmedLine = line.trim();
  
  // Check for markdown headers (## Summary, ### Key Developments, etc.)
  const isMarkdownHeader = trimmedLine.startsWith('#');
  
  // Summary section (## Summary or variations)
  if (isMarkdownHeader && (lowerLine.includes('summary') || lowerLine.includes('market summary'))) {
    return { icon: <Target className="w-4 h-4" />, type: 'Summary' };
  }
  // Key developments/news section
  if (isMarkdownHeader && (lowerLine.includes('development') || lowerLine.includes('key news') || lowerLine.includes('news'))) {
    return { icon: <Lightbulb className="w-4 h-4" />, type: 'Key Developments' };
  }
  // Sources section
  if (isMarkdownHeader && lowerLine.includes('source')) {
    return { icon: <ExternalLink className="w-4 h-4" />, type: 'Sources' };
  }
  // Non-emoji detection (professional icons only)
  if (lowerLine.includes('market summary')) {
    return { icon: <Target className="w-4 h-4" />, type: 'Summary' };
  }
  if (lowerLine.includes('key news')) {
    return { icon: <Lightbulb className="w-4 h-4" />, type: 'Key Developments' };
  }
  if (lowerLine.includes('market sentiment') || lowerLine.includes('odds') || lowerLine.includes('probability')) {
    return { icon: <BarChart3 className="w-4 h-4" />, type: 'Analysis' };
  }
  if (lowerLine.includes('risk') || lowerLine.includes('warning') || lowerLine.includes('caution')) {
    return { icon: <AlertTriangle className="w-4 h-4" />, type: 'Risk' };
  }
  if (lowerLine.includes('upside') || lowerLine.includes('bullish')) {
    return { icon: <TrendingUp className="w-4 h-4" />, type: 'Upside' };
  }
  if (lowerLine.includes('downside') || lowerLine.includes('bearish')) {
    return { icon: <TrendingDown className="w-4 h-4" />, type: 'Downside' };
  }
  
  return null;
};

// Extract key stats from content for the stats panel - simplified to use primary color
const extractKeyStats = (content: string): { label: string; value: string }[] => {
  const stats: { label: string; value: string }[] = [];
  
  // Look for "X% probability" or "X% odds" patterns
  const probMatch = content.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:probability|chance|odds)\s*(?:of\s+)?(?:a\s+)?([^,.\n]+)/i);
  if (probMatch) {
    stats.push({ label: probMatch[2].trim().slice(0, 20), value: `${probMatch[1]}%` });
  }
  
  // Look for volume patterns
  const volMatch = content.match(/(?:volume|pool)[:\s]*\$?([\d,.]+[KMB]?)/i);
  if (volMatch) {
    stats.push({ label: 'Volume', value: `$${volMatch[1]}` });
  }
  
  // Look for "no change" or dominant outcome
  const noChangeMatch = content.match(/(?:no change|hold steady)[:\s]*(?:about\s+)?(\d+(?:\.\d+)?)\s*%/i);
  if (noChangeMatch) {
    stats.push({ label: 'No Change', value: `${noChangeMatch[1]}%` });
  }
  
  return stats;
};

export const PolyfactualContent = ({ content }: PolyfactualContentProps) => {
  const lines = content.split('\n');
  const keyStats = extractKeyStats(content);
  
  let currentSection: { icon: React.ReactNode; type: string } | null = null;
  let sectionContent: string[] = [];
  const sections: React.ReactNode[] = [];
  let sectionIndex = 0;

  const renderSection = (sectionInfo: typeof currentSection, content: string[], key: number) => {
    if (content.length === 0) return null;
    
    const joinedContent = content.join('\n');
    
    if (sectionInfo) {
      return (
        <div 
          key={key}
          className="p-4 rounded-xl border-l-4 border-primary/30 bg-primary/5 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-2 text-primary">
            {sectionInfo.icon}
            <span className="font-semibold text-sm uppercase tracking-wide">
              {sectionInfo.type}
            </span>
          </div>
          <div className="text-muted-foreground text-sm leading-relaxed">
            {formatParagraphs(joinedContent)}
          </div>
        </div>
      );
    }
    
    return (
      <div key={key} className="text-muted-foreground text-sm leading-relaxed">
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
            <span className="text-primary mt-0.5 flex-shrink-0">•</span>
            <span className="break-words overflow-hidden" style={{ overflowWrap: 'anywhere' }}>{formatInlineContent(trimmed.slice(1).trim())}</span>
          </div>
        );
      }
      
      // Regular paragraph
      return (
        <p key={idx} className="my-2 break-words overflow-hidden" style={{ overflowWrap: 'anywhere' }}>
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
    <div className="space-y-4 overflow-hidden">
      {/* Key Stats Panel */}
      {keyStats.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-card border border-border">
          {keyStats.map((stat, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20"
            >
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground text-xs">{stat.label}</span>
              <span className="font-bold text-sm text-primary">
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
