import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, XCircle, Brain, Globe, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-500/15 rounded-full blur-[150px] animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Poly
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Warning Banner */}
        <div className="mb-8 p-6 sm:p-8 bg-gradient-to-r from-destructive/20 via-warning/20 to-destructive/20 border-2 border-warning/50 rounded-2xl text-center">
          <AlertTriangle className="w-16 h-16 text-warning mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-bold text-warning mb-2">⚠️ NOT FINANCIAL ADVICE ⚠️</h1>
          <p className="text-lg text-foreground">
            Poly is an informational tool only. All trading decisions are your sole responsibility.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 sm:p-12">
          <div className="space-y-8 text-muted-foreground">
            {/* Risk Warning */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <XCircle className="w-6 h-6 text-destructive" />
                <h2 className="text-2xl font-bold text-foreground">Risk Warning</h2>
              </div>
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span>
                      <strong>Prediction markets are highly speculative.</strong> You can lose 100% of your investment.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span>
                      <strong>Only trade what you can afford to lose.</strong> Never invest money you need for essential
                      expenses.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span>
                      <strong>Past performance does not guarantee future results.</strong> Historical data is not
                      predictive.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span>
                      <strong>Market prices can change rapidly.</strong> Liquidity may not be available when you need
                      it.
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            {/* AI Limitations */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Brain className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-foreground">AI Limitations</h2>
              </div>
              <div className="space-y-3">
                <p>Our AI analysis has inherent limitations:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>AI can be wrong.</strong> Predictions and analysis may be inaccurate or incomplete.
                  </li>
                  <li>
                    <strong>Market data may be delayed.</strong> Real-time data depends on third-party sources.
                  </li>
                  <li>
                    <strong>AI does not know the future.</strong> No model can predict outcomes with certainty.
                  </li>
                  <li>
                    <strong>Context may be missing.</strong> AI may not have access to all relevant information.
                  </li>
                  <li>
                    <strong>Bias is possible.</strong> Training data and methodology may introduce biases.
                  </li>
                </ul>
              </div>
            </section>

            {/* No Guarantees */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <XCircle className="w-6 h-6 text-orange-400" />
                <h2 className="text-2xl font-bold text-foreground">No Guarantees</h2>
              </div>
              <p className="mb-3">We make no guarantees regarding:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Accuracy of analysis, predictions, or market data</li>
                <li>Trade execution, timing, or fill rates</li>
                <li>Service availability or uptime</li>
                <li>Profitability of any trading strategy</li>
                <li>Third-party service performance (Polymarket, WalletConnect, etc.)</li>
              </ul>
            </section>

            {/* Jurisdiction & US Availability */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold text-foreground">Jurisdiction & US Availability</h2>
              </div>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-3 mb-4">
                <p className="font-semibold text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  US Users: Polymarket is now available
                </p>
                <p className="text-sm">
                  As of November 2025, Polymarket received CFTC (Commodity Futures Trading Commission) approval and
                  launched a regulated US platform. US users can now access Polymarket through the official regulated
                  app.
                </p>
              </div>
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg space-y-3">
                <p className="font-semibold text-foreground">Important considerations:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    Some <strong>state-level restrictions</strong> may still apply depending on your location.
                  </li>
                  <li>Users are solely responsible for compliance with local laws and regulations.</li>
                  <li>We do not provide legal advice regarding the legality of prediction markets in your area.</li>
                  <li>Some features may not be available in all regions.</li>
                </ul>
              </div>
            </section>

            {/* Polymarket Builders Program */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <h2 className="text-2xl font-bold text-foreground">Official Polymarket Builders Program</h2>
              </div>
              <div className="space-y-3">
                <p>
                  <strong>Poly is NOT Polymarket itself.</strong> We are part of Polymarket's Official Builders Program.
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong className="text-emerald-400">We are an official member of Polymarket's Builders Program</strong></li>
                  <li>We are not responsible for Polymarket's actions, policies, or issues.</li>
                  <li>Market data is provided by Polymarket and other third-party sources.</li>
                  <li>For issues with Polymarket itself, contact Polymarket directly.</li>
                </ul>
              </div>
            </section>

            {/* Independent Verification */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-yellow-400" />
                <h2 className="text-2xl font-bold text-foreground">Always Verify</h2>
              </div>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-foreground font-medium">Before making any trading decision:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Verify information from multiple independent sources</li>
                  <li>Do your own research (DYOR)</li>
                  <li>Consider consulting a financial advisor</li>
                  <li>Understand the specific market rules and resolution criteria</li>
                  <li>Never rely solely on AI analysis for trading decisions</li>
                </ul>
              </div>
            </section>

            {/* Acceptance */}
            <section className="pt-6 border-t border-white/10">
              <p className="text-center text-foreground font-medium">
                By using Poly, you acknowledge that you have read, understood, and agree to this disclaimer.
              </p>
            </section>

            {/* Links */}
            <section className="pt-4 border-t border-white/10">
              <p className="text-sm">
                See also:{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>{" "}
                |{" "}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
