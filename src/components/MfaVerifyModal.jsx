// admin/src/components/MfaVerifyModal.jsx
import { useEffect, useRef, useState } from "react";
import { Shield, Smartphone, AlertTriangle, X } from "lucide-react";

const CODE_LENGTH = 8;

/**
 * Second factor for a sign-in that is already half-done: Firebase has accepted
 * the password, but the server issues no session until this code verifies.
 *
 * It sits over the login form rather than on its own route, because that half-
 * finished state is not a place to navigate to — leaving it has to mean
 * abandoning the sign-in, and a route makes that ambiguous.
 *
 * The caller owns the abort confirmation (the browser Back button has to be
 * able to raise it too); this component owns only the typed code.
 */
export default function MfaVerifyModal({
  email,
  status, // "idle" | "verifying"
  error,
  confirmingAbort,
  onSubmit,
  onRequestAbort,
  onCancelAbort,
  onConfirmAbort,
}) {
  const [code, setCode] = useState("");
  const inputRef = useRef(null);

  const isVerifying = status === "verifying";
  const canSubmit = !isVerifying && code.length === CODE_LENGTH;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isVerifying) onRequestAbort();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVerifying, onRequestAbort]);

  const submit = (e) => {
    e.preventDefault();
    if (canSubmit) onSubmit(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-slate-400 break-all">
                {email || "Enter the code from your authenticator app"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestAbort}
            disabled={isVerifying}
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
                Cancel this sign-in? You are not signed in until the code is
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
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-6 space-y-4">
              <div className="text-center">
                <Smartphone className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-2">
                  Verification Required
                </h3>
                <p className="text-slate-400 text-sm">
                  Enter the {CODE_LENGTH}-digit code from your authenticator app
                  to continue
                </p>
              </div>

              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                disabled={isVerifying}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))
                }
                placeholder={"0".repeat(CODE_LENGTH)}
                className="w-full text-center text-2xl font-mono tracking-widest bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 text-center">
                Code from your authenticator app
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm text-center bg-red-500/10 border border-red-500/20 text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Verify &amp; Continue
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onRequestAbort}
              disabled={isVerifying}
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
