// admin/src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);

// Firebase restores a persisted session asynchronously, so auth.currentUser is
// null for the first moments after a page load. Resolving this once prevents
// the first request after a refresh from going out unauthenticated.
export const authReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    unsub();
    resolve(user);
  });
});

// Current user's ID token, or null when signed out.
// `force` re-fetches so newly written custom claims (e.g. mfaAuthTime) are seen.
export const getIdToken = async (force = false) => {
  await authReady;
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(force);
};
