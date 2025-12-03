import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import API from "../services/api";
import { Shield, QrCode, Smartphone, ArrowLeft } from "lucide-react";

export default function MFA({ setAuthed }) {
  const { mode, id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [adminId, setAdminId] = useState(id || null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const isSetupMode = mode === "setup";
  const isFromCreate = location.state?.fromCreate || false;

  // If verifying login
  useEffect(() => {
    if (mode === "verify" && !adminId) {
      API.get("/admin/me")
        .then((res) => setAdminId(res.data.admin._id))
        .catch(() => setMsg("Session expired, please login again"));
    }
  }, []);

  // SETUP MFA (QR Generation)
  const handleSetup = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await API.post("/admin/setup-mfa", { adminId });
      setQr(res.data.qrImage);
      setMsg(
        "QR code generated successfully! Scan it with Google Authenticator."
      );
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to enable MFA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const res = await API.post("/admin/verify-mfa", {
        adminId,
        code,
        fromCreate: isFromCreate,
      });

      // CASE 1: This was from AddAdmin → DO NOT LOGIN
      if (res.data.fromCreate === true) {
        return navigate("/dashboard/admins", { replace: true });
      }

      // NORMAL LOGIN
      setAuthed(true);
      return navigate("/dashboard", { replace: true });
    } catch (err) {
      setMsg(err.response?.data?.message || "Invalid OTP code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Updated container width logic */}
      <div
        className={`w-full ${
          isSetupMode ? "max-w-4xl" : "max-w-md"
        } bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden`}
      >
        <div
          className={`${
            isSetupMode ? "flex flex-col lg:flex-row min-h-[600px]" : ""
          }`}
        >
          {/* Left Side - Setup MFA (Only show in setup mode) */}
          {isSetupMode && (
            <div className="flex-1 p-8 border-b lg:border-b-0 lg:border-r border-slate-700/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Setup MFA</h2>
                  <p className="text-slate-400 text-sm">
                    Secure your account with 2FA
                  </p>
                </div>
              </div>

              {!qr ? (
                <div className="space-y-6">
                  <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-700/50">
                    <div className="flex items-center gap-3 mb-4">
                      <Smartphone className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-semibold text-white">Get Started</h3>
                    </div>
                    <p className="text-slate-300 text-sm mb-4">
                      Download Google Authenticator app from your app store and
                      click below to generate QR code.
                    </p>
                    <button
                      onClick={handleSetup}
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
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
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-700/50">
                    <h3 className="font-semibold text-white mb-4 text-center">
                      Scan QR Code
                    </h3>
                    <div className="flex justify-center mb-4">
                      <img
                        src={qr}
                        alt="QR Code"
                        className="w-48 h-48 rounded-xl border-2 border-slate-600"
                      />
                    </div>
                    <p className="text-slate-300 text-sm text-center mb-4">
                      Scan this QR code with Google Authenticator app
                    </p>
                    <div className="text-center">
                      <p className="text-slate-400 text-sm mb-4">
                        After scanning, switch to the verification tab to enter
                        the code
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Side - Verify MFA */}
          <div className={`${isSetupMode ? "flex-1" : "w-full"} p-8`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isSetupMode ? "Verify MFA" : "Two-Factor Authentication"}
                </h2>
                <p className="text-slate-400 text-sm">
                  {isSetupMode
                    ? "Enter your verification code"
                    : "Enter the code from your authenticator app"}
                </p>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-6">
              <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-700/50">
                <div className="space-y-4">
                  <div className="text-center">
                    <Smartphone className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h3 className="font-semibold text-white mb-2">
                      {isSetupMode ? "Enter OTP Code" : "Verification Required"}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {isSetupMode
                        ? "Open Google Authenticator and enter the code"
                        : "Enter the code from your authenticator app to continue"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      maxLength={8}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="00000000"
                      className="w-full text-center text-2xl font-mono bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                    />
                    <p className="text-xs text-slate-400 text-center">
                      Code from your authenticator app
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 8}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    {isSetupMode ? "Complete Setup" : "Verify & Continue"}
                  </>
                )}
              </button>
            </form>

            {msg && (
              <div
                className={`mt-4 p-3 rounded-xl text-center text-sm ${
                  msg.toLowerCase().includes("invalid") ||
                  msg.toLowerCase().includes("failed") ||
                  msg.toLowerCase().includes("error") ||
                  msg.toLowerCase().includes("expired")
                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                }`}
              >
                {msg}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Only show back to login in normal verification mode */}
        {!isSetupMode && (
          <div className="border-t border-slate-700/50 p-4 bg-slate-900/20">
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 text-sm mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
