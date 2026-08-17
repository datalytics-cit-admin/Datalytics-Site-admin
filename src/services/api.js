import axios from "axios";
import { signOut } from "firebase/auth";
import { auth, authReady, getIdToken } from "./firebase";

// Deliberately does NOT import clearSession from ./session — that module
// imports this one, and the cycle is avoidable: every path below ends in a full
// page load, and session.js drops its cache on boot whenever Firebase reports
// no signed-in user.
const bounceToLogin = async () => {
  await signOut(auth).catch(() => {});
  if (window.location.pathname !== "/login") window.location.replace("/login");
};

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL + "/api",
});

// Single choke point for auth transport: every call made through this instance
// carries the current Firebase ID token. Individual pages need no changes.
API.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// The server returns 401 { code: "MFA_REQUIRED" } when the ID token is valid but
// the second factor has not been completed for this sign-in. Everything else
// that 401s gets one forced token refresh before giving up, which covers an
// ID token that expired mid-session.
API.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response || response.status !== 401 || config?._retried) {
      return Promise.reject(error);
    }

    // A lapsed second factor sends the user back to sign in, not to a standalone
    // MFA page. The code prompt only ever appears as a step over the login form,
    // so there is one place to be when a session is no longer good.
    if (response.data?.code === "MFA_REQUIRED") {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
      return Promise.reject(error);
    }

    // The account was locked down from a sign-in alert. Retrying is pointless
    // and actively harmful: the refresh token is revoked, so getIdToken(true)
    // below would throw and replace this error with an opaque Firebase one,
    // leaving the user on a broken page instead of the login screen.
    if (response.data?.code === "SESSION_REVOKED") {
      await bounceToLogin();
      return Promise.reject(error);
    }

    await authReady;
    if (!auth.currentUser) {
      if (window.location.pathname !== "/login") window.location.replace("/login");
      return Promise.reject(error);
    }

    config._retried = true;

    // A revoked refresh token makes this throw. Treat it as "you are signed
    // out" rather than letting it surface as an unrelated failure.
    let fresh;
    try {
      fresh = await getIdToken(true);
    } catch {
      await bounceToLogin();
      return Promise.reject(error);
    }

    if (fresh) config.headers.Authorization = `Bearer ${fresh}`;
    return API(config);
  }
);

export default API;
