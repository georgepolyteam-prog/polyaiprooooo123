import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Wallet, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TerminalAuthGateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  returnPath?: string;
}

export function TerminalAuthGate({
  title,
  description,
  icon,
  returnPath = '/terminal',
}: TerminalAuthGateProps) {
  const authUrl = `/auth?next=${encodeURIComponent(returnPath)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col items-center justify-center p-6 text-center"
    >
      <div
        className={cn(
          'relative w-16 h-16 rounded-2xl mb-4',
          'bg-gradient-to-br from-primary/20 to-primary/5',
          'flex items-center justify-center',
          'border border-primary/20'
        )}
      >
        {icon || <Wallet className="w-7 h-7 text-primary" />}
        <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-primary" />
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-[240px]">{description}</p>

      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        <Button asChild className="w-full gap-2">
          <Link to={authUrl}>
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full gap-2">
          <Link to={authUrl}>Create Account</Link>
        </Button>
      </div>
    </motion.div>
  );
}
