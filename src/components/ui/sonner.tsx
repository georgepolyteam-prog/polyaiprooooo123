import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast-cyber group-[.toaster]:!bg-[#0f0f14] group-[.toaster]:backdrop-blur-xl group-[.toaster]:!text-white group-[.toaster]:border group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl",
          title: "group-[.toast]:!text-white group-[.toast]:font-semibold",
          description: "group-[.toast]:!text-gray-300",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "toast-success-cyber",
          error: "toast-error-cyber",
          warning: "toast-warning-cyber",
          info: "toast-info-cyber",
        },
      }}
      icons={{
        success: <CheckCircle className="w-5 h-5 text-success drop-shadow-[0_0_8px_hsl(var(--success))]" />,
        error: <XCircle className="w-5 h-5 text-destructive drop-shadow-[0_0_8px_hsl(var(--destructive))]" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgb(251,191,36)]" />,
        info: <Info className="w-5 h-5 text-poly-cyan drop-shadow-[0_0_8px_hsl(var(--poly-cyan))]" />,
        loading: <Loader2 className="w-5 h-5 text-poly-cyan animate-spin drop-shadow-[0_0_8px_hsl(var(--poly-cyan))]" />,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
