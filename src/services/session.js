// admin/src/services/session.js
//
// `/admin/me` used to be fetched independently by App, ProtectedRoute,
// DashboardLayout and again by whichever page was rendering — four identical
// round trips per navigation, each one a token verification plus Firestore
// reads. On localhost that is invisible; over a real network it is most of the
// wait before anything appears.
//
// Two things happen here:
//   1. Concurrent callers collapse onto a single in-flight request.
//   2. The last answer is persisted, so a reload renders from it immediately
//      and revalidates in the background instead of blocking on a round trip.
//
// The stored record is only ever used for display and for hiding controls the
// user cannot use. Every actual permission is enforced server-side on each
// request, so a stale or edited copy grants nothing.
import { useEffect, useState } from "react";
import API from "./api";
import { auth, authReady } from "./firebase";

const STORAGE_KEY = "datalytics.session.v1";

// Fresh enough to use without asking again.
const FRESH_MS = 5 * 60 * 1000;
// Old enough that it still renders instantly, but is revalidated in the
// background. Beyond this we wait for the network rather than show stale roles.
const USABLE_MS = 12 * 60 * 60 * 1000;

let cache = readStored();
let inFlight = null;

// A persisted record can outlive the session it describes. An admin can lock
// this account down from a sign-in alert opened in a different browser, or on
// their phone — nothing in this tab would hear about it, and the dashboard
// would keep rendering from localStorage until some action happened to 401.
//
// So the first call after a page load always checks with the server, even when
// the stored copy is fresh. It still paints from cache immediately; the check
// runs behind it, and the api interceptor turns a 401 into a redirect. The
// caching this module exists for was about navigating BETWEEN dashboard pages,
// not about reloads, so this costs one request per hard load and nothing else.
let revalidatedThisLoad = false;

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.admin?._id || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > USABLE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(entry) {
  try {
    if (entry) localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or a full quota — the in-memory cache still works.
  }
}

const fetchSession = () => {
  inFlight = API.get("/admin/me")
    .then((res) => {
      cache = {
        admin: res.data.admin,
        at: Date.now(),
        uid: auth.currentUser?.uid ?? null,
      };
      writeStored(cache);
      return cache.admin;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

// A persisted record must never outlive the account it belongs to. Firebase
// restores its session asynchronously, so this runs as soon as that is known —
// off the critical path, and before any stale identity could matter. A missed
// case still self-corrects: the revalidation 401s and the interceptor redirects.
authReady.then((user) => {
  if (!user || (cache?.uid && cache.uid !== user.uid)) clearSession();
});

// A lock-down is almost never performed in the tab it applies to: the alert is
// read on a phone, or in another browser, and this tab is left sitting on the
// dashboard. Nothing here would hear about it until the user happened to click
// something that made a request — which is why signing out appeared to take
// several clicks.
//
// Re-checking whenever the tab comes back to the front turns "next click" into
// "the moment you look at it". The check is just the ordinary /admin/me call;
// the api interceptor is what turns its rejection into a redirect.
//
// Throttled, because visibilitychange fires on every alt-tab, and skipped
// entirely when there is no session to invalidate.
const FOREGROUND_RECHECK_MS = 30 * 1000;
let lastForegroundCheck = 0;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!cache) return;
    if (Date.now() - lastForegroundCheck < FOREGROUND_RECHECK_MS) return;

    lastForegroundCheck = Date.now();
    (inFlight || fetchSession()).catch(() => {});
  });
}

/**
 * The last known admin without any network access — null if nothing is stored.
 * Survives a page reload, which is what lets the dashboard paint immediately.
 */
export const peekSession = () => cache?.admin ?? null;

/**
 * The signed-in admin. Resolves from cache when fresh, resolves from a stale
 * copy while revalidating behind it, and otherwise fetches — once, no matter
 * how many callers ask at the same moment.
 *
 * A background revalidation that 401s is handled by the api interceptor, which
 * sends the user to /login or /mfa.
 */
export const getSession = ({ force = false } = {}) => {
  if (force) return fetchSession();

  const age = cache ? Date.now() - cache.at : Infinity;

  // First call of this page load — always verify with the server, but do not
  // make the user wait for it when there is something usable to show.
  if (!revalidatedThisLoad) {
    revalidatedThisLoad = true;
    const checking = inFlight || fetchSession();

    if (age < USABLE_MS) {
      checking.catch(() => {});
      return Promise.resolve(cache.admin);
    }
    return checking;
  }

  if (age < FRESH_MS) return Promise.resolve(cache.admin);

  if (age < USABLE_MS) {
    if (!inFlight) fetchSession().catch(() => {});
    return Promise.resolve(cache.admin);
  }

  return inFlight || fetchSession();
};

/** Drop the session everywhere. Call on login and logout — never hand one account's session to the next. */
export const clearSession = () => {
  cache = null;
  inFlight = null;
  writeStored(null);
};

/**
 * Hook form. Renders from the persisted record on the first paint when there is
 * one, so navigating between dashboard pages costs no round trip at all.
 */
export function useSession() {
  const [admin, setAdmin] = useState(peekSession);
  const [loading, setLoading] = useState(() => peekSession() === null);

  useEffect(() => {
    let alive = true;

    getSession()
      .then((value) => alive && setAdmin(value))
      .catch(() => alive && setAdmin(null))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, []);

  return { admin, loading };
}
