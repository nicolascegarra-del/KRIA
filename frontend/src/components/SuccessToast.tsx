import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

interface SuccessToastProps {
  message: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

/**
 * Toast de éxito que aparece en la parte superior y se auto-descarta.
 */
export default function SuccessToast({ message, onDismiss, autoDismissMs = 3500 }: SuccessToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [message, onDismiss, autoDismissMs]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-700 text-white px-4 py-3 rounded-xl shadow-lg text-sm max-w-sm animate-in slide-in-from-top-2"
    >
      <CheckCircle2 size={16} className="shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="text-white/70 hover:text-white shrink-0 p-0.5"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
}
