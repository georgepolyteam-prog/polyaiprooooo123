import { BadgeCheck, Users, TrendingUp } from 'lucide-react';
import { Builder, VolumeDataPoint } from '@/hooks/useBuilderStats';
import { BuilderVolumeChart } from './BuilderVolumeChart';

interface BuilderCardProps {
  builder: Builder;
  volumeHistory: VolumeDataPoint[];
  isLoadingVolume?: boolean;
}

const formatVolume = (volume: number): string => {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
};

export function BuilderCard({ builder, volumeHistory, isLoadingVolume }: BuilderCardProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {builder.builderLogo ? (
            <img
              src={builder.builderLogo}
              alt={builder.builderName || builder.builder}
              className="w-16 h-16 rounded-xl object-cover bg-muted"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl">
              {(builder.builderName || builder.builder).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">
                {builder.builderName || builder.builder}
              </h2>
              {builder.verified && (
                <BadgeCheck className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              {builder.builder}
            </div>
            <div className="mt-1">
              {builder.verified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                  <BadgeCheck className="w-3 h-3" />
                  Verified Builder
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                  Unverified
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-foreground">#{builder.rank}</div>
          <div className="text-sm text-muted-foreground">Rank</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Total Volume</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatVolume(builder.volume)}
          </div>
        </div>
        <div className="rounded-lg bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Active Users</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {builder.activeUsers?.toLocaleString() || '-'}
          </div>
        </div>
      </div>

      {/* Volume Chart */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Volume History</h3>
        <BuilderVolumeChart data={volumeHistory} isLoading={isLoadingVolume} />
      </div>

    </div>
  );
}
