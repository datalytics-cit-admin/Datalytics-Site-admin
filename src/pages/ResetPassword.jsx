// admin/src/pages/ResetPassword.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../services/api";
import {
  ShieldCheck,
  KeyRound,
  Unlock,
  QrCode,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import GmailLogo from "../components/GmailLogo";
import GoogleAuthenticatorLogo from "../components/GoogleAuthenticatorLogo";

const CODE_LENGTH = 8;
const RESEND_COOLDOWN_S = 60;
const NOTICE_TTL_MS = 10_000;

// Identical to the server's passwordPolicy.js and to AddAdmin's meter. The
// server's copy is the only one that enforces anything — this exists so the
// form can say what is missing without a round trip.
const RULES = [
  ["8+", (p) => p.length >= 8, "at least 8 characters"],
  ["A", (p) => /[A-Z]/.test(p), "an uppercase letter"],
  ["a", (p) => /[a-z]/.test(p), "a lowercase letter"],
  ["1", (p) => /[0-9]/.test(p), "a number"],
  ["#", (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), "a special character"],
];

const maskEmail = (email) => {
  const [user, domain] = String(email || "").split("@");
  if (!user || !domain) return email || "";
  const head = user.slice(0, Math.min(2, user.length));
  const tail = user.length > 3 ? user.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(2, user.length - head.length - tail.length))}${tail}@${domain}`;
};

const Shell = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <img
          src="/datalyticscit_logo.png"
          alt="Datalytics CIT"
          className="w-20 h-20 object-contain mx-auto mb-3"
        />
        <h1 className="text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
          Datalytics Admin Portal
        </h1>
      </div>
      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl">
        {children}
      </div>
    </div>
  </div>
);

/**
 * Password reset reached from a lock-down email.
 *
 * Identity is proven BEFORE anything is composed: the code is sent the moment
 * the page opens, and the password fields do not exist until it verifies. That
 * ordering is a courtesy to the user rather than the security control — the
 * server refuses /reset/complete without the proof no matter what the client
 * does, so a caller skipping straight to it gets a 403.
 *
 * This deliberately replaces Firebase's own reset page, which treats the link
 * as a single bearer credential and would set a password with no second check.
 */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  // The same emailed link, the same token, the same two codes — "release" just
  // skips the password step and lifts the hold, leaving the credential alone.
  const isRelease = params.get("action") === "release";
  const navigate = useNavigate();

  const [phase, setPhase] = useState("loading"); // loading | form | done | dead
  const [fatal, setFatal] = useState("");
  const [account, setAccount] = useState({ email: "", name: "" });

  // 1 = emailed code, 2 = new password, 3 = authenticator. Each factor gets
  // its own screen: the two codes come from different places, and asking for
  // one of them under a password field reads as an afterthought.
  const [step, setStep] = useState(1);
  // Step 2 is skipped entirely on a release, so the progress dots and the
  // "next step" jumps both read from this rather than counting to three.
  const STEPS = isRelease ? [1, 3] : [1, 2, 3];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Step 1
  const [emailToken, setEmailToken] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [proofToken, setProofToken] = useState("");

  // Step 2
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);

  // Step 3
  const [mfaCode, setMfaCode] = useState("");

  // Step 3's escape hatch, for the admin who has lost the authenticator as
  // well. "off" is the normal path; the ticket is what tells the server to
  // check the code against the new QR instead of the stored secret.
  const [reenroll, setReenroll] = useState("off"); // off | advising | generating | ready
  const [mfaQr, setMfaQr] = useState("");
  const [mfaTicket, setMfaTicket] = useState("");
  const [replaced, setReplaced] = useState(false);

  const codeRef = useRef(null);
  const passwordRef = useRef(null);
  const mfaRef = useRef(null);

  // StrictMode double-invokes effects in development, and the first thing this
  // page does is send an email. Without this guard every local page load mails
  // two codes and burns two of the server's six-per-window allowance.
  const openedRef = useRef(false);

  const failed = RULES.filter(([, ok]) => !ok(password));
  const matches = password.length > 0 && password === confirm;
  const passwordReady = !busy && failed.length === 0 && matches;
  // "advising" and "generating" are decision states: no authenticator has been
  // named yet, so a code box would be asking for something nobody can supply.
  const codeVisible = reenroll === "off" || reenroll === "ready";
  // A release never collects a password, so the rules all read as unmet and
  // gating the final submit on passwordReady would leave the button dead for
  // ever. Only the reset path has a password to be ready.
  const canSubmit =
    !busy && mfaCode.length === CODE_LENGTH && (isRelease || passwordReady);

  const requestCode = useCallback(
    async ({ resend = false } = {}) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const { data } = await API.post("/admin/security/reset/send-code", { token });
        setEmailToken(data.emailToken);
        setEmailCode("");
        setCooldown(RESEND_COOLDOWN_S);
        if (data.delivered === false) {
          setNotice("Email delivery is not configured — check the server log for the code.");
        } else if (resend) {
          setNotice("A new code is on its way.");
        }
        return true;
      } catch (err) {
        setError(err.response?.data?.message || "Could not send the code.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token]
  );

  // Opening the page validates the link and immediately mails a code, so the
  // first thing the user sees is the box it goes in.
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    if (!token) {
      setFatal("This link is missing its token. Open the reset email again.");
      setPhase("dead");
      return;
    }

    // No `alive` flag here, deliberately. StrictMode mounts, unmounts and
    // remounts in development: the cleanup would flip `alive` to false before
    // the first request resolved, and the ref guard blocks the second run from
    // ever setting state — leaving the page stuck on "Checking your link...".
    // React 18 no longer warns about setState after unmount, so the guard alone
    // is both necessary and sufficient.
    (async () => {
      try {
        const { data } = await API.post("/admin/security/reset/start", { token });
        setAccount({ email: data.email, name: data.name });
        setPhase("form");
        await requestCode();
      } catch (err) {
        setFatal(err.response?.data?.message || "This reset link is not valid.");
        setPhase("dead");
      }
    })();
  }, [token, requestCode]);

  // A notice confirms something that already happened, so it clears itself
  // rather than sitting in the layout above the code box.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), NOTICE_TTL_MS);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (phase !== "form") return;
    if (step === 1) codeRef.current?.focus();
    else if (step === 2) passwordRef.current?.focus();
    else mfaRef.current?.focus();
  }, [phase, step]);

  const killIfLinkDead = (failure) => {
    if (failure?.code === "RESET_LINK_USED" || failure?.code === "RESET_LINK_INVALID") {
      setFatal(failure.message);
      setPhase("dead");
      return true;
    }
    return false;
  };

  const verifyCode = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data } = await API.post("/admin/security/reset/verify-code", {
        token,
        emailToken,
        code: emailCode,
      });
      setProofToken(data.resetProofToken);
      setStep(isRelease ? 3 : 2);
    } catch (err) {
      const failure = err.response?.data;
      if (killIfLinkDead(failure)) return;
      setError(failure?.message || "Could not verify that code.");
      if (failure?.code === "RESET_CODE_EXPIRED" || failure?.code === "RESET_CODE_STALE") {
        setEmailToken("");
      }
    } finally {
      setBusy(false);
    }
  };

  // Advancing to the authenticator asks the server one question first: is this
  // simply the password they already have? Catching it here means they are not
  // marched through a second factor only to be refused at the end — and on a
  // reset reached from a lock-down, the old password is the very thing under
  // suspicion. The server repeats the check at /reset/complete regardless.
  const goToAuthenticator = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await API.post("/admin/security/reset/password-check", {
        token,
        resetProofToken: proofToken,
        password,
      });
      if (data?.reused) {
        setError("That is the password you already have. Type a different one.");
        return;
      }
      setStep(3);
    } catch (err) {
      const failure = err.response?.data;
      if (killIfLinkDead(failure)) return;
      // A check that cannot run must not trap them on this screen — the rule is
      // enforced at /reset/complete either way.
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  // Mints a replacement TOTP secret and shows its QR. Nothing on the account
  // changes here — the server hands the secret back in a ticket and only
  // enrols it if /reset/complete arrives with a code that proves the scan
  // worked. Backing out at any point leaves the old authenticator intact.
  const generateNewAuthenticator = async () => {
    setReenroll("generating");
    setError("");
    setNotice("");
    try {
      const { data } = await API.post("/admin/security/reset/authenticator", {
        token,
        resetProofToken: proofToken,
      });
      setMfaQr(data.qrImage);
      setMfaTicket(data.mfaTicket);
      setMfaCode("");
      setReenroll("ready");
    } catch (err) {
      const failure = err.response?.data;
      if (killIfLinkDead(failure)) return;
      setError(failure?.message || "Could not create a new authenticator QR.");
      setReenroll("off");
    }
  };

  const cancelReenroll = () => {
    setReenroll("off");
    setMfaQr("");
    setMfaTicket("");
    setMfaCode("");
    setError("");
  };

  const complete = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await API.post(
        isRelease
          ? "/admin/security/reset/release"
          : "/admin/security/reset/complete",
        {
          token,
          resetProofToken: proofToken,
          mfaCode,
          // Ignored by /release, which never touches the credential.
          password,
          confirmPassword: confirm,
          // Absent on the normal path, so the server checks the stored secret.
          ...(mfaTicket ? { mfaTicket } : {}),
        }
      );
      setReplaced(Boolean(data?.authenticatorReplaced));
      setPhase("done");
    } catch (err) {
      const failure = err.response?.data;
      if (killIfLinkDead(failure)) return;
      setError(failure?.message || "Could not set the new password.");

      // The proof timed out while the password was being composed. Send them
      // back for a fresh code rather than rejecting correct input.
      if (failure?.code === "EMAIL_NOT_VERIFIED") {
        setProofToken("");
        setStep(1);
        setError("That took a while — here is a fresh code.");
        await requestCode({ resend: true });
      }

      // Only reachable if the password changed under the step-2 check, or a
      // client skipped it. Either way, the field to fix is back on step 2.
      if (failure?.code === "PASSWORD_REUSED" && !isRelease) {
        setStep(2);
      }

      // The ten-minute ticket ran out while they were scanning. The old QR is
      // dead to the server now, so drop it rather than let them keep typing
      // codes from a secret it will never accept.
      if (failure?.code === "MFA_TICKET_EXPIRED") {
        setMfaQr("");
        setMfaTicket("");
        setMfaCode("");
        setReenroll("advising");
      }
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Checking your link...
        </div>
      </Shell>
    );
  }

  if (phase === "dead") {
    return (
      <Shell>
        <div className="text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white">This link cannot be used</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{fatal}</p>
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            className="w-full py-3 px-4 rounded-xl font-semibold bg-slate-700/60 hover:bg-slate-600/60 text-white transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <div className="text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {isRelease
              ? "Account released"
              : replaced
              ? "Password and authenticator updated"
              : "Password updated"}
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {isRelease
              ? "The hold is lifted. Sign in with the password you already had — you will still need your email code and authenticator code."
              : "Every device has been signed out. Sign in with your new password — you will still need your email code and authenticator code."}
          </p>
          {replaced && (
            <p className="text-sm text-amber-200/90 leading-relaxed">
              Use the authenticator entry you just scanned; the old one no
              longer works, so delete it. We have emailed you a copy of the new
              QR code — keep it.
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            className="w-full py-3 px-4 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* One dot per factor, plus the password itself. */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              STEPS.indexOf(n) <= STEPS.indexOf(step)
                ? "bg-indigo-500"
                : "bg-slate-700"
            }`}
          />
        ))}
      </div>

      {/* ------------------------------ Step 1: prove the inbox, first ---- */}
      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && emailCode.length === CODE_LENGTH) verifyCode();
          }}
          className="space-y-5"
        >
          <div className="flex items-center gap-3">
            <GmailLogo className="w-10 h-10 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">Verify it's you</h2>
              <p className="text-xs text-slate-400 break-all">
                {maskEmail(account.email)}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">
            We sent a {CODE_LENGTH}-digit code to the address on your admin
            record. It expires in 5 minutes.
          </p>

          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={emailCode}
            disabled={busy}
            onChange={(e) =>
              setEmailCode(e.target.value.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))
            }
            placeholder={"0".repeat(CODE_LENGTH)}
            className="w-full text-center text-2xl font-mono tracking-[0.55em] indent-[0.55em] bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-40"
          />

          <button
            type="button"
            onClick={() => requestCode({ resend: true })}
            disabled={busy || cooldown > 0}
            className="w-full text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
          </button>

          {notice && (
            <p className="text-xs text-center text-slate-400">{notice}</p>
          )}
          {error && (
            <div className="p-3 rounded-xl text-sm text-center bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || emailCode.length !== CODE_LENGTH}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Verify &amp; continue
              </>
            )}
          </button>

          <p className="text-xs text-slate-500 text-center leading-relaxed">
            You'll choose a new password once this code checks out.
          </p>
        </form>
      )}

      {/* -------------------------- Step 2: the new password, gated ------- */}
      {step === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (passwordReady) goToAuthenticator();
          }}
          className="space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Set a new password</h2>
              <p className="text-xs text-emerald-400/90">Email verified ✓</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300">New password</label>
            <div className="relative">
              <input
                ref={passwordRef}
                type={reveal ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a new password"
                className="w-full pl-4 pr-12 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setReveal(!reveal)}
                aria-label={reveal ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {reveal ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
              {RULES.map(([label, ok, description]) => (
                <span
                  key={label}
                  title={description}
                  className={`text-xs font-mono transition-colors ${
                    ok(password) ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300">
              Re-enter new password
            </label>
            <input
              type={reveal ? "text" : "password"}
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              className={`w-full px-4 py-3 bg-slate-900/60 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                confirm.length === 0
                  ? "border-slate-700 focus:ring-indigo-500"
                  : matches
                  ? "border-emerald-500/50 focus:ring-emerald-500"
                  : "border-red-500/50 focus:ring-red-500"
              }`}
            />
            {confirm.length > 0 && !matches && (
              <p className="text-xs text-red-400">The two passwords do not match.</p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm text-center bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}

          {/* Nothing is SAVED yet — this only checks the password is not the
              current one, then moves to the factor that decides whether any of
              it is kept. */}
          <button
            type="submit"
            disabled={!passwordReady}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Checking...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* ---------------- Step 3: the second factor, on its own ----------- */}
      {step === 3 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) complete();
          }}
          className="space-y-5"
        >
          {/* Same shape as the email step, because it is the same kind of ask:
              a code that lives somewhere else. */}
          <div className="flex items-center gap-3">
            <GoogleAuthenticatorLogo className="w-10 h-10 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">
                {reenroll === "ready"
                  ? "Scan and confirm"
                  : codeVisible
                  ? "Authenticator code"
                  : "Lost your authenticator?"}
              </h2>
              <p className="text-xs text-emerald-400/90">
                {isRelease ? "Email verified ✓" : "Password ready ✓"}
              </p>
            </div>
          </div>

          {codeVisible && (
            <p className="text-sm text-slate-400 leading-relaxed">
              {reenroll === "ready"
                ? "Scan the code below, then type what your app shows for it."
                : `Open your authenticator app and enter the ${CODE_LENGTH}-digit code for Datalytics-Admin.`}{" "}
              {isRelease
                ? "The hold is lifted only once this checks out — your password does not change."
                : "Your new password is saved only once this checks out."}
            </p>
          )}

          <div className="space-y-3">

            {/* The QR sits ABOVE the box it feeds, so the order on screen is
                the order of the actions: scan, then type. */}
            {reenroll === "ready" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-400">
                  <QrCode className="w-4 h-4" />
                  Scan with your authenticator app
                </div>
                <img
                  src={mfaQr}
                  alt="New authenticator QR code"
                  className="w-44 h-44 mx-auto rounded-lg bg-white p-2"
                />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Add it as a new entry, then type the code it shows. Your old
                  entry keeps working until this form goes through — if you find
                  your phone before then, nothing has changed.
                </p>
                <button
                  type="button"
                  onClick={cancelReenroll}
                  className="w-full text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
                >
                  Found the old authenticator? Use that instead
                </button>
              </div>
            )}

            {codeVisible && (
              <input
                ref={mfaRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                disabled={busy}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))
                }
                placeholder={"0".repeat(CODE_LENGTH)}
                className="w-full text-center text-xl font-mono tracking-[0.45em] indent-[0.45em] bg-slate-900/60 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-40"
              />
            )}

            {reenroll === "off" && (
              <button
                type="button"
                onClick={() => setReenroll("advising")}
                disabled={busy}
                className="w-full text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
              >
                Lost your authenticator?
              </button>
            )}

            {/* Said before the QR appears, not after: once it is on screen the
                advice about screenshotting it is already too late to act on. */}
            {reenroll === "advising" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                <div className="flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    This replaces your second factor. The QR is shown once —
                    screenshot it, or keep the copy we email you when the reset
                    goes through. Your current authenticator keeps working right
                    up until you submit this form.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelReenroll}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-700/60 hover:bg-slate-600/60 text-white transition-colors"
                  >
                    Never mind
                  </button>
                  <button
                    type="button"
                    onClick={generateNewAuthenticator}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 transition-colors"
                  >
                    Show me the new QR
                  </button>
                </div>
              </div>
            )}

            {reenroll === "generating" && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                Building your new QR code...
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm text-center bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}

          {codeVisible && (
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isRelease ? "Releasing..." : "Updating password..."}
                </>
              ) : (
                <>
                  {isRelease ? (
                    <Unlock className="w-4 h-4" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  {isRelease ? "Release my account" : "Update password"}
                </>
              )}
            </button>
          )}

          {/* The password they typed is still in state, so going back is free
              — and it is the only way to fix a typo now that the field lives
              on another screen. A release has no such screen. */}
          {!isRelease && (
            <button
              type="button"
              onClick={() => {
                setStep(2);
                setError("");
              }}
              disabled={busy}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back to the password
            </button>
          )}
        </form>
      )}
    </Shell>
  );
}
