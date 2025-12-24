import React from "react";
import { ExternalLink, Globe } from "lucide-react";
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
        "group relative flex items-center gap-2 p-3 rounded-lg",
        "bg-[#161b22] hover:bg-[#1c2128] border border-white/5 hover:border-emerald-500/30",
        "transition-all duration-200 hover:shadow-md hover:shadow-emerald-500/10"
      )}
    >
      {/* Source number badge */}
      <div className="relative flex-shrink-0 w-5 h-5 rounded bg-gradient-to-br from-emerald-600 to-cyan-600 text-white flex items-center justify-center text-xs font-bold">
        {index + 1}
      </div>
      
      {/* Favicon */}
      <div className="relative flex-shrink-0 w-4 h-4 rounded overflow-hidden bg-[#21262d] flex items-center justify-center">
        {faviconUrl ? (
          <img 
            src={faviconUrl} 
            alt="" 
            className="w-4 h-4 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <Globe className={cn("w-3 h-3 text-gray-500", faviconUrl && "hidden")} />
      </div>
      
      {/* Content */}
      <div className="relative flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
          {title || domain}
        </p>
        <p className="text-[10px] text-gray-500 truncate">
          {domain}
        </p>
      </div>
      
      {/* External link icon */}
      <ExternalLink className="relative flex-shrink-0 w-3 h-3 text-gray-600 group-hover:text-emerald-400 transition-colors" />
    </a>
  );
};
