import { useState } from "react";
import { ThumbsUp, ThumbsDown, Bug, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface VoiceFeedbackProps {
  messageId: string;
  conversationId: string;
  messageContent: string;
  className?: string;
}

type FeedbackType = "thumbs_up" | "thumbs_down" | "bug_report";

export const VoiceFeedback = ({
  messageId,
  conversationId,
  messageContent,
  className,
}: VoiceFeedbackProps) => {
  const [submitted, setSubmitted] = useState<FeedbackType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBugDialog, setShowBugDialog] = useState(false);
  const [bugDescription, setBugDescription] = useState("");

  const submitFeedback = async (type: FeedbackType, description?: string) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("voice_feedback").insert({
        message_id: messageId,
        conversation_id: conversationId,
        message_content: messageContent.substring(0, 1000),
        feedback_type: type,
        bug_description: description,
        user_agent: navigator.userAgent,
      });

      if (error) throw error;

      setSubmitted(type);
      if (type === "bug_report") {
        toast.success("Bug reported", { description: "Thanks for helping improve Poly!" });
        setShowBugDialog(false);
      } else {
        toast.success("Thanks for your feedback!");
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThumbsUp = () => submitFeedback("thumbs_up");
  const handleThumbsDown = () => submitFeedback("thumbs_down");
  const handleBugReport = () => setShowBugDialog(true);
  const submitBugReport = () => submitFeedback("bug_report", bugDescription);

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-1.5 voice-feedback", className)}>
        <div className="flex items-center gap-1 text-xs text-primary">
          <Check className="w-3 h-3" />
          <span>Thanks!</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn("flex items-center gap-1 voice-feedback", className)}>
        <button
          onClick={handleThumbsUp}
          disabled={isSubmitting}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          title="Good response"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleThumbsDown}
          disabled={isSubmitting}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          title="Bad response"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleBugReport}
          disabled={isSubmitting}
          className="p-1.5 rounded-lg hover:bg-warning/10 text-muted-foreground hover:text-warning transition-colors disabled:opacity-50"
          title="Report bug"
        >
          <Bug className="w-3.5 h-3.5" />
        </button>
      </div>

      <Dialog open={showBugDialog} onOpenChange={setShowBugDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-warning" />
              Report a Bug
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Response being reported:</p>
              <p className="text-sm text-foreground line-clamp-3">
                {messageContent.substring(0, 200)}...
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                What went wrong?
              </label>
              <Textarea
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder="Describe the issue... (e.g., incorrect information, failed to understand, wrong calculation)"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowBugDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={submitBugReport} 
              disabled={isSubmitting || !bugDescription.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Bug className="w-4 h-4 mr-2" />
              )}
              Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
