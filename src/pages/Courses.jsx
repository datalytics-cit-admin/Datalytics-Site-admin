import { useEffect, useState } from "react";
import API from "../services/api";
import { getSession } from "../services/session";
import { BookOpen, Plus, Trash2, GraduationCap, Search } from "lucide-react";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null); // Add this

  // Add this state to track current batch
  const [currentBatch, setCurrentBatch] = useState("");

  // Fetch current admin and batch
  useEffect(() => {
    getSession()
      .then((admin) => {
        setCurrentAdmin(admin);
        setCurrentBatch(admin.batch);
      })
      .catch(console.error);
  }, []);

  // Add this function to get the current academic batch
  const getCurrentBatch = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0 = January, 11 = December

    // Academic year typically starts around June/July
    // If it's January-May, current batch is previous year to current year
    // If it's June-December, current batch is current year to next year
    if (currentMonth < 5) {
      // January - May
      return `${currentYear - 1}-${currentYear}`;
    } else {
      // June - December
      return `${currentYear}-${currentYear + 1}`;
    }
  };

  // Update the canAddCourse logic
  const canAddCourse =
    currentAdmin?.role === "superadmin" ||
    (currentAdmin?.role === "admin" &&
      currentAdmin?.batch === getCurrentBatch());

  // Fetch current admin
  useEffect(() => {
    getSession()
      .then(setCurrentAdmin)
      .catch(console.error);
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await API.get("/courses");

      // Filter out "Computing Department" (case-insensitive)
      const filteredCourses = res.data.filter(
        (course) => !course.name.toLowerCase().includes("computing department")
      );

      setCourses(filteredCourses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Check if current admin can delete this course
  const canDeleteCourse = (course) => {
    if (!currentAdmin) return false;

    // Superadmin can always delete
    if (currentAdmin.role === "superadmin") return true;

    // Normal admin can only delete if:
    // 1. They are in current batch AND
    // 2. They created the course
    const isInCurrentBatch = currentAdmin.batch === getCurrentBatch();
    const isCreator =
      course.createdBy && course.createdBy._id === currentAdmin._id;

    return isInCurrentBatch && isCreator;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await API.post("/courses", {
        name,
        createdBy: currentAdmin._id, // Include creator info
      });
      setCourses((prev) => [res.data, ...prev]);
      setName("");
      setMsg("Course Added");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg(err.response?.data?.message || "Error adding course");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    try {
      await API.delete(`/courses/${id}`);
      setCourses((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  // Filter courses based on search term
  const filteredCourses = courses.filter((course) =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full mx-auto px-1 sm:px-2 lg:px-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-linear-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl sm:text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Manage Courses
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Add and manage academic courses
              {currentAdmin?.role !== "superadmin" &&
                " • You can only delete your own courses"}
            </p>
          </div>
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

      {/* Add Course Card */}
      {canAddCourse && (
        <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Plus className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-lg font-semibold text-white">Add New Course</h2>
          </div>

          <form
            onSubmit={handleAdd}
            className="flex flex-col sm:flex-row gap-4"
          >
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Course Name <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                placeholder="e.g., M.Sc. Software Systems"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 sm:self-end">
              <label className="text-sm font-medium text-slate-300 opacity-0 sm:block hidden">
                Action
              </label>
              <button
                type="submit"
                className="w-full sm:w-auto bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 sm:px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="sm:block hidden">Add Course</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Courses List Card */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-400 shrink-0" />
            <h2 className="text-lg font-semibold text-white">All Courses</h2>
            <span className="bg-slate-700/50 text-slate-300 text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full border border-slate-600">
              {filteredCourses.length}{" "}
              {filteredCourses.length === 1 ? "course" : "courses"}
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search courses..."
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2 sm:py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8 sm:py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredCourses.map((c) => (
              <div
                key={c._id}
                className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 sm:p-4 hover:border-slate-600 transition-all duration-200 group hover:transform hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-base sm:text-lg line-clamp-2 mb-1">
                      {c.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Added on : {new Date(c.createdAt).toLocaleDateString()}
                    </p>

                    {/* Updated: Show creator's name and email */}
                    <p className="text-xs text-slate-400">
                      Added by : {c.createdBy?.name || "Unknown"}
                      {c.createdBy?.email && ` (${c.createdBy.email})`}
                    </p>
                  </div>

                  {/* Only show delete button if admin has permission */}
                  {canDeleteCourse(c) && (
                    <button
                      onClick={() => handleDelete(c._id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all duration-200 transform hover:scale-110 opacity-70 group-hover:opacity-100 shrink-0"
                      title="Delete course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700/50 rounded-2xl mx-auto mb-3 sm:mb-4 flex items-center justify-center">
              <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-300 mb-2">
              {searchTerm ? "No courses found" : "No courses yet"}
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xs mx-auto">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Get started by adding your first course"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
