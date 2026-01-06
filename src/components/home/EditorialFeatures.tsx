import { motion } from "framer-motion";
import { Brain, TrendingUp, Zap, Users } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Deep Research",
    description: "AI analysis with cited sources from Polyfactual",
    accent: "primary",
  },
  {
    icon: TrendingUp,
    title: "Whale Tracker",
    description: "Real-time flow monitoring of smart money",
    accent: "emerald",
  },
  {
    icon: Zap,
    title: "Instant Execution",
    description: "Trade Polymarket & Kalshi in one interface",
    accent: "amber",
  },
  {
    icon: Users,
    title: "Leaderboard",
    description: "Track top traders and their positions",
    accent: "purple",
  },
];

export const EditorialFeatures = () => {
  return (
    <section className="relative px-6 md:px-12 lg:px-20 py-24 md:py-32">
      <div className="max-w-6xl mx-auto">
        {/* Editorial layout - asymmetric */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Left column - statement */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-5"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-foreground mb-6">
              Ask anything
              <br />
              about any market.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
              Get answers backed by real data, whale movements, and AI research.
              No more guessing.
            </p>

            <div className="mt-8 font-mono text-xs text-muted-foreground">
              <span className="text-primary">$</span> poly analyze "fed rate decision"
            </div>
          </motion.div>

          {/* Right column - staggered cards */}
          <div className="lg:col-span-7 relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className={`
                    relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm
                    hover:border-border hover:bg-card transition-all duration-300
                    ${i % 2 === 1 ? "sm:mt-8" : ""}
                  `}
                >
                  {/* Icon with accent glow */}
                  <div
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center mb-4
                      ${feature.accent === "primary" ? "bg-primary/10 text-primary" : ""}
                      ${feature.accent === "emerald" ? "bg-emerald-500/10 text-emerald-500" : ""}
                      ${feature.accent === "amber" ? "bg-amber-500/10 text-amber-500" : ""}
                      ${feature.accent === "purple" ? "bg-purple-500/10 text-purple-500" : ""}
                    `}
                  >
                    <feature.icon className="w-5 h-5" />
                  </div>

                  <h3 className="font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Subtle corner accent */}
                  <div
                    className={`
                      absolute top-0 right-0 w-16 h-16 rounded-tr-2xl opacity-5
                      ${feature.accent === "primary" ? "bg-primary" : ""}
                      ${feature.accent === "emerald" ? "bg-emerald-500" : ""}
                      ${feature.accent === "amber" ? "bg-amber-500" : ""}
                      ${feature.accent === "purple" ? "bg-purple-500" : ""}
                    `}
                    style={{
                      maskImage: "linear-gradient(135deg, black 50%, transparent 50%)",
                      WebkitMaskImage: "linear-gradient(135deg, black 50%, transparent 50%)",
                    }}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
