import axios from "axios";
import { auth, authReady, getIdToken } from "./firebase";

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

    if (response.data?.code === "MFA_REQUIRED") {
      if (!window.location.pathname.startsWith("/mfa")) {
        window.location.replace("/mfa/verify");
      }
      return Promise.reject(error);
    }

    await authReady;
    if (!auth.currentUser) {
      if (window.location.pathname !== "/login") window.location.replace("/login");
      return Promise.reject(error);
    }

    config._retried = true;
    const fresh = await getIdToken(true);
    if (fresh) config.headers.Authorization = `Bearer ${fresh}`;
    return API(config);
  }
);

export default API;
