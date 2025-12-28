import { useState, useMemo, useRef, useEffect } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  X,
  UserPlus,
  Calendar,
  Mail,
  Phone,
  Link,
  Image,
} from "lucide-react";

export default function AddMember() {
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [gender, setGender] = useState("");
  const [year, setYear] = useState("");
  const [position, setPosition] = useState("");
  const [batch, setBatch] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [github, setGithub] = useState("");
  const [instagram, setInstagram] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [fileInfo, setFileInfo] = useState({ name: "", size: "" });

  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [positions, setPositions] = useState([]);
  const [courses, setCourses] = useState([]);

  const [currentAdmin, setCurrentAdmin] = useState(null);

  // Fetch current admin info
  useEffect(() => {
    API.get("/admin/me")
      .then((res) => setCurrentAdmin(res.data.admin))
      .catch(console.error);
  }, []);

  const batchOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const arr = [];

    if (currentAdmin?.role === "superadmin") {
      // Super admin: Show batches from 2019 to current + 1
      const startYear = 2019;
      for (let i = startYear; i <= currentYear + 1; i++) {
        arr.push(`${i}-${i + 1}`);
      }
    } else {
      // Regular admin: Show only current batch
      const currentMonth = new Date().getMonth();
      let currentBatch;

      if (currentMonth >= 6) {
        // July to December
        currentBatch = `${currentYear}-${currentYear + 1}`;
      } else {
        // January to June
        currentBatch = `${currentYear - 1}-${currentYear}`;
      }

      arr.push(currentBatch);
    }

    return arr.sort((a, b) => {
      const yearA = parseInt(a.split("-")[0]);
      const yearB = parseInt(b.split("-")[0]);
      return yearB - yearA;
    });
  }, [currentAdmin]);

  // Set default batch based on admin role
  useEffect(() => {
    if (!currentAdmin) return;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    let defaultBatch;

    if (currentMonth >= 6) {
      // July to December
      defaultBatch = `${currentYear}-${currentYear + 1}`;
    } else {
      // January to June
      defaultBatch = `${currentYear - 1}-${currentYear}`;
    }

    // For regular admin, force current batch only
    if (currentAdmin.role !== "superadmin") {
      setBatch(defaultBatch);
    } else {
      // For superadmin, set default but allow changing
      if (!batch) {
        setBatch(defaultBatch);
      }
    }
  }, [currentAdmin]);

  const years = [2, 3, 4];
  const genderOptions = ["M", "F", "O"];

  // Fetch courses
  useEffect(() => {
    API.get("/courses")
      .then((res) => {
        // Filter out "Computing Department" (case-insensitive)
        const filteredCourses = res.data.filter(
          (course) =>
            !course.name.toLowerCase().includes("computing department")
        );
        setCourses(filteredCourses.reverse());
      })
      .catch(() => setCourses([]));
  }, []);

  // Set default batch
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11 (Jan-Dec)

    // If it's after June, consider it the next academic year
    if (currentMonth >= 6) {
      // July to December
      setBatch(`${currentYear}-${currentYear + 1}`);
    } else {
      // January to June
      setBatch(`${currentYear - 1}-${currentYear}`);
    }
  }, []);

  // Fetch roles for batch
  useEffect(() => {
    if (!batch) return;
    API.get(`/roles/${batch}`)
      .then((res) => setPositions(res.data.reverse())) // Reverse the array
      .catch(() => setPositions([]));
  }, [batch]);

  const handleFile = (fileData) => {
    if (!fileData) return;
    if (!fileData.type.startsWith("image/"))
      return setMsg("Only image files allowed");
    if (fileData.size > 5 * 1024 * 1024) return setMsg("Max size 5MB");

    setFile(fileData);
    setPreview(URL.createObjectURL(fileData));
    setFileInfo({
      name: fileData.name,
      size: (fileData.size / 1024 / 1024).toFixed(2) + "MB",
    });
    setMsg("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleClickUpload = () => fileInputRef.current?.click();

  const removeImage = () => {
    setFile(null);
    setPreview("");
    setFileInfo({ name: "", size: "" });
  };

  const handlePhoneChange = (value) => {
    if (!phoneTouched) setPhoneTouched(true);

    const digits = value.replace(/\D/g, "").slice(0, 10);

    if (digits.length <= 5) {
      setPhone(digits);
    } else {
      setPhone(`${digits.slice(0, 5)} ${digits.slice(5)}`);
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!file) return setMsg("Select an image");

    // Validate phone
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setMsg("Enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    setUploadProgress(5);

    // Format phone number
    const formattedPhone = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

    const fd = new FormData();
    fd.append("image", file);
    fd.append("name", name);
    fd.append("course", course);
    fd.append("year", year);
    fd.append("position", position);
    fd.append("email", email);
    fd.append("rollNo", rollNo);
    fd.append("gender", gender);
    fd.append("dob", dob);
    fd.append("linkedin", linkedin);
    
    if (portfolio.trim()) fd.append("portfolio", portfolio);
    if (github.trim()) fd.append("github", github);
    if (instagram.trim()) fd.append("instagram", instagram);

    fd.append("batch", batch);
    fd.append("phone", formattedPhone);

    try {
      // CORRECT - use admin endpoint
      await API.post("/admin/members/add", fd, {
        onUploadProgress: (p) =>
          setUploadProgress(Math.round((p.loaded / p.total) * 100)),
      });

      setMsg("Member Added");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setMsg(err.response?.data?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-4 mb-6 sm:mb-8">
        {/* Mobile: Two rows */}
        <div className="sm:hidden space-y-4">
          {/* Row 1: Back button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl transition-all duration-200 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-medium">Back to Members</span>
            </button>
          </div>

          {/* Row 2: Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Add New Member
              </h1>
              <p className="text-xs text-slate-400">
                Create a new member profile
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: Single row with back button on left and title centered */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Back button on left */}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl transition-all duration-200 group shrink-0"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium">Back to Members</span>
          </button>

          {/* Title centered in remaining space */}
          <div className="flex-1 flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Add New Member
              </h1>
              <p className="text-sm text-slate-400">
                Create a new member profile
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
            msg.includes("Added")
              ? "bg-green-500/10 border border-green-500/20"
              : "bg-red-500/10 border border-red-500/20"
          }`}
        >
          <p
            className={`text-sm font-medium text-center sm:text-left ${
              msg.includes("Added") ? "text-green-400" : "text-red-400"
            }`}
          >
            {msg}
          </p>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
        <form onSubmit={submit} className="p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Left Column - Personal Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></div>
                  Personal Information
                </h3>

                {/* Name + Course */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Course <span className="text-red-400">*</span>
                    </label>
                    <select
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
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
                    <label className="text-sm font-medium text-slate-300">
                      Roll Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      placeholder="Enter roll number"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Gender <span className="text-red-400">*</span>
                      </label>
                      <select
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        required
                      >
                        <option
                          value=""
                          className="bg-slate-800 text-slate-300"
                        >
                          Select
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Year <span className="text-red-400">*</span>
                      </label>
                      <select
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        required
                      >
                        <option
                          value=""
                          className="bg-slate-800 text-slate-300"
                        >
                          Select
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
                      <Mail className="w-4 h-4 shrink-0" />
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>

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
                        className={`flex-1 bg-slate-900/50 border rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base ${
                          phoneTouched && phone.replace(/\D/g, "").length !== 10
                            ? "border-red-500"
                            : "border-slate-700"
                        }`}
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="98765 43210"
                        required
                      />
                    </div>
                    {phoneTouched && phone.replace(/\D/g, "").length !== 10 && (
                      <p className="text-xs text-red-400 mt-1">
                        Enter a valid 10-digit number
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Additional Information */}
            <div className="space-y-6">
              {/* Role & Batch */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0"></div>
                  Role & Batch
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Position <span className="text-red-400">*</span>
                    </label>
                    <select
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Batch <span className="text-red-400">*</span>
                        {currentAdmin?.role !== "superadmin" && (
                          <span className="text-xs text-slate-500 ml-2">
                            (Your batch)
                          </span>
                        )}
                      </label>
                      <select
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        required
                        disabled={currentAdmin?.role !== "superadmin"} // Disable for regular admins
                      >
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
                        <Calendar className="w-4 h-4 shrink-0" />
                        Date of Birth <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full shrink-0"></div>
                  Social Profiles
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Link className="w-4 h-4 shrink-0" />
                      LinkedIn URL <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="url"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Portfolio (Optional)
                      </label>
                      <input
                        type="url"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                        value={portfolio}
                        onChange={(e) => setPortfolio(e.target.value)}
                        placeholder="https://yourportfolio.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        GitHub (Optional)
                      </label>
                      <input
                        type="url"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                        value={github}
                        onChange={(e) => setGithub(e.target.value)}
                        placeholder="https://github.com/username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      Instagram (Optional)
                    </label>
                    <input
                      type="url"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="https://instagram.com/username"
                    />
                  </div>
                </div>
              </div>

              {/* Profile Image */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-rose-500 rounded-full shrink-0"></div>
                  Profile Image <span className="text-red-400">*</span>
                </h3>

                <div
                  className="border-2 border-dashed border-slate-600 rounded-2xl p-4 sm:p-6 lg:p-8 text-center cursor-pointer transition-all duration-200 hover:border-indigo-500 hover:bg-slate-900/30 group"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={handleClickUpload}
                >
                  {preview ? (
                    <div className="relative">
                      <img
                        src={preview}
                        className="mx-auto h-32 sm:h-40 lg:h-48 w-32 sm:w-40 lg:w-48 object-cover rounded-xl shadow-lg"
                        alt="Preview"
                      />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white p-1 rounded-full transition-all duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage();
                        }}
                      >
                        <X className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700/50 rounded-2xl mx-auto flex items-center justify-center group-hover:bg-indigo-500/20 transition-all duration-200">
                        <Image className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 group-hover:text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-300">
                          Drop your image here
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          or click to browse
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          Max 5MB • PNG, JPG, JPEG
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files[0])}
                  />
                </div>

                {file && (
                  <div className="mt-4 p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-slate-300 font-medium truncate">
                            {fileInfo.name}
                          </p>
                          <p className="text-slate-500 text-xs">
                            {fileInfo.size}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-300 transition-colors duration-200 shrink-0"
                        onClick={removeImage}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {uploadProgress > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-linear-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-700/50">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 sm:mr-3"></div>
                  <span className="text-sm sm:text-base">Adding Member...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="text-sm sm:text-base">Add New Member</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
