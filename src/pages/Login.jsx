// admin/src/pages/Login.jsx
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import API from "../services/api";
import { clearSession } from "../services/session";
import { auth, getIdToken } from "../services/firebase";
import { setLoginProof, clearLoginProof } from "../services/loginProof";
import LoginEmailCodeModal from "../components/LoginEmailCodeModal";
import MfaVerifyModal from "../components/MfaVerifyModal";
import { useNavigationGuard } from "../hooks/useNavigationGuard";

// Deliberately says nothing about how to lift the hold. This sentence is shown
// to whoever typed the password — which, on a held account, is exactly the
// person the hold exists to keep out. The way back in is in the email, and only
// the mailbox owner has that.
const HELD_MESSAGE =
  "This account is Locked by the User. Please contact the user to unlock it.";

/**
 * Whether the account on this address is currently held. Answers false for
 * anything it cannot determine — an unknown address, a rate limit, a network
 * fault — so a check that fails never becomes a login that fails.
 */
const isAccountHeld = async (email) => {
  const address = String(email || "").trim();
  if (!address) return false;
  try {
    const { data } = await API.post("/admin/security/lock-state", { email: address });
    return Boolean(data?.locked);
  } catch {
    return false;
  }
};

export default function Login({ setAuthed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  // A cancelled sign-in is a notice, not a failure — the red shaking box reads
  // as "something went wrong", which this is not.
  const [msgTone, setMsgTone] = useState("error"); // "error" | "info"
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Both remaining factors run here, over the form, rather than on their own
  // routes. Between the password and the codes the user holds a Firebase token
  // but no server session — a state that should not be navigable to, because
  // leaving it has to mean abandoning the sign-in.
  //
  //   "form"  nothing in flight
  //   "email" the code we mailed to the address on the admin record
  //   "mfa"   the code from the authenticator app
  const [step, setStep] = useState("form");
  const [confirmingAbort, setConfirmingAbort] = useState(false);

  // Email step
  const [emailStatus, setEmailStatus] = useState("idle"); // "sending" | "awaiting" | "verifying"
  const [emailMsg, setEmailMsg] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [emailToken, setEmailToken] = useState("");
  const [codeSentTo, setCodeSentTo] = useState("");

  // Authenticator step
  const [mfaStatus, setMfaStatus] = useState("idle"); // "idle" | "verifying"
  const [mfaMsg, setMfaMsg] = useState("");
  const [proofToken, setProofToken] = useState("");
  // Whether this account still has to enrol an authenticator, read once from
  // /mfa/state before the email step and acted on after it.
  const [needsEnrolment, setNeedsEnrolment] = useState(false);

  // The abort paths must not fire mid-request, and they are reached from a
  // keydown handler and the browser Back button as well as from a click — none
  // of which see fresh state through a closure.
  const busyRef = useRef(false);
  busyRef.current =
    emailStatus === "sending" ||
    emailStatus === "verifying" ||
    mfaStatus === "verifying";

  // Asks the server to mail a code. Shared by the initial send and Resend, so
  // the two cannot drift.
  const requestEmailCode = useCallback(async ({ resend = false } = {}) => {
    setEmailStatus("sending");
    setEmailMsg("");
    setEmailNotice("");

    try {
      const { data } = await API.post("/admin/login/email-code");
      setEmailToken(data.emailToken);
      setCodeSentTo(data.email || "");
      setEmailStatus("awaiting");

      // SMTP is not configured in development, where the server logs the code
      // instead of sending it. Saying so beats a silent wait for mail that is
      // never coming.
      if (data.delivered === false) {
        setEmailNotice("Email delivery is not configured — check the server log for the code.");
      } else if (resend) {
        setEmailNotice("A new code is on its way.");
      }
      return true;
    } catch (err) {
      setEmailStatus("awaiting");
      setEmailMsg(err.response?.data?.message || "Could not send the sign-in code.");
      return false;
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");
    setMsgTone("error");
    setLoading(true);

    try {
      // Asked BEFORE the password goes to Firebase, on purpose.
      //
      // Firebase rejects a wrong password on the client, so the server never
      // sees the attempt: a held account would answer "invalid email or
      // password" to a wrong guess and "on hold" to a correct one. That change
      // of message IS the leak — it tells whoever is guessing that they have
      // just found the password. Held accounts now answer the same way to every
      // password, right or wrong.
      //
      // A failure here is never allowed to block a sign-in: if the check cannot
      // run, the flow carries on and the server's own 403 still holds the line.
      if (await isAccountHeld(email)) {
        setMsg(HELD_MESSAGE);
        setStep("form");
        return;
      }

      // Firebase verifies the password and issues an ID token. That token alone
      // is NOT a session — the server still requires the email code and the
      // second factor.
      await signInWithEmailAndPassword(auth, email.trim(), password);
      clearSession();
      clearLoginProof();

      const { data } = await API.get("/admin/mfa/state");

      // Already satisfied for this sign-in: both factors were completed against
      // this same auth_time, so re-challenging would be asking twice.
      if (data.mfaSatisfied) {
        setAuthed(true);
        return navigate("/dashboard");
      }

      // Every other route into MFA — enrolment included — goes through the
      // email step first. Remembered here rather than re-fetched afterwards,
      // because whether this account has an authenticator cannot change while
      // the user is reading their inbox.
      setNeedsEnrolment(!data.mfaEnabled);
      setConfirmingAbort(false);
      setEmailToken("");
      setProofToken("");
      setMfaStatus("idle");
      setMfaMsg("");
      setStep("email");
      await requestEmailCode();
    } catch (err) {
      const code = err?.code || "";
      if (code.startsWith("auth/")) {
        setMsg(
          code === "auth/invalid-credential" || code === "auth/wrong-password" ||
          code === "auth/user-not-found"
            ? "Invalid email or password"
            : "Sign-in failed. Please try again."
        );
      } else {
        // A held account authenticates against Firebase perfectly well — the
        // password is still correct — and is refused by the first call that
        // needs a session. Drop the Firebase session too, so the browser is not
        // left half signed in to an account it cannot use.
        if (err.response?.data?.code === "ACCOUNT_LOCKED") {
          await signOut(auth).catch(() => {});
          clearSession();
          setMsg(HELD_MESSAGE);
        } else {
          setMsg(err.response?.data?.message || "Login failed");
        }
      }
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  // Exchanges the emailed code for the proof the MFA endpoints require. Issues
  // no session: this is one factor of two.
  const verifyEmailCode = useCallback(
    async (code) => {
      if (busyRef.current) return;

      setEmailStatus("verifying");
      setEmailMsg("");
      setEmailNotice("");

      try {
        const { data } = await API.post("/admin/login/email-verify", {
          emailToken,
          code,
        });

        // Persisted as well as held in state, because the enrolment branch is a
        // real route and a reload there would otherwise lose it.
        setProofToken(data.emailProofToken);
        setLoginProof(data.emailProofToken);

        if (needsEnrolment) {
          // No authenticator on this account yet — enrol first. The route reads
          // the proof back out of sessionStorage.
          setStep("form");
          return navigate("/mfa/setup", { state: { fromCreate: false } });
        }

        setEmailStatus("awaiting");
        setStep("mfa");
      } catch (err) {
        const failure = err.response?.data;
        setEmailStatus("awaiting");
        setEmailMsg(failure?.message || "Could not verify that code.");

        // A dead token cannot be retried with the same digits — clear the box's
        // token so the only way forward is Resend.
        if (failure?.code === "LOGIN_CODE_EXPIRED" || failure?.code === "LOGIN_CODE_STALE") {
          setEmailToken("");
        }
      }
    },
    [emailToken, needsEnrolment, navigate]
  );

  // Completes the sign-in. The server stamps an mfaAuthTime claim bound to this
  // specific sign-in, so the ID token must be force-refreshed to carry it.
  const verifyMfa = useCallback(
    async (code) => {
      if (busyRef.current) return;

      setMfaStatus("verifying");
      setMfaMsg("");

      try {
        await API.post("/admin/verify-mfa", { code, emailProofToken: proofToken });
        await getIdToken(true);
        clearSession();
        clearLoginProof();

        setStep("form");
        setAuthed(true);
        navigate("/dashboard", { replace: true });
      } catch (err) {
        const failure = err.response?.data;
        setMfaStatus("idle");

        // The email proof died before the authenticator code was entered — most
        // likely the user sat on this screen for over ten minutes. Send them
        // back to the email step rather than letting them retype TOTP codes
        // that can never be accepted.
        if (failure?.code === "EMAIL_NOT_VERIFIED") {
          clearLoginProof();
          setProofToken("");
          setStep("email");
          setEmailMsg("That took a while — here is a fresh code.");
          return void requestEmailCode({ resend: true });
        }

        setMfaMsg(failure?.message || "Invalid OTP code");
      }
    },
    [navigate, setAuthed, proofToken, requestEmailCode]
  );

  // Abandoning here must actually undo the half-finished sign-in: Firebase
  // still holds a valid token for this account, and leaving it in place would
  // mean a signed-in browser that never passed the remaining factors.
  const abortLogin = useCallback(async () => {
    if (busyRef.current) return;

    setStep("form");
    setConfirmingAbort(false);
    setEmailStatus("idle");
    setEmailMsg("");
    setEmailNotice("");
    setEmailToken("");
    setMfaStatus("idle");
    setMfaMsg("");
    setProofToken("");
    setPassword("");

    clearLoginProof();
    await signOut(auth).catch(() => {});
    clearSession();

    setMsgTone("info");
    setMsg("Sign-in cancelled. Enter your email and password to try again.");
  }, []);

  const requestAbort = useCallback(() => {
    if (!busyRef.current) setConfirmingAbort(true);
  }, []);

  // Browser Back and tab close both raise the same confirmation the Cancel
  // button does, instead of silently stranding a half-authenticated browser.
  useNavigationGuard(step !== "form", requestAbort);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {step === "email" && (
        <LoginEmailCodeModal
          email={codeSentTo || email.trim()}
          status={emailStatus}
          error={emailMsg}
          notice={emailNotice}
          confirmingAbort={confirmingAbort}
          onResend={() => requestEmailCode({ resend: true })}
          onSubmit={verifyEmailCode}
          onRequestAbort={requestAbort}
          onCancelAbort={() => setConfirmingAbort(false)}
          onConfirmAbort={abortLogin}
        />
      )}

      {step === "mfa" && (
        <MfaVerifyModal
          email={email.trim()}
          status={mfaStatus}
          error={mfaMsg}
          confirmingAbort={confirmingAbort}
          onSubmit={verifyMfa}
          onRequestAbort={requestAbort}
          onCancelAbort={() => setConfirmingAbort(false)}
          onConfirmAbort={abortLogin}
        />
      )}

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-linear(rgba(255,255,255,0.02)_1px,transparent_1px),linear-linear(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-linear(ellipse_80%_50%_at_50%_50%,black,transparent)]"></div>

      <div className="w-full max-w-[350px] sm:max-w-[384px] md:max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-30 h-30 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <img
              src="/datalyticscit_logo.png"
              alt="Club Logo"
              className="w-25 h-25 md:w-30 md:h-30 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Datalytics Admin Portal
          </h1>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 md:p-8 shadow-2xl">
          {/* Glass morphism effect */}
          <div className="absolute inset-0 bg-linear-to-br from-white/5 to-white/0 rounded-3xl backdrop-blur-sm"></div>

          <div className="relative z-10">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Welcome</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Only for our generation in Datalytics CIT.
                <br />
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300 flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 via-slate-800"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-linear-to-r from-purple-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
                  <input
                    type="email"
                    className="relative w-full pl-12 pr-4 py-4 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300"
                    placeholder="admin@datalytics.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300 flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 via-slate-800"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-linear-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="relative w-full pl-12 pr-12 py-4 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors duration-200"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {showPassword ? (
                        <>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </>
                      ) : (
                        <>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full relative group bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-linear-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative flex items-center justify-center">
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                        />
                      </svg>
                      Access Dashboard
                    </>
                  )}
                </span>
              </button>

              {/* Error Message */}
              {msg && (
                <div
                  className={`p-4 rounded-xl ${
                    msgTone === "info"
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : "bg-red-500/10 border border-red-500/30 animate-shake"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg
                      className={`w-5 h-5 ${
                        msgTone === "info" ? "text-amber-400" : "text-red-400"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p
                      className={`text-sm font-medium ${
                        msgTone === "info" ? "text-amber-300" : "text-red-400"
                      }`}
                    >
                      {msg}
                    </p>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 animate-fade-in">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-xs text-slate-500 font-medium">
              Protected by MFA
            </p>
          </div>
          <p className="text-xs text-slate-600">
            © 2024 Datalytics CIT • All Rights Reserved.
          </p>
        </div>
      </div>

      {/* Add custom animations to your global CSS */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
