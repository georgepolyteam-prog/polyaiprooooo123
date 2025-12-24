import { PolyLogo } from "@/components/PolyLogo";

export const TypingIndicator = () => {
  return (
    <div className="flex gap-4 animate-fade-in">
      {/* Avatar */}
      <div className="shrink-0">
        <PolyLogo size="sm" showText={false} />
      </div>

      {/* Typing dots */}
      <div className="flex items-center gap-1.5 py-3">
        <div className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
        <div className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
        <div className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
      </div>
    </div>
  );
};
