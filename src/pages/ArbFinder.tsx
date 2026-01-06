import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, TrendingUp, AlertCircle, Zap, BarChart3 } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { ArbOpportunityCard } from '@/components/arb/ArbOpportunityCard';
import { ArbFilters } from '@/components/arb/ArbFilters';
import { ArbAlertModal } from '@/components/arb/ArbAlertModal';
import { ArbAlertsList } from '@/components/arb/ArbAlertsList';
import { ProfitCalculator } from '@/components/arb/ProfitCalculator';
import { useArbOpportunities } from '@/hooks/useArbOpportunities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function ArbFinder() {
  const [category, setCategory] = useState('all');
  const [minSpread, setMinSpread] = useState(1);
  const [alertModalOpen, setAlertModalOpen] = useState(false);

  const {
    opportunities,
    stats,
    isLoading,
    error,
    lastUpdated,
    refresh,
  } = useArbOpportunities({
    category,
    minSpread,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // Get selected opportunity for calculator (first one or empty)
  const selectedOpp = opportunities[0];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />
      
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/20">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Universal Arbitrage Finder</h1>
              <p className="text-sm text-muted-foreground">
                Find cross-platform price discrepancies across all markets on Kalshi & Polymarket
              </p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Best Spread"
            value={selectedOpp ? `${selectedOpp.spreadPercent.toFixed(1)}%` : '--'}
            highlight
          />
          <StatCard
            icon={<Scale className="w-4 h-4" />}
            label="Opportunities"
            value={opportunities.length.toString()}
          />
          <StatCard
            icon={<BarChart3 className="w-4 h-4" />}
            label="Matched Pairs"
            value={stats?.matchedPairs?.toString() || '--'}
          />
          <StatCard
            icon={<Zap className="w-4 h-4" />}
            label="Auto-Refresh"
            value="30s"
          />
          <StatCard
            icon={<AlertCircle className="w-4 h-4" />}
            label="Min Spread"
            value={`${minSpread}%`}
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <ArbFilters
            category={category}
            onCategoryChange={setCategory}
            minSpread={minSpread}
            onMinSpreadChange={setMinSpread}
            onRefresh={refresh}
            isLoading={isLoading}
            lastUpdated={lastUpdated}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
          {/* Opportunities Grid */}
          <div className="space-y-4">
            {error && (
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="py-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {isLoading && opportunities.length === 0 ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="bg-card/50 border-white/10">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex justify-between">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : opportunities.length === 0 ? (
              <Card className="bg-card/50 border-white/10">
                <CardContent className="py-12 text-center">
                  <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Opportunities Found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    No arbitrage opportunities currently meet your criteria. 
                    Try lowering the minimum spread or selecting a different category.
                  </p>
                  {stats && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      Scanned {stats.polymarketCount} Polymarket & {stats.kalshiCount} Kalshi markets • 
                      Found {stats.matchedPairs} matched pairs
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <motion.div
                className="space-y-4"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.05 } },
                }}
              >
                {opportunities.map((opp) => (
                  <ArbOpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onSetAlert={() => setAlertModalOpen(true)}
                  />
                ))}
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Profit Calculator */}
            <ProfitCalculator
              buyPrice={selectedOpp?.buyPrice || 60}
              sellPrice={selectedOpp?.sellPrice || 65}
              spreadPercent={selectedOpp?.spreadPercent || 8.33}
            />

            {/* Alerts List */}
            <ArbAlertsList onCreateAlert={() => setAlertModalOpen(true)} />
          </div>
        </div>
      </main>

      {/* Alert Modal */}
      <ArbAlertModal open={alertModalOpen} onOpenChange={setAlertModalOpen} />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

function StatCard({ icon, label, value, highlight }: StatCardProps) {
  return (
    <Card className="bg-card/50 border-white/10">
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
