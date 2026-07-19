// admin/src/components/DashboardLayout.jsx
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  BadgeCheck,
  BookOpen,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Settings,
  User,
  Lock,
} from "lucide-react";
import { useState, useEffect } from "react";
import API from "../services/api";

export default function DashboardLayout({ setAuthed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [me, setMe] = useState(null);

  // Function to get current batch based on academic year (June to June)
  const getCurrentBatch = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11 (Jan=0, Jun=5)
    const currentYear = now.getFullYear();

    // Academic year starts in June (month 5)
    const academicYearStart = currentMonth >= 5 ? currentYear : currentYear - 1;
    const academicYearEnd = academicYearStart + 1;

    return `${academicYearStart}-${academicYearEnd}`;
  };

  const [currentBatch, setCurrentBatch] = useState(getCurrentBatch());

  // Check if admin has permission to add members/events
  const canAddContent = () => {
    if (!me) return false;

    // Superadmins can always add content
    if (me.role === "superadmin") return true;

    // Normal admins can only add content if they're in the current batch
    return me.batch === currentBatch;
  };

  // Update current batch every minute (optional, or remove if not needed)
  useEffect(() => {
    setCurrentBatch(getCurrentBatch());

    // Update batch every minute (optional - remove if you don't need real-time updates)
    const interval = setInterval(() => {
      setCurrentBatch(getCurrentBatch());
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    API.get("/admin/me")
      .then((res) => setMe(res.data.admin))
      .catch(() => {});
  }, []);

  useEffect(() => {
     if (open) {
       document.body.style.overflow = "hidden";
     } else {
       document.body.style.overflow = "unset";
     }

     return () => {
       document.body.style.overflow = "unset";
     };
   }, [open]);

  const logout = async () => {
    try {
      await API.post("/admin/logout");
    } catch (_) {
    } finally {
      setAuthed(false);
      navigate("/login");
    }
  };

  const isActive = (path) =>
    location.pathname === path
      ? "bg-linear-to-r from-indigo-600 to-blue-500 text-white shadow-md"
      : "text-slate-300 hover:bg-slate-800/60 hover:text-white";

  const isManagementActive = () =>
    location.pathname.includes("/dashboard/roles") ||
    location.pathname.includes("/dashboard/courses") ||
    location.pathname.includes("/dashboard/admins");

  const isMemberActive = () =>
    location.pathname === "/dashboard" ||
    location.pathname === "/dashboard/add-member" ||
    location.pathname.startsWith("/dashboard/edit/");

  const isEventActive = () => location.pathname.includes("/dashboard/events");

  // Function to handle restricted link clicks
  const handleRestrictedClick = (e, message) => {
    e.preventDefault();
    alert(message);
  };

  // Toggle handlers ensuring only one drawer is open at a time and navigates to the first page if collapsed
  const toggleMembers = () => {
    if (!membersOpen) {
      navigate("/dashboard");
    } else {
      setMembersOpen(false);
    }
  };

  const toggleEvents = () => {
    if (!eventsOpen) {
      navigate("/dashboard/events");
    } else {
      setEventsOpen(false);
    }
  };

  const toggleManagement = () => {
    if (!managementOpen) {
      navigate("/dashboard/roles");
    } else {
      setManagementOpen(false);
    }
  };

  // Open drawer based on current page automatically, and close others
  useEffect(() => {
    if (isMemberActive()) {
      setMembersOpen(true);
      setEventsOpen(false);
      setManagementOpen(false);
    } else if (isEventActive()) {
      setMembersOpen(false);
      setEventsOpen(true);
      setManagementOpen(false);
    } else if (isManagementActive()) {
      setMembersOpen(false);
      setEventsOpen(false);
      setManagementOpen(true);
    } else {
      setMembersOpen(false);
      setEventsOpen(false);
      setManagementOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-950 to-black text-slate-100 flex">
      {/* Sidebar */}
      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } fixed md:relative top-0 left-0 h-full w-64 md:w-68 lg:w-70 z-40 transition-all duration-300
        bg-slate-950/80 backdrop-blur-xl border-r border-slate-800/50 flex flex-col shadow-2xl md:translate-x-0`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-800/50">
          <div className="flex items-center gap-3 mb-3">
            <img
              src="/datalyticscit_logo.png"
              alt="Club Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain"
            />
            <div>
              <h1 className="text-lg sm:text-xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Datalytics
              </h1>
              <p className="text-xs text-slate-400">Management Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
          {/* Members Dropdown */}
          <div className="pt-2">
            <button
              onClick={toggleMembers}
              className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-all duration-200 group ${
                isMemberActive()
                  ? "bg-slate-800/60 text-white"
                  : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-medium text-sm sm:text-base">
                  Members
                </span>
              </div>

              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  membersOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {membersOpen && (
              <div className="mt-1 ml-3 sm:ml-4 space-y-1 border-l border-slate-700/50 pl-2 sm:pl-3 py-2">
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 ${
                    location.pathname === "/dashboard"
                      ? "bg-indigo-500/20 text-indigo-300 border-l-2 border-indigo-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-sm">Members List</span>
                </Link>

                {canAddContent() ? (
                  <Link
                    to="/dashboard/add-member"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 ${
                      location.pathname === "/dashboard/add-member"
                        ? "bg-indigo-500/20 text-indigo-300 border-l-2 border-indigo-400"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="text-sm">Add Member</span>
                  </Link>
                ) : (
                  <button
                    onClick={(e) =>
                      handleRestrictedClick(
                        e,
                        "Only current batch admins can add new members. Please contact a superadmin or current batch admin."
                      )
                    }
                    className="flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 text-slate-500 hover:text-slate-400 hover:bg-slate-800/20 w-full text-left cursor-not-allowed"
                    disabled
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-sm">Add Member</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Events Dropdown */}
          <div className="pt-2">
            <button
              onClick={toggleEvents}
              className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-all duration-200 group ${
                isEventActive()
                  ? "bg-slate-800/60 text-white"
                  : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-medium text-sm sm:text-base">Events</span>
              </div>

              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  eventsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {eventsOpen && (
              <div className="mt-1 ml-3 sm:ml-4 space-y-1 border-l border-slate-700/50 pl-2 sm:pl-3 py-2">
                <Link
                  to="/dashboard/events"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 ${
                    location.pathname === "/dashboard/events"
                      ? "bg-indigo-500/20 text-indigo-300 border-l-2 border-indigo-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="text-sm">Event List</span>
                </Link>

                {canAddContent() ? (
                  <Link
                    to="/dashboard/events/add"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 ${
                      location.pathname === "/dashboard/events/add"
                        ? "bg-indigo-500/20 text-indigo-300 border-l-2 border-indigo-400"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="text-sm">Add Event</span>
                  </Link>
                ) : (
                  <button
                    onClick={(e) =>
                      handleRestrictedClick(
                        e,
                        "Only current batch admins can add new events. Please contact a superadmin or current batch admin."
                      )
                    }
                    className="flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 text-slate-500 hover:text-slate-400 hover:bg-slate-800/20 w-full text-left cursor-not-allowed"
                    disabled
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-sm">Add Event</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Management Dropdown */}
          <div className="pt-4">
            <button
              onClick={toggleManagement}
              className={`w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-all duration-200 group ${
                isManagementActive()
                  ? "bg-slate-800/60 text-white"
                  : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 flex items-center justify-center">
                  <Settings className="w-4 h-4 transition-transform group-hover:scale-110" />
                </div>
                <span className="font-medium text-sm sm:text-base">
                  Management
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  managementOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Content */}
            {managementOpen && (
              <div className="mt-1 ml-3 sm:ml-4 space-y-1 border-l border-slate-700/50 pl-2 sm:pl-3 py-2">
                <Link
                  to="/dashboard/roles"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 group ${
                    location.pathname.includes("/dashboard/roles")
                      ? "bg-indigo-500/20 text-indigo-300 border-l-2 border-indigo-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <BadgeCheck className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span className="text-sm">Manage Roles</span>
                </Link>

                <Link
                  to="/dashboard/courses"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 group ${
                    location.pathname.includes("/dashboard/courses")
                      ? "bg-indigo-500/20 text-indigo-300 border-l-2 border-indigo-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span className="text-sm">Manage Courses</span>
                </Link>

                <Link
                  to="/dashboard/admins"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 group ${
                    location.pathname.includes("/dashboard/admins")
                      ? "bg-indigo-500/20 text-indigo-300 border-l-2 border-indigo-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span className="text-sm">Manage Admins</span>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800/50">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 sm:py-3 px-3 sm:px-4 rounded-xl bg-linear-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 transition-all duration-200 transform hover:scale-[1.02] font-medium text-sm shadow-lg group"
          >
            <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="border-b border-slate-800/50 bg-slate-950/30 backdrop-blur-lg px-5 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <h2 className="text-2xl sm:text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Dashboard
            </h2>

            {/* Current Batch in Header */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/30 border border-slate-700/50 px-2 sm:px-3 py-1 rounded-lg">
              <span className="text-xs text-slate-400">Batch:</span>
              <span className="text-sm font-semibold text-white">
                {currentBatch}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Profile section on right */}
            {me && (
              <div className="hidden sm:flex items-center gap-2 sm:gap-3 bg-slate-800/50 border border-slate-700/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />

                <div className="text-left">
                  <p className="text-sm font-semibold text-white">{me.name}</p>
                  <p className="text-xs text-slate-400">{me.email}</p>
                  <p className="text-xs text-slate-400">{me.batch}</p>
                </div>

                {/* Role badge */}
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                    me.role === "superadmin"
                      ? "bg-yellow-500/20 text-yellow-300"
                      : me.batch === currentBatch
                      ? "bg-green-500/20 text-green-300"
                      : "bg-slate-500/20 text-slate-300"
                  }`}
                >
                  {me.role === "superadmin"
                    ? "Super Admin"
                    : me.batch === currentBatch
                    ? "Current Batch Admin"
                    : "Admin ( no access )"}
                </span>
              </div>
            )}

            {/* Mobile Profile Info */}
            {me && (
              <div className="sm:hidden flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 px-2 py-1 rounded-lg">
                <User className="w-4 h-4 text-indigo-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">
                    {me.role === "superadmin" ? me.name : "Admin"}
                  </span>
                  <span
                    className={`text-xs font-semibold px-1.5 py-0.3 rounded ${
                      me.role === "superadmin"
                        ? "bg-yellow-500/20 text-yellow-300"
                        : me.batch === currentBatch
                        ? "bg-green-500/20 text-green-300"
                        : "bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {me.role === "superadmin" ? "Super Admin" : "Admin"}
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Sidebar Toggle */}
            <button
              className="md:hidden p-1.5 sm:p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-700/50 transition-all duration-200"
              onClick={() => setOpen(!open)}
            >
              {open ? (
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
              ) : (
                <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 bg-linear-to-br from-slate-900/20 via-slate-950/20 to-black/20 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
