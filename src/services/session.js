// admin/src/services/session.js
//
// `/admin/me` used to be fetched independently by App, ProtectedRoute,
// DashboardLayout and again by whichever page was rendering — four identical
// round trips per navigation, each one a token verification plus Firestore
// reads. On localhost that is invisible; over a real network it is most of the
// wait before anything appears.
//
// This module makes the session a single shared value: concurrent callers
// collapse onto one in-flight request, and later callers reuse the answer until
// it goes stale. Role and batch do not change mid-session, so a few minutes of
// reuse costs nothing in correctness.
import { useEffect, useState } from "react";
import API from "./api";

const TTL_MS = 5 * 60 * 1000;

let cache = null; // { admin, at }
let inFlight = null;

/** The cached admin without triggering a fetch — null if nothing is loaded. */
export const peekSession = () => cache?.admin ?? null;

/**
 * The signed-in admin. Served from cache when fresh, otherwise fetched once no
 * matter how many callers ask at the same moment.
 * Pass { force: true } after something changes the admin's own record.
 */
export const getSession = ({ force = false } = {}) => {
  if (!force) {
    if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.admin);
    if (inFlight) return inFlight;
  }

  inFlight = API.get("/admin/me")
    .then((res) => {
      cache = { admin: res.data.admin, at: Date.now() };
      return cache.admin;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/** Drop the cached session. Call on login and logout — never reuse one account's session for the next. */
export const clearSession = () => {
  cache = null;
  inFlight = null;
};

/**
 * Hook form for components that only need the admin record. Renders
 * immediately from cache when it is already loaded, so a navigation between
 * dashboard pages shows content without a round trip.
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
