import { useEffect, useState, useCallback } from "react";

/**
 * Estado de error que se auto-limpia tras `durationMs` milisegundos.
 * Uso: const [error, setError] = useAutoCloseError();
 */
export function useAutoCloseError(durationMs = 6000) {
  const [error, setErrorRaw] = useState("");

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setErrorRaw(""), durationMs);
    return () => clearTimeout(t);
  }, [error, durationMs]);

  const setError = useCallback((msg: string) => setErrorRaw(msg), []);
  const clearError = useCallback(() => setErrorRaw(""), []);

  return [error, setError, clearError] as const;
}
