import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="relative border-t border-white/10 backdrop-blur-xl bg-white/5 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Main footer content */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="text-center sm:text-left">
            <p className="font-medium text-foreground">Poly - AI Market Analysis for Polymarket</p>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap justify-center sm:justify-start">
              <span>Powered by</span>
              <a
                href="https://polymarket.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 text-foreground/80 hover:text-foreground transition-colors"
              >
                Polymarket
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <span>•</span>
              <a
                href="https://domeapi.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-poly-cyan underline underline-offset-2 decoration-poly-cyan/50 hover:decoration-poly-cyan transition-colors"
              >
                domeapi.io
              </a>
              <span>•</span>
              <a
                href="https://search.brave.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 text-foreground/80 hover:text-foreground transition-colors"
              >
                Brave Search
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

          {/* Legal links */}
          <nav className="flex items-center gap-6 text-sm flex-wrap justify-center sm:justify-end">
            <Link to="/help" className="text-poly-cyan hover:text-poly-cyan/80 transition-colors font-medium">
              Help & Support
            </Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link to="/disclaimer" className="text-muted-foreground hover:text-foreground transition-colors">
              Disclaimer
            </Link>
          </nav>
        </div>

        {/* Disclaimer bar */}
        <div className="pt-4 border-t border-white/5 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Poly. All rights reserved.
            <span className="mx-2">•</span>
            <span className="text-warning/80">Not financial advice. Trading involves risk of loss.</span>
            <span className="mx-2">•</span>
            Part of Polymarket's Official Builders Program.
          </p>
        </div>
      </div>
    </footer>
  );
};
