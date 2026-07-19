import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import {
  Calendar,
  Search,
  Filter,
  Edit3,
  Trash2,
  MapPin,
  User,
  Clock,
  ChevronDown,
  Plus,
} from "lucide-react";

export default function EventsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(false);

  // Generate batch options and get current batch
  const getCurrentBatch = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11 (Jan=0, Jun=5)
    const currentYear = now.getFullYear();

    // Academic year starts in June (month 5)
    const academicYearStart = currentMonth >= 5 ? currentYear : currentYear - 1;
    const academicYearEnd = academicYearStart + 1;

    return `${academicYearStart}-${academicYearEnd}`;
  };

  const generateBatchOptions = () => {
    const currentYear = new Date().getFullYear();
    const batches = [];

    // Start from 2019, go to current year + 1
    for (let year = 2019; year <= currentYear + 1; year++) {
      batches.push(`${year}-${year + 1}`);
    }

    // Sort in descending order (newest first)
    return batches.sort((a, b) => {
      const yearA = parseInt(a.split("-")[0]);
      const yearB = parseInt(b.split("-")[0]);
      return yearB - yearA;
    });
  };

  // Check if current admin can edit/delete an event
  const canModifyEvent = (eventBatch) => {
    if (!currentAdmin) return false;

    // Superadmin can modify anyone
    if (currentAdmin.role === "superadmin") return true;

    // Regular admin can only modify their batch events
    return currentAdmin.batch === eventBatch;
  };

  const fetchEvents = async () => {
    try {
      // Get current admin info first
      const adminRes = await API.get("/admin/me");
      setCurrentAdmin(adminRes.data.admin);

      // Then fetch events
      const eventsRes = await API.get("/events");
      const data = eventsRes.data.events;
      setEvents(data);

      setBatchFilter(getCurrentBatch());
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDelete = async (id) => {
    try {
      await API.delete(`/events/${id}`);
      setEvents((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const handleEdit = (event) => {
    if (!canModifyEvent(event.batch)) {
      alert("You can only edit events from your own batch");
      return;
    }
    navigate(`/dashboard/events/edit/${event._id}`);
  };

  const handleDeleteWithCheck = async (event) => {
    if (!canModifyEvent(event.batch)) {
      alert("You can only delete events from your own batch");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${event.name}"?`)) return;

    try {
      await handleDelete(event._id);
    } catch (err) {
      if (err.response?.status === 403) {
        alert("Permission denied: " + err.response.data.message);
      } else {
        alert(err.response?.data?.message || "Delete failed");
      }
    }
  };

  const uniqueBatches = useMemo(
    () => [...new Set(events.map((e) => e.batch).filter(Boolean))],
    [events]
  );

  // Get filtered events for current batch
  const currentBatchEvents = useMemo(() => {
    if (!batchFilter) return events;
    return events.filter((e) => e.batch === batchFilter);
  }, [events, batchFilter]);

  // Get unique statuses only from current batch
  const uniqueStatuses = useMemo(
    () => [...new Set(currentBatchEvents.map((e) => e.status).filter(Boolean))],
    [currentBatchEvents]
  );

  const filtered = currentBatchEvents.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  // Count events in current batch
  const currentBatchCount = currentBatchEvents.length;

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "upcoming":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "ongoing":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "completed":
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
      case "cancelled":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Title and Current Batch */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:gap-30">
          {/* Events Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Club Events
              </h1>
            </div>
          </div>

          {/* Current Batch - Moved closer to title */}
          <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-4 py-2 shadow-lg w-full sm:w-fit min-w-[280px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-linear-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Selected Batch</p>
                  <p className="text-sm md:text-lg font-bold text-white">
                    {batchFilter || "All Batches"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {currentBatchCount}
                </p>
                <p className="text-sm text-slate-400">events</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Total Events and Add Button */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Total Events */}
          <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-4 py-2 shadow-lg w-full sm:w-fit">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-linear-to-r from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Events</p>
                <p className="text-2xl font-bold text-white">{events.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 py-4 shadow-xl">
        {/* Header with Toggle Button for Mobile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-indigo-400" />
            <h2 className="text-3sm md:text-lg font-semibold text-white">
              Filters & Search
            </h2>
          </div>

          {/* Mobile Toggle Button */}
          <button
            className="md:hidden p-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-lg transition-all duration-200"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          >
            <ChevronDown
              className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${
                isFiltersOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Filters Content - Hidden on mobile by default */}
        <div className={`mt-4 ${isFiltersOpen ? "block" : "hidden md:block"}`}>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Batch Filter */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Batch
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  // Reset other filters when batch changes
                  setStatusFilter("");
                }}
              >
                <option value="" className="bg-slate-800 text-slate-300">
                  All Batches
                </option>
                {generateBatchOptions().map((b) => (
                  <option key={b} value={b} className="bg-slate-800 text-white">
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Status
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="" className="bg-slate-800 text-slate-300">
                  All Status
                </option>
                {uniqueStatuses.map((s) => (
                  <option key={s} value={s} className="bg-slate-800 text-white">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Search - Takes 2 columns */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Search
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="Search by event name, venue, speaker..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {(batchFilter || statusFilter || search) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all duration-200 text-sm font-medium"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Event Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {filtered.map((e) => {
          const canModify = canModifyEvent(e.batch);
          return (
            <div
              key={e._id}
              className={`bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-[1.02] group`}
            >
              {/* Event Image */}
              <div className="relative">
                <img
                  src={e.image}
                  alt={e.name}
                  className="w-full h-70 object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent"></div>

                {/* Event Name Only */}
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="text-lg font-bold text-white text-left line-clamp-1">
                    {e.name}
                  </h3>
                </div>
              </div>

              {/* Event Details */}
              <div className="p-4 space-y-4">
                {/* Status & Batch Badges - Below Image */}
                <div className="flex items-center justify-between">
                  {/* Status Badge */}
                  <div
                    className={`px-3 py-1 rounded-lg border text-xs font-semibold ${getStatusColor(
                      e.status
                    )}`}
                  >
                    {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                  </div>

                  {/* Batch Badge */}
                  <div className="px-3 py-1 bg-slate-700/50 rounded-lg text-xs font-semibold text-slate-300">
                    {e.batch}
                  </div>
                </div>

                {/* Date & Time - Equal Alignment */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{formatDate(e.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{e.time}</span>
                  </div>
                </div>

                {/* Venue - Full Width */}
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="line-clamp-1">{e.venue}</span>
                </div>

                {/* Speaker - Full Width */}
                {e.speaker && (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="line-clamp-1">{e.speaker}</span>
                  </div>
                )}

                <div className="relative">
                  <div
                    className={`text-sm text-slate-400 leading-relaxed whitespace-pre-wrap transition-all duration-300 ${
                      expanded ? "max-h-none" : "max-h-20 overflow-hidden"
                    }`}
                  >
                    {e.description}
                  </div>

                  {/* Gradient fade when collapsed */}
                  {!expanded && e.description.length > 150 && (
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-linear-to-t from-slate-900 via-slate-900/80 to-transparent pointer-events-none"></div>
                  )}

                  {/* Show more/less button */}
                  {e.description.length > 150 && (
                    <div className="flex justify-start mt-2">
                      <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 text-xs font-medium px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 rounded-lg transition-all duration-200 hover:scale-105"
                      >
                        {expanded ? (
                          <>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                            Show less
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                            Show more
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Created/Updated Info - Equal Alignment */}
                <div className="flex items-start justify-between text-[11px] text-slate-500 leading-tight space-y-1">
                  {/* Left - Created By */}
                  <div className="flex-1">
                    {e.createdBy && (
                      <div>
                        <div>
                          <span className="text-slate-400">Created: </span>
                          <span className="text-slate-300">
                            {e.createdBy.name || "Unknown"}
                          </span>
                        </div>
                        {e.createdBy.email && (
                          <div className="text-slate-400 line-clamp-1">
                            {e.createdBy.email}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right - Updated By */}
                  <div className="flex-1 text-right">
                    {e.updatedBy && (
                      <div>
                        <div>
                          <span className="text-slate-400">Updated: </span>
                          <span className="text-slate-300">
                            {e.updatedBy.name || "Unknown"}
                          </span>
                        </div>
                        {e.updatedBy.email && (
                          <div className="text-slate-400 line-clamp-1">
                            {e.updatedBy.email}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-slate-700/50">
                  {canModify ? (
                    <>
                      <button
                        onClick={() => handleEdit(e)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 text-sm font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteWithCheck(e)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 text-sm font-medium border bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/30"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleEdit(e)}
                      className="flex-1 flex items-center justify-center gap-2 py-1 px-2 rounded-lg transition-all duration-200 text-xs font-medium bg-slate-800/30 text-slate-500 cursor-not-allowed"
                      disabled
                    >
                      View Only
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-slate-700/50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <Calendar className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-300 mb-3">
            No events found
          </h3>
          <p className="text-slate-400 max-w-md mx-auto mb-6">
            {search || statusFilter
              ? "Try adjusting your filters to see more results"
              : batchFilter
              ? `No events found in ${batchFilter} batch`
              : "No events have been added yet. Get started by adding your first event!"}
          </p>
          {(search || statusFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
              className=" bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 px-6 py-2 rounded-xl transition-all duration-200"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
