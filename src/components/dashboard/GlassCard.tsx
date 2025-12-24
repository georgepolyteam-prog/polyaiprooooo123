import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  pulse?: boolean;
  cyber?: boolean;
}

export function GlassCard({ children, className = '', glow = false, pulse = false, cyber = false }: GlassCardProps) {
  return (
    <div 
      className={cn(
        "relative backdrop-blur-xl",
        cyber ? "glass-card" : "bg-card/80 dark:bg-space-800/80",
        "border border-border/50 rounded-2xl",
        "shadow-lg",
        glow && "shadow-glow",
        pulse && "animate-pulse-border",
        cyber && "holographic gradient-border",
        className
      )}
    >
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-accent/20 rounded-2xl blur-xl -z-10" />
      )}
      {cyber && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      )}
      {children}
    </div>
  );
}
