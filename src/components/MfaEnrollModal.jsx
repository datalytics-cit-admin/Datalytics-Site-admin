// admin/src/components/MfaEnrollModal.jsx
import { useEffect, useRef, useState } from "react";
import {
  Shield,
  QrCode,
  Smartphone,
  Lock,
  AlertTriangle,
  Camera,
  X,
} from "lucide-react";

const CODE_LENGTH = 8;

/**
 * Second factor enrolment for an admin that does not exist yet.
 *
 * The gate is deliberate and one-directional:
 *   idle       → only "Generate QR Code" is live; the code box is locked
 *   advising   → the screenshot warning, shown once before the first QR is
 *                fetched — the secret is only ever displayed here, so the
 *                creator has to be told to keep a copy *before* it appears
 *   generating → nothing is live
 *   ready      → the code box unlocks; "Complete Setup" stays locked until the
 *                code is the full length
 *   submitting → everything locks again until the server answers
 *
 * The caller owns the network calls, the qr/status props and the abort
 * confirmation (the browser Back button has to be able to raise it too); this
 * component owns only the typed code.
 */
export default function MfaEnrollModal({
  email,
  qr,
  status, // "idle" | "generating" | "ready" | "submitting"
  progress = 0,
  error,
  confirmingAbort,
  onGenerate,
  onSubmit,
  onRequestAbort,
  onCancelAbort,
  onConfirmAbort,
}) {
  const [code, setCode] = useState("");
  const [advising, setAdvising] = useState(false);
  const inputRef = useRef(null);

  const isReady = status === "ready";
  const isSubmitting = status === "submitting";
  const isGenerating = status === "generating";
  const codeUnlocked = isReady && !isSubmitting;
  const canSubmit = codeUnlocked && code.length === CODE_LENGTH;

  const generate = () => {
    setAdvising(false);
    onGenerate();
  };

  // The caller remounts this on every new QR (and unmounts it on abort), so the
  // typed code is discarded with the secret it belonged to — no reset effects,
  // no stale code surviving into the next attempt.
  useEffect(() => {
    if (qr) inputRef.current?.focus();
  }, [qr]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) onRequestAbort();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSubmitting, onRequestAbort]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Enable Two-Factor Authentication
              </h2>
              <p className="text-sm text-slate-400 break-all">
                Required before {email || "this admin"} can be created
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestAbort}
            disabled={isSubmitting}
            aria-label="Cancel admin creation"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Nothing is written until the last step — say so plainly, because
              the creator is about to be asked to walk away and scan a phone. */}
          <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/90">
              Nothing is saved yet. The admin is created only after this code is
              verified.
            </p>
          </div>

          {/* STEP 1 — QR */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <QrCode className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">
                  Step 1 — Scan the QR code
                </h3>
                <p className="text-xs text-slate-400">
                  Open Google Authenticator on the new admin's phone
                </p>
              </div>
            </div>

            {qr ? (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <img
                    src={qr}
                    alt="MFA QR code"
                    className="w-44 h-44 rounded-xl border-2 border-slate-600 bg-white p-1"
                  />
                </div>
                <p className="flex items-center justify-center gap-1.5 text-xs text-amber-300/90">
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  Screenshot this — this screen won't show it again.
                </p>
                <button
                  type="button"
                  onClick={generate}
                  disabled={isSubmitting || isGenerating}
                  className="w-full text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                >
                  Scanned the wrong code? Generate a new QR
                </button>
              </div>
            ) : advising && !isGenerating ? (
              /* The QR carries the TOTP secret and the server never re-issues
                 the same one. Say that plainly here, while there is still
                 nothing on screen to rush past. */
              <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex gap-3">
                  <Camera className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-200">
                      Take a screenshot of the QR code
                    </p>
                    <p className="text-sm text-amber-200/80">
                      Save it somewhere safe before you scan it. If the new admin
                      ever loses their phone, this image is what gets them back
                      in. A copy is emailed to them once setup completes, but
                      this screen will not show it again.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setAdvising(false)}
                    className="sm:w-28 py-2.5 px-4 rounded-xl text-sm font-semibold bg-slate-700/60 hover:bg-slate-600/60 text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={generate}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Got it — show the QR code
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdvising(true)}
                disabled={isGenerating || isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    Generate QR Code
                  </>
                )}
              </button>
            )}
          </div>

          {/* STEP 2 — CODE */}
          <div
            className={`rounded-xl border p-5 space-y-4 transition-colors duration-300 ${
              codeUnlocked
                ? "border-slate-700/50 bg-slate-800/40"
                : "border-slate-800 bg-slate-800/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  codeUnlocked ? "bg-emerald-500/20" : "bg-slate-700/50"
                }`}
              >
                {codeUnlocked ? (
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div>
                <h3
                  className={`font-semibold text-sm ${
                    codeUnlocked ? "text-white" : "text-slate-500"
                  }`}
                >
                  Step 2 — Enter the {CODE_LENGTH}-digit code
                </h3>
                <p className="text-xs text-slate-400">
                  {codeUnlocked
                    ? "Type the code shown in the authenticator app"
                    : "Locked until the QR code is generated"}
                </p>
              </div>
            </div>

            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              disabled={!codeUnlocked}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH))
              }
              placeholder={"0".repeat(CODE_LENGTH)}
              className="w-full text-center text-2xl font-mono tracking-[0.55em] indent-[0.55em] bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm text-center bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700/50">
          {confirmingAbort ? (
            <div className="space-y-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-300">
                  Cancel this creation? Nothing has been saved. Your form
                  details stay as they are.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onCancelAbort}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold bg-slate-700/60 hover:bg-slate-600/60 text-white transition-colors"
                >
                  Keep setting up
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
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onRequestAbort}
                disabled={isSubmitting}
                className="sm:w-40 py-3 px-4 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onSubmit(code)}
                disabled={!canSubmit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {progress > 0 && progress < 100
                      ? `Uploading... ${progress}%`
                      : "Creating admin..."}
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
