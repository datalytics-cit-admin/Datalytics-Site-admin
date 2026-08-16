// admin/src/pages/Roles.jsx
import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import { getSession } from "../services/session";
import { BadgeCheck, Plus, Trash2, Users, Tag, Filter } from "lucide-react";

export default function Roles() {
  const [batch, setBatch] = useState("");
  const [roles, setRoles] = useState([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null); // Add this

  // Fetch current admin
  useEffect(() => {
    getSession()
      .then(setCurrentAdmin)
      .catch(console.error);
  }, []);

  // Dynamic Batch Options from 2019 with current batch selected
  const batchOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const arr = [];

    // Start from 2019 up to current year + 1 (next batch)
    const startYear = 2019;
    for (let i = startYear; i <= currentYear + 1; i++) {
      arr.push(`${i}-${i + 1}`);
    }
    return arr.sort((a, b) => parseInt(b) - parseInt(a));
  }, []);

  // Auto-select current batch on component mount
  useEffect(() => {
    const currentBatch = `${new Date().getFullYear()}-${
      new Date().getFullYear() + 1
    }`;
    setBatch(currentBatch);
  }, []);

  const fetchRoles = async () => {
    if (!batch) return;
    setLoading(true);
    try {
      const res = await API.get(`/roles/${batch}`);

      // Filter out "Datalytics Admin" role
      const filteredRoles = res.data.filter(
        (role) => role.name !== "Datalytics Admin"
      );

      setRoles(filteredRoles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [batch]);

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

  // Auto-select current batch on component mount
  useEffect(() => {
    setBatch(getCurrentBatch());
  }, []);

  // Check if current admin can add role to this batch
  const canAddRole = (targetBatch) => {
    if (!currentAdmin) return false;
    if (currentAdmin.role === "superadmin") return true;
    return (
      currentAdmin.batch === getCurrentBatch() &&
      targetBatch === getCurrentBatch()
    );
  };

  // Check if current admin can delete this role
  const canDeleteRole = (role) => {
    if (!currentAdmin) return false;

    // Superadmin can always delete
    if (currentAdmin.role === "superadmin") return true;

    // Normal admin can only delete if:
    // 1. They are in current batch AND
    // 2. They created the role
    const isInCurrentBatch = currentAdmin.batch === getCurrentBatch();
    const isCreator = role.createdBy && role.createdBy._id === currentAdmin._id;

    return isInCurrentBatch && isCreator;
  };

  const add = async (e) => {
    e?.preventDefault();
    if (!name) return setMsg("Role name is required");
    if (!canAddRole(batch))
      return setMsg("You don't have permission to add roles to this batch");

    try {
      await API.post(`/roles/add`, {
        name,
        batch,
        category,
        createdBy: currentAdmin._id, // Include creator info
      });
      setMsg("Role Added");
      setName("");
      setCategory("");
      fetchRoles();
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg(err.response?.data?.message || "Error adding role");
    }
  };

  const remove = async (id) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await API.delete(`/roles/${id}`);
      fetchRoles();
    } catch (err) {
      setMsg("Error deleting role");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-1 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <BadgeCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Manage Roles
              </h1>
              <p className="text-sm text-slate-400">
                Create and manage member roles
                {currentAdmin?.role !== "superadmin" &&
                  " • You can only manage roles in current batch"}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Success Message */}
      {msg && (
        <div
          className={`p-4 rounded-xl mb-6 ${
            msg.includes("Added")
              ? "bg-green-500/10 border border-green-500/20"
              : "bg-red-500/10 border border-red-500/20"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              msg.includes("Added") ? "text-green-400" : "text-red-400"
            }`}
          >
            {msg}
          </p>
        </div>
      )}
      {/* Batch Selection Card */}
      <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Select Batch</h2>
          {batch === getCurrentBatch() && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
              Current Batch
            </span>
          )}
        </div>

        <select
          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
        >
          <option value="" className="bg-slate-800 text-slate-300">
            Choose a batch
          </option>
          {batchOptions.map((b) => (
            <option key={b} value={b} className="bg-slate-800 text-white">
              {b}
            </option>
          ))}
        </select>

        {currentAdmin?.role !== "superadmin" && (
          <p className="text-xs text-slate-400 mt-2">
            Add and Manage roles for current batch ({getCurrentBatch()})
          </p>
        )}
      </div>
      {/* Add Role Form */}
      {batch && canAddRole(batch) && (
        <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Plus className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Add New Role</h2>
            {/* {currentAdmin?.role !== "superadmin" && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                Your batch only
              </span>
            )} */}
          </div>

          <form
            onSubmit={add}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Role Name <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                placeholder="e.g., Executive Director"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Category (Optional)
              </label>
              <input
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                placeholder="e.g., Leadership"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 opacity-0">
                Action
              </label>
              <button
                type="submit"
                className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Role
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Permission Notice for Regular Admin */}
      {batch && !canAddRole(batch) && currentAdmin?.role === "admin" && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-blue-400 font-medium">Permission Notice</p>
              <p className="text-sm text-blue-300">
                You can only add and manage roles for your batch (
                {currentAdmin.batch})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Roles List */}
      {batch && (
        <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BadgeCheck className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">
                Roles for {batch}
              </h2>
              <span className="bg-slate-700/50 text-slate-300 text-sm px-3 py-1 rounded-full border border-slate-600">
                {roles.length} {roles.length === 1 ? "role" : "roles"}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : roles.length > 0 ? (
            // admin/src/pages/Roles.jsx - Update the display part
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((r) => (
                <div
                  key={r._id}
                  className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all duration-200 group hover:transform hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-lg line-clamp-2 mb-1">
                        {r.name}
                      </h3>

                      {r.category && (
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-400 line-clamp-1">
                            {r.category}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-slate-400">
                        Added on : {new Date(r.createdAt).toLocaleDateString()}
                      </p>

                      {/* Updated: Show creator's name and email */}
                      {r.createdBy && (
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-slate-400">
                            Added by : {r.createdBy?.name || "Unknown"}
                            {r.createdBy?.email && ` (${r.createdBy.email})`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Only show delete button if admin has permission */}
                    {canDeleteRole(r) && (
                      <button
                        onClick={() => remove(r._id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all duration-200 transform hover:scale-110 opacity-70 group-hover:opacity-100 shrink-0"
                        title="Delete role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-700/50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-300 mb-2">
                No roles found
              </h3>
              <p className="text-slate-400 text-sm">
                Get started by adding the first role for {batch}
              </p>
            </div>
          )}
        </div>
      )}
      {/* Empty State when no batch selected */}
      {!batch && (
        <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-12 text-center shadow-xl">
          <div className="w-20 h-20 bg-slate-700/50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <Filter className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-300 mb-3">
            Select a Batch
          </h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Choose a batch from the dropdown above to start managing roles for
            that academic year.
          </p>
        </div>
      )}
    </div>
  );
}
