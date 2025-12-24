import { ArrowLeft, HelpCircle, Mic, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface VoiceHeaderProps {
  isProcessing: boolean;
  isSpeaking: boolean;
  isRecording: boolean;
  onCancel: () => void;
  onShowTour: () => void;
}

export const VoiceHeader = ({
  isProcessing,
  isSpeaking,
  isRecording,
  onCancel,
  onShowTour,
}: VoiceHeaderProps) => {
  const navigate = useNavigate();
  const showCancel = isProcessing || isSpeaking || isRecording;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-primary/10 bg-background/90 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left - Back */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        {/* Center - Title */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors",
            isRecording ? "bg-destructive animate-pulse" :
            isSpeaking ? "bg-primary animate-pulse" :
            isProcessing ? "bg-warning" :
            "bg-primary"
          )} />
          <span className="text-sm font-medium text-foreground">Voice Mode</span>
          {isProcessing && (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {showCancel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="voice-cancel-btn text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onShowTour}
            className="text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
