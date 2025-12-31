import { Share2, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { KalshiMarket } from '@/hooks/useDflowApi';

interface KalshiShareButtonProps {
  market: KalshiMarket;
  prediction?: 'yes' | 'no';
  compact?: boolean;
}

export function KalshiShareButton({ market, prediction, compact = false }: KalshiShareButtonProps) {
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/kalshi` : '';
  
  const shareText = prediction
    ? `I just predicted ${prediction.toUpperCase()} on "${market.title}" at ${prediction === 'yes' ? market.yesPrice : market.noPrice}¢ 📊\n\nTrade prediction markets on Solana:`
    : `"${market.title}"\n\nYes: ${market.yesPrice}¢ | No: ${market.noPrice}¢\n\nTrade prediction markets on Solana:`;

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full hover:bg-muted/50"
        onClick={(e) => {
          e.stopPropagation();
          shareToTwitter();
        }}
      >
        <Share2 className="w-4 h-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-border/50 hover:bg-muted/50"
          onClick={(e) => e.stopPropagation()}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={shareToTwitter} className="cursor-pointer">
          <Twitter className="w-4 h-4 mr-2" />
          Share on X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink} className="cursor-pointer">
          <Share2 className="w-4 h-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
