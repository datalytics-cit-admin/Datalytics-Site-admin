import axios from "axios";
import { signOut } from "firebase/auth";
import { auth, authReady, getIdToken } from "./firebase";

// Routes that work while signed out. A 401 from any background call must not
// yank someone off one of these — /reset-password especially, since it is
// reached BY someone who cannot sign in, and bouncing them to the login form
// is precisely the dead end the page exists to escape.
const PUBLIC_PATHS = ["/login", "/reset-password"];

export const isPublicPath = () =>
  PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));

// Deliberately does NOT import clearSession from ./session — that module
// imports this one, and the cycle is avoidable: every path below ends in a full
// page load, and session.js drops its cache on boot whenever Firebase reports
// no signed-in user.
const bounceToLogin = async () => {
  await signOut(auth).catch(() => {});
  if (!isPublicPath()) window.location.replace("/login");
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

// Every 401 gets exactly one forced token refresh before giving up. That covers
// an ID token that expired mid-session, and an ID token minted before a custom
// claim the server now wants — which is what MFA_REQUIRED usually means in a
// tab that did not itself perform the sign-in.
API.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response) return Promise.reject(error);

    // A held account answers 403, not 401: the credential is perfectly valid,
    // the account is not usable. Nothing here is retryable — a fresh token says
    // exactly the same thing — so the session is dropped at once rather than
    // left to fail on whatever the user clicks next.
    //
    // This is the path a lock-down takes for a tab that is still open. Without
    // it the 403 fell straight through to the caller, the interceptor did
    // nothing, and the browser stayed on a dashboard it could no longer use.
    if (response.status === 403 && response.data?.code === "ACCOUNT_LOCKED") {
      await bounceToLogin();
      return Promise.reject(error);
    }

    if (response.status !== 401) return Promise.reject(error);

    const code = response.data?.code;

    // Second time round, with a token we just forced. Whatever the server says
    // now is the real answer, so stop retrying.
    //
    // A lapsed second factor sends the user back to sign in, not to a standalone
    // MFA page. The code prompt only ever appears as a step over the login form,
    // so there is one place to be when a session is no longer good.
    if (config?._retried) {
      if (code === "MFA_REQUIRED" && !isPublicPath()) {
        window.location.replace("/login");
      }
      return Promise.reject(error);
    }

    // MFA_REQUIRED deliberately falls through to the forced refresh below
    // rather than redirecting on sight.
    //
    // mfaAuthTime is a custom claim, and a claim only reaches the client when a
    // token is minted. A tab that opens holding an ID token cached from BEFORE
    // the second factor was completed — a new tab of an already signed-in
    // session, most obviously — presents a token with no claim on it and is
    // told MFA_REQUIRED, even though the account is fully signed in. Bouncing
    // straight to /login made that tab look signed out. One forced refresh
    // picks the claim up and the retry succeeds; if MFA genuinely has not been
    // done, the retry says so again and the branch above redirects.

    // The account was locked down from a sign-in alert. Retrying is pointless
    // and actively harmful: the refresh token is revoked, so getIdToken(true)
    // below would throw and replace this error with an opaque Firebase one,
    // leaving the user on a broken page instead of the login screen.
    if (code === "SESSION_REVOKED") {
      await bounceToLogin();
      return Promise.reject(error);
    }

    await authReady;
    if (!auth.currentUser) {
      if (!isPublicPath()) window.location.replace("/login");
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
