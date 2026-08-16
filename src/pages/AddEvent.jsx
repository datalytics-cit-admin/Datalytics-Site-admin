import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { getSession } from "../services/session";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Image,
  Upload,
  X,
} from "lucide-react";

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AddEvent() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    batch: "",
    date: getTodayDate(),
    fromTime: "17:00", // 5:00 PM
    toTime: "18:00", // 6:00 PM
    venue: "",
    speaker: "",
    description: "",
    status: "upcoming",
  });

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [fileInfo, setFileInfo] = useState({ name: "", size: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [me, setMe] = useState(null);

  const fileInputRef = useRef(null);

  // Batch options based on admin role
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
      // Regular admin: Show only current batch
      const currentBatch = `${currentYear}-${currentYear + 1}`;
      arr.push(currentBatch);
    }

    return arr.sort((a, b) => parseInt(b) - parseInt(a));
  }, [me?.role]);

  // Status options
  const statusOptions = [
    { value: "upcoming", label: "Upcoming" },
    { value: "ongoing", label: "Ongoing" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  // Fetch logged-in admin
  useEffect(() => {
    getSession()
      .then(setMe)
      .catch(() => {});
  }, []);

  // Set default batch based on admin role
  useEffect(() => {
    if (!me) return;

    const currentYear = new Date().getFullYear();
    const currentBatch = `${currentYear}-${currentYear + 1}`;

    setForm((prev) => ({
      ...prev,
      batch: currentBatch,
      status: "upcoming",
      fromTime: "17:00",
      toTime: "18:00",
    }));
  }, [me]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Format time to 12-hour format with AM/PM
  const formatTimeForDisplay = (timeString) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  // Combine fromTime and toTime into a single string
  const getCombinedTime = () => {
    if (form.fromTime && form.toTime) {
      return `${formatTimeForDisplay(form.fromTime)} - ${formatTimeForDisplay(
        form.toTime
      )}`;
    }
    return "";
  };

  // Handle file selection
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

  // Remove selected image
  const removeImage = () => {
    setFile(null);
    setPreview("");
    setFileInfo({ name: "", size: "" });
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // Submit form
  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    // Validation
    if (!file) {
      setMsg("Please select an event image");
      setLoading(false);
      return;
    }

    if (
      !form.name ||
      !form.batch ||
      !form.date ||
      !form.fromTime ||
      !form.toTime ||
      !form.venue ||
      !form.description
    ) {
      setMsg("Please fill all required fields");
      setLoading(false);
      return;
    }

    // Validate date is not in the past
    const eventDate = new Date(form.date);
    if (eventDate < new Date().setHours(0, 0, 0, 0)) {
      setMsg("Event date cannot be in the past");
      setLoading(false);
      return;
    }

    // Validate time range
    if (form.fromTime >= form.toTime) {
      setMsg("End time must be after start time");
      setLoading(false);
      return;
    }

    try {
      const fd = new FormData();

      // Append all form fields
      Object.keys(form).forEach((key) => {
        if (key === "fromTime" || key === "toTime") {
          // Skip individual time fields, we'll append combined time
          return;
        }
        fd.append(key, form[key]);
      });

      // Append combined time string
      fd.append("time", getCombinedTime());

      // Append image file
      fd.append("image", file);

      const res = await API.post("/events", fd);

      setMsg("Event Created");

      // Redirect to events list after success
      setTimeout(() => {
        navigate("/dashboard/events");
      }, 1500);
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  // Check if form can be submitted
  const canSubmit =
    file &&
    form.name &&
    form.batch &&
    form.date &&
    form.fromTime &&
    form.toTime &&
    form.venue &&
    form.description;

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-4 mb-6 sm:mb-8">
        {/* Mobile: Two rows */}
        <div className="sm:hidden space-y-4">
          {/* Row 1: Back button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/dashboard/events")}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl transition-all duration-200 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-medium">Back to Events</span>
            </button>
          </div>

          {/* Row 2: Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Create New Event
              </h1>
              <p className="text-xs text-slate-400">
                Add a new event to the calendar
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: Single row with back button on left and title centered */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Back button on left */}
          <button
            onClick={() => navigate("/dashboard/events")}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl transition-all duration-200 group shrink-0"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium">Back to Events</span>
          </button>

          {/* Title centered in remaining space */}
          <div className="flex-1 flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Create New Event
              </h1>
              <p className="text-sm text-slate-400">
                Add a new event to the calendar
              </p>
            </div>
          </div>

          {/* Empty div for balance */}
          <div className="w-32 shrink-0"></div>
        </div>
      </div>

      {/* Message */}
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

      {/* Form */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Basic Info */}
            <div className="space-y-6">
              {/* Event Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Event Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter event name"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                />
              </div>

              {/* Batch */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Batch <span className="text-red-400">*</span>
                </label>
                <select
                  className={`w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 ${
                    me?.role !== "superadmin"
                      ? "cursor-not-allowed opacity-70"
                      : ""
                  }`}
                  value={form.batch}
                  onChange={(e) => handleInputChange("batch", e.target.value)}
                  required
                  disabled={me?.role !== "superadmin"}
                >
                  <option value="" className="bg-slate-800">
                    Select Batch
                  </option>
                  {batchOptions.map((batch) => (
                    <option key={batch} value={batch} className="bg-slate-800">
                      {batch}
                    </option>
                  ))}
                </select>
                {me?.role !== "superadmin" && (
                  <p className="text-xs text-slate-400">
                    Add only events for current batch
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 scheme-dark"
                  value={form.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              {/* Time Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Time Range <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      From
                    </label>
                    <input
                      type="time"
                      className="w-full scheme-dark bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                      value={form.fromTime}
                      onChange={(e) =>
                        handleInputChange("fromTime", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      To
                    </label>
                    <input
                      type="time"
                      className="w-full scheme-dark bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                      value={form.toTime}
                      onChange={(e) =>
                        handleInputChange("toTime", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
                {/* {form.fromTime && form.toTime && (
                  <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <strong>Selected Time:</strong> {getCombinedTime()}
                  </div>
                )} */}
              </div>

              {/* Venue */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Venue <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter event venue"
                  value={form.venue}
                  onChange={(e) => handleInputChange("venue", e.target.value)}
                  required
                />
              </div>

              {/* Speaker */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Speaker (Optional)
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter speaker name"
                  value={form.speaker}
                  onChange={(e) => handleInputChange("speaker", e.target.value)}
                />
              </div>
            </div>

            {/* Right Column - Image and Additional Info */}
            <div className="space-y-6">
              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Status <span className="text-red-400">*</span>
                </label>
                <select
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                  value={form.status}
                  onChange={(e) => handleInputChange("status", e.target.value)}
                  required
                >
                  {statusOptions.map((status) => (
                    <option
                      key={status.value}
                      value={status.value}
                      className="bg-slate-800"
                    >
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 resize-none"
                  placeholder="Describe the event..."
                  value={form.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  required
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Event Image <span className="text-red-400">*</span>
                </label>

                <div
                  className={`border-2 border-dashed rounded-2xl p-3 text-center cursor-pointer transition-all duration-300 ${
                    isDragging
                      ? "border-indigo-500 bg-slate-900/40"
                      : preview
                      ? "border-2 border-indigo-500 bg-slate-900/30" // Added border and background when image selected
                      : "border-slate-600 hover:border-indigo-500 hover:bg-slate-900/30"
                  }`}
                  onClick={() => fileInputRef.current.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {preview ? (
                    <div className="relative">
                      <img
                        src={preview}
                        alt="Preview"
                        className="mx-auto h-60 w-full object-cover rounded-xl shadow-md" // Added border to image
                      />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-red-500 p-1 rounded-full hover:bg-red-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage();
                        }}
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                      <div className="mt-2 text-xs text-slate-400">
                        {fileInfo.name} • {fileInfo.size}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="w-8 h-8 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-400">
                          Drag & drop or click to upload
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Max 5MB • JPG, PNG, JPEG
                        </p>
                      </div>
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
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-700/50">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] ${
                canSubmit && !loading
                  ? "bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                  Creating Event...
                </div>
              ) : (
                "Create Event"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
