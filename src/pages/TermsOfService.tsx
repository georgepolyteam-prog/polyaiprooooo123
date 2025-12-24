import { Link } from "react-router-dom";
import { ArrowLeft, FileText, AlertTriangle, Ban, Scale, UserCheck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-[150px] animate-pulse"
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
        <div className="glass-card rounded-2xl p-8 sm:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Terms of Service</h1>
              <p className="text-muted-foreground">Last updated: December 2025</p>
            </div>
          </div>

          <div className="space-y-8 text-muted-foreground">
            {/* Acceptance */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Poly ("the Service"), you agree to be bound by these Terms of Service. If you do
                not agree to these terms, do not use the Service.
              </p>
            </section>

            {/* Service Description */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Service Description</h2>
              <p>
                Poly is an AI-powered analysis tool for Polymarket prediction markets. We provide market data,
                AI-generated insights, whale tracking, and trading functionality. We are <strong>NOT</strong> Polymarket
                itself, but we are an official member of Polymarket's Builders Program.
              </p>
            </section>

            {/* Eligibility */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <UserCheck className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-semibold text-foreground">3. Eligibility & Jurisdiction</h2>
              </div>
              <div className="space-y-3 pl-8">
                <p>To use the Service, you must:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Be at least 18 years old or the legal age in your jurisdiction</li>
                  <li>Have the legal capacity to enter into binding agreements</li>
                  <li>
                    Be responsible for compliance with all applicable local, state, national, and international laws
                  </li>
                </ul>
                <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    US Availability: Polymarket is now available to US users
                  </p>
                  <p className="mt-2 text-sm">
                    As of November 2025, Polymarket received CFTC approval and launched a regulated US app. US users can
                    access Polymarket through the official regulated platform. Some state-level restrictions may still
                    apply. Always verify compliance with your local laws.
                  </p>
                </div>
              </div>
            </section>

            {/* Trading Disclaimer - CRITICAL */}
            <section className="p-6 bg-warning/10 border border-warning/30 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-warning" />
                <h2 className="text-xl font-bold text-warning">4. TRADING DISCLAIMER</h2>
              </div>
              <div className="space-y-3">
                <p className="font-semibold text-foreground">
                  THE SERVICE DOES NOT PROVIDE FINANCIAL, INVESTMENT, OR TRADING ADVICE.
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    All analysis, predictions, and insights are for <strong>informational purposes only</strong>
                  </li>
                  <li>
                    All trading decisions are <strong>solely your responsibility</strong>
                  </li>
                  <li>
                    Prediction markets are highly speculative and involve <strong>risk of total loss</strong>
                  </li>
                  <li>AI analysis may be inaccurate, incomplete, or outdated</li>
                  <li>Past performance does not guarantee future results</li>
                  <li>We do not guarantee trade execution, accuracy, or profitability</li>
                  <li>
                    You should <strong>never trade more than you can afford to lose</strong>
                  </li>
                </ul>
                <p className="mt-4 text-sm text-foreground">
                  By using trading features, you acknowledge that you understand these risks and accept full
                  responsibility for your trading decisions and any resulting losses.
                </p>
              </div>
            </section>

            {/* Account Responsibilities */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Account Responsibilities</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You are responsible for maintaining the security of your wallet and private keys</li>
                <li>Never share your API credentials or private keys with anyone</li>
                <li>You must provide accurate information when using the Service</li>
                <li>You are responsible for all activity under your account or wallet</li>
              </ul>
            </section>

            {/* Prohibited Uses */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <Ban className="w-5 h-5 text-destructive" />
                <h2 className="text-xl font-semibold text-foreground">6. Prohibited Uses</h2>
              </div>
              <p className="mb-3">You may not use the Service to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Manipulate markets or engage in wash trading</li>
                <li>Conduct illegal activities or violate any laws</li>
                <li>Automate access beyond reasonable personal use (scraping, bots)</li>
                <li>Attempt to circumvent security measures</li>
                <li>Interfere with other users' use of the Service</li>
                <li>Use the Service if you are a restricted person under applicable laws</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Intellectual Property</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Poly branding, design, and AI methodology are our intellectual property</li>
                <li>Market data originates from Polymarket and third-party providers</li>
                <li>You may not reproduce or redistribute our analysis for commercial purposes without permission</li>
              </ul>
            </section>

            {/* Limitation of Liability */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <Scale className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-foreground">8. Limitation of Liability</h2>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</p>
                <p>WE ARE NOT LIABLE FOR:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Trading losses or financial damages</li>
                  <li>Inaccurate AI analysis or predictions</li>
                  <li>Service interruptions or downtime</li>
                  <li>Third-party service failures (Polymarket, WalletConnect, etc.)</li>
                  <li>Unauthorized access to your account</li>
                  <li>Any indirect, incidental, or consequential damages</li>
                </ul>
              </div>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Termination</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>We may terminate or suspend access for violations of these terms</li>
                <li>You may stop using the Service at any time</li>
                <li>Upon termination, provisions that should survive (liability, disclaimers) remain in effect</li>
              </ul>
            </section>

            {/* Modifications */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Modifications</h2>
              <p>
                We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance
                of the new terms. We encourage you to review this page periodically.
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
                <Link to="/disclaimer" className="text-primary hover:underline">
                  Disclaimer
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
