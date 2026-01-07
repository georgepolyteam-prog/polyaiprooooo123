import { HeroStatement } from "@/components/home/HeroStatement";
import { LivePulseStrip } from "@/components/home/LivePulseStrip";
import { EditorialFeatures } from "@/components/home/EditorialFeatures";
import { BrutalistStats } from "@/components/home/BrutalistStats";
import { TerminalCTA } from "@/components/home/TerminalCTA";
import { SupportedPlatforms } from "@/components/home/SupportedPlatforms";
import { MinimalFooter } from "@/components/home/MinimalFooter";

const Home = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Hero - the opening statement */}
      <HeroStatement />

      {/* Live pulse strip - real data ticker */}
      <LivePulseStrip />

      {/* Editorial features - what we do */}
      <EditorialFeatures />

      {/* Brutalist stats - the numbers */}
      <BrutalistStats />

      {/* Terminal CTA - quick start */}
      <TerminalCTA />

      {/* Supported platforms */}
      <SupportedPlatforms />

      {/* Footer - minimal */}
      <MinimalFooter />
    </div>
  );
};

export default Home;
