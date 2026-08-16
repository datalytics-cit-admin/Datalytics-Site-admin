import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { getSession } from "../services/session";
import { Calendar, Search, Filter, ChevronDown } from "lucide-react";
import EventCard from "../components/EventCard";
import { useEventStatuses, getStatusLabel } from "../utils/eventStatus";

export default function EventsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const navigate = useNavigate();

  // Live status per event, derived from the event window instead of the status
  // string the server persisted at page-load time. The map keeps its identity
  // until an event actually changes status, so this does not re-render the
  // list every second.
  const statuses = useEventStatuses(events);

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
  const canModifyEvent = useCallback(
    (eventBatch) => {
      if (!currentAdmin) return false;

      // Superadmin can modify anyone
      if (currentAdmin.role === "superadmin") return true;

      // Regular admin can only modify their batch events
      return currentAdmin.batch === eventBatch;
    },
    [currentAdmin]
  );

  const fetchEvents = async () => {
    try {
      // Both at once: the session is usually already cached, and the events
      // request should not wait on it either way.
      const [admin, eventsRes] = await Promise.all([
        getSession(),
        API.get("/events"),
      ]);

      setCurrentAdmin(admin);
      setEvents(eventsRes.data.events);

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

  const handleDelete = useCallback(async (id) => {
    try {
      await API.delete(`/events/${id}`);
      setEvents((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  }, []);

  // Stable identities so memoized cards are not re-rendered by every parent
  // render (a status flip, a keystroke in the search box).
  const handleEdit = useCallback(
    (event) => {
      if (!canModifyEvent(event.batch)) {
        alert("You can only edit events from your own batch");
        return;
      }
      navigate(`/dashboard/events/edit/${event._id}`);
    },
    [canModifyEvent, navigate]
  );

  const handleDeleteWithCheck = useCallback(
    async (event) => {
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
    },
    [canModifyEvent, handleDelete]
  );

  // Get filtered events for current batch
  const currentBatchEvents = useMemo(() => {
    if (!batchFilter) return events;
    return events.filter((e) => e.batch === batchFilter);
  }, [events, batchFilter]);

  // Get unique statuses only from current batch (live, not the stored value)
  const uniqueStatuses = useMemo(
    () =>
      [
        ...new Set(
          currentBatchEvents
            .map((e) => statuses[e._id] || e.status)
            .filter(Boolean)
        ),
      ],
    [currentBatchEvents, statuses]
  );

  const filtered = useMemo(
    () =>
      currentBatchEvents.filter((e) => {
        if (search && !e.name.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (statusFilter && (statuses[e._id] || e.status) !== statusFilter)
          return false;
        return true;
      }),
    [currentBatchEvents, search, statusFilter, statuses]
  );

  // Count events in current batch
  const currentBatchCount = currentBatchEvents.length;

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
                    {getStatusLabel(s)}
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
        {filtered.map((e) => (
          <EventCard
            key={e._id}
            event={e}
            canModify={canModifyEvent(e.batch)}
            onEdit={handleEdit}
            onDelete={handleDeleteWithCheck}
          />
        ))}
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
