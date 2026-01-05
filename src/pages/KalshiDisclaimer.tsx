import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Shield, Globe, Users, Zap, Scale, FileText } from "lucide-react";
import { Footer } from "@/components/Footer";

const RESTRICTED_JURISDICTIONS = [
  "Afghanistan", "Albania", "Australia", "Barbados", "Belarus", "Belgium", "Bosnia and Herzegovina",
  "Bulgaria", "Burkina Faso", "Canada", "Cayman Islands", "Central African Republic", "China",
  "Côte d'Ivoire (Ivory Coast)", "Croatia", "Cuba", "Democratic People's Republic of Korea (North Korea)",
  "Democratic Republic of the Congo", "France", "Germany", "Haiti", "Hong Kong", "Iran", "Iraq",
  "Italy", "Jamaica", "Jordan", "Kosovo", "Lebanon", "Libya", "Mali", "Malta", "Mexico", "Morocco",
  "Myanmar (Burma)", "Nicaragua", "Pakistan", "Panama", "Philippines", "Poland", "Russia",
  "Senegal", "Singapore", "South Africa", "South Sudan", "Spain", "Switzerland", "Syria",
  "Tanzania", "Trinidad and Tobago", "Turkey", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "Venezuela", "Vietnam", "Yemen", "Zimbabwe"
];

export default function KalshiDisclaimer() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
      
      {/* Header */}
      <header className="relative border-b border-border/50 backdrop-blur-xl bg-background/80">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link 
            to="/kalshi" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Kalshi Markets
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative max-w-4xl mx-auto px-4 py-8 pb-16">
        {/* Warning Banner */}
        <div className="mb-8 p-6 rounded-2xl bg-destructive/10 border-2 border-destructive/30">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-destructive flex-shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-destructive mb-2">
                THIRD-PARTY INTERFACE DISCLAIMER
              </h1>
              <p className="text-foreground/90 text-lg">
                <strong>Poly is NOT Kalshi.</strong> We provide a third-party interface to access Kalshi markets 
                via DFlow on the Solana blockchain. Your use of this interface is subject to additional risks 
                beyond those of trading directly on Kalshi.
              </p>
            </div>
          </div>
        </div>

        {/* DFlow/Solana Integration */}
        <section className="mb-8 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">DFlow & Solana Integration</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong className="text-foreground">How Trading Works:</strong> When you trade Kalshi markets 
              through Poly, your orders are executed on the Solana blockchain via DFlow's infrastructure. 
              This is different from trading directly on Kalshi's exchange.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Trades settle on Solana, not Kalshi's native settlement system</li>
              <li>You interact with Solana smart contracts, introducing blockchain-specific risks</li>
              <li>Transaction finality depends on Solana network confirmation</li>
              <li>Network congestion may affect execution timing and fees</li>
              <li>Wallet security is your responsibility—lost keys mean lost funds</li>
            </ul>
            <p className="text-warning">
              DFlow and Poly are independent of Kalshi. Issues with DFlow's routing, Solana network 
              congestion, or smart contract behavior are outside Kalshi's control.
            </p>
          </div>
        </section>

        {/* Event Contract Risk */}
        <section className="mb-8 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-warning" />
            <h2 className="text-xl font-semibold">Event Contract Trading Risk</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="text-destructive font-medium">
              TRADING EVENT CONTRACTS IS HIGHLY SPECULATIVE AND INVOLVES SUBSTANTIAL RISK OF LOSS.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Event contracts may lose all value if the underlying event does not occur as predicted</li>
              <li>Markets can be extremely volatile with rapid price swings</li>
              <li>Past performance is not indicative of future results</li>
              <li>You should only trade with funds you can afford to lose entirely</li>
              <li>Each contract has specific rules governing settlement—read them before trading</li>
            </ul>
            <p>
              Kalshi event contracts are <strong>not</strong> traditional securities or derivatives. 
              They are binary outcome contracts regulated by the CFTC as a designated contract market (DCM).
            </p>
          </div>
        </section>

        {/* Electronic Trading Risk */}
        <section className="mb-8 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-semibold">Electronic Trading Risks</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>System Failures:</strong> Hardware, software, or network malfunctions may prevent order execution</li>
              <li><strong>Order Cancellation:</strong> Orders may be cancelled or modified due to system errors</li>
              <li><strong>Price Delays:</strong> Market data may be delayed or inaccurate during high volatility</li>
              <li><strong>Platform Unavailability:</strong> DFlow, Solana, or Kalshi may be unavailable at critical times</li>
              <li><strong>Execution Differences:</strong> Fill prices may differ from displayed quotes</li>
              <li><strong>Wallet Issues:</strong> Solana wallet connections may fail or timeout during transactions</li>
            </ul>
            <p>
              You acknowledge that electronic trading carries inherent risks that may result in financial loss 
              beyond your control.
            </p>
          </div>
        </section>

        {/* Market Makers */}
        <section className="mb-8 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold">Market Maker Disclosure</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Kalshi maintains approved market maker programs. These participants may have advantages 
              not available to regular traders:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Reduced trading fees or fee rebates</li>
              <li>Access to specialized risk management tools</li>
              <li>Priority order execution during certain periods</li>
              <li>Direct market access and lower latency</li>
            </ul>
            <p className="text-warning">
              By trading on Kalshi markets, you acknowledge that you may be trading against sophisticated 
              market makers with technological and informational advantages.
            </p>
          </div>
        </section>

        {/* Restricted Jurisdictions */}
        <section className="mb-8 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-semibold">Restricted Jurisdictions</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="text-destructive font-medium">
              Trading on Kalshi is PROHIBITED for residents of the following jurisdictions:
            </p>
            <div className="bg-destructive/5 rounded-lg p-4 border border-destructive/20">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {RESTRICTED_JURISDICTIONS.map((country) => (
                  <span key={country} className="text-foreground/80">• {country}</span>
                ))}
              </div>
            </div>
            <p>
              <strong>You are solely responsible</strong> for ensuring your use of Kalshi markets complies 
              with all applicable laws in your jurisdiction. Poly does not verify your location or 
              enforce geographic restrictions—compliance is your responsibility.
            </p>
            <p className="text-warning text-sm">
              This list may not be complete. Additional US state-level restrictions may apply. 
              Consult the official Kalshi Member Agreement for the current list.
            </p>
          </div>
        </section>

        {/* Liability Limitations */}
        <section className="mb-8 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-semibold">Liability Limitations</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong>Poly, its affiliates, and partners disclaim all liability for:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Actions or omissions by Kalshi, DFlow, or Solana network</li>
              <li>Trading losses, regardless of cause</li>
              <li>System failures, delays, or unavailability</li>
              <li>Errors in market data, pricing, or analysis</li>
              <li>Consequences of your trading decisions</li>
              <li>Smart contract vulnerabilities or exploits</li>
              <li>Wallet security breaches or lost funds</li>
            </ul>
            <p>
              <strong>Maximum Liability:</strong> To the fullest extent permitted by law, our total 
              liability is limited to the fees you paid to Poly (if any) in the preceding 12 months.
            </p>
          </div>
        </section>

        {/* Identity Verification */}
        <section className="mb-8 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-semibold">Identity Verification (USA PATRIOT Act)</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Under the USA PATRIOT Act and anti-money laundering (AML) regulations, Kalshi and/or DFlow 
              may require you to provide identity verification information. This may include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Government-issued photo identification</li>
              <li>Proof of address</li>
              <li>Social Security Number or Tax ID</li>
              <li>Source of funds documentation</li>
            </ul>
            <p>
              Failure to provide requested information may result in account restrictions or closure.
            </p>
          </div>
        </section>

        {/* Additional Terms */}
        <section className="mb-8 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Additional Terms</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              By using Poly to access Kalshi markets, you also agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <Link to="https://kalshi.com/legal/member-agreement" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Kalshi Member Agreement
                </Link>
              </li>
              <li>
                <Link to="https://kalshi.com/legal/exchange-rules" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Kalshi Exchange Rules
                </Link>
              </li>
              <li>
                <Link to="https://dflow.net/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  DFlow Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-primary hover:underline">
                  Poly Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-primary hover:underline">
                  Poly Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </section>

        {/* Acceptance */}
        <section className="p-6 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-center text-foreground">
            <strong>By trading Kalshi markets through Poly, you acknowledge that you have read, understood, 
            and agree to all disclosures above.</strong> If you do not agree, do not use this interface.
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <Link 
              to="/kalshi" 
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              I Understand, Continue to Markets
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
