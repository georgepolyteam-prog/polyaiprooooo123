import { useState, useEffect, memo } from "react";
import { User, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceMessage } from "@/hooks/useVoiceChat";
import { VoiceFeedback } from "./VoiceFeedback";
import polyLogo from "@/assets/poly-logo-new.png";

interface MessageBubbleProps {
  message: VoiceMessage;
  isSpeaking: boolean;
  timestamp?: Date;
  conversationId: string;
  isLatest?: boolean;
}

// Waveform animation for speaking
const SpeakingWaveform = () => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="w-0.5 bg-primary rounded-full"
        style={{
          height: "12px",
          animation: `waveform 0.5s ease-in-out infinite`,
          animationDelay: `${i * 0.08}s`,
        }}
      />
    ))}
  </div>
);

// Format timestamp
const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Format content with highlights
const formatContent = (content: string): string => {
  return content
    // Bold text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // Italic text
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Percentages
    .replace(
      /(\d+(?:\.\d+)?%)/gi,
      '<span class="font-mono font-semibold text-primary">$1</span>'
    )
    // Money values
    .replace(
      /\$[\d,]+(?:\.\d+)?[KMB]?/gi,
      '<span class="font-mono font-semibold text-primary">$&</span>'
    )
    // Market headers
    .replace(
      /📊\s*\[([^\]]+)\]/g,
      '<div class="mt-3 mb-2 text-base font-semibold text-foreground flex items-center gap-2"><span>📊</span><span>$1</span></div>'
    )
    // Section headers with emojis
    .replace(
      /(🎯|⚠️|💡|🔥|🏁)\s*\*?\*?([^*\n:]+)\*?\*?:/g,
      '<div class="mt-2 font-medium text-foreground">$1 <span class="text-primary">$2:</span></div>'
    );
};

// Poly Avatar component
const PolyAvatar = memo(({ isSpeaking }: { isSpeaking: boolean }) => (
  <div className={cn(
    "relative w-9 h-9 rounded-lg overflow-hidden shrink-0 transition-all duration-150 bg-black flex items-center justify-center",
    "ring-2 shadow-md",
    isSpeaking 
      ? "ring-primary shadow-primary/30 scale-105" 
      : "ring-primary/30 shadow-transparent"
  )}>
    <img src={polyLogo} alt="Poly" className="w-6 h-6 object-contain" />
    {isSpeaking && (
      <div className="absolute inset-0 bg-primary/20 animate-pulse" />
    )}
  </div>
));

// User Avatar component
const UserAvatar = memo(() => (
  <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
    <User className="w-4 h-4 text-primary-foreground" />
  </div>
));

export const MessageBubble = memo(({ 
  message, 
  isSpeaking, 
  timestamp, 
  conversationId,
  isLatest 
}: MessageBubbleProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const isUser = message.role === "user";

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Hide internal URL analyze commands
  if (isUser && message.content.startsWith("[URL_ANALYZE]")) return null;

  // Clean up display content
  let displayContent = message.content;
  if (isUser && displayContent.toLowerCase().startsWith("analyze this market:")) {
    displayContent = displayContent.replace(/^analyze this market:\s*/i, "").trim();
    if (displayContent.match(/^https?:\/\//)) return null;
  }

  return (
    <div
      className={cn(
        "flex gap-3 items-start transition-all duration-150",
        isUser ? "justify-end" : "justify-start",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {!isUser && <PolyAvatar isSpeaking={isSpeaking} />}

      <div
        className={cn(
          "relative max-w-[85%] md:max-w-[80%] rounded-md transition-all duration-150",
          isUser
            ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
            : cn(
                "bg-card/80 backdrop-blur-sm border shadow-md",
                isSpeaking 
                  ? "border-primary/40 shadow-primary/20" 
                  : "border-border/50 shadow-black/5"
              )
        )}
      >
        {/* AI badge for assistant messages */}
        {!isUser && isLatest && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-[10px] text-primary">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Poly</span>
          </div>
        )}

        <div className="px-4 py-3">
          {/* Speaking indicator */}
          {!isUser && isSpeaking && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-primary/20">
              <SpeakingWaveform />
              <span className="text-xs text-primary font-medium">Speaking</span>
            </div>
          )}

          {/* Message content */}
          <div
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap",
              isUser ? "text-primary-foreground" : "text-foreground"
            )}
            dangerouslySetInnerHTML={{ __html: formatContent(displayContent) }}
          />

          {/* Footer with timestamp and feedback */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
            <div className="flex items-center gap-1.5">
              {timestamp && (
                <p className={cn(
                  "text-[10px]",
                  isUser ? "text-primary-foreground/60" : "text-muted-foreground"
                )}>
                  {formatTime(timestamp)}
                </p>
              )}
              {isUser && (
                <Check className="w-3 h-3 text-primary-foreground/60" />
              )}
            </div>
            
            {!isUser && (
              <VoiceFeedback
                messageId={message.id}
                conversationId={conversationId}
                messageContent={message.content}
              />
            )}
          </div>
        </div>
      </div>

      {isUser && <UserAvatar />}
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";
