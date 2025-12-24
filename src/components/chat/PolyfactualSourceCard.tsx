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
        "group relative flex items-center gap-3 p-4 rounded-xl",
        "bg-[#161b22] hover:bg-[#1c2128] border border-white/5 hover:border-emerald-500/30",
        "transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10",
        "hover:-translate-y-0.5"
      )}
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Source number badge */}
      <div className="relative flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-cyan-600 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-emerald-500/20">
        {index + 1}
      </div>
      
      {/* Favicon */}
      <div className="relative flex-shrink-0 w-6 h-6 rounded-md overflow-hidden bg-[#21262d] flex items-center justify-center">
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
        <p className="text-sm font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
          {title || domain}
        </p>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {domain}
        </p>
      </div>
      
      {/* External link icon */}
      <ExternalLink className="relative flex-shrink-0 w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition-colors" />
    </a>
  );
};
