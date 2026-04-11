import { useEffect, useRef, useCallback } from "react";

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keypress", "scroll", "touchstart", "click",
] as const;

const LS_KEY = "kria_last_activity";

export function useInactivityLogout({
  timeoutMinutes,
  enabled,
  onLogout,
  onWarn,
  onResetWarn,
}: {
  timeoutMinutes: number;
  enabled: boolean;
  onLogout: () => void;
  onWarn: () => void;
  onResetWarn: () => void;
}) {
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLogoutRef = useRef(onLogout);
  const onWarnRef = useRef(onWarn);
  const onResetWarnRef = useRef(onResetWarn);
  onLogoutRef.current = onLogout;
  onWarnRef.current = onWarn;
  onResetWarnRef.current = onResetWarn;

  const reset = useCallback(() => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    onResetWarnRef.current();

    localStorage.setItem(LS_KEY, String(Date.now()));

    const timeoutMs = timeoutMinutes * 60 * 1000;
    // Warn 1 minute before logout (or at 80% for timeouts < 2 min)
    const warnMs = timeoutMs > 120_000 ? timeoutMs - 60_000 : timeoutMs * 0.8;

    warnTimer.current = setTimeout(() => onWarnRef.current(), warnMs);
    logoutTimer.current = setTimeout(() => onLogoutRef.current(), timeoutMs);
  }, [timeoutMinutes]);

  useEffect(() => {
    if (!enabled || !timeoutMinutes) return;

    // Check if the user was already inactive before the page was opened
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const lastActivity = parseInt(localStorage.getItem(LS_KEY) ?? "0", 10);
    if (lastActivity && Date.now() - lastActivity >= timeoutMs) {
      onLogoutRef.current();
      return;
    }

    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };
  }, [enabled, timeoutMinutes, reset]);

  return { reset };
}
