import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import {
  ArrowLeft,
  UserPlus,
  Upload,
  X,
  Mail,
  Phone,
  Image,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";

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
  const [fileInfo, setFileInfo] = useState({ name: "", size: "" });

  const [courses, setCourses] = useState([]);
  const [positions, setPositions] = useState([]);
  const [me, setMe] = useState(null);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    API.get("/admin/me").then((res) => setMe(res.data.admin));
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
    setFileInfo({
      name: fileData.name,
      size: (fileData.size / 1024 / 1024).toFixed(2) + "MB",
    });
    setMsg("");
  };

  const removeImage = () => {
    setFile(null);
    setPreview("");
    setFileInfo({ name: "", size: "" });
  };

  // Submit
  const submit = async (e) => {
    e.preventDefault();

    if (!file) return setMsg("Select profile image");

    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) return setMsg("Invalid phone number");

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setMsg(passwordValidation.message);
      return;
    }

    const formattedPhone = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

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
    fd.append("phone", formattedPhone);
    fd.append("role", me?.role === "superadmin" ? "admin" : "admin");

    setLoading(true);

    try {
      const res = await API.post("/admin/add", fd, {
        onUploadProgress: (p) =>
          setUploadProgress(Math.round((p.loaded / p.total) * 100)),
      });

      setMsg("Admin Created");

      // Redirect to MFA Setup page for the newly created admin
      navigate(`/mfa/setup/${res.data.admin._id}`, {
        state: { fromCreate: true },
      });
    } catch (err) {
      setMsg(err.response?.data?.message || "Error");
    } finally {
      setLoading(false);
    }
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
              onClick={() => navigate("/dashboard/admins")}
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
            onClick={() => navigate("/dashboard/admins")}
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
            msg.includes("Created")
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {msg}
        </div>
      )}

      {/* FORM */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
        <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:gap-10">
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
              <div
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
      ${
        isDragging
          ? "border-indigo-500 bg-slate-900/40"
          : file
          ? "border-slate-700"
          : "border-slate-600 hover:border-indigo-500 hover:bg-slate-900/30"
      }`}
                onClick={() => fileInputRef.current.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
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
                      className="absolute -top-2 -right-2 bg-red-500 p-1 rounded-full"
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
            disabled={loading}
            className="w-full bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 mt-4 py-3 rounded-xl text-white font-semibold"
          >
            {loading ? "Creating..." : "Create Admin"}
          </button>
        </form>
      </div>
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
