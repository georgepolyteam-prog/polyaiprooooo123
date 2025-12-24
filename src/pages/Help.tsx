import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bug, Sparkles, AlertTriangle, MessageCircle, Send, CheckCircle, Zap, TrendingUp, Users, Newspaper, BarChart3, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type TicketType = 'bug' | 'feature' | 'issue' | 'contact';

interface TicketConfig {
  type: TicketType;
  label: string;
  description: string;
  icon: typeof Bug;
  gradient: string;
  glowColor: string;
}

const ticketTypes: TicketConfig[] = [
  {
    type: 'bug',
    label: 'Bug Report',
    description: 'Something broken?',
    icon: Bug,
    gradient: 'from-red-500 to-orange-500',
    glowColor: 'shadow-red-500/30'
  },
  {
    type: 'feature',
    label: 'Feature Request',
    description: 'Got an idea?',
    icon: Sparkles,
    gradient: 'from-poly-purple to-poly-cyan',
    glowColor: 'shadow-poly-purple/30'
  },
  {
    type: 'issue',
    label: 'Report Issue',
    description: 'General problems',
    icon: AlertTriangle,
    gradient: 'from-yellow-500 to-amber-500',
    glowColor: 'shadow-yellow-500/30'
  },
  {
    type: 'contact',
    label: 'Contact Us',
    description: 'Questions & partnerships',
    icon: MessageCircle,
    gradient: 'from-blue-500 to-cyan-500',
    glowColor: 'shadow-blue-500/30'
  }
];

export default function Help() {
  const [selectedType, setSelectedType] = useState<TicketType | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [priority, setPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType || !subject.trim() || !description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('help_tickets').insert({
        type: selectedType,
        subject: subject.trim(),
        description: description.trim(),
        email: email.trim() || null,
        priority,
        user_agent: navigator.userAgent,
        page_url: window.location.href
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success('Ticket submitted successfully!');
      
      // Reset form after delay
      setTimeout(() => {
        setSelectedType(null);
        setSubject('');
        setDescription('');
        setEmail('');
        setPriority('normal');
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedConfig = ticketTypes.find(t => t.type === selectedType);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-poly-purple/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-poly-cyan/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-poly-pink/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="cyber-grid-animated absolute inset-0 opacity-30" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold gradient-text">Help Center</h1>
            <p className="text-sm text-muted-foreground">We're here to help</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
              <Zap className="w-4 h-4 text-poly-cyan" />
              <span className="text-sm text-muted-foreground">Usually responds within 24 hours</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="gradient-text-animated">How can we help?</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Report bugs, request features, or just say hi. We read every message.
            </p>
          </motion.div>

          {/* Success State */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-success to-poly-cyan flex items-center justify-center glow-cyan"
                  >
                    <CheckCircle className="w-12 h-12 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2">Ticket Submitted!</h3>
                  <p className="text-muted-foreground">We'll get back to you soon.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ticket Type Selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {ticketTypes.map((config, index) => (
              <motion.button
                key={config.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedType(config.type)}
                className={cn(
                  "relative p-6 rounded-2xl transition-all duration-300 group",
                  "glass-card-hover cursor-pointer",
                  selectedType === config.type && `ring-2 ring-offset-2 ring-offset-background ${config.glowColor}`,
                  selectedType === config.type ? `shadow-lg ${config.glowColor}` : ''
                )}
              >
                {/* Gradient overlay on selection */}
                {selectedType === config.type && (
                  <motion.div
                    layoutId="selectedBg"
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-20 bg-gradient-to-br",
                      config.gradient
                    )}
                  />
                )}
                
                <div className="relative z-10">
                  <div className={cn(
                    "w-12 h-12 rounded-xl mb-4 flex items-center justify-center transition-all",
                    "bg-gradient-to-br",
                    config.gradient,
                    selectedType === config.type ? "scale-110" : "group-hover:scale-105"
                  )}>
                    <config.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{config.label}</h3>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            {selectedType && (
              <motion.form
                key={selectedType}
                initial={{ opacity: 0, y: 20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                className="glass-card rounded-2xl p-6 md:p-8 overflow-hidden"
              >
                {/* Form Header */}
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border/50">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
                    selectedConfig?.gradient
                  )}>
                    {selectedConfig && <selectedConfig.icon className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedConfig?.label}</h3>
                    <p className="text-sm text-muted-foreground">Fill out the form below</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Subject <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief description of your issue"
                      className="bg-muted/50 border-border/50 focus:border-primary"
                      required
                      maxLength={200}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        selectedType === 'bug' 
                          ? "What happened? What did you expect to happen? Steps to reproduce..." 
                          : selectedType === 'feature'
                          ? "Describe your idea. How would it help you?"
                          : "Tell us more..."
                      }
                      className="min-h-[150px] bg-muted/50 border-border/50 focus:border-primary resize-none"
                      required
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {description.length}/2000
                    </p>
                  </div>

                  {/* Email & Priority Row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="For follow-up responses"
                        className="bg-muted/50 border-border/50 focus:border-primary"
                        maxLength={255}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Priority</label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger className="bg-muted/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">🟢 Low</SelectItem>
                          <SelectItem value="normal">🟡 Normal</SelectItem>
                          <SelectItem value="high">🟠 High</SelectItem>
                          <SelectItem value="urgent">🔴 Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !subject.trim() || !description.trim()}
                      className={cn(
                        "w-full h-12 text-base font-semibold rounded-xl transition-all",
                        "bg-gradient-to-r",
                        selectedConfig?.gradient,
                        "hover:opacity-90 disabled:opacity-50",
                        "btn-glow"
                      )}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Submitting...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-5 h-5" />
                          <span>Submit Ticket</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* How It Works Info Section */}
          {!selectedType && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5 text-poly-cyan" />
                <h3 className="text-lg font-semibold gradient-text">How to Use Poly</h3>
              </div>
              
              {/* Features */}
              <div className="space-y-3 mb-8">
                {[
                  { icon: Zap, text: "Responds in seconds with concise answers" },
                  { icon: TrendingUp, text: "Real-time odds, volume & market data" },
                  { icon: Users, text: "Tracks whale activity & smart money" },
                  { icon: Newspaper, text: "Searches the web for latest context" },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-poly-cyan/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-4 h-4 text-poly-cyan" />
                    </div>
                    <span className="text-muted-foreground">{feature.text}</span>
                  </div>
                ))}
              </div>
              
              {/* Three Ways to Use */}
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Three Ways to Use</h4>
              <div className="grid md:grid-cols-3 gap-3 mb-8">
                {[
                  { icon: MessageCircle, title: "Chat", description: "Ask anything about any market", gradient: "from-cyan-500/20 to-blue-500/10" },
                  { icon: BarChart3, title: "Dashboard", description: "Real-time orderbook & whale tracking", gradient: "from-purple-500/20 to-pink-500/10" },
                  { icon: Trophy, title: "Leaderboard", description: "Track top profitable traders", gradient: "from-amber-500/20 to-orange-500/10" },
                ].map((usage, i) => (
                  <div key={i} className={cn("p-4 rounded-xl bg-gradient-to-br border border-border/30", usage.gradient)}>
                    <div className="flex items-center gap-2 mb-2">
                      <usage.icon className="w-4 h-4 text-foreground" />
                      <span className="font-medium text-sm">{usage.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{usage.description}</p>
                  </div>
                ))}
              </div>
              
              {/* Example Questions */}
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Try Asking</h4>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                {[
                  '"Analyze the Trump 2028 market"',
                  '"What markets have the best edge right now?"',
                  "[paste any Polymarket URL]",
                ].map((example, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-poly-cyan font-mono">→</span>
                    <span className="text-muted-foreground">{example}</span>
                  </div>
                ))}
              </div>
              
              <p className="text-center text-muted-foreground text-sm mt-8">
                👆 Select an option above to submit a ticket
              </p>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}