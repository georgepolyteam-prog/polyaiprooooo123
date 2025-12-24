import { useEffect, useState } from 'react';
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ 
  value, 
  format = (n) => n.toString(),
  className = '' 
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (Math.abs(value - displayValue) < 0.0001) return;
    
    setIsAnimating(true);
    const duration = 300;
    const steps = 20;
    const stepValue = (value - displayValue) / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        setIsAnimating(false);
        clearInterval(interval);
      } else {
        setDisplayValue(prev => prev + stepValue);
      }
    }, duration / steps);
    
    return () => clearInterval(interval);
  }, [value, displayValue]);
  
  return (
    <span 
      className={cn(
        "transition-all duration-200",
        isAnimating && "text-accent scale-105",
        className
      )}
    >
      {format(displayValue)}
    </span>
  );
}
