import { BarChart3, Fish, Flame } from "lucide-react";

interface ChatHeroProps {
  onSuggestionClick: (text: string) => void;
}

const suggestions = [
  { label: "Analyze a market", icon: BarChart3, query: "Analyze this market: [paste URL]" },
  { label: "Track whales", icon: Fish, query: "Show me whale activity on the hottest markets" },
  { label: "Hot markets", icon: Flame, query: "What are the hottest markets right now?" },
];

export const ChatHero = ({ onSuggestionClick }: ChatHeroProps) => {
  return (
    <section className="min-h-[75vh] px-4 lg:px-6 flex items-center">
      <div className="w-full max-w-4xl mx-auto">
        {/* Left-aligned content */}
        <div className="text-left animate-fade-in">
          {/* Main heading */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4 tracking-tight">
            Your AI analyst for
            <br />
            <span className="text-primary">Polymarket</span>
          </h1>
          
          <p className="text-muted-foreground text-base mb-2 max-w-lg">
            Instant analysis on any prediction market.
          </p>
          
          <p className="text-sm text-muted-foreground/70 mb-8 max-w-lg">
            💡 Just paste a market URL or tell me what you're looking for
          </p>

          {/* Suggestions as list */}
          <div className="border-t border-border pt-6">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Quick actions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    onClick={() => onSuggestionClick(item.query)}
                    className="flex items-center gap-2 px-4 py-2 border border-border rounded bg-background hover:bg-primary/5 hover:border-primary/30 transition-all duration-150 text-sm text-foreground animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <Icon className="w-4 h-4 text-primary" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
