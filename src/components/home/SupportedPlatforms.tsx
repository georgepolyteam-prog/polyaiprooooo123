import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import polymarketLogo from "@/assets/polymarket-logo.png";
import kalshiLogo from "@/assets/kalshi-logo.png";

const platforms = [
  {
    name: "Polymarket",
    logo: polymarketLogo,
    tagline: "Global Prediction Markets",
    description: "Trade on world events with crypto. 24/7 liquidity across 500+ active markets.",
    accent: "from-purple-500/20 to-transparent",
    link: "/markets",
  },
  {
    name: "Kalshi",
    logo: kalshiLogo,
    tagline: "Regulated US Markets",
    description: "CFTC-regulated event contracts. Legal prediction markets for US traders.",
    accent: "from-emerald-500/20 to-transparent",
    link: "/kalshi",
  },
];

const dataSources = [
  { name: "Real-time orderbooks", detail: "Live bid/ask data" },
  { name: "AI-powered analysis", detail: "Claude + custom models" },
  { name: "Cross-platform arbitrage", detail: "Price discrepancy detection" },
];

export const SupportedPlatforms = () => {
  return (
    <section className="relative px-6 md:px-12 lg:px-20 py-24 md:py-32 bg-muted/20">
      <div className="max-w-6xl mx-auto">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
            // supported platforms
          </span>
        </motion.div>

        {/* Platform cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {platforms.map((platform, index) => (
            <motion.div
              key={platform.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={platform.link}
                className="group block relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 hover:border-primary/30 transition-all duration-300 h-full"
              >
                {/* Accent glow */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${platform.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden rounded-tr-2xl">
                  <div className="absolute top-0 right-0 w-px h-8 bg-gradient-to-b from-primary/50 to-transparent" />
                  <div className="absolute top-0 right-0 w-8 h-px bg-gradient-to-l from-primary/50 to-transparent" />
                </div>

                <div className="relative z-10">
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-xl bg-background/80 border border-border/50 flex items-center justify-center mb-6 overflow-hidden">
                    <img
                      src={platform.logo}
                      alt={platform.name}
                      className="w-8 h-8 object-contain"
                    />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-foreground mb-1">
                    {platform.name}
                  </h3>
                  <p className="font-mono text-xs text-primary mb-4">
                    {platform.tagline}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {platform.description}
                  </p>

                  {/* CTA */}
                  <div className="flex items-center gap-2 text-sm text-foreground group-hover:text-primary transition-colors">
                    <span>Explore markets</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Data sources row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="border-t border-border/30 pt-8"
        >
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {dataSources.map((source) => (
              <div key={source.name} className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {source.name}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {source.detail}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
