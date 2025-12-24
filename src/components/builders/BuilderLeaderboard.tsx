import { Crown, Medal, Award, BadgeCheck, ExternalLink } from 'lucide-react';
import { Builder } from '@/hooks/useBuilderStats';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BuilderLeaderboardProps {
  builders: Builder[];
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

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-yellow-400" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-300" />;
    case 3:
      return <Award className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="text-muted-foreground font-mono">#{rank}</span>;
  }
};

export function BuilderLeaderboard({ builders }: BuilderLeaderboardProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="w-16 text-center">Rank</TableHead>
            <TableHead>Builder</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">Active Users</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {builders.map((builder) => (
            <TableRow
              key={builder.builder}
              className="border-border/30"
            >
              <TableCell className="text-center">
                <div className="flex justify-center">{getRankIcon(builder.rank)}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  {builder.builderLogo ? (
                    <img
                      src={builder.builderLogo}
                      alt={builder.builderName || builder.builder}
                      className="w-8 h-8 rounded-full object-cover bg-muted"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                      {(builder.builderName || builder.builder).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-1.5">
                      {builder.builderName || builder.builder}
                      {builder.verified && (
                        <BadgeCheck className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {builder.builder.slice(0, 8)}...
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold text-emerald-400">
                {formatVolume(builder.volume)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {builder.activeUsers?.toLocaleString() || '-'}
              </TableCell>
              <TableCell className="text-right">
                {builder.verified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                    <BadgeCheck className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Unverified</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
