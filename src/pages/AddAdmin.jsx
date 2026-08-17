import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { getSession } from "../services/session";
import {
  ArrowLeft,
  UserPlus,
  X,
  Mail,
  Phone,
  Image,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";
import EmailVerifyModal from "../components/EmailVerifyModal";
import MfaEnrollModal from "../components/MfaEnrollModal";
import { useNavigationGuard } from "../hooks/useNavigationGuard";

export default function AddAdmin() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [batch, setBatch] = useState("");
  const [position, setPosition] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  const [courses, setCourses] = useState([]);
  const [positions, setPositions] = useState([]);
  const [me, setMe] = useState(null);

  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState("error"); // "error" | "success" | "info"
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Creation is a handshake and only the last step writes anything:
  //   form → validate → verify the email → enrol MFA → create
  // Until both codes verify there is no admin record, no sign-in account and no
  // uploaded image, so abandoning the flow needs no cleanup.
  const [phase, setPhase] = useState("form"); // "form" | "email" | "mfa"
  const [emailToken, setEmailToken] = useState("");
  const [emailVerifiedToken, setEmailVerifiedToken] = useState("");
  const [emailStatus, setEmailStatus] = useState("sending"); // sending|awaiting|verifying
  const [emailMsg, setEmailMsg] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [qr, setQr] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [mfaStatus, setMfaStatus] = useState("idle"); // idle|generating|ready|submitting
  const [mfaMsg, setMfaMsg] = useState("");
  const [confirmingAbort, setConfirmingAbort] = useState(false);

  // Belt and braces against duplicate submissions: `loading` disables the
  // button, this blocks a second call that slips through before React repaints
  // (double Enter, a fast double click, a stray re-fire).
  const inFlightRef = useRef(false);

  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const fileInputRef = useRef(null);
  const years = [2, 3, 4];
  const genders = [
    { value: "M", label: "Male" },
    { value: "F", label: "Female" },
    { value: "O", label: "Other" },
  ];
  const [isDragging, setIsDragging] = useState(false);

  // Batch generator with permission logic
  const batchOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const arr = [];

    if (me?.role === "superadmin") {
      // Super admin: Show batches from 2019 to current + 1
      const startYear = 2019;
      for (let i = startYear; i <= currentYear + 1; i++) {
        arr.push(`${i}-${i + 1}`);
      }
    } else {
      // Regular admin: Show only next batch (current + 1)
      const nextBatch = `${currentYear + 1}-${currentYear + 2}`;
      arr.push(nextBatch);
    }

    return arr.sort((a, b) => parseInt(b) - parseInt(a));
  }, [me?.role]);

  // Set default batch based on admin role
  useEffect(() => {
    if (!me) return;

    const currentYear = new Date().getFullYear();

    if (me.role === "superadmin") {
      // Superadmin: default to current batch
      const currentBatch = `${currentYear}-${currentYear + 1}`;
      setBatch(currentBatch);
    } else {
      // Regular admin: default to next batch (current + 1)
      const nextBatch = `${currentYear + 1}-${currentYear + 2}`;
      setBatch(nextBatch);
    }
  }, [me]);

  // Fetch Courses - Updated to reverse the order
  useEffect(() => {
    API.get("/courses")
      .then((res) => {
        // Filter out "Computing Department" (case-insensitive)
        const filteredCourses = res.data.filter(
          (course) =>
            !course.name.toLowerCase().includes("computing department")
        );
        setCourses(filteredCourses.reverse()); // Reverse the array
      })
      .catch(() => setCourses([]));
  }, []);

  // Fetch logged-in admin
  useEffect(() => {
    getSession().then(setMe).catch(() => {});
  }, []);

  // // auto batch - set current batch as default
  // useEffect(() => {
  //   const currentYear = new Date().getFullYear();
  //   const currentBatch = `${currentYear}-${currentYear + 1}`;
  //   setBatch(currentBatch);
  // }, []);

  // Fetch positions by batch
  useEffect(() => {
    if (!batch) return;
    API.get(`/roles/${batch}`)
      .then((res) => setPositions(res.data.reverse())) // Reverse the array
      .catch(() => setPositions([]));
  }, [batch]);


  // Phone formatter
  const handlePhoneChange = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 5) setPhone(digits);
    else setPhone(`${digits.slice(0, 5)} ${digits.slice(5)}`);
  };

  // Image Handler
  const handleFile = (fileData) => {
    if (!fileData) return;
    if (!fileData.type.startsWith("image/"))
      return setMsg("Only image files allowed");
    if (fileData.size > 5 * 1024 * 1024) return setMsg("Max 5MB");

    setFile(fileData);
    setPreview(URL.createObjectURL(fileData));
    setMsg("");
  };

  const removeImage = () => {
    setFile(null);
    setPreview("");
  };

  const formattedPhone = () => {
    const digits = phone.replace(/\D/g, "");
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  };

  // The identity fields the server validates and binds the MFA draft to. The
  // password and the image are deliberately absent: they are sent once, with
  // the final create request, and never before.
  const detailsPayload = () => ({
    name,
    rollNo,
    email,
    course,
    gender,
    year,
    batch,
    position,
    linkedin,
    phone: formattedPhone(),
  });

  // The form is frozen while its details are being checked and for the whole
  // MFA step — the draft is bound to exactly these values.
  const formLocked = loading || phase !== "form";

  const showError = (text) => {
    setMsgTone("error");
    setMsg(text);
  };

  // STEP 1 — check the details. Writes nothing; this only decides whether it is
  // worth asking the creator to scan anything.
  const submit = async (e) => {
    e.preventDefault();

    if (inFlightRef.current || phase !== "form") return;

    if (!file) return showError("Select profile image");

    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) return showError("Invalid phone number");

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return showError(passwordValidation.message);
    }

    inFlightRef.current = true;
    setLoading(true);
    setMsg("");

    try {
      await API.post("/admin/add/validate", detailsPayload());

      setQr("");
      setDraftToken("");
      setEmailVerifiedToken("");
      setMfaMsg("");
      setMfaStatus("idle");
      setConfirmingAbort(false);
      setPhase("email");

      // Hand the in-flight guard over before starting the send. Without this,
      // sendEmailCode's own guard sees the flag this function is still holding
      // and returns immediately — the modal opens on "Sending the code..." and
      // no request is ever made.
      inFlightRef.current = false;
      await sendEmailCode();
    } catch (err) {
      showError(err.response?.data?.message || "Error");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  // STEP 2 — prove the address is real and reachable. Writes nothing: the code
  // is emailed, and only a keyed hash of it travels in the returned token.
  const sendEmailCode = useCallback(async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setEmailStatus("sending");
    setEmailMsg("");
    setEmailNotice("");

    try {
      const { data } = await API.post("/admin/add/email-code", detailsPayload());
      setEmailToken(data.emailToken);
      setEmailStatus("awaiting");

      // The server falls back to logging the code when SMTP is unconfigured;
      // say so plainly rather than leaving someone waiting for an email that
      // was never sent. "pending" means it is still being sent — the code box
      // opens now and the message lands a moment later.
      if (data.delivered === false) {
        setEmailNotice(
          "Email delivery is not configured on the server, so the code was written to the server log."
        );
      } else if (data.delivered === "pending") {
        // setEmailNotice("The email is on its way — it may take a few seconds to arrive.");
      }
    } catch (err) {
      setEmailStatus("awaiting");
      setEmailMsg(err.response?.data?.message || "Could not send the code");
    } finally {
      inFlightRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, rollNo, email, course, gender, year, batch, position, linkedin, phone]);

  const verifyEmailCode = useCallback(
    async (code) => {
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      setEmailStatus("verifying");
      setEmailMsg("");

      try {
        const { data } = await API.post("/admin/add/email-verify", {
          ...detailsPayload(),
          emailToken,
          emailCode: code,
        });

        setEmailVerifiedToken(data.emailVerifiedToken);
        setMfaStatus("idle");
        setMfaMsg("");
        setPhase("mfa");
      } catch (err) {
        setEmailStatus("awaiting");
        setEmailMsg(err.response?.data?.message || "Could not verify the code");
      } finally {
        inFlightRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emailToken, name, rollNo, email, course, gender, year, batch, position, linkedin, phone]
  );

  // STEP 3 — issue the enrolment QR. Still writes nothing: the secret comes
  // back inside a signed, short-lived token that the create request hands back.
  const generateQr = useCallback(async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setMfaStatus("generating");
    setMfaMsg("");

    try {
      const { data } = await API.post("/admin/add/draft", {
        ...detailsPayload(),
        emailVerifiedToken,
      });
      setQr(data.qrImage);
      setDraftToken(data.draftToken);
      setMfaStatus("ready");
    } catch (err) {
      setMfaStatus(qr ? "ready" : "idle");
      setMfaMsg(err.response?.data?.message || "Could not generate the QR code");
    } finally {
      inFlightRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, emailVerifiedToken, name, rollNo, email, course, gender, year, batch, position, linkedin, phone]);

  // STEP 4 — the only call that creates anything. The server verifies the code
  // against the draft before it touches Firestore, Firebase Auth or Cloudinary.
  const completeCreation = useCallback(
    async (code) => {
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      setMfaStatus("submitting");
      setMfaMsg("");

      const fd = new FormData();
      fd.append("image", file);
      fd.append("name", name);
      fd.append("rollNo", rollNo);
      fd.append("email", email);
      fd.append("password", password);
      fd.append("course", course);
      fd.append("gender", gender);
      fd.append("year", year);
      fd.append("batch", batch);
      fd.append("position", position);
      fd.append("linkedin", linkedin);
      fd.append("phone", formattedPhone());
      fd.append("role", "admin");
      fd.append("draftToken", draftToken);
      fd.append("mfaCode", code);

      try {
        await API.post("/admin/add", fd, {
          onUploadProgress: (p) =>
            setUploadProgress(Math.round((p.loaded / p.total) * 100)),
        });

        // Leaving the flow is what deactivates the navigation guard, so drop the
        // phase before navigating.
        setPhase("form");
        setMsgTone("success");
        setMsg("Admin Created");
        navigate("/dashboard/admins", { replace: true });
      } catch (err) {
        const failure = err.response?.data;

        // A dead or mismatched draft cannot be retried with the same QR — send
        // the creator back to step 1 rather than letting them retype a code
        // that can never verify.
        if (failure?.code === "DRAFT_INVALID" || failure?.code === "DRAFT_STALE") {
          setQr("");
          setDraftToken("");
          setMfaStatus("idle");
        } else {
          setMfaStatus("ready");
        }

        setMfaMsg(failure?.message || "Could not create the admin");
      } finally {
        inFlightRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftToken, file, name, rollNo, email, password, course, gender, year, batch, position, linkedin, phone, navigate]
  );

  // Aborting costs nothing to undo — there is nothing stored to undo — so it
  // just closes the modal and hands the form back with the details intact.
  const abortCreation = () => {
    if (mfaStatus === "submitting") return;
    setPhase("form");
    setQr("");
    setDraftToken("");
    setEmailToken("");
    setEmailVerifiedToken("");
    setEmailMsg("");
    setEmailNotice("");
    setMfaStatus("idle");
    setMfaMsg("");
    setConfirmingAbort(false);
    setMsgTone("info");
    setMsg("Admin creation cancelled — nothing was saved.");
  };

  // Read through a ref so the handler identity stays stable for the guard's
  // event listeners while still seeing the current status.
  const mfaStatusRef = useRef(mfaStatus);
  useEffect(() => {
    mfaStatusRef.current = mfaStatus;
  }, [mfaStatus]);

  const requestAbort = useCallback(() => {
    if (mfaStatusRef.current !== "submitting") setConfirmingAbort(true);
  }, []);

  // Browser Back and tab close both land on the same confirmation the Cancel
  // button raises. Nothing is at risk either way; this stops the creator from
  // silently losing a filled-in form.
  useNavigationGuard(phase !== "form", requestAbort);

  const leavePage = () => {
    if (phase !== "form") return requestAbort();
    navigate("/dashboard/admins");
  };

  const validatePassword = (password) => {
    if (!password) return { valid: false, message: "Password is required" };

    if (password.length < 8) {
      return {
        valid: false,
        message: "Password must be at least 8 characters",
      };
    }

    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: "Password must contain at least one uppercase letter (A-Z)",
      };
    }

    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        message: "Password must contain at least one lowercase letter (a-z)",
      };
    }

    if (!/[0-9]/.test(password)) {
      return {
        valid: false,
        message: "Password must contain at least one number (0-9)",
      };
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return {
        valid: false,
        message:
          "Password must contain at least one special character (!@#$%^&*)",
      };
    }

    return { valid: true, message: "✓ Strong password" };
  };

  // Get password validation
  const passwordValidation = validatePassword(password);


  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-6 lg:px-8">
      {/* HEADER */}

      <div className="space-y-4 mb-6 sm:mb-8">
        {/* Mobile: Two rows */}
        <div className="sm:hidden space-y-4">
          {/* Row 1: Back button */}
          <div className="flex items-center justify-between">
            <button
              onClick={leavePage}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl transition-all duration-200 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-medium">Back to Admins</span>
            </button>
          </div>

          {/* Row 2: Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Add New Admin
              </h1>
              <p className="text-xs text-slate-400">
                Create admin access profile
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: Single row with back button on left and title centered */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Back button on left */}
          <button
            onClick={leavePage}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl transition-all duration-200 group shrink-0"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium">Back to Admins</span>
          </button>

          {/* Title centered in remaining space */}
          <div className="flex-1 flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Add New Admin
              </h1>
              <p className="text-sm text-slate-400">
                Create admin access profile
              </p>
            </div>
          </div>

          {/* Empty div for balance */}
          <div className="w-32 shrink-0"></div>
        </div>
      </div>

      {/* MESSAGE */}
      {msg && (
        <div
          className={`p-4 rounded-xl mb-6 ${
            msgTone === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : msgTone === "info"
              ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {msg}
        </div>
      )}

      {/* FORM */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
        <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:gap-10">
          {/* A disabled fieldset locks every control inside it natively, so the
              details cannot drift while they are being validated or while the
              MFA step is bound to them. `contents` keeps the grid layout. */}
          <fieldset disabled={formLocked} className="contents">
          {/* DETAILS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Input
              label="Full Name"
              required
              value={name}
              setter={setName}
              placeholder="Enter full name"
            />
            <Input
              label="Roll Number"
              required
              value={rollNo}
              setter={setRollNo}
              placeholder="Enter roll number"
            />

            <Input
              icon={<Mail />}
              label="Email"
              required
              value={email}
              setter={setEmail}
              type="email"
              placeholder="example@gmail.com.edu"
            />
            {/* Password Field - Icon-based compact */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Key className="w-4 h-4 shrink-0" />
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                    passwordTouched && !passwordValidation.valid
                      ? "border-red-500"
                      : passwordTouched && passwordValidation.valid
                      ? "border-green-500"
                      : "border-slate-700"
                  }`}
                  value={password}
                  onChange={(e) => {
                    if (!passwordTouched) setPasswordTouched(true);
                    setPassword(e.target.value);
                  }}
                  placeholder="Enter strong password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Icon-based validation */}
              {passwordTouched && password && (
                <div className="flex items-center justify-between">
                  {/* Icons */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`${
                        password.length >= 8
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                      title="8+ characters"
                    >
                      <div className="text-xs">8+</div>
                    </div>
                    <div
                      className={`${
                        /[A-Z]/.test(password)
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                      title="Uppercase"
                    >
                      <div className="text-xs font-bold">A</div>
                    </div>
                    <div
                      className={`${
                        /[a-z]/.test(password)
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                      title="Lowercase"
                    >
                      <div className="text-xs">a</div>
                    </div>
                    <div
                      className={`${
                        /[0-9]/.test(password)
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                      title="Number"
                    >
                      <div className="text-xs">1</div>
                    </div>
                    <div
                      className={`${
                        /[!@#$%^&*(),.?":{}|<>]/.test(password)
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                      title="Special"
                    >
                      <div className="text-xs">#</div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="text-xs">
                    {passwordValidation.valid ? (
                      <span className="text-green-400">✓ Strong</span>
                    ) : (
                      <span className="text-amber-400">
                        Needs{" "}
                        {5 -
                          [
                            password.length >= 8,
                            /[A-Z]/.test(password),
                            /[a-z]/.test(password),
                            /[0-9]/.test(password),
                            /[!@#$%^&*(),.?":{}|<>]/.test(password),
                          ].filter(Boolean).length}{" "}
                        more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <SelectBasic
              label="Batch"
              options={batchOptions}
              required
              value={batch}
              setter={setBatch}
              disabled={me?.role !== "superadmin"} // Disable for regular admins
              helperText={
                me?.role === "superadmin"
                  ? "Select any batch"
                  : "Next batch only (auto-assigned)"
              }
            />

            <Select
              label="Position"
              options={positions}
              required
              value={position}
              setter={setPosition}
            />

            <Select
              label="Course"
              options={courses}
              required
              value={course}
              setter={setCourse}
            />

            <SelectBasic
              label="Year"
              options={years}
              required
              value={year}
              setter={setYear}
            />

            <SelectBasic
              label="Gender"
              options={genders}
              required
              value={gender}
              setter={setGender}
            />

            <PhoneInput value={phone} setter={handlePhoneChange} />

            <Input
              label="LinkedIn URL"
              value={linkedin}
              required
              setter={setLinkedin}
              placeholder="https://linkedin.com/in/username"
            />
            {/* IMAGE UPLOAD */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Profile Photo <span className="text-red-400">*</span>
              </label>
              {/* A div takes no part in fieldset[disabled], so the lock is
                  applied by hand here. */}
              <div
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all
      ${formLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      ${
        isDragging
          ? "border-indigo-500 bg-slate-900/40"
          : file
          ? "border-slate-700"
          : formLocked
          ? "border-slate-700"
          : "border-slate-600 hover:border-indigo-500 hover:bg-slate-900/30"
      }`}
                onClick={() => {
                  if (formLocked) return;
                  fileInputRef.current.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!formLocked) setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (formLocked) return;
                  handleFile(e.dataTransfer.files[0]);
                }}
              >
                {preview ? (
                  <div className="relative flex justify-center">
                    <img
                      src={preview}
                      alt="Profile preview"
                      className="h-32 w-32 object-cover rounded-xl shadow-md"
                    />
                    <button
                      type="button"
                      disabled={formLocked}
                      className="absolute -top-2 -right-2 bg-red-500 p-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage();
                      }}
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Image className="w-10 h-10 text-slate-400" />
                    <p className="text-sm text-slate-400">
                      Drag & Drop or Click to Upload
                    </p>
                    <p className="text-xs text-slate-500">
                      Max 5MB • JPG PNG JPEG •
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>
            </div>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={formLocked}
            className="w-full bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 mt-4 py-3 rounded-xl text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-600 disabled:hover:to-purple-600 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Checking details...
              </>
            ) : phase === "email" ? (
              "Verify the email to continue"
            ) : phase === "mfa" ? (
              "Finish MFA setup to create"
            ) : (
              "Create Admin"
            )}
          </button>
          </fieldset>
        </form>
      </div>

      {phase === "email" && (
        <EmailVerifyModal
          email={email.trim()}
          status={emailStatus}
          error={emailMsg}
          notice={emailNotice}
          confirmingAbort={confirmingAbort}
          onResend={sendEmailCode}
          onSubmit={verifyEmailCode}
          onRequestAbort={requestAbort}
          onCancelAbort={() => setConfirmingAbort(false)}
          onConfirmAbort={abortCreation}
        />
      )}

      {/* Remounted per QR so the typed code never outlives the secret it was
          for, and unmounted on abort so nothing survives a cancelled attempt. */}
      {phase === "mfa" && (
        <MfaEnrollModal
          key={qr || "pending-qr"}
          email={email}
          qr={qr}
          status={mfaStatus}
          progress={uploadProgress}
          error={mfaMsg}
          confirmingAbort={confirmingAbort}
          onGenerate={generateQr}
          onSubmit={completeCreation}
          onRequestAbort={requestAbort}
          onCancelAbort={() => setConfirmingAbort(false)}
          onConfirmAbort={abortCreation}
        />
      )}
    </div>
  );
}

/* COMPONENTS */
const Input = ({ label, required, value, setter, type = "text", icon, placeholder }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-slate-300 flex gap-1 items-center">
      {icon} {label} {required && <span className="text-red-400">*</span>}
    </label>
    <input
      type={type}
      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500"
      value={value}
      onChange={(e) => setter(e.target.value)}
      required={required}
      placeholder={placeholder}
    />
  </div>
);

const Select = ({ label, options, value, setter, required }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-slate-300">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <select
      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
      value={value}
      onChange={(e) => setter(e.target.value)}
      required={required}
    >
      <option value="">Select</option>
      {options.map((o) => (
        <option key={o._id || o} value={o._id || o} className="bg-slate-800">
          {o.name || o}
        </option>
      ))}
    </select>
  </div>
);

const SelectBasic = ({
  label,
  options,
  value,
  setter,
  required,
  disabled,
  helperText,
}) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-slate-300">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <select
      className={`w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      value={value}
      onChange={(e) => setter(e.target.value)}
      required={required}
      disabled={disabled}
    >
      <option value="">Select</option>
      {options.map((option) => {
        // Handle both object and string options
        const optionValue = option.value || option;
        const optionLabel = option.label || option;
        return (
          <option
            key={optionValue}
            value={optionValue}
            className="bg-slate-800"
          >
            {optionLabel}
          </option>
        );
      })}
    </select>
    {helperText && <p className="text-xs text-slate-400">{helperText}</p>}
  </div>
);
const PhoneInput = ({ value, setter }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
      <Phone className="w-4 h-4" /> Phone Number{" "}
      <span className="text-red-400">*</span>
    </label>
    <div className="flex gap-3">
      <div className="px-3 flex items-center bg-slate-900/50 border border-slate-700 rounded-xl text-slate-300 font-medium">
        +91
      </div>
      <input
        className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
        placeholder="98765 43210"
        value={value}
        onChange={(e) => setter(e.target.value)}
        required
      />
    </div>
  </div>
);
