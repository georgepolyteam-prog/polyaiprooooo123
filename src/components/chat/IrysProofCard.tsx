import React from "react";
import { ShieldCheck, ExternalLink, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface IrysProofCardProps {
  marketCount: number;
  sampleTxId?: string;
  category?: string;
  className?: string;
}

export const IrysProofCard = ({ 
  marketCount, 
  sampleTxId, 
  category,
  className 
}: IrysProofCardProps) => {
  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-4 mb-4",
        className
      )}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent pointer-events-none" />
      
      <div className="relative flex items-start gap-3">
        {/* Shield icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-blue-400">
              ✅ Verified on Irys Blockchain
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground mb-2">
            Analysis based on <span className="font-semibold text-foreground">{marketCount.toLocaleString()}</span> historical prediction markets
            {category && category !== 'all' && (
              <span className="text-blue-400 ml-1">• {category}</span>
            )}
          </p>
          
          <div className="flex items-center gap-4 flex-wrap">
            {sampleTxId && (
              <a 
                href={`https://gateway.irys.xyz/${sampleTxId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Blockchain Proof
              </a>
            )}
            
            <a 
              href="https://irys.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Database className="w-3.5 h-3.5" />
              Powered by Irys
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
