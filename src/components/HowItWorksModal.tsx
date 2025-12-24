import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  BarChart3, 
  Trophy,
  Zap,
  TrendingUp,
  Users,
  Newspaper,
  Target
} from "lucide-react";
import { PolyLogo } from "./PolyLogo";
import { Link } from "react-router-dom";

interface HowItWorksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FeatureItem = ({ icon: Icon, text }: { icon: React.ElementType; text: string }) => (
  <div className="flex items-center gap-3 text-sm text-muted-foreground">
    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-3.5 h-3.5 text-primary" />
    </div>
    <span>{text}</span>
  </div>
);

const UsageCard = ({ 
  icon: Icon, 
  title, 
  description,
  gradient
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  gradient: string;
}) => (
  <div className={`rounded-xl p-4 border border-border/50 ${gradient}`}>
    <div className="flex items-center gap-3 mb-2">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <h4 className="font-semibold text-white">{title}</h4>
    </div>
    <p className="text-sm text-white/70 leading-relaxed">{description}</p>
  </div>
);

const ExampleBlock = ({ examples }: { examples: string[] }) => (
  <div className="bg-muted/50 rounded-lg p-4 border border-border/50 space-y-2">
    {examples.map((example, i) => (
      <div key={i} className="flex items-start gap-2 text-sm">
        <span className="text-primary font-mono">→</span>
        <span className="text-muted-foreground">{example}</span>
      </div>
    ))}
  </div>
);

export const HowItWorksModal = ({ open, onOpenChange }: HowItWorksModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <PolyLogo size="sm" />
            <DialogTitle className="text-xl font-semibold">How to Use Poly</DialogTitle>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 max-h-[calc(85vh-140px)]">
          <div className="space-y-6 p-6">
            
            {/* What is Poly */}
            <div className="space-y-3">
              <p className="text-foreground font-medium">
                Your AI analyst for Polymarket — get instant market insights.
              </p>
              <div className="space-y-2">
                <FeatureItem icon={Zap} text="Responds in seconds with concise answers" />
                <FeatureItem icon={TrendingUp} text="Real-time odds, volume & market data" />
                <FeatureItem icon={Users} text="Tracks whale activity & smart money" />
                <FeatureItem icon={Newspaper} text="Searches the web for latest context" />
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Three Ways to Use */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Three Ways to Use Poly
              </h3>
              <div className="space-y-3">
                <UsageCard
                  icon={MessageSquare}
                  title="Chat"
                  description="Ask anything about any market. Paste URLs for instant analysis, get edge calculations, and find opportunities."
                  gradient="bg-gradient-to-br from-cyan-500/20 to-blue-500/10"
                />
                <UsageCard
                  icon={BarChart3}
                  title="Dashboard"
                  description="Paste a market URL for real-time orderbook, live trades, and whale tracking in one view."
                  gradient="bg-gradient-to-br from-purple-500/20 to-pink-500/10"
                />
                <UsageCard
                  icon={Trophy}
                  title="Leaderboard"
                  description="See the most profitable traders in the last 24 hours. Track smart money movements."
                  gradient="bg-gradient-to-br from-amber-500/20 to-orange-500/10"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Example Questions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Try Asking
              </h3>
              <ExampleBlock 
                examples={[
                  '"Analyze the Trump 2028 market"',
                  '"What markets have the best edge right now?"',
                  '"Show me whale trades on Bitcoin markets"',
                  '"Any arbitrage opportunities?"',
                  '[paste any Polymarket URL]'
                ]}
              />
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* What You'll Get */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                What You'll Get
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="w-4 h-4 text-primary" />
                  <span>Edge calculations</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Live odds & volume</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Whale activity</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Newspaper className="w-4 h-4 text-primary" />
                  <span>News & context</span>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>
        
        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <div className="w-full flex flex-col items-center gap-3">
            <Button 
              onClick={() => onOpenChange(false)} 
              className="w-full"
              size="lg"
            >
              Got it!
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Link to="/privacy" onClick={() => onOpenChange(false)} className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <span>•</span>
              <Link to="/terms" onClick={() => onOpenChange(false)} className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <span>•</span>
              <Link to="/disclaimer" onClick={() => onOpenChange(false)} className="hover:text-foreground transition-colors">
                Disclaimer
              </Link>
            </div>
            <p className="text-xs text-emerald-500/70">
              V1 — We're always improving
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
