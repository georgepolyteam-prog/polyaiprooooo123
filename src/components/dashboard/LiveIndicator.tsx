import { useEffect, useState } from 'react';

interface LiveIndicatorProps {
  lastUpdate: number;
}

export function LiveIndicator({ lastUpdate }: LiveIndicatorProps) {
  const [timeSince, setTimeSince] = useState('just now');
  
  useEffect(() => {
    const updateTime = () => {
      const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
      if (seconds < 10) setTimeSince('just now');
      else if (seconds < 60) setTimeSince(`${seconds}s ago`);
      else setTimeSince(`${Math.floor(seconds / 60)}m ago`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
      <div className="relative">
        <div className="w-2 h-2 bg-success rounded-full animate-ping absolute" />
        <div className="w-2 h-2 bg-success rounded-full" />
      </div>
      <span className="text-xs font-medium text-success">LIVE · {timeSince}</span>
    </div>
  );
}
