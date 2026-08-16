// admin/src/pages/MembersList.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  ExternalLink,
  User,
  Calendar,
  BookOpen,
  ChevronDown,
  Shield,
} from "lucide-react";

export default function MembersList() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const navigate = useNavigate();

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

  // The server flags these on the members payload. This page used to download
  // the whole admin roster just to answer the same question — a second request
  // on the dashboard's landing route, and on the production host every extra
  // request costs hundreds of milliseconds before it does any work.
  const superadminEmails = useMemo(
    () =>
      new Set(
        members
          .filter((m) => m.isSuperadmin && m.email)
          .map((m) => m.email.toLowerCase())
      ),
    [members]
  );

  const isMemberSuperadmin = (memberEmail) =>
    !!memberEmail && superadminEmails.has(memberEmail.toLowerCase());

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

  // Check if current admin can edit/delete a member
  const canModifyMember = (memberBatch, memberEmail) => {
    if (!currentAdmin) return false;

    // Superadmin can modify anyone
    if (currentAdmin.role === "superadmin") return true;

    // Regular admin can only modify their batch mates
    if (currentAdmin.batch !== memberBatch) return false;

    // Regular admin CANNOT modify superadmin accounts
    if (isMemberSuperadmin(memberEmail)) return false;

    return true;
  };

  const fetchMembers = async () => {
    try {
      // Both at once: the session is usually already cached, and the members
      // request should not wait on it either way.
      const [admin, membersRes] = await Promise.all([
        getSession(),
        API.get("/admin/members/all"),
      ]);

      setCurrentAdmin(admin);
      setMembers(membersRes.data);

      setBatchFilter(getCurrentBatch());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleDelete = async (id) => {
    // if (!confirm("Are you sure you want to delete this member?")) return;

    try {
      // Use the corrected admin delete endpoint
      await API.delete(`/admin/members/${id}`);
      setMembers((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const handleEdit = (member) => {
    if (!canModifyMember(member.batch, member.email)) {
      if (isMemberSuperadmin(member.email)) {
        alert("You cannot edit superadmin accounts");
      } else {
        alert("You can only edit members from your own batch");
      }
      return;
    }
    navigate(`/dashboard/edit/${member._id}`);
  };

  const handleDeleteWithCheck = async (member) => {
    if (!canModifyMember(member.batch, member.email)) {
      if (isMemberSuperadmin(member.email)) {
        alert("You cannot delete superadmin accounts");
      } else {
        alert("You can only delete members from your own batch");
      }
      return;
    }

    if (!confirm(`Are you sure you want to delete ${member.name}?`)) return;

    try {
      await handleDelete(member._id);
    } catch (err) {
      if (err.response?.status === 403) {
        alert("Permission denied: " + err.response.data.message);
      } else {
        alert(err.response?.data?.message || "Delete failed");
      }
    }
  };

  const uniqueBatches = useMemo(
    () => [...new Set(members.map((m) => m.batch).filter(Boolean))],
    [members]
  );

  // Get filtered members for current batch
  const currentBatchMembers = useMemo(() => {
    if (!batchFilter) return members;
    return members.filter((m) => m.batch === batchFilter);
  }, [members, batchFilter]);

  // Get unique values only from current batch
  const uniqueYears = useMemo(
    () => [...new Set(currentBatchMembers.map((m) => m.year).filter(Boolean))],
    [currentBatchMembers]
  );
  const uniqueCategories = useMemo(
    () => [
      ...new Set(
        currentBatchMembers.map((m) => m.position?.category).filter(Boolean)
      ),
    ],
    [currentBatchMembers]
  );
  const uniqueGenders = useMemo(
    () => [
      ...new Set(currentBatchMembers.map((m) => m.gender).filter(Boolean)),
    ],
    [currentBatchMembers]
  );

  const filtered = currentBatchMembers.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (yearFilter && String(m.year) !== String(yearFilter)) return false;
    if (categoryFilter && m.position?.category !== categoryFilter) return false;
    if (genderFilter && m.gender !== genderFilter) return false;
    return true;
  });

  // Count members in current batch
  const currentBatchCount = currentBatchMembers.length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading members...</p>
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
          {/* Club Members Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Club Members
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
                <p className="text-sm text-slate-400">members</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Total Members and Admin Info */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Total Members */}
          <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-4 py-2 shadow-lg w-full sm:w-fit">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-linear-to-r from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Members</p>
                <p className="text-2xl font-bold text-white">
                  {members.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Permission Notice */}
      {/* {currentAdmin && currentAdmin.role === "admin" && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-blue-400 font-medium">Permission Notice</p>
              <p className="text-sm text-blue-300">
                You can only edit and delete members from your batch (
                {currentAdmin.batch}).
                {currentAdmin.role === "admin" &&
                  " Superadmins have full access."}
              </p>
            </div>
          </div>
        </div>
      )} */}

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
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Batch
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  // Reset other filters when batch changes
                  setYearFilter("");
                  setCategoryFilter("");
                  setGenderFilter("");
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

            {/* Year Filter */}
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Year
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
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
            </div>

            {/* Role Category Filter */}
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Role
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="" className="bg-slate-800 text-slate-300">
                  All Roles
                </option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c} className="bg-slate-800 text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Filter */}
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Gender
              </label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
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
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {(batchFilter ||
            yearFilter ||
            categoryFilter ||
            genderFilter ||
            search) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSearch("");
                  setYearFilter("");
                  setCategoryFilter("");
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

      {/* Member Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {filtered.map((m) => {
          const canModify = canModifyMember(m.batch, m.email); // Pass email here
          return (
            <div
              key={m._id}
              className={`bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-[1.02] group `}
            >
              {/* Profile Image */}
              <div className="relative">
                <img
                  src={m.imageUrl}
                  alt={m.name}
                  className="w-full h-80 object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent"></div>

                {/* Permission Indicator */}
                {/* {!canModify && (
                  <div className="absolute top-3 right-3 bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded-lg text-xs backdrop-blur-sm">
                    Read Only
                  </div>
                )} */}

                <div className="absolute bottom-3 left-4">
                  <h3 className="text-lg font-bold text-white">{m.name}</h3>
                  <p className="text-sm text-slate-300">{m.position?.name}</p>
                </div>
              </div>

              {/* Member Details */}
              <div className="p-4 space-y-3">
                {/* Course / Year */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    {m.course?.name}
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <User className="w-4 h-4 text-slate-400" />
                    Year {m.year}
                  </div>
                </div>

                {/* Role & Batch */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20">
                    {m.position?.category}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full">
                    {m.batch}
                  </span>
                </div>

                {/* Contact + Created/Updated Info */}
                <div className="flex items-start justify-between">
                  {/* LEFT — Contact Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{m.email}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Phone className="w-3 h-3" />
                      <span>{m.phone}</span>
                    </div>
                  </div>

                  {/* RIGHT — Created / Updated */}
                  <div className="text-right text-[11px] text-slate-500 leading-tight space-y-1">
                    {m.createdBy && (
                      <div>
                        <div>
                          <span className="text-slate-400">Created By: </span>
                          <span className="text-slate-300">
                            {m.createdBy.name || "Unknown"}
                          </span>
                        </div>
                        {m.createdBy.email && (
                          <div className="text-slate-400">
                            {m.createdBy.email}
                          </div>
                        )}
                      </div>
                    )}

                    {m.updatedBy && (
                      <div>
                        <div>
                          <span className="text-slate-400">Updated By: </span>
                          <span className="text-slate-300">
                            {m.updatedBy.name || "Unknown"}
                          </span>
                        </div>
                        {m.updatedBy.email && (
                          <div className="text-slate-400">
                            {m.updatedBy.email}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Social Links */}
                <div className="flex gap-3 pt-2">
                  {m.linkedin && (
                    <a
                      href={m.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
                      title="LinkedIn"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                    </a>
                  )}
                  {m.github && (
                    <a
                      href={m.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white transition-colors duration-200"
                      title="GitHub"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                    </a>
                  )}
                  {m.portfolio && (
                    <a
                      href={m.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 transition-colors duration-200"
                      title="Portfolio"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </a>
                  )}

                  {m.instagram && (
                    <a
                      href={m.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 transition-colors duration-200"
                      title="Instagram"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M7.75 2h8.5C19.55 2 22 4.45 22 7.75v8.5c0 3.3-2.45 5.75-5.75 5.75h-8.5C4.45 22 2 19.55 2 16.25v-8.5C2 4.45 4.45 2 7.75 2zm0 2C5.68 4 4 5.68 4 7.75v8.5C4 18.32 5.68 20 7.75 20h8.5c2.07 0 3.75-1.68 3.75-3.75v-8.5C20 5.68 18.32 4 16.25 4h-8.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm4.75-.88a1.12 1.12 0 110 2.24 1.12 1.12 0 010-2.24z" />
                      </svg>
                    </a>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-slate-700/50">
                  {canModify ? (
                    <>
                      <button
                        onClick={() => handleEdit(m)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 text-sm font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteWithCheck(m)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 text-sm font-medium border bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/30"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleEdit(m)}
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
            <Users className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-300 mb-3">
            No members found
          </h3>
          <p className="text-slate-400 max-w-md mx-auto mb-6">
            {search || yearFilter || categoryFilter || genderFilter
              ? "Try adjusting your filters to see more results"
              : batchFilter
              ? `No members found in ${batchFilter} batch`
              : "No members have been added yet. Get started by adding your first member!"}
          </p>
          {(search || yearFilter || categoryFilter || genderFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setYearFilter("");
                setCategoryFilter("");
                setGenderFilter("");
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
