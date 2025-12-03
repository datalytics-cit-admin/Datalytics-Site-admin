// admin/src/pages/EditAdmin.jsx
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Link,
  Save,
  Shield,
  Calendar,
  BookOpen,
  Hash,
  UserCircle,
  X,
  Eye,
  EyeOff,
  Key,
} from "lucide-react"; // Added Eye, EyeOff, Key icons

export default function EditAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    course: "",
    year: "",
    position: "",
    rollNo: "",
    gender: "",
    phone: "",
    linkedin: "",
    batch: "",
    image: "",
    password: "", // Add password field
  });

  const [courses, setCourses] = useState([]);
  const [positions, setPositions] = useState([]);
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [original, setOriginal] = useState({});

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

    const batchOptions = useMemo(() => {
      const currentYear = new Date().getFullYear();
      const arr = [];

      // Start from 2019 up to currentYear + 1
      const startYear = 2019;

      for (let year = startYear; year <= currentYear + 1; year++) {
        arr.push(`${year}-${year + 1}`);
      }

      // Sort in descending order (newest first)
      return arr.sort((a, b) => {
        const yearA = parseInt(a.split("-")[0]);
        const yearB = parseInt(b.split("-")[0]);
        return yearB - yearA;
      });
    }, []);

  const years = [1, 2, 3, 4];
  const genderOptions = ["M", "F", "O"];
  const roleOptions = ["admin", "superadmin"];

  // Password validation
  const validatePassword = (password) => {
    if (!password) return { valid: true, message: "" };

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

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current admin role
        const me = await API.get("/admin/me");
        setMyRole(me.data.admin.role);

        // Fetch courses - reverse the array and filter out "Computing Department"
        const coursesRes = await API.get("/courses");
        const filteredCourses = coursesRes.data.filter(
          (course) =>
            !course.name.toLowerCase().includes("computing department")
        );
        setCourses(filteredCourses.reverse());

        // Fetch all admins
        const adminRes = await API.get("/admin/all");
        const admins = adminRes.data.admins;
        const admin = admins.find((a) => a._id === id);

        if (!admin) {
          setMsg("Admin not found");
          setTimeout(() => navigate("/dashboard/admins"), 2000);
          return;
        }

        // Format phone number
        const cleanedDigits = admin.phone
          .replace("+91", "")
          .replace(/\s/g, "")
          .trim();
        const formattedPhone = `${cleanedDigits.slice(
          0,
          5
        )} ${cleanedDigits.slice(5)}`;

        const adminData = {
          name: admin.name || "",
          email: admin.email || "",
          role: admin.role || "",
          course: admin.course?._id || admin.course || "",
          year: admin.year || "",
          position: admin.position?._id || admin.position || "",
          rollNo: admin.rollNo || "",
          gender: admin.gender || "",
          phone: formattedPhone,
          linkedin: admin.linkedin || "",
          batch: admin.batch || "",
          image: admin.image || "",
          password: "", // Password field is empty initially
        };

        setForm(adminData);
        setOriginal(adminData);
        setPreview(admin.image || "");

        // Fetch positions based on batch
        if (admin.batch) {
          const positionsRes = await API.get(`/roles/${admin.batch}`);
          setPositions(positionsRes.data.reverse());
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setMsg("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate]);

  // Fetch positions when batch changes
  useEffect(() => {
    if (!form.batch) return;
    API.get(`/roles/${form.batch}`)
      .then((res) => setPositions(res.data.reverse()))
      .catch(() => setPositions([]));
  }, [form.batch]);

  const handlePhoneChange = (value) => {
    if (!phoneTouched) setPhoneTouched(true);
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 5) {
      setForm({ ...form, phone: digits });
    } else {
      setForm({ ...form, phone: `${digits.slice(0, 5)} ${digits.slice(5)}` });
    }
  };

  const handlePasswordChange = (value) => {
    if (!passwordTouched) setPasswordTouched(true);
    setForm({ ...form, password: value });
  };

  const handleInputChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleFile = (fileData) => {
    if (!fileData) return;
    if (!fileData.type.startsWith("image/"))
      return setMsg("Only image files allowed");
    if (fileData.size > 5 * 1024 * 1024) return setMsg("Max size 5MB");

    setFile(fileData);
    setPreview(URL.createObjectURL(fileData));
  };

  const removeImage = () => {
    setFile(null);
    setPreview("");
    setForm((prev) => ({ ...prev, image: "" }));
  };

  const saveChanges = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    // Check if image is selected or exists
    if (!file && !form.image) {
      setMsg("Profile photo is required");
      setSaving(false);
      return;
    }

    // Validate phone number
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setMsg("Enter a valid 10-digit phone number");
      setSaving(false);
      return;
    }

    // Validate password if entered
    if (form.password) {
      const passwordValidation = validatePassword(form.password);
      if (!passwordValidation.valid) {
        setMsg(passwordValidation.message);
        setSaving(false);
        return;
      }
    }

    const formattedPhone = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

    try {
      const fd = new FormData();

      // Add all form fields except image
      Object.keys(form).forEach((key) => {
        if (key !== "image") {
          // Don't send empty password
          if (key === "password" && !form.password) {
            return; // Skip empty password
          }
          fd.append(key, form[key]);
        }
      });
      fd.set("phone", formattedPhone);

      // Handle image
      if (file) {
        fd.append("image", file);
      } else if (form.image) {
        fd.append("image", form.image);
      }

      await API.put(`/admin/edit/${id}`, fd);

      setMsg("Admin Updated");
      setTimeout(() => navigate("/dashboard/admins"), 1000);
    } catch (err) {
      setMsg(err.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const getFieldBorderClass = (field, originalField) =>
    field !== originalField
      ? "border-yellow-400 ring-2 ring-yellow-400/20"
      : "border-slate-700";

  const formChanged =
    Object.keys(form).some((key) => {
      if (key === "password") {
        // Password is changed if it has any value (since original password is empty/hidden)
        return form.password !== "";
      }
      return form[key] !== original[key];
    }) || file !== null;

  const imageChanged = file !== null || form.image !== original.image;

  // Get password validation
  const passwordValidation = validatePassword(form.password);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading admin data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-6 lg:px-8">
      {/* Header - same as before */}
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
            <div className="w-10 h-10 bg-linear-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Edit Admin
              </h1>
              <p className="text-xs text-slate-400">
                Update administrator information
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
            <div className="w-10 h-10 bg-linear-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Edit Admin
              </h1>
              <p className="text-sm text-slate-400">
                Update administrator information
              </p>
            </div>
          </div>

          {/* Empty div for balance */}
          <div className="w-32 shrink-0"></div>
        </div>
      </div>

      {/* Success Message */}
      {msg && (
        <div
          className={`p-3 sm:p-4 rounded-xl mb-4 sm:mb-6 ${
            msg.includes("Updated")
              ? "bg-green-500/10 border border-green-500/20"
              : "bg-red-500/10 border border-red-500/20"
          }`}
        >
          <p
            className={`text-sm font-medium text-center sm:text-left ${
              msg.includes("Updated") ? "text-green-400" : "text-red-400"
            }`}
          >
            {msg}
          </p>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
        <form onSubmit={saveChanges} className="p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Left Column - Personal Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></div>
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                        form.name,
                        original.name
                      )}`}
                      value={form.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Mail className="w-4 h-4 shrink-0" />
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                        form.email,
                        original.email
                      )}`}
                      value={form.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Academic Details */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>
                  Academic Details
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 shrink-0" />
                      Course <span className="text-red-400">*</span>
                    </label>
                    <select
                      className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                        form.course,
                        original.course
                      )}`}
                      value={form.course}
                      onChange={(e) =>
                        handleInputChange("course", e.target.value)
                      }
                      required
                    >
                      <option value="" className="bg-slate-800 text-slate-300">
                        Select Course
                      </option>
                      {courses.map((c) => (
                        <option
                          key={c._id}
                          value={c._id}
                          className="bg-slate-800 text-white"
                        >
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <Hash className="w-4 h-4 shrink-0" />
                        Roll Number <span className="text-red-400">*</span>
                      </label>
                      <input
                        className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                          form.rollNo,
                          original.rollNo
                        )}`}
                        value={form.rollNo}
                        onChange={(e) =>
                          handleInputChange("rollNo", e.target.value)
                        }
                        placeholder="Enter roll number"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Year <span className="text-red-400">*</span>
                      </label>
                      <select
                        className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                          form.year,
                          original.year
                        )}`}
                        value={form.year}
                        onChange={(e) =>
                          handleInputChange("year", e.target.value)
                        }
                        required
                      >
                        <option
                          value=""
                          className="bg-slate-800 text-slate-300"
                        >
                          Select Year
                        </option>
                        {years.map((y) => (
                          <option
                            key={y}
                            value={y}
                            className="bg-slate-800 text-white"
                          >
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full shrink-0"></div>
                  Contact Information
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Phone className="w-4 h-4 shrink-0" />
                      Phone Number <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-3">
                      <div className="flex items-center px-3 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium shrink-0">
                        +91
                      </div>
                      <input
                        type="text"
                        className={`flex-1 bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                          form.phone,
                          original.phone
                        )} ${
                          phoneTouched &&
                          form.phone.replace(/\D/g, "").length !== 10
                            ? "border-red-500"
                            : "border-slate-700"
                        }`}
                        value={form.phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="98765 43210"
                        required
                      />
                    </div>
                    {phoneTouched &&
                      form.phone.replace(/\D/g, "").length !== 10 && (
                        <p className="text-xs text-red-400 mt-1">
                          Enter a valid 10-digit number
                        </p>
                      )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Link className="w-4 h-4 shrink-0" />
                      LinkedIn URL <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="url"
                      className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                        form.linkedin,
                        original.linkedin
                      )}`}
                      value={form.linkedin}
                      onChange={(e) =>
                        handleInputChange("linkedin", e.target.value)
                      }
                      placeholder="https://linkedin.com/in/username"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Role & Image */}
            <div className="space-y-6">
              {/* Batch */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0"></div>
                  Batch & Gender
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Batch <span className="text-red-400">*</span>
                      </label>
                      <select
                        className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                          form.batch,
                          original.batch
                        )} ${
                          myRole !== "superadmin"
                            ? "opacity-70 cursor-not-allowed"
                            : ""
                        }`}
                        value={form.batch}
                        onChange={(e) =>
                          handleInputChange("batch", e.target.value)
                        }
                        disabled={myRole !== "superadmin"}
                        required
                      >
                        <option
                          value=""
                          className="bg-slate-800 text-slate-300"
                        >
                          Select Batch
                        </option>
                        {batchOptions.map((b) => (
                          <option
                            key={b}
                            value={b}
                            className="bg-slate-800 text-white"
                          >
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <UserCircle className="w-4 h-4 shrink-0" />
                        Gender <span className="text-red-400">*</span>
                      </label>
                      <select
                        className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                          form.gender,
                          original.gender
                        )}`}
                        value={form.gender}
                        onChange={(e) =>
                          handleInputChange("gender", e.target.value)
                        }
                        required
                      >
                        <option
                          value=""
                          className="bg-slate-800 text-slate-300"
                        >
                          Select Gender
                        </option>
                        {genderOptions.map((g) => (
                          <option
                            key={g}
                            value={g}
                            className="bg-slate-800 text-white"
                          >
                            {g === "M"
                              ? "Male"
                              : g === "F"
                              ? "Female"
                              : "Other"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Position Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Position <span className="text-red-400">*</span>
                    </label>
                    <select
                      className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                        form.position,
                        original.position
                      )}`}
                      value={form.position}
                      onChange={(e) =>
                        handleInputChange("position", e.target.value)
                      }
                      required
                    >
                      <option value="" className="bg-slate-800 text-slate-300">
                        Select Position
                      </option>
                      {positions.map((r) => (
                        <option
                          key={r._id}
                          value={r._id}
                          className="bg-slate-800 text-white"
                        >
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Password Field - Compact Icon-based */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Key className="w-4 h-4 shrink-0" />
                      New Password (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        className={`w-full bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${getFieldBorderClass(
                          form.password,
                          ""
                        )} ${
                          passwordTouched && !passwordValidation.valid
                            ? "border-red-500"
                            : passwordTouched && passwordValidation.valid
                            ? "border-green-500"
                            : ""
                        }`}
                        value={form.password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        placeholder="Leave empty to keep current password"
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

                    {/* Icon-based validation - only show when password has value */}
                    {passwordTouched && form.password && (
                      <div className="flex items-center justify-between">
                        {/* Icons */}
                        <div className="flex items-center gap-2">
                          <div
                            className={`${
                              form.password.length >= 8
                                ? "text-green-400"
                                : "text-slate-500"
                            }`}
                            title="8+ characters"
                          >
                            <div className="text-xs">8+</div>
                          </div>
                          <div
                            className={`${
                              /[A-Z]/.test(form.password)
                                ? "text-green-400"
                                : "text-slate-500"
                            }`}
                            title="Uppercase letter"
                          >
                            <div className="text-xs font-bold">A</div>
                          </div>
                          <div
                            className={`${
                              /[a-z]/.test(form.password)
                                ? "text-green-400"
                                : "text-slate-500"
                            }`}
                            title="Lowercase letter"
                          >
                            <div className="text-xs">a</div>
                          </div>
                          <div
                            className={`${
                              /[0-9]/.test(form.password)
                                ? "text-green-400"
                                : "text-slate-500"
                            }`}
                            title="Number"
                          >
                            <div className="text-xs">1</div>
                          </div>
                          <div
                            className={`${
                              /[!@#$%^&*(),.?":{}|<>]/.test(form.password)
                                ? "text-green-400"
                                : "text-slate-500"
                            }`}
                            title="Special character"
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
                                  form.password.length >= 8,
                                  /[A-Z]/.test(form.password),
                                  /[a-z]/.test(form.password),
                                  /[0-9]/.test(form.password),
                                  /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
                                ].filter(Boolean).length}{" "}
                              more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Image with Label and Required */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <User className="w-4 h-4 shrink-0" />
                  Profile Photo <span className="text-red-400">*</span>
                </label>
                <div
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
      ${
        isDragging
          ? "border-indigo-400 bg-slate-900/40"
          : imageChanged
          ? "border-yellow-400 ring-2 ring-yellow-400/20"
          : "border-slate-600 hover:border-indigo-500 hover:bg-slate-900/30"
      }`}
                  onClick={() =>
                    document.getElementById("adminImageInput").click()
                  }
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
                    const droppedFile = e.dataTransfer.files[0];
                    handleFile(droppedFile);
                  }}
                >
                  {preview || form.image ? (
                    <div className="relative">
                      <img
                        src={preview || form.image}
                        alt="Profile preview"
                        className="mx-auto h-40 w-40 object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-red-500 px-1 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage();
                        }}
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm">
                      Drag & drop image here or click to upload
                      <br />
                      <span className="text-xs">
                        Max 5MB • PNG, JPG, JPEG •
                      </span>
                    </div>
                  )}
                  <input
                    id="adminImageInput"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files[0])}
                    // Removed: required={!form.image}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-700/50">
            <button
              type="submit"
              disabled={saving || !formChanged}
              className={`w-full font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg ${
                formChanged
                  ? "bg-linear-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white focus:ring-purple-500"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 sm:mr-3"></div>
                  <span className="text-sm sm:text-base">
                    Updating Admin...
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="text-sm sm:text-base">
                    {formChanged ? "Save Changes" : "No Changes Made"}
                  </span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
