import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, TrendingUp, AlertCircle, Zap, BarChart3, Bug, Loader2 } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { ArbOpportunityCard } from '@/components/arb/ArbOpportunityCard';
import { ArbFilters } from '@/components/arb/ArbFilters';
import { ArbAlertModal } from '@/components/arb/ArbAlertModal';
import { ArbAlertsList } from '@/components/arb/ArbAlertsList';
import { ProfitCalculator } from '@/components/arb/ProfitCalculator';
import { useArbOpportunities } from '@/hooks/useArbOpportunities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function ArbFinder() {
  const [category, setCategory] = useState('all');
  const [minSpread, setMinSpread] = useState(1);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  
  // Debug state
  const [debugResponse, setDebugResponse] = useState<unknown>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

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

  // Direct test of edge function
  const testEdgeFunction = async () => {
    setDebugLoading(true);
    setDebugResponse(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('arb-scanner', {
        body: {
          category: 'all',
          minSpread: 0.5,
          minSimilarity: 60,
          debug: true,
          limit: 200,
        },
      });
      
      setDebugResponse({
        success: !error,
        error: error?.message,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      setDebugResponse({
        success: false,
        error: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      });
    } finally {
      setDebugLoading(false);
    }
  };

  // Get selected opportunity for calculator (first one or empty)
  const selectedOpp = opportunities[0];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />
      
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="gap-2"
            >
              <Bug className="w-4 h-4" />
              {showDebug ? 'Hide Debug' : 'Debug'}
            </Button>
          </div>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bug className="w-4 h-4" />
                Debug Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={testEdgeFunction} 
                  disabled={debugLoading}
                  size="sm"
                >
                  {debugLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Edge Function'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDebugResponse(null)}
                >
                  Clear
                </Button>
              </div>
              
              {debugResponse && (
                <div className="space-y-3">
                  <div className="bg-background rounded-lg p-3 text-xs">
                    <div className="font-semibold mb-1">Manual test summary</div>
                    <div>Markets: {(debugResponse as any)?.data?.stats?.polymarketCount ?? '--'} Poly • {(debugResponse as any)?.data?.stats?.kalshiCount ?? '--'} Kalshi</div>
                    <div>Comparisons: {(debugResponse as any)?.data?.stats?.comparisonAttempts ?? '--'}</div>
                    <div>Matched pairs: {(debugResponse as any)?.data?.stats?.matchedPairs ?? '--'}</div>
                    <div>Opportunities: {(debugResponse as any)?.data?.stats?.opportunitiesFound ?? '--'}</div>
                  </div>

                  <div className="bg-background rounded-lg p-3 text-xs">
                    <div className="font-semibold mb-1">Sample titles</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="font-medium mb-1">Polymarket</div>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {(((debugResponse as any)?.data?.debug?.samplePolymarketTitles ?? []) as string[]).slice(0, 5).map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium mb-1">Kalshi</div>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {(((debugResponse as any)?.data?.debug?.sampleKalshiTitles ?? []) as string[]).slice(0, 5).map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-background rounded-lg p-3 text-xs">
                    <div className="font-semibold mb-2">Top comparison attempts (debug)</div>
                    <div className="space-y-2">
                      {(((debugResponse as any)?.data?.debug?.topMatches ?? []) as any[]).slice(0, 10).map((m, idx) => (
                        <div key={idx} className={`border rounded p-2 ${m.passed ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                          <div className="font-medium">#{idx + 1} — score {m.score}% — {m.passed ? '✅ PASS' : '❌ FAIL'}</div>
                          <div className="mt-1">Poly: {m.polyTitle}</div>
                          <div>Kalshi: {m.kalshiTitle}</div>
                          {m.polyEntities?.length > 0 && (
                            <div className="mt-1 text-muted-foreground">Poly entities: {m.polyEntities.join(', ')}</div>
                          )}
                          {m.kalshiEntities?.length > 0 && (
                            <div className="text-muted-foreground">Kalshi entities: {m.kalshiEntities.join(', ')}</div>
                          )}
                          {m.entityMismatch?.length > 0 && (
                            <div className="text-red-400">Entity mismatch: {m.entityMismatch.join(', ')}</div>
                          )}
                          <div className="mt-1 text-muted-foreground">{m.why}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Orderbook errors */}
                  {((debugResponse as any)?.data?.debug?.orderbookErrors ?? []).length > 0 && (
                    <div className="bg-background rounded-lg p-3 text-xs">
                      <div className="font-semibold mb-2 text-red-400">Orderbook Fetch Errors</div>
                      <div className="space-y-2">
                        {(((debugResponse as any)?.data?.debug?.orderbookErrors ?? []) as any[]).map((err, idx) => (
                          <div key={idx} className="border border-red-500/30 rounded p-2 bg-red-500/5">
                            <div className="font-medium">{err.pair}</div>
                            <div className="mt-1 text-muted-foreground break-all">Poly URL: {err.polyUrl}</div>
                            {err.polyError && <div className="text-red-400">Poly error: {err.polyError}</div>}
                            <div className="mt-1 text-muted-foreground break-all">Kalshi URL: {err.kalshiUrl}</div>
                            {err.kalshiError && <div className="text-red-400">Kalshi error: {err.kalshiError}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-background rounded-lg p-4 overflow-auto max-h-96">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(debugResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Current hook state (auto-refresh scan) */}
              <div className="text-xs space-y-1">
                <div><strong>Hook State (auto-refresh scan):</strong></div>
                <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
                <div>Error: {error || 'None'}</div>
                <div>Opportunities: {opportunities.length}</div>
                <div>Stats: {JSON.stringify(stats)}</div>
                <div>Last Updated: {lastUpdated ? new Date(lastUpdated).toISOString() : 'Never'}</div>
              </div>
            </CardContent>
          </Card>
        )}

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
