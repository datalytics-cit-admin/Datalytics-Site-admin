// admin/src/components/LoginEmailCodeModal.jsx
import { useEffect, useRef, useState } from "react";
import { Mail, AlertTriangle, X, ShieldCheck } from "lucide-react";
import GmailLogo from "./GmailLogo";

const CODE_LENGTH = 8;
const RESEND_COOLDOWN_S = 60;
const NOTICE_TTL_MS = 10_000;

// Shows the address without printing it in full over someone's shoulder. The
// user already knows which account they typed, so this is a reminder of where
// to look, not a disclosure.
const maskEmail = (email) => {
  const [user, domain] = String(email || "").split("@");
  if (!user || !domain) return email || "";
  const head = user.slice(0, Math.min(2, user.length));
  const tail = user.length > 3 ? user.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(2, user.length - head.length - tail.length))}${tail}@${domain}`;
};

/**
 * First of the two codes a sign-in needs: the one emailed to the address on the
 * admin record. It runs BEFORE the authenticator step, and the server will not
 * accept a TOTP code without the proof this step produces.
 *
 * Structurally a twin of EmailVerifyModal, but deliberately not shared with it.
 * That one is a step inside admin *creation* and its copy says so throughout
 * ("nothing is saved yet", "cancel this creation") — the two would need a
 * conditional on almost every string, which is a worse thing to maintain than
 * two honest components.
 *
 * The caller owns the abort confirmation, because browser Back has to raise the
 * same prompt; this component owns only the typed code and the resend timer.
 */
export default function LoginEmailCodeModal({
  email,
  status, // "sending" | "awaiting" | "verifying"
  error,
  notice,
  confirmingAbort,
  onResend,
  onSubmit,
  onRequestAbort,
  onCancelAbort,
  onConfirmAbort,
}) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const inputRef = useRef(null);

  const isSending = status === "sending";
  const isVerifying = status === "verifying";
  const busy = isSending || isVerifying;
  const canSubmit = !busy && code.length === CODE_LENGTH;

  useEffect(() => {
    if (status === "awaiting") inputRef.current?.focus();
  }, [status]);

  // The cooldown here is a courtesy — it stops the obvious double-click. The
  // limit that actually matters is server-side (loginEmailCodeLimiter), because
  // a timer in the browser protects nobody's inbox.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !busy) onRequestAbort();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onRequestAbort]);

  // The notice is the caller's state, but how long it stays on screen is a
  // presentation concern — it confirms something that already happened, so it
  // should not hold a slot in the layout once it has been read.
  //
  // What is remembered is the text that has been retired, not a shown/hidden
  // flag: a *different* message must appear even while the last one is retired,
  // and only the timer writes state, so the effect never renders in a loop.
  const [retired, setRetired] = useState("");
  const noticeShown = Boolean(notice) && notice !== retired;

  useEffect(() => {
    if (!noticeShown) return;
    const id = setTimeout(() => setRetired(notice), NOTICE_TTL_MS);
    return () => clearTimeout(id);
  }, [noticeShown, notice]);

  const submit = (e) => {
    e.preventDefault();
    if (canSubmit) onSubmit(code);
  };

  const resend = () => {
    if (busy || cooldown > 0) return;
    // Re-arms the notice, so a second resend confirms itself even when the
    // caller sets the very same sentence it set last time.
    setRetired("");
    setCode("");
    setCooldown(RESEND_COOLDOWN_S);
    onResend();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Check your email</h2>
              <p className="text-sm text-slate-400 break-all">
                {maskEmail(email)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestAbort}
            disabled={busy}
            aria-label="Cancel sign-in"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmingAbort ? (
          <div className="p-6 space-y-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">
                Cancel this sign-in? You are not signed in until both codes are
                verified, so you will need to enter your email and password
                again.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onCancelAbort}
                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-slate-700/60 hover:bg-slate-600/60 text-white transition-colors"
              >
                Keep signing in
              </button>
              <button
                type="button"
                onClick={onConfirmAbort}
                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 transition-colors"
              >
                Yes, cancel sign-in
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-5">
            {/* Says plainly that this is step 1 of 2, so the authenticator
                prompt that follows does not read as the flow going wrong. */}
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-slate-500">
              <span className="text-indigo-400">Step 1 of 2</span>
              <span className="h-px flex-1 bg-slate-700/60" />
              <span>Authenticator next</span>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-6 space-y-4">
              <div className="text-center">
                <GmailLogo className="w-10 h-10 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-2">
                  Enter the {CODE_LENGTH}-digit code
                </h3>
                <p className="text-slate-400 text-sm">
                  {isSending
                    ? "Sending the code..."
                    : "We sent a code to the address on your admin record. It expires in 5 minutes."}
                </p>
              </div>

              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                disabled={busy}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))
                }
                placeholder={"0".repeat(CODE_LENGTH)}
                className="w-full text-center text-2xl font-mono tracking-[0.55em] indent-[0.55em] bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              />

              <button
                type="button"
                onClick={resend}
                disabled={busy || cooldown > 0}
                className="w-full text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
              >
                {cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : "Didn't get it? Resend code"}
              </button>
            </div>

            {notice && noticeShown && (
              <p className="text-xs text-center text-slate-400">{notice}</p>
            )}

            {error && (
              <div className="p-3 rounded-xl text-sm text-center bg-red-500/10 border border-red-500/20 text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Verify &amp; Continue
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onRequestAbort}
              disabled={busy}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel and return to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
