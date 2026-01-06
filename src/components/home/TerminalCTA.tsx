import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const commands = [
  { prompt: 'poly analyze "Will Fed cut rates in March?"', delay: 50 },
];

const responses = [
  "Fetching market data...",
  "Analyzing 47 sources...",
  "Cross-referencing whale activity...",
  "",
  "Result: 67% probability",
  "Volume: $2.4M | 24h change: +5.3%",
  "Top signal: Fed officials dovish remarks",
];

export const TerminalCTA = () => {
  const [typedCommand, setTypedCommand] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [responseLines, setResponseLines] = useState<string[]>([]);

  useEffect(() => {
    const command = commands[0].prompt;
    let charIndex = 0;

    // Type the command
    const typeInterval = setInterval(() => {
      if (charIndex < command.length) {
        setTypedCommand(command.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => setShowResponse(true), 500);
      }
    }, commands[0].delay);

    return () => clearInterval(typeInterval);
  }, []);

  useEffect(() => {
    if (!showResponse) return;

    let lineIndex = 0;
    const lineInterval = setInterval(() => {
      if (lineIndex < responses.length) {
        setResponseLines((prev) => [...prev, responses[lineIndex]]);
        lineIndex++;
      } else {
        clearInterval(lineInterval);
      }
    }, 400);

    return () => clearInterval(lineInterval);
  }, [showResponse]);

  return (
    <section className="relative px-6 md:px-12 lg:px-20 py-24 md:py-32">
      <div className="max-w-4xl mx-auto">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
            // quick start
          </span>
        </motion.div>

        {/* Terminal window */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden"
        >
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="font-mono text-xs text-muted-foreground ml-2">
              poly-terminal
            </span>
          </div>

          {/* Terminal content */}
          <div className="p-6 font-mono text-sm">
            {/* Command line */}
            <div className="flex items-start gap-2 text-foreground">
              <span className="text-primary">$</span>
              <span>
                {typedCommand}
                {typedCommand.length < commands[0].prompt.length && (
                  <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse ml-0.5" />
                )}
              </span>
            </div>

            {/* Response */}
            {showResponse && (
              <div className="mt-4 space-y-1">
                {responseLines.map((line, i) => {
                  const safeeLine = line ?? "";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`
                        ${safeeLine === "" ? "h-2" : ""}
                        ${safeeLine.startsWith("Result:") ? "text-emerald-400 font-semibold" : "text-muted-foreground"}
                        ${safeeLine.startsWith("Volume:") ? "text-foreground" : ""}
                        ${safeeLine.startsWith("Top signal:") ? "text-primary" : ""}
                      `}
                    >
                      {safeeLine && <span className="text-muted-foreground/50 mr-2">›</span>}
                      {safeeLine}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="px-6 py-4 border-t border-border/50 bg-muted/20">
            <Link
              to="/chat"
              className="group inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Try it yourself
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* Keyboard hint */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-center font-mono text-xs text-muted-foreground"
        >
          press <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border text-foreground">⌘K</kbd> anywhere to search
        </motion.p>
      </div>
    </section>
  );
};
