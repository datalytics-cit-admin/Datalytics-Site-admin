// admin/src/components/EmailVerifyModal.jsx
import { useEffect, useRef, useState } from "react";
import { Mail, AlertTriangle, X, ShieldCheck } from "lucide-react";

const CODE_LENGTH = 8;
const RESEND_COOLDOWN_S = 60;

/**
 * The Gmail mark, inlined rather than hotlinked — the modal has to render even
 * when the network is the thing that's broken.
 */
function GmailLogo({ className = "" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Gmail">
      <path
        fill="#4caf50"
        d="M45,16.2l-5,2.75l-5,4.75L35,40h7c1.657,0,3-1.343,3-3V16.2z"
      />
      <path
        fill="#1e88e5"
        d="M3,16.2l3.614,1.71L13,23.7V40H6c-1.657,0-3-1.343-3-3V16.2z"
      />
      <polygon
        fill="#e53935"
        points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17"
      />
      <path
        fill="#c62828"
        d="M3,12.298V16.2l10,7.5V11.2L9.876,8.859C9.132,8.301,8.228,8,7.298,8h0C4.924,8,3,9.924,3,12.298z"
      />
      <path
        fill="#fbc02d"
        d="M45,12.298V16.2l-10,7.5V11.2l3.124-2.341C38.868,8.301,39.772,8,40.702,8h0C43.076,8,45,9.924,45,12.298z"
      />
    </svg>
  );
}

/**
 * Proves the admin's email address exists and is reachable, before anything is
 * created and before MFA enrolment is offered.
 *
 * The cooldown here is a courtesy — it stops the obvious double-click. The
 * limit that actually matters is server-side (emailCodeLimiter), because a
 * timer in the browser protects nobody's inbox.
 */
export default function EmailVerifyModal({
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

  const submit = (e) => {
    e.preventDefault();
    if (canSubmit) onSubmit(code);
  };

  const resend = () => {
    if (busy || cooldown > 0) return;
    setCode("");
    setCooldown(RESEND_COOLDOWN_S);
    onResend();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Verify Email</h2>
              <p className="text-sm text-slate-400 break-all">{email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestAbort}
            disabled={busy}
            aria-label="Cancel admin creation"
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
                Cancel this creation? Nothing has been saved. Your form details
                stay as they are.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onCancelAbort}
                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-slate-700/60 hover:bg-slate-600/60 text-white transition-colors"
              >
                Keep verifying
              </button>
              <button
                type="button"
                onClick={onConfirmAbort}
                className="flex-1 py-3 px-4 rounded-xl font-semibold bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 transition-colors"
              >
                Yes, cancel creation
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-5">
            <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200/90">
                Nothing is saved yet. The admin is created only after the email
                and the authenticator code are both verified.
              </p>
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
                    : "We sent a code to the address above. It expires in 10 minutes."}
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

            {notice && (
              <div className="p-3 rounded-xl text-sm text-center bg-slate-700/30 border border-slate-600/40 text-slate-300">
                {notice}
              </div>
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
                  Verify Email
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onRequestAbort}
              disabled={busy}
              className="w-full text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
