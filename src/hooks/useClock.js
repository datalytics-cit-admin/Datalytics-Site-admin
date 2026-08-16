// admin/src/hooks/useClock.js
import { useMemo, useRef, useSyncExternalStore } from "react";

// One timer drives every time-aware component in the app. Components subscribe
// to this clock instead of each owning a setInterval, so a list of 50 event
// cards still costs a single tick per second and one pass over the subscribers.
const subscribers = new Set();

let now = Date.now();
let timerId = null;

const emit = () => {
  now = Date.now();
  for (const notify of subscribers) notify();
};

// Ticks are aligned to the next wall-clock second rather than a fixed 1000ms
// interval. A plain interval drifts a few ms per tick and eventually swallows a
// whole second, which is what makes a live clock look jumpy next to the OS one.
const schedule = () => {
  timerId = setTimeout(() => {
    emit();
    schedule();
  }, 1000 - (Date.now() % 1000));
};

const start = () => {
  if (timerId === null) schedule();
};

const stop = () => {
  clearTimeout(timerId);
  timerId = null;
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    // Background tabs throttle timers to roughly one tick per minute, so the
    // clock stops while hidden and resyncs the instant the tab comes back
    // instead of catching up one stale second at a time.
    if (document.hidden) {
      stop();
    } else if (subscribers.size > 0) {
      emit();
      start();
    }
  });
}

const subscribe = (notify) => {
  subscribers.add(notify);
  if (subscribers.size === 1) {
    now = Date.now();
    start();
  }
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) stop();
  };
};

const getNow = () => now;

/**
 * Current timestamp in ms, updated once per second.
 * Re-renders the calling component on every tick — only use it for something
 * that actually shows seconds. For derived values use useClockValue.
 */
export function useNow() {
  return useSyncExternalStore(subscribe, getNow, getNow);
}

/**
 * Derives a value from the current time and re-renders ONLY when that value
 * changes. The clock still ticks every second, but a component showing e.g. a
 * status string renders twice in an event's whole lifetime instead of 3600
 * times an hour.
 *
 * `compute` receives the timestamp in ms. `deps` invalidates the cached value
 * the same way useMemo deps do.
 */
export function useClockValue(compute, deps = []) {
  const computeRef = useRef(compute);
  computeRef.current = compute;

  // Rebuilt whenever deps change, which also drops the value cached in the
  // closure. Caching per timestamp keeps compute to once per tick even though
  // React calls getSnapshot on every render.
  const getSnapshot = useMemo(() => {
    let cached = null;
    return () => {
      const at = getNow();
      if (cached === null || cached.at !== at) {
        cached = { at, value: computeRef.current(at) };
      }
      return cached.value;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
