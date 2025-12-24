import { cn } from "@/lib/utils";
import polyLogoImage from "@/assets/poly-logo-new.png";

interface PolyLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  iconOnly?: boolean;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
};

const textSizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

export const PolyLogo = ({ size = "md", showText = true, className, iconOnly = false }: PolyLogoProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img 
        src={polyLogoImage} 
        alt="Poly" 
        className={cn(sizeClasses[size], "object-contain")}
      />
      {showText && !iconOnly && (
        <span className={cn("font-semibold tracking-tight text-foreground", textSizes[size])}>
          Poly
        </span>
      )}
    </div>
  );
};
