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
        success: <CheckCircle className="w-5 h-5 text-blue-500" />,
        error: <XCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
        loading: <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
