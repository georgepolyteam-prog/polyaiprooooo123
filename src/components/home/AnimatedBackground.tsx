export const AnimatedBackground = () => {
  return (
    <>
      {/* Animated gradient mesh */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Primary gradient orbs */}
        <div className="absolute top-0 -left-40 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[150px] animate-float-slow" />
        <div className="absolute top-1/4 -right-40 w-[600px] h-[600px] bg-secondary/12 rounded-full blur-[180px] animate-float-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[150px] animate-float-slow" style={{ animationDelay: '4s' }} />
        
        {/* Secondary subtle orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 via-transparent to-transparent rounded-full" />
        
        {/* Grid overlay */}
        <div className="absolute inset-0 cyber-grid opacity-30" />
        
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }} />
        
        {/* Gradient line accents */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
      </div>
      
      {/* Floating particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 15}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
    </>
  );
};
