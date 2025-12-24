import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Database, Eye, Share2, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1f] via-[#1a0f2e] to-[#0f0a1f] relative">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-pink-500/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Privacy Policy</h1>
              <p className="text-muted-foreground">Last updated: December 2025</p>
            </div>
          </div>

          <div className="space-y-8 text-muted-foreground">
            {/* Introduction */}
            <section>
              <p className="text-lg leading-relaxed">
                Poly ("we," "our," or "us") is an AI-powered market analysis tool for Polymarket prediction markets. 
                This Privacy Policy explains how we collect, use, and protect your information when you use our services.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-foreground">Information We Collect</h2>
              </div>
              <div className="space-y-4 pl-8">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Account Information</h3>
                  <p>When you create an account, we collect your email address and display name.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Chat & Conversation Data</h3>
                  <p>Messages you send to Poly are stored to provide AI analysis and improve our services. This includes conversation history and any market URLs you share.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Technical Information</h3>
                  <p>We collect IP addresses, browser user agents, and device information for security, analytics, and service improvement.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Wallet Information</h3>
                  <p>When you connect a wallet, we only access your <strong>public wallet address</strong>. We <strong>NEVER</strong> store, access, or request your private keys or seed phrases.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Voice Data</h3>
                  <p>If you use voice chat features, audio recordings are processed to provide responses and are not permanently stored.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Telegram Information</h3>
                  <p>If you use our Telegram bot for alerts, we collect your Telegram chat ID and username to send notifications.</p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Trading Data</h3>
                  <p>Positions you choose to track and any trading activity conducted through our interface.</p>
                </div>
              </div>
            </section>

            {/* How We Use Your Information */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-semibold text-foreground">How We Use Your Information</h2>
              </div>
              <ul className="list-disc pl-12 space-y-2">
                <li>Provide AI-powered market analysis and insights</li>
                <li>Process and facilitate trades on Polymarket</li>
                <li>Send price alerts and notifications via Telegram</li>
                <li>Improve our services, fix bugs, and enhance user experience</li>
                <li>Ensure security and prevent abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            {/* Third-Party Services */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Share2 className="w-5 h-5 text-pink-400" />
                <h2 className="text-xl font-semibold text-foreground">Third-Party Services</h2>
              </div>
              <p className="mb-4">We integrate with the following third-party services:</p>
              <ul className="list-disc pl-12 space-y-2">
                <li><strong>Polymarket</strong> - For market data and trade execution</li>
                <li><strong>Dome API</strong> - For additional market analytics</li>
                <li><strong>WalletConnect</strong> - For secure wallet connections</li>
                <li><strong>Telegram</strong> - For notifications and alerts</li>
                <li><strong>AI Services</strong> - For processing chat messages and generating market analysis</li>
              </ul>
              <p className="mt-4 text-sm">Each of these services has their own privacy policies. We encourage you to review them.</p>
            </section>

            {/* Data Storage */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-semibold text-foreground">Data Storage & Security</h2>
              </div>
              <ul className="list-disc pl-12 space-y-2">
                <li>Data is stored on secure, hosted infrastructure</li>
                <li>Polymarket API credentials are stored <strong>only in your browser's local storage</strong> and are never sent to our servers</li>
                <li>We use encryption for data in transit and at rest</li>
                <li>Private keys are <strong>NEVER</strong> stored or transmitted</li>
              </ul>
            </section>

            {/* Data Retention */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-yellow-400" />
                <h2 className="text-xl font-semibold text-foreground">Data Retention & Your Rights</h2>
              </div>
              <ul className="list-disc pl-12 space-y-2">
                <li>Chat history is retained for service improvement</li>
                <li>You can request deletion of your data at any time</li>
                <li>Account deletion removes all associated data</li>
                <li>Local storage data can be cleared through your browser settings</li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
              </div>
              <p>
                If you have questions about this Privacy Policy or wish to exercise your data rights, 
                please contact us through our official channels.
              </p>
            </section>

            {/* Links */}
            <section className="pt-4 border-t border-white/10">
              <p className="text-sm">
                See also: <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> | <Link to="/disclaimer" className="text-primary hover:underline">Disclaimer</Link>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
