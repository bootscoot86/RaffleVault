import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_MINUTES = 15;   // show warning after 15 min idle
const WARNING_SECONDS = 60;       // countdown before auto-logout

export default function useInactivityTimeout({ onWarn, onLogout }) {
  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);
  const isWarning = useRef(false);

  const resetTimers = useCallback(() => {
    // If warning is already showing, don't reset on activity —
    // user must click "Stay Logged In" to dismiss
    if (isWarning.current) return;

    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);

    inactivityTimer.current = setTimeout(() => {
      isWarning.current = true;
      onWarn(WARNING_SECONDS);

      warningTimer.current = setTimeout(() => {
        onLogout();
      }, WARNING_SECONDS * 1000);

    }, INACTIVITY_MINUTES * 60 * 1000);
  }, [onWarn, onLogout]);

  // Call this when the user clicks "Stay Logged In"
  const stayLoggedIn = useCallback(() => {
    isWarning.current = false;
    clearTimeout(warningTimer.current);
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));
    resetTimers(); // start the timer on mount

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimers));
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
    };
  }, [resetTimers]);

  return { stayLoggedIn };
}
