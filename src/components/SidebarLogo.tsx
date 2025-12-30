import { motion } from 'framer-motion';
import polyLogo from '@/assets/poly-logo-new.png';

interface SidebarLogoProps {
  collapsed?: boolean;
}

export const SidebarLogo = ({ collapsed = false }: SidebarLogoProps) => {
  return (
    <div className="flex items-center gap-3 px-2">
      <motion.div
        className="relative flex-shrink-0"
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {/* Glow effect behind logo */}
        <div className="absolute inset-0 blur-xl bg-primary/30 rounded-full animate-pulse" />
        <img
          src={polyLogo}
          alt="Poly Logo"
          className="relative w-10 h-10 object-contain drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
        />
      </motion.div>
      
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col"
        >
          <span className="text-lg font-bold tracking-tight text-foreground">
            Poly
          </span>
          <span className="text-[10px] text-muted-foreground/70 tracking-wider uppercase">
            Market Terminal
          </span>
        </motion.div>
      )}
    </div>
  );
};
