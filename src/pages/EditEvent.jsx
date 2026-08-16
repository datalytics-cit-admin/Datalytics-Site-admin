import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Save,
} from "lucide-react";

// Helper function to get today's date in local timezone
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function EditEvent() {
  const { id } = useParams();
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

  const [original, setOriginal] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [fileInfo, setFileInfo] = useState({ name: "", size: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  // Fetch logged-in admin and event data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current admin
        setMe(await getSession());

        // Get event data
        const eventRes = await API.get(`/events/${id}`);
        const event = eventRes.data.event;

        // Format date for input
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toISOString().split("T")[0];

        // Parse time range (e.g., "5:00 PM - 6:00 PM" to fromTime and toTime)
        let fromTime = "17:00";
        let toTime = "18:00";

        if (event.time && event.time.includes("-")) {
          const timeParts = event.time.split("-").map((part) => part.trim());
          if (timeParts.length === 2) {
            // Convert 12-hour format to 24-hour format for time inputs
            const convertTo24Hour = (time12h) => {
              const [time, modifier] = time12h.split(" ");
              let [hours, minutes] = time.split(":");

              if (hours === "12") {
                hours = "00";
              }

              if (modifier === "PM") {
                hours = parseInt(hours, 10) + 12;
              }

              return `${String(hours).padStart(2, "0")}:${minutes}`;
            };

            try {
              fromTime = convertTo24Hour(timeParts[0]);
              toTime = convertTo24Hour(timeParts[1]);
            } catch (error) {
              console.error("Error parsing time:", error);
              // Keep default times if parsing fails
            }
          }
        }

        const eventData = {
          name: event.name || "",
          batch: event.batch || "",
          date: formattedDate,
          fromTime: fromTime,
          toTime: toTime,
          venue: event.venue || "",
          speaker: event.speaker || "",
          description: event.description || "",
          status: event.status || "upcoming",
        };

        setForm(eventData);
        setOriginal(eventData);

        // Set preview if image exists
        if (event.image) {
          setPreview(event.image);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading event data:", err);
        setMsg("Failed to load event data");
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

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
    // Keep the original image URL for preview if it exists
    if (original.image) {
      setPreview(original.image);
    }
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

  // Check if form has changes
  const hasChanges = () => {
    const formChanged = Object.keys(form).some(
      (key) => form[key] !== original[key]
    );
    return formChanged || file !== null;
  };

  // Get field border color based on changes
  const getFieldBorderClass = (field, originalField) =>
    form[field] !== originalField
      ? "border-yellow-400 ring-2 ring-yellow-400/20"
      : "border-slate-700";

  // Submit form
  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setSaving(true);

    // Validation
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
      setSaving(false);
      return;
    }

    // Validate date is not in the past
    const eventDate = new Date(form.date);
    if (eventDate < new Date().setHours(0, 0, 0, 0)) {
      setMsg("Event date cannot be in the past");
      setSaving(false);
      return;
    }

    // Validate time range
    if (form.fromTime >= form.toTime) {
      setMsg("End time must be after start time");
      setSaving(false);
      return;
    }

    try {
      const fd = new FormData();

      // Append all form fields (except individual time fields)
      Object.keys(form).forEach((key) => {
        if (key === "fromTime" || key === "toTime") {
          // Skip individual time fields, we'll append combined time
          return;
        }
        if (form[key] !== original[key] || key === "batch") {
          fd.append(key, form[key]);
        }
      });

      // Append combined time string
      fd.append("time", getCombinedTime());

      // Append image file if changed
      if (file) {
        fd.append("image", file);
      }

      await API.put(`/events/${id}`, fd);

      setMsg("Event Updated");

      // Redirect to events list after success
      setTimeout(() => {
        navigate("/dashboard/events");
      }, 1500);
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading event data...</p>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="w-10 h-10 bg-linear-to-r from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Edit Event
              </h1>
              <p className="text-xs text-slate-400">Update event information</p>
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
            <div className="w-10 h-10 bg-linear-to-r from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Edit Event
              </h1>
              <p className="text-sm text-slate-400">Update event information</p>
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
            msg.includes("Updated")
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
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 ${getFieldBorderClass(
                    "name",
                    original.name
                  )}`}
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
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 ${
                    me?.role !== "superadmin"
                      ? "cursor-not-allowed opacity-70"
                      : ""
                  } ${getFieldBorderClass("batch", original.batch)}`}
                  value={form.batch}
                  onChange={(e) => handleInputChange("batch", e.target.value)}
                  required
                  disabled={me?.role !== "superadmin"} // Lock for normal admins
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
                    Batch can't be modified
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
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 scheme-dark ${getFieldBorderClass(
                    "date",
                    original.date
                  )}`}
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
                      className={`w-full scheme-dark bg-slate-900/50 border rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 ${getFieldBorderClass(
                        "fromTime",
                        original.fromTime
                      )}`}
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
                      className={`w-full scheme-dark bg-slate-900/50 border rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 ${getFieldBorderClass(
                        "toTime",
                        original.toTime
                      )}`}
                      value={form.toTime}
                      onChange={(e) =>
                        handleInputChange("toTime", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Venue */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Venue <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 ${getFieldBorderClass(
                    "venue",
                    original.venue
                  )}`}
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
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 ${getFieldBorderClass(
                    "speaker",
                    original.speaker
                  )}`}
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
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 ${getFieldBorderClass(
                    "status",
                    original.status
                  )}`}
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
                  className={`w-full h-32 bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300 resize-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${getFieldBorderClass(
                    "description",
                    original.description
                  )}`}
                  placeholder="Describe the event..."
                  value={form.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData("text/plain");
                    document.execCommand("insertText", false, text);
                  }}
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
                      ? "border-yellow-500 bg-slate-900/40"
                      : file !== null
                      ? "border-yellow-400 ring-2 ring-yellow-400/20"
                      : "border-slate-600 hover:border-yellow-500 hover:bg-slate-900/30"
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
                        className="mx-auto h-60 w-full object-cover rounded-xl shadow-md"
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
                      {file && (
                        <div className="mt-2 text-xs text-yellow-400">
                          New image selected: {fileInfo.name} • {fileInfo.size}
                        </div>
                      )}
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
                {!file && preview && (
                  <p className="text-xs text-slate-400">
                    Current event image will be kept unless you upload a new one
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-700/50">
            <button
              type="submit"
              disabled={!hasChanges() || saving}
              className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] ${
                hasChanges() && !saving
                  ? "bg-linear-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white shadow-lg"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                  Updating Event...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Save className="w-5 h-5 mr-2" />
                  {hasChanges() ? "Save Changes" : "No Changes Made"}
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
