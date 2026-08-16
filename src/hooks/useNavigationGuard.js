// admin/src/hooks/useNavigationGuard.js
import { useEffect, useRef } from "react";

/**
 * While `active`, closing/reloading the tab raises the browser's own confirm
 * dialog, and the browser Back button is intercepted so the page can ask first
 * (`onBackAttempt` runs instead of the navigation).
 *
 * This guards typed work, not data: the flows using it write nothing until they
 * finish, so leaving anyway is always safe — it just costs the user their form.
 *
 * Back is intercepted with a sentinel history entry, because a pop cannot be
 * cancelled once it happens: the entry gives Back something to consume, and the
 * resulting popstate is answered by pushing it straight back.
 */
export function useNavigationGuard(active, onBackAttempt) {
  // Kept in a ref so a caller passing an inline arrow does not tear the
  // listeners down and re-push a sentinel on every render.
  const handlerRef = useRef(onBackAttempt);
  useEffect(() => {
    handlerRef.current = onBackAttempt;
  }, [onBackAttempt]);

  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const pushSentinel = () =>
      window.history.pushState({ navGuard: true }, "", window.location.href);

    const onPopState = () => {
      pushSentinel();
      handlerRef.current?.();
    };

    pushSentinel();
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [active]);
}
