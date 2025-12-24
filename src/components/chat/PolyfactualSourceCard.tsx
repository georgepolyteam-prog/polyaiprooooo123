import React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PolyfactualSourceCardProps {
  title: string;
  url: string;
  index: number;
}

// Extract domain from URL for display
const getDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return url;
  }
};

// Get favicon URL using Google's favicon service
const getFaviconUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return "";
  }
};

export const PolyfactualSourceCard = ({ title, url, index }: PolyfactualSourceCardProps) => {
  const domain = getDomain(url);
  const faviconUrl = getFaviconUrl(url);
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl",
        "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30",
        "transition-all duration-200 hover:shadow-md hover:shadow-cyan-500/10"
      )}
    >
      {/* Source number badge */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
        {index + 1}
      </div>
      
      {/* Favicon */}
      <div className="flex-shrink-0 w-5 h-5 rounded overflow-hidden bg-white/10">
        {faviconUrl && (
          <img 
            src={faviconUrl} 
            alt="" 
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-cyan-300 transition-colors">
          {title || domain}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {domain}
        </p>
      </div>
      
      {/* External link icon */}
      <ExternalLink className="flex-shrink-0 w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
    </a>
  );
};
