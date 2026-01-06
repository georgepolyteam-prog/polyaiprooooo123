import { Link } from "react-router-dom";
import { ArrowLeft, Info, Shield, Globe, Users, Zap, Scale, FileText, Gavel, Database, CheckCircle } from "lucide-react";
import { Footer } from "@/components/Footer";

// Updated Restricted Jurisdictions from Kalshi Member Agreement v1.6
const RESTRICTED_JURISDICTIONS = [
  "Afghanistan", "Algeria", "Angola", "Australia", "Belarus", "Belgium", "Bolivia", "Bulgaria",
  "Burkina Faso", "Cameroon", "Canada", "Central African Republic", "Côte d'Ivoire", "Cuba",
  "Democratic Republic of the Congo", "Ethiopia", "France", "Haiti", "Iran", "Iraq", "Italy",
  "Kenya", "Laos", "Lebanon", "Libya", "Mali", "Monaco", "Mozambique", "Myanmar (Burma)",
  "Namibia", "Nicaragua", "Niger", "North Korea", "People's Republic of China", "Poland",
  "Russia", "Singapore", "Somalia", "South Sudan", "Sudan", "Switzerland", "Syria", "Taiwan",
  "Thailand", "Ukraine", "United Arab Emirates", "United Kingdom", "Venezuela", "Yemen", "Zimbabwe"
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
        {/* Professional Notice Banner */}
        <div className="mb-8 p-6 rounded-2xl bg-card/80 border border-border/50 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Info className="w-6 h-6 text-primary flex-shrink-0" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Third-Party Interface Notice
              </h1>
              <p className="text-muted-foreground text-lg">
                <strong className="text-foreground">Poly is not Kalshi.</strong> We provide a third-party interface to access Kalshi markets 
                via DFlow on the Solana blockchain. Your use of this interface is subject to additional risks 
                beyond those of trading directly on Kalshi.
              </p>
            </div>
          </div>
        </div>

        {/* Event Contract Risk - Section III from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Event Contract Trading Risk</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="font-medium text-foreground">
              The risk of loss in trading Event Contracts on Kalshi can be substantial and is a highly speculative activity involving volatile markets.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Trading may incur fees which will add to losses and may significantly reduce earnings</li>
              <li>Each Event Contract has specific rules that dictate trading period, settlement, payout, and outcome determination</li>
              <li>You are responsible for reading, understanding, and accepting the terms of an Event Contract prior to trading</li>
              <li>Event contracts may lose all value if the underlying event does not occur as predicted</li>
              <li>You should only trade with funds you can afford to lose entirely</li>
            </ul>
            <p className="text-sm">
              Kalshi event contracts are regulated by the CFTC as a designated contract market (DCM).
            </p>
          </div>
        </section>

        {/* Electronic Trading Risk - Section IV from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Electronic Trading Risks</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Trading through the internet involves many interrelated systems, including hardware, software, 
              telephonic, cable, and power generation, all of which are subject to failure or malfunction.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">System Unavailability:</strong> It may not be possible to enter new orders, execute existing orders, modify or cancel orders, or access market data</li>
              <li><strong className="text-foreground">Catastrophic Failures:</strong> Orders and their priority in the order queue may be lost</li>
              <li><strong className="text-foreground">Trading Cessation:</strong> Trading of a particular Event Contract may cease due to lack of bids or offers</li>
              <li><strong className="text-foreground">Contract Expiration:</strong> Event Contracts will expire pursuant to their terms even if the system is not accessible</li>
            </ul>
            <p className="text-sm">
              You freely assume these risks and hold Kalshi, DFlow, and their affiliates harmless against any losses resulting from these risks.
            </p>
          </div>
        </section>

        {/* DFlow/Solana Integration */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">DFlow & Solana Integration</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong className="text-foreground">How Trading Works:</strong> When you trade Kalshi markets 
              through Poly, your orders are executed on the Solana blockchain via DFlow's infrastructure.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Trades settle on Solana, not Kalshi's native settlement system</li>
              <li>You interact with Solana smart contracts, introducing blockchain-specific risks</li>
              <li>Transaction finality depends on Solana network confirmation</li>
              <li>Network congestion may affect execution timing and fees</li>
              <li>Wallet security is your responsibility—lost keys mean lost funds</li>
            </ul>
            <p className="text-sm">
              DFlow and Poly are independent of Kalshi. Issues with DFlow's routing, Solana network 
              congestion, or smart contract behavior are outside Kalshi's control.
            </p>
          </div>
        </section>

        {/* Member Obligations - Section V from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Member Obligations</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>By trading on Kalshi markets, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Pay all applicable fees and charges as specified on the Kalshi website</li>
              <li>Be bound by and comply with the Kalshi Rulebook (as amended from time to time)</li>
              <li>Consent and be subject to the jurisdiction of Kalshi and its Terms</li>
              <li>Consent to Kalshi utilizing a Derivatives Clearing Organization (DCO) of its choosing for clearing services</li>
              <li>Not allow any person not identified to Kalshi to access or use the Services</li>
            </ul>
          </div>
        </section>

        {/* Representations & Warranties - Section VI from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Representations & Warranties</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>By trading, you represent and warrant that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>If you are an individual, you are of the age of majority in your state of residence</li>
              <li>You have all requisite legal authority and capacity to enter into these agreements</li>
              <li>You are in compliance with the Commodity Exchange Act (CEA), CFTC regulations, and all applicable laws</li>
              <li>You are not statutorily disqualified from acting as a Member</li>
              <li>You are not domiciled in, organized in, or located in any Restricted Jurisdiction</li>
            </ul>
          </div>
        </section>

        {/* Arbitration Requirement - Section VII from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gavel className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Arbitration & Dispute Resolution</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              You acknowledge and agree that you will abide by and be subject to the Kalshi Rulebook, 
              including the <strong className="text-foreground">obligation to submit to arbitration</strong> for dispute resolution.
            </p>
            <p>
              Your status as a Member may be limited, conditioned, restricted, or terminated by Kalshi 
              in accordance with the Kalshi Rulebook.
            </p>
          </div>
        </section>

        {/* Market Makers - Section VII.T from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Market Maker Disclosure</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Kalshi's Rulebook allows Kalshi to implement market maker programs. Market makers may receive benefits including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Discounts on fees, rebates, or revenue share from fees</li>
              <li>Sophisticated risk management tools (e.g., order cancellation on disconnect)</li>
              <li>Greater throughput to the Exchange</li>
            </ul>
            <p className="text-sm">
              These benefits may enable market makers to price their quotes in ways materially different from 
              other members and may give them trading advantages. Outside of required times, market makers 
              are not required to maintain maximum spread size and minimum depth.
            </p>
          </div>
        </section>

        {/* Investment of Member Funds - Section VIII from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Investment of Member Funds</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Except as prohibited by CFTC regulations, all cash and other property in your Member Account 
              or otherwise held by Kalshi's Derivatives Clearing Organization on your behalf may, from time to time, 
              without notice to you, be invested by Kalshi consistent with Commission Regulations, 
              including Regulations 22.2(e)(1) and 1.25.
            </p>
          </div>
        </section>

        {/* Data Use Consent - Section XII from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Data Use Consent</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              By trading, you grant Kalshi a worldwide, perpetual, irrevocable, royalty-free license to store, 
              use, copy, display, disseminate, and create derivative works from:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The price and quantity data for each transaction you enter into</li>
              <li>Each bid, offer, and/or order you provide via the Services</li>
            </ul>
            <p className="text-sm">
              You acknowledge that Kalshi may use such information for business, marketing, and other purposes.
            </p>
          </div>
        </section>

        {/* Restricted Jurisdictions - Section VI from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-muted">
              <Globe className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Restricted Jurisdictions</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p className="font-medium text-foreground">
              Trading is prohibited for residents of the following jurisdictions:
            </p>
            <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {RESTRICTED_JURISDICTIONS.map((country) => (
                  <span key={country} className="text-muted-foreground">• {country}</span>
                ))}
              </div>
            </div>
            <p className="text-sm">
              <strong className="text-foreground">You are solely responsible</strong> for ensuring your use of Kalshi markets complies 
              with all applicable laws in your jurisdiction. This includes any jurisdiction or territory subject to 
              comprehensive country-wide, territory-wide, or regional economic sanctions imposed by the United States.
            </p>
          </div>
        </section>

        {/* No Warranty - Section XIV from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-muted">
              <Info className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">No Warranty</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Kalshi, its affiliates, and its software, hardware, and service providers provide the Kalshi Platform 
              <strong className="text-foreground"> "AS IS" and without any warranty or condition</strong>, express, implied, or statutory.
            </p>
            <p className="text-sm">
              Kalshi specifically disclaims any implied warranty of title, merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </div>
        </section>

        {/* Liability Limitations - Section XI from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-muted">
              <Scale className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Limitations on Liability</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong className="text-foreground">Poly, Kalshi, DFlow, and their affiliates disclaim all liability for:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Consequential, special, or punitive damages</li>
              <li>Trading losses, loss of anticipated profits, or loss of trading incentives</li>
              <li>Loss by reason of shutdown in operation or increased expenses</li>
              <li>System failures, delays, or unavailability</li>
              <li>Errors in market data, pricing, or analysis</li>
              <li>Smart contract vulnerabilities or exploits</li>
            </ul>
            <p className="text-sm">
              <strong className="text-foreground">Maximum Liability:</strong> Kalshi's aggregate maximum liability shall not exceed the lesser of 
              the purchase price of any assets through the Platform, or the aggregate fees paid to Kalshi in the preceding 12 months.
            </p>
          </div>
        </section>

        {/* Identity Verification - Section XVIII from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">USA PATRIOT Act Notice</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Pursuant to the requirements of the USA PATRIOT Act, Kalshi is required to obtain, verify, and record 
              information that identifies you, including your name, address, and other information that will allow 
              Kalshi to identify you in accordance with the USA PATRIOT Act.
            </p>
          </div>
        </section>

        {/* Governing Law - Section XIX from Agreement */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-muted">
              <Gavel className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Governing Law</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              The Kalshi Member Agreement is governed by the <strong className="text-foreground">laws of the State of New York</strong>. 
              Any dispute between Kalshi and you arising from or in connection with this Agreement will be settled 
              in accordance with the procedures set forth in the Kalshi Rulebook.
            </p>
          </div>
        </section>

        {/* Additional Terms */}
        <section className="mb-6 p-6 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-muted">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Additional Terms & Agreements</h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>
              By using Poly to access Kalshi markets, you also agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <Link to="https://kalshi.com/legal/member-agreement" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Kalshi Member Agreement (v1.6)
                </Link>
              </li>
              <li>
                <Link to="https://kalshi.com/legal/exchange-rules" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  KalshiEX Rulebook
                </Link>
              </li>
              <li>
                <Link to="https://kalshi.com/regulatory" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Kalshi Regulatory Documents
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
            and agree to all disclosures above and the complete Kalshi Member Agreement.</strong>
          </p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            If you do not agree, do not use this interface.
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <Link 
              to="/kalshi" 
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
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
