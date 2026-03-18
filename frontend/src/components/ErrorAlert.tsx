import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

/**
 * Alerta de error reutilizable con auto-dismiss y accesibilidad.
 * Renderiza null si message está vacío.
 */
export default function ErrorAlert({ message, onDismiss, autoDismissMs = 6000 }: ErrorAlertProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [message, onDismiss, autoDismissMs]);

  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
    >
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-700 shrink-0 p-0.5 rounded"
        aria-label="Cerrar mensaje de error"
      >
        <X size={14} />
      </button>
    </div>
  );
}
