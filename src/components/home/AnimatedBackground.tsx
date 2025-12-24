import { useEffect, useState } from "react";

export const AnimatedBackground = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    const checkMotion = () => setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    
    checkMobile();
    checkMotion();
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const particleCount = prefersReducedMotion ? 0 : isMobile ? 8 : 20;

  return (
    <>
      {/* Animated gradient mesh */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Primary gradient orbs - smaller on mobile */}
        <div 
          className="absolute top-0 -left-20 sm:-left-40 w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-primary/15 rounded-full blur-[80px] sm:blur-[150px] will-change-transform" 
          style={{ animation: prefersReducedMotion ? 'none' : 'float-slow 20s ease-in-out infinite' }}
        />
        <div 
          className="absolute top-1/4 -right-20 sm:-right-40 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-secondary/12 rounded-full blur-[100px] sm:blur-[180px] will-change-transform" 
          style={{ animation: prefersReducedMotion ? 'none' : 'float-slow 20s ease-in-out infinite', animationDelay: '2s' }}
        />
        <div 
          className="absolute bottom-0 left-1/4 w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-accent/10 rounded-full blur-[80px] sm:blur-[150px] will-change-transform" 
          style={{ animation: prefersReducedMotion ? 'none' : 'float-slow 20s ease-in-out infinite', animationDelay: '4s' }}
        />
        
        {/* Secondary subtle orbs - hide on mobile */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] bg-gradient-radial from-primary/5 via-transparent to-transparent rounded-full hidden sm:block" />
        
        {/* Grid overlay */}
        <div className="absolute inset-0 cyber-grid opacity-20 sm:opacity-30" />
        
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.01] sm:opacity-[0.015] mix-blend-overlay" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }} />
        
        {/* Gradient line accents */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
      </div>
      
      {/* Floating particles - reduced on mobile */}
      {!prefersReducedMotion && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {[...Array(particleCount)].map((_, i) => (
            <div
              key={i}
              className="particle will-change-transform"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 15}s`,
                animationDuration: `${15 + Math.random() * 10}s`,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};
