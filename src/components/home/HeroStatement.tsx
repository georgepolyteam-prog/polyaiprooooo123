import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export const HeroStatement = () => {
  return (
    <section className="relative min-h-[60vh] md:min-h-[85vh] flex flex-col justify-center px-6 md:px-12 lg:px-20 overflow-hidden pt-16 md:pt-0">
      {/* Subtle background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Single gradient orb - not particle spam */}
        <motion.div
          className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Noise texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 max-w-5xl">
        {/* Monospace label */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6"
        >
          <span className="font-mono text-xs md:text-sm text-muted-foreground tracking-widest uppercase">
            // prediction market intelligence
          </span>
        </motion.div>

        {/* Main headline - left aligned, brutal */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-[clamp(3rem,12vw,8rem)] font-bold leading-[0.9] tracking-tight text-foreground mb-6"
        >
          Trade
          <br />
          <span className="text-primary">smarter.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="font-mono text-sm md:text-base text-muted-foreground max-w-md mb-12"
        >
          The all-in-one platform for prediction market traders.
          <br />
          AI research. Live data. Execution.
        </motion.p>

        {/* CTA - minimal, not screaming */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link
            to="/chat"
            className="group inline-flex items-center gap-2 text-foreground font-medium hover:text-primary transition-colors"
          >
            <span className="border-b border-current pb-0.5">Start analyzing</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/markets"
            className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            or browse markets →
          </Link>
        </motion.div>

        {/* Live indicator - real activity pulse */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex items-center gap-3 mt-12 md:mt-16"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            live market data
          </span>
        </motion.div>
      </div>
    </section>
  );
};
