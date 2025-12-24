import { useState } from 'react';
import { Search, Hammer, RefreshCw } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Footer } from '@/components/Footer';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBuilderStats, TimePeriod } from '@/hooks/useBuilderStats';
import { BuilderLeaderboard } from '@/components/builders/BuilderLeaderboard';

const TIME_PERIODS: { label: string; value: TimePeriod }[] = [
  { label: 'Day', value: 'DAY' },
  { label: 'Week', value: 'WEEK' },
  { label: 'Month', value: 'MONTH' },
  { label: 'All', value: 'ALL' },
];

export default function BuilderStats() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('WEEK');
  const [searchQuery, setSearchQuery] = useState('');

  const { leaderboard, isLoading, error, refetch } = useBuilderStats(timePeriod);

  const filteredBuilders = leaderboard.filter((builder) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      builder.builder.toLowerCase().includes(query) ||
      builder.builderName?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <ParticleBackground />
      <TopBar />

      <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Hammer className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Builder Stats</h1>
          </div>
          <p className="text-muted-foreground">
            Track Polymarket builder integrations, volume, and performance
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search builders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/50 border-border/50"
            />
          </div>

          {/* Time Period Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-card/50 border border-border/50">
            {TIME_PERIODS.map((period) => (
              <Button
                key={period.value}
                variant={timePeriod === period.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimePeriod(period.value)}
                className="px-3"
              >
                {period.label}
              </Button>
            ))}
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
            {error}
          </div>
        )}

        {/* Leaderboard */}
        {isLoading && leaderboard.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card/30 p-12 text-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-spin" />
            <p className="text-muted-foreground">Loading builder stats...</p>
          </div>
        ) : filteredBuilders.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card/30 p-12 text-center">
            <Hammer className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No builders match your search' : 'No builder data available'}
            </p>
          </div>
        ) : (
          <BuilderLeaderboard builders={filteredBuilders} />
        )}
      </main>

      <Footer />
    </div>
  );
}
