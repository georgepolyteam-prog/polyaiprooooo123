import { useState, useEffect } from "react";
import { 
  CheckCircle2, AlertCircle, Clock, 
  Zap, TrendingUp, Sparkles, Bell, ExternalLink,
  Server, Database, Wifi, Shield, Activity
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SystemStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  icon: React.ReactNode;
}

interface Update {
  date: string;
  title: string;
  type: "feature" | "fix" | "improvement" | "announcement";
}

const systemStatuses: SystemStatus[] = [
  { name: "Chat API", status: "operational", icon: <Activity className="w-4 h-4" /> },
  { name: "Live Trade Feed", status: "operational", icon: <Wifi className="w-4 h-4" /> },
  { name: "Market Data", status: "operational", icon: <TrendingUp className="w-4 h-4" /> },
  { name: "Authentication", status: "operational", icon: <Shield className="w-4 h-4" /> },
  { name: "Database", status: "operational", icon: <Database className="w-4 h-4" /> },
  { name: "Edge Functions", status: "operational", icon: <Server className="w-4 h-4" /> },
];

const recentUpdates: Update[] = [
  { date: "Dec 28, 2025", title: "POLY Token Credit System - Implementation & Testing", type: "feature" },
  { date: "Dec 28, 2025", title: "Helius Webhook Integration for Deposits", type: "feature" },
  { date: "Dec 27, 2025", title: "Wallet Analytics - PnL & Win Rate fixes", type: "fix" },
  { date: "Dec 27, 2025", title: "Leaderboard UI remake with animated loading", type: "improvement" },
  { date: "Dec 27, 2025", title: "Tracked Wallets page redesign", type: "improvement" },
  { date: "Dec 27, 2025", title: "Hot Markets section improvements", type: "improvement" },
  { date: "Dec 26, 2025", title: "Wallet Profile page complete remake", type: "feature" },
  { date: "Dec 25, 2025", title: "Live Trades Tour for new users", type: "feature" },
  { date: "Dec 24, 2025", title: "Status Page Launch", type: "feature" },
  { date: "Dec 23, 2025", title: "Polyfactual Deep Research", type: "feature" },
];

const announcements = [
  {
    title: "POLY Token Credits",
    description: "We're actively testing the new credit system. Deposit POLY tokens to get chat credits!",
    type: "info" as const,
  },
  {
    title: "Beta Features",
    description: "Deep Research mode is in beta. Some queries may take longer.",
    type: "info" as const,
  },
];

const getStatusColor = (status: SystemStatus["status"]) => {
  switch (status) {
    case "operational": return "bg-emerald-500";
    case "degraded": return "bg-amber-500";
    case "down": return "bg-red-500";
  }
};

const getStatusText = (status: SystemStatus["status"]) => {
  switch (status) {
    case "operational": return "Operational";
    case "degraded": return "Degraded";
    case "down": return "Down";
  }
};

const getUpdateBadge = (type: Update["type"]) => {
  switch (type) {
    case "feature":
      return <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">New</Badge>;
    case "fix":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Fix</Badge>;
    case "improvement":
      return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">Update</Badge>;
    case "announcement":
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Info</Badge>;
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
      
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-secondary/15 rounded-full blur-[150px]" />
      </div>

      <main className="flex-1 relative z-10 container mx-auto px-4 py-8 pt-20">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">System Status</h1>
          <p className="text-muted-foreground text-sm">
            Last checked: {currentTime.toLocaleTimeString()}
          </p>
        </div>

        {/* Overall Status */}
        <GlassCard cyber glow className="p-4 mb-6">
          <div className="flex items-center justify-center gap-3">
            {allOperational ? (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-emerald-400">All Systems Operational</h2>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-amber-400">Some Systems Degraded</h2>
                </div>
              </>
            )}
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Status */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard cyber className="p-4">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                Services
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {systemStatuses.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`} />
                    <span className="text-sm truncate">{service.name}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Recent Updates */}
            <GlassCard cyber className="p-4">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Recent Updates
              </h3>
              <div className="space-y-2">
                {recentUpdates.map((update, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {getUpdateBadge(update.type)}
                      <span className="text-sm truncate">{update.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{update.date}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Announcements */}
            <GlassCard cyber className="p-4">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Announcements
              </h3>
              <div className="space-y-3">
                {announcements.map((announcement, i) => (
                  <div key={i} className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <h4 className="font-semibold text-sm mb-1">{announcement.title}</h4>
                    <p className="text-xs text-muted-foreground">{announcement.description}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Quick Stats */}
            <GlassCard cyber className="p-4">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Platform Stats
              </h3>
              <div className="space-y-2">
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
            <GlassCard cyber className="p-4">
              <h3 className="text-base font-semibold mb-3">Resources</h3>
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
