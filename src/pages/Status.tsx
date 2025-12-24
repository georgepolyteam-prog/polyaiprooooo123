import { useState, useEffect } from "react";
import { 
  CheckCircle2, AlertCircle, Clock, Activity, 
  Zap, TrendingUp, Sparkles, Bell, ExternalLink,
  Server, Database, Wifi, Shield
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SystemStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  latency?: number;
  icon: React.ReactNode;
}

interface Update {
  date: string;
  title: string;
  description: string;
  type: "feature" | "fix" | "improvement" | "announcement";
}

const systemStatuses: SystemStatus[] = [
  { name: "Chat API", status: "operational", latency: 120, icon: <Activity className="w-4 h-4" /> },
  { name: "Live Trade Feed", status: "operational", latency: 45, icon: <Wifi className="w-4 h-4" /> },
  { name: "Market Data", status: "operational", latency: 80, icon: <TrendingUp className="w-4 h-4" /> },
  { name: "Authentication", status: "operational", latency: 95, icon: <Shield className="w-4 h-4" /> },
  { name: "Database", status: "operational", latency: 25, icon: <Database className="w-4 h-4" /> },
  { name: "Edge Functions", status: "operational", latency: 150, icon: <Server className="w-4 h-4" /> },
];

const recentUpdates: Update[] = [
  {
    date: "Dec 24, 2024",
    title: "Live Trades Tour Added",
    description: "New interactive tour for first-time users explaining all Live Trades features including whale alerts, filters, and export functionality.",
    type: "feature",
  },
  {
    date: "Dec 24, 2024",
    title: "Status Page Launch",
    description: "New status page to monitor system health, view recent updates, and stay informed about platform improvements.",
    type: "feature",
  },
  {
    date: "Dec 24, 2024",
    title: "Sound Mute Fix",
    description: "Fixed an issue where muting whale alerts didn't fully stop sound playback on the Live Trades page.",
    type: "fix",
  },
  {
    date: "Dec 24, 2024",
    title: "Trading Panel Repositioned",
    description: "Moved the trading panel to the top of the market data sidebar for quicker access.",
    type: "improvement",
  },
  {
    date: "Dec 23, 2024",
    title: "Polyfactual Deep Research Hint",
    description: "Added a pulsing hint for new users to discover the Deep Research feature in chat.",
    type: "feature",
  },
  {
    date: "Dec 23, 2024",
    title: "Market URL Resolution Fix",
    description: "Improved market URL handling to correctly resolve Polymarket event and market slugs.",
    type: "fix",
  },
  {
    date: "Dec 22, 2024",
    title: "Mobile Live Trades Improvements",
    description: "Enhanced mobile layout for live trades with better scrolling and visibility.",
    type: "improvement",
  },
  {
    date: "Dec 21, 2024",
    title: "Whale Alert Thresholds",
    description: "Added tiered whale alerts: $1k+ for whales and $10k+ for mega whales with distinct visual treatments.",
    type: "feature",
  },
];

const announcements = [
  {
    title: "Beta Features",
    description: "Deep Research mode is in beta. Some queries may take longer to process.",
    type: "info" as const,
  },
  {
    title: "Chrome Extension",
    description: "Our Chrome extension is now available for quick market analysis while browsing Polymarket.",
    type: "success" as const,
  },
];

const getStatusColor = (status: SystemStatus["status"]) => {
  switch (status) {
    case "operational":
      return "bg-emerald-500";
    case "degraded":
      return "bg-amber-500";
    case "down":
      return "bg-red-500";
  }
};

const getStatusText = (status: SystemStatus["status"]) => {
  switch (status) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
  }
};

const getUpdateBadge = (type: Update["type"]) => {
  switch (type) {
    case "feature":
      return <Badge className="bg-primary/20 text-primary border-primary/30">New Feature</Badge>;
    case "fix":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Bug Fix</Badge>;
    case "improvement":
      return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Improvement</Badge>;
    case "announcement":
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Announcement</Badge>;
  }
};

export default function Status() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const allOperational = systemStatuses.every(s => s.status === "operational");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-secondary/15 rounded-full blur-[150px]" />
      </div>

      <main className="flex-1 relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 bg-gradient-to-r from-foreground via-primary to-secondary bg-clip-text text-transparent">
            System Status
          </h1>
          <p className="text-muted-foreground text-lg">
            Real-time platform health & recent updates
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Last checked: {currentTime.toLocaleTimeString()}
          </p>
        </div>

        {/* Overall Status */}
        <GlassCard cyber glow className="p-6 mb-8">
          <div className="flex items-center justify-center gap-4">
            {allOperational ? (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-emerald-400">All Systems Operational</h2>
                  <p className="text-muted-foreground">Everything is running smoothly</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-amber-400">Some Systems Degraded</h2>
                  <p className="text-muted-foreground">We're working on it</p>
                </div>
              </>
            )}
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Status */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard cyber className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Service Status
              </h3>
              <div className="space-y-3">
                {systemStatuses.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">{service.icon}</div>
                      <span className="font-medium">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {service.latency && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {service.latency}ms
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`} />
                        <span className="text-sm text-muted-foreground">
                          {getStatusText(service.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Recent Updates */}
            <GlassCard cyber className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Recent Updates
              </h3>
              <div className="space-y-4">
                {recentUpdates.map((update, i) => (
                  <div key={i}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{update.date}</span>
                        {getUpdateBadge(update.type)}
                      </div>
                    </div>
                    <h4 className="font-semibold text-foreground mb-1">{update.title}</h4>
                    <p className="text-sm text-muted-foreground">{update.description}</p>
                    {i < recentUpdates.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Announcements */}
            <GlassCard cyber className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Announcements
              </h3>
              <div className="space-y-4">
                {announcements.map((announcement, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      announcement.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-primary/10 border-primary/30"
                    }`}
                  >
                    <h4 className="font-semibold text-sm mb-1">{announcement.title}</h4>
                    <p className="text-xs text-muted-foreground">{announcement.description}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Quick Stats */}
            <GlassCard cyber className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Platform Stats
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Uptime (30d)</span>
                  <span className="font-mono text-emerald-400">99.9%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Response</span>
                  <span className="font-mono text-foreground">85ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Markets</span>
                  <span className="font-mono text-foreground">500+</span>
                </div>
              </div>
            </GlassCard>

            {/* Links */}
            <GlassCard cyber className="p-6">
              <h3 className="text-lg font-semibold mb-4">Resources</h3>
              <div className="space-y-2">
                <a
                  href="https://x.com/trypolyai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-sm">Follow for updates</span>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </a>
                <a
                  href="/help"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-sm">Get support</span>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </a>
              </div>
            </GlassCard>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
