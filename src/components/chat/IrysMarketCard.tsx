import { ExternalLink, ShieldCheck, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface IrysMarketCardProps {
  question: string;
  yesPrice: string;
  volume: number;
  category?: string;
  resolvedOutcome?: string | null;
  txId?: string;
  proofUrl?: string;
  endDate?: string;
  index: number;
  onSelect?: () => void;
}

const formatVolume = (vol: number): string => {
  if (vol >= 1000000) {
    return `${(vol / 1000000).toFixed(1)}M`.replace('.0M', 'M');
  } else if (vol >= 1000) {
    return `${(vol / 1000).toFixed(1)}K`.replace('.0K', 'K');
  }
  return vol.toString();
};

export function IrysMarketCard({ 
  question, 
  yesPrice, 
  volume, 
  category,
  resolvedOutcome,
  txId,
  proofUrl,
  endDate,
  index,
  onSelect
}: IrysMarketCardProps) {
  const isYesWinner = resolvedOutcome?.toLowerCase() === 'yes';
  const isNoWinner = resolvedOutcome?.toLowerCase() === 'no';
  const hasOutcome = resolvedOutcome !== null && resolvedOutcome !== undefined;
  
  return (
    <div
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 rounded-xl bg-card border border-border",
        "hover:border-blue-500/50 hover:bg-blue-500/5 hover:shadow-lg hover:shadow-blue-500/10",
        "transition-all group cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Blockchain Verified Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
              <ShieldCheck className="w-3 h-3" />
              Blockchain Verified
            </span>
            {category && (
              <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-full">
                {category}
              </span>
            )}
          </div>
          
          {/* Question */}
          <p className="text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors leading-snug">
            {question}
          </p>
          
          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
            {/* Resolved Outcome */}
            {hasOutcome && (
              <span className={cn(
                "font-semibold flex items-center gap-1",
                isYesWinner ? "text-success" : isNoWinner ? "text-destructive" : "text-muted-foreground"
              )}>
                {isYesWinner ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : isNoWinner ? (
                  <XCircle className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {resolvedOutcome}
              </span>
            )}
            
            {/* Final Price */}
            <span className="text-muted-foreground">
              {yesPrice}% YES
            </span>
            
            {/* Volume */}
            <span className="text-muted-foreground">
              ${formatVolume(volume)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Proof Link */}
      {proofUrl && (
        <a
          href={proofUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View Blockchain Proof
        </a>
      )}
    </div>
  );
}
