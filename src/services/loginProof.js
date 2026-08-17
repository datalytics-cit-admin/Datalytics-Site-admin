// admin/src/services/loginProof.js
//
// Between the email code and the authenticator code the browser holds a signed
// proof that the inbox step was passed. It has to survive a reload, because the
// MFA *setup* branch is a real route (/mfa/setup) and refreshing there would
// otherwise strand the user with no way forward but signing in again.
//
// sessionStorage, not localStorage: the proof is scoped to this sign-in and
// should die with the tab. It is also worthless on its own — the server checks
// it against the uid and auth_time of the Firebase ID token presented with it,
// so a copied proof cannot be used from another session or another account.
const KEY = "datalytics.loginEmailProof.v1";

export const setLoginProof = (token) => {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private mode with storage disabled. The caller still holds the token in
    // React state for this page, so the flow works until a reload.
  }
};

export const getLoginProof = () => {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};

export const clearLoginProof = () => setLoginProof(null);
