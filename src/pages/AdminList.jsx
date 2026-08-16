// admin/src/pages/AdminList.jsx
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { getSession } from "../services/session";
import {
  Users,
  Search,
  Filter,
  Edit3,
  Trash2,
  Mail,
  Phone,
  User,
  Shield,
  Crown,
  ChevronDown,
  BookOpen,
  Hash,
} from "lucide-react";

export default function AdminList() {
  const [admins, setAdmins] = useState([]);
  const [myRole, setMyRole] = useState("");
  const [myBatch, setMyBatch] = useState("");
  const [myId, setMyId] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const navigate = useNavigate();

  // Batch options for current and next batches
  const batchOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const arr = [];

    // Start from 2019 up to current year + 1 (next batch)
    const startYear = 2024;
    for (let i = startYear; i <= currentYear + 1; i++) {
      arr.push(`${i}-${i + 1}`);
    }

    return arr.sort((a, b) => parseInt(b) - parseInt(a));
  }, []);

  // Set current batch on component mount
  // useEffect(() => {
  //   const currentBatch = `${new Date().getFullYear()}-${
  //     new Date().getFullYear() + 1
  //   }`;
  //   setBatchFilter(currentBatch);
  // }, []);

  const fetchAdmins = async () => {
    try {
      const res = await API.get("/admin/all");
      setAdmins(res?.data?.admins || []);
    } catch (err) {
      console.error(err);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyDetails = async () => {
    try {
      const admin = await getSession();
      setMyRole(admin.role);
      setMyBatch(admin.batch);
      setMyId(admin._id); // Store current user's ID
    } catch (err) {
      console.error("Failed to fetch user details:", err);
    }
  };

  const deleteAdmin = async (id) => {
    if (!confirm("Are you sure you want to delete this admin?")) return;
    try {
      await API.delete(`/admin/delete/${id}`);
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchMyDetails();
  }, []);

  // Check if current user can edit/delete a specific admin
  // These MIRROR server/utils/adminPermissions.js#canManageAdmin. The server is
  // authoritative and returns 403 regardless; this only decides which buttons
  // are offered. Keep the two in sync.
  //
  //  1. Nobody may delete their own account — superadmin included.
  //  2. Superadmin has full control over every other record.
  //  3. A regular admin may act only on admins they personally created.
  //  4. Therefore previous boards' admins are read-only to the current board.
  //  5. A regular admin may still edit (not delete) their own profile.

  const canEditAdmin = (targetAdmin) => {
    if (myRole === "superadmin") return true;

    if (myRole === "admin") {
      if (targetAdmin._id === myId) return true;      // own profile
      return checkIfCreatedByMe(targetAdmin);          // only admins they created
    }

    return false;
  };

  const canDeleteAdmin = (targetAdmin) => {
    // Rule 1 — nobody deletes themselves, whatever their role.
    if (targetAdmin._id === myId) return false;

    if (myRole === "superadmin") return true;

    if (myRole === "admin") {
      return checkIfCreatedByMe(targetAdmin);
    }

    return false;
  };

  // Helper function to check if current user created the admin
  const checkIfCreatedByMe = (targetAdmin) => {
    // Approach 1: Check by createdBy field (if it contains user ID)
    if (targetAdmin.createdBy?._id === myId || targetAdmin.createdBy === myId) {
      return true;
    }

    // Approach 2: Check if createdBy contains current user's name/email
    // You might need to adjust this based on your actual data structure
    const myDetails = admins.find((admin) => admin._id === myId);
    if (myDetails && targetAdmin.createdBy === myDetails.name) {
      return true;
    }

    // Approach 3: Check if createdBy contains current user's email
    if (myDetails && targetAdmin.createdBy === myDetails.email) {
      return true;
    }

    return false;
  };

  // Check if admin is active based on batch
  const isAdminActive = (admin) => {
    // Super admins are always active
    if (admin.role === "superadmin") return true;

    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11 (Jan=0, Jun=5)
    const currentYear = now.getFullYear();

    const adminBatchStartYear = parseInt(admin.batch?.split("-")[0]);

    // Current academic year starts in June (month 5)
    const currentAcademicYearStart =
      currentMonth >= 5 ? currentYear : currentYear - 1;

    return adminBatchStartYear === currentAcademicYearStart;
  };

  // Check if current user can create admin in a specific batch
  const canCreateInBatch = (batch) => {
    if (myRole === "superadmin") return true;
    if (myRole === "admin") {
      const myBatchYear = parseInt(myBatch?.split("-")[0]);
      const targetBatchYear = parseInt(batch?.split("-")[0]);

      // Admin can only create in next batch (X+1)
      const canCreateInThisBatch = targetBatchYear === myBatchYear + 1;

      if (!canCreateInThisBatch) return false;

      // Check if admin has already created an admin in this batch
      const hasCreatedInBatch = checkIfAlreadyCreatedInBatch(batch);

      return !hasCreatedInBatch;
    }
    return false;
  };

  // Check if current user has already created an admin in the target batch
  const checkIfAlreadyCreatedInBatch = (targetBatch) => {
    // Count how many admins in target batch were created by current user
    const adminsCreatedByMeInBatch = admins.filter((admin) => {
      const isCreatedByMe = checkIfCreatedByMe(admin);
      return isCreatedByMe && admin.batch === targetBatch;
    });

    return adminsCreatedByMeInBatch.length > 0;
  };

  // Get unique values for filters
  const uniqueBatches = [
    ...new Set(admins.map((a) => a.batch).filter(Boolean)),
  ];
  const uniqueYears = [...new Set(admins.map((a) => a.year).filter(Boolean))];
  const uniqueRoles = [...new Set(admins.map((a) => a.role).filter(Boolean))];
  const uniqueGenders = [
    ...new Set(admins.map((a) => a.gender).filter(Boolean)),
  ];

  // Filter admins based on current filters
  const filteredAdmins = admins.filter((admin) => {
    if (search) {
      const searchLower = search.toLowerCase();
      const nameMatch = admin.name.toLowerCase().includes(searchLower);
      const emailMatch = admin.email.toLowerCase().includes(searchLower);

      // Return false only if neither name nor email matches
      if (!nameMatch && !emailMatch) return false;
    }
    if (batchFilter && admin.batch !== batchFilter) return false;
    if (yearFilter && String(admin.year) !== String(yearFilter)) return false;
    if (roleFilter && admin.role !== roleFilter) return false;
    if (genderFilter && admin.gender !== genderFilter) return false;
    return true;
  });

  // Split by roles for display with priority emails
  const superAdmins = filteredAdmins
    .filter((a) => a.role === "superadmin")
    .sort((a, b) => {
      const priorityEmails = [
        "mitraabaaburaj@gmail.com",
        "arunakhil9715@gmail.com",
        "datalyticscit@cit.edu.in",
      ];

      const aEmail = a.email?.toLowerCase().trim();
      const bEmail = b.email?.toLowerCase().trim();

      const aIndex = priorityEmails.findIndex(
        (email) => email.toLowerCase().trim() === aEmail
      );
      const bIndex = priorityEmails.findIndex(
        (email) => email.toLowerCase().trim() === bEmail
      );

      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
     
      if (aIndex !== -1) return -1;
      
      if (bIndex !== -1) return 1;
      
      return 0;
    });

  const normalAdmins = filteredAdmins.filter((a) => a.role === "admin");

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading admins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Title and Current Batch */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:gap-30">
          {/* Admin Management Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Admin Management
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Manage admin accounts and permissions
              </p>
            </div>
          </div>

          {/* Current Batch Stats */}
          <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-4 py-2 shadow-lg w-full sm:w-fit min-w-[280px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-linear-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
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
                  {filteredAdmins.length}
                </p>
                <p className="text-sm text-slate-400">admins</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Total Admins and Add Button */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Total Admins Card */}
          <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-4 py-2 shadow-lg w-full sm:w-fit">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-linear-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Admins</p>
                <p className="text-2xl font-bold text-white">{admins.length}</p>
              </div>
            </div>
          </div>

          {/* Add Admin Button - Only for authorized users */}
          {(myRole === "superadmin" ||
            (myRole === "admin" && canCreateInBatch(batchFilter))) && (
            <Link
              to="/dashboard/admins/add"
              className="bg-linear-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 px-6 py-3 rounded-2xl text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 justify-center"
            >
              <Users className="w-4 h-4" />
              Add Admin
            </Link>
          )}

          {/* Show message when admin cannot create more */}
          {myRole === "admin" &&
            !canCreateInBatch(batchFilter) &&
            batchFilter && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3">
                <p className="text-yellow-400 text-sm font-medium">
                  {checkIfAlreadyCreatedInBatch(batchFilter)
                    ? `Already created an admin in ${batchFilter} batch`
                    : `No access to ${batchFilter} batch`}
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Rest of the component remains the same... */}
      {/* Filters Card */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 py-4 shadow-xl">
        {/* Header with Toggle Button for Mobile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-purple-400" />
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
            {/* Batch Filter - No restrictions for viewing, only for creation */}
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Batch {myRole === "admin" && "(Creation Limits)"}
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  setYearFilter("");
                  setRoleFilter("");
                  setGenderFilter("");
                }}
              >
                <option value="" className="bg-slate-800 text-slate-300">
                  All Batches
                </option>
                {batchOptions.map((b) => (
                  <option key={b} value={b} className="bg-slate-800 text-white">
                    {b}
                  </option>
                ))}
              </select>

              {/* Helper text for batch selection - Only show for admin users */}
              {myRole === "admin" && batchFilter && (
                <p className="text-xs mt-1 text-slate-400">
                  {canCreateInBatch(batchFilter)
                    ? `You can create one admin in ${batchFilter} batch`
                    : `View only - Cannot create admin in ${batchFilter} batch`}
                </p>
              )}
            </div>

            {/* Year Filter */}
            {/* <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Year
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="" className="bg-slate-800 text-slate-300">
                  All Years
                </option>
                {uniqueYears.map((y) => (
                  <option key={y} value={y} className="bg-slate-800 text-white">
                    Year {y}
                  </option>
                ))}
              </select>
            </div> */}

            {/* Role Filter */}
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Role
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="" className="bg-slate-800 text-slate-300">
                  All Roles
                </option>
                {uniqueRoles.map((r) => (
                  <option key={r} value={r} className="bg-slate-800 text-white">
                    {r === "superadmin" ? "Super Admin" : "Admin"}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Filter */}
            {/* <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Gender
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
              >
                <option value="" className="bg-slate-800 text-slate-300">
                  All Genders
                </option>
                {uniqueGenders.map((g) => (
                  <option key={g} value={g} className="bg-slate-800 text-white">
                    {g === "M" ? "Male" : g === "F" ? "Female" : "Other"}
                  </option>
                ))}
              </select>
            </div> */}

            {/* Search - Takes 2 columns */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Search
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {(batchFilter ||
            yearFilter ||
            roleFilter ||
            genderFilter ||
            search) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setBatchFilter("");
                  setSearch("");
                  setYearFilter("");
                  setRoleFilter("");
                  setGenderFilter("");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all duration-200 text-sm font-medium"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Super Admins Section */}
      {superAdmins.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-yellow-400">Super Admins</h2>
            <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-sm font-medium border border-yellow-500/30">
              {superAdmins.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {superAdmins.map((admin) => (
              <AdminCard
                key={admin._id}
                admin={admin}
                myRole={myRole}
                myId={myId}
                canEdit={canEditAdmin(admin)}
                canDelete={canDeleteAdmin(admin)}
                isAdminActive={isAdminActive}
                onEdit={() => navigate(`/dashboard/admins/edit/${admin._id}`)}
                onDelete={deleteAdmin}
              />
            ))}
          </div>
        </div>
      )}

      {/* Normal Admins Section */}
      {normalAdmins.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-purple-400">Admins</h2>
            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm font-medium border border-purple-500/30">
              {normalAdmins.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {normalAdmins.map((admin) => (
              <AdminCard
                key={admin._id}
                admin={admin}
                myRole={myRole}
                myId={myId}
                canEdit={canEditAdmin(admin)}
                canDelete={canDeleteAdmin(admin)}
                isAdminActive={isAdminActive}
                onEdit={() => navigate(`/dashboard/admins/edit/${admin._id}`)}
                onDelete={deleteAdmin}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredAdmins.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-slate-700/50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <Shield className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-300 mb-3">
            No admins found
          </h3>
          <p className="text-slate-400 max-w-md mx-auto mb-6">
            {search || yearFilter || roleFilter || genderFilter
              ? "Try adjusting your filters to see more results"
              : batchFilter
              ? `No admins found in ${batchFilter} batch`
              : "No admins have been added yet."}
          </p>
          {(search || yearFilter || roleFilter || genderFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setYearFilter("");
                setRoleFilter("");
                setGenderFilter("");
              }}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 px-6 py-2 rounded-xl transition-all duration-200"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Updated Admin Card Component
function AdminCard({
  admin,
  myRole,
  myId,
  canEdit,
  canDelete,
  isAdminActive,
  onEdit,
  onDelete,
}) {
  const isSuperAdmin = admin.role === "superadmin";
  const isMyProfile = admin._id === myId;

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group">
      {/* Profile Image */}
      <div className="relative">
        <img
          src={admin.image || "/api/placeholder/400/200"}
          alt={admin.name}
          className="w-full h-80 object-cover rounded-b-2xl"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/80 via-slate-900/10 to-transparent"></div>

        {/* Name + Position */}
        <div className="absolute bottom-3 left-4">
          <h3 className="text-xl font-bold text-white truncate">
            {admin.name}
          </h3>
          <p className="text-sm text-slate-300">
            {admin.position?.name || "Admin"}
          </p>
        </div>

        {/* Role Badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span
            className={`px-3 py-1 rounded-xl text-xs font-bold border
      bg-black text-white-300 border-black-500/30
    `}
          >
            {isSuperAdmin ? "SA" : "A"}
          </span>

          {isMyProfile && (
            <span className="text-red-500 text-lg font-bold leading-none">
              *
            </span>
          )}
        </div>
      </div>

      {/* Admin Details */}
      <div className="p-5 space-y-4">
        {/* Course / Year */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <BookOpen className="w-4 h-4 text-slate-400" />
            {admin.course?.name}
          </div>
          {admin.year > 0 && (
            <div className="flex items-center gap-1 text-slate-300">
              <User className="w-4 h-4 text-slate-400" />
              Year {admin.year}
            </div>
          )}
        </div>

        {/* Batch / Gender */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            {admin.batch}
          </span>
          {admin.gender && (
            <span className="text-xs font-medium text-slate-300 bg-slate-700/50 px-3 py-1 rounded-full">
              {admin.gender === "M"
                ? "Male"
                : admin.gender === "F"
                ? "Female"
                : "Other"}
            </span>
          )}
        </div>

        {/* Roll Number and Batch */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          {admin.rollNo && (
            <div className="flex items-center gap-2 text-slate-300">
              <Hash className="w-4 h-4 text-slate-400" />
              <span>Roll No: {admin.rollNo}</span>
            </div>
          )}

          {admin.batch && !admin.batch.startsWith("2019") && (
            <span className="px-2 py-0.5 rounded-lg bg-slate-700/40 border border-slate-600 text-slate-300 text-[10px]">
              {admin.batch}
            </span>
          )}
        </div>

        {/* Contact Info + Status */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 truncate">
              <Mail className="w-4 h-4" />
              <span className="truncate">{admin.email}</span>
            </div>

            {/* Status */}
            <span
              className={`px-2 py-1 rounded-lg font-medium border ${
                isAdminActive(admin)
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {isAdminActive(admin) ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400">
              {admin.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{admin.phone}</span>
                </div>
              )}
            </div>

            {/* MFA */}
            {admin.mfaEnabled && (
              <span className="px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                MFA Enabled
              </span>
            )}
          </div>
        </div>

        {/* LinkedIn */}
        {admin.linkedin && (
          <a
            href={admin.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
            LinkedIn Profile
          </a>
        )}

        {/* Created / Updated */}
        <div className="flex justify-between text-[11px] text-slate-500 pt-1">
          <span>
            Added on : {new Date(admin.createdAt).toLocaleDateString("en-IN")}
          </span>
          <span>
            Updated on : {new Date(admin.updatedAt).toLocaleDateString("en-IN")}
          </span>
        </div>

        <div className="flex justify-between text-[11px] text-slate-500 pt-1">
          <span>
            Added by : {admin.createdBy?.name || "Unknown"}
            {admin.createdBy?.email && ` - ${admin.createdBy.email}`}
          </span>
          <span>
            Updated by : {admin.updatedBy?.name || "Unknown"}
            {admin.updatedBy?.email && ` - ${admin.updatedBy.email}`}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-700/50">
          {canEdit ? (
            <>
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 hover:text-white py-2 rounded-xl text-sm font-medium"
              >
                <Edit3 className="w-4 h-4" /> Edit
              </button>
              {canDelete && (
                <button
                  onClick={() => onDelete(admin._id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 py-2 rounded-xl text-sm font-medium border border-red-500/20"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </>
          ) : (
            <div className="w-full text-center text-xs text-slate-500">
              {myRole === "superadmin" ? "" : "View Only"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
