// admin/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "./services/api";
import Login from "./pages/Login";
import AddMember from "./pages/AddMember";
import MembersList from "./pages/MembersList";
import EditMember from "./pages/EditMember";
import DashboardLayout from "./components/DashboardLayout";
import Roles from "./pages/Roles";
import Courses from "./pages/Courses";
import AdminList from "./pages/AdminList";
import AddAdmin from "./pages/AddAdmin";
import EditAdmin from "./pages/EditAdmin";
import MFA from "./pages/MFA";

import EventsList from "./pages/EventsList";
import AddEvent from "./pages/AddEvent";
import EditEvent from "./pages/EditEvent";

// Title component to set document title
const PageTitle = ({ title }) => {
  useEffect(() => {
    document.title = `${title} | Datalytics Admin `;
    return () => {
      document.title = "Datalytics Admin";
    };
  }, [title]);

  return null;
};

// Protected Route Component - WITH ALERT
const ProtectedRoute = ({ children, requireCurrentBatch = false, title }) => {
  const [checking, setChecking] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const response = await API.get("/admin/me");
        const admin = response.data.admin;

        // Get current batch
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const academicYearStart =
          currentMonth >= 5 ? currentYear : currentYear - 1;
        const academicYearEnd = academicYearStart + 1;
        const currentBatch = `${academicYearStart}-${academicYearEnd}`;

        // Check permissions
        if (!requireCurrentBatch) {
          setHasPermission(true);
        } else {
          // For routes that require current batch access
          const canAccess =
            admin.role === "superadmin" || admin.batch === currentBatch;
          setHasPermission(canAccess);

          if (!canAccess) {
            setShowAlert(true);
          }
        }
      } catch (error) {
        setHasPermission(false);
      } finally {
        setChecking(false);
      }
    };

    checkPermission();
  }, [requireCurrentBatch]);

  // Show alert when permission is denied
  useEffect(() => {
    if (showAlert) {
      alert("Access denied. Only current batch admins can access this page.");
      setShowAlert(false);
    }
  }, [showAlert]);

  if (checking) {
    return (
      <>
        <PageTitle title="Loading..." />
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
          <div className="animate-pulse text-sm text-slate-400">
            Checking permissions...
          </div>
        </div>
      </>
    );
  }

  return hasPermission ? (
    <>
      <PageTitle title={title} />
      {children}
    </>
  ) : (
    <Navigate to="/dashboard" replace />
  );
};

export default function App() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const verify = async () => {
      try {
        await API.get("/admin/me");
        setAuthed(true);
      } catch {
        setAuthed(false);
      } finally {
        setChecking(false);
      }
    };
    verify();
  }, []);

  if (checking) {
    return (
      <>
        <PageTitle title="Loading..." />
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
          <div className="animate-pulse text-sm text-slate-400">
            Checking admin session...
          </div>
        </div>
      </>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <>
            <PageTitle title="Login" />
            <Login setAuthed={setAuthed} />
          </>
        }
      />
      <Route
        path="/mfa/:mode/:id"
        element={
          <>
            <PageTitle title="Two-Factor Authentication" />
            <MFA setAuthed={setAuthed} />
          </>
        }
      />

      {/* Global Route */}
      <Route
        path="/"
        element={
          authed ? <Navigate to="/dashboard" /> : <Navigate to="/login" />
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          authed ? (
            <DashboardLayout setAuthed={setAuthed} />
          ) : (
            <Navigate to="/login" />
          )
        }
      >
        <Route
          index
          element={
            <>
              <PageTitle title="Members" />
              <MembersList />
            </>
          }
        />

        {/* Protected Add Member Route */}
        <Route
          path="add-member"
          element={
            <ProtectedRoute requireCurrentBatch={true} title="Add Member">
              <AddMember />
            </ProtectedRoute>
          }
        />

        <Route
          path="edit/:id"
          element={
            <>
              <PageTitle title="Edit Member" />
              <EditMember />
            </>
          }
        />

        <Route
          path="roles"
          element={
            <>
              <PageTitle title="Roles" />
              <Roles />
            </>
          }
        />

        <Route
          path="courses"
          element={
            <>
              <PageTitle title="Courses" />
              <Courses />
            </>
          }
        />

        <Route
          path="admins"
          element={
            <>
              <PageTitle title="Admin" />
              <AdminList />
            </>
          }
        />

        <Route
          path="admins/add"
          element={
            <>
              <PageTitle title="Add Admin" />
              <AddAdmin />
            </>
          }
        />

        {/* Protected Edit Admin Route */}
        <Route
          path="admins/edit/:id"
          element={
            <ProtectedRoute requireCurrentBatch={true} title="Edit Admin">
              <EditAdmin />
            </ProtectedRoute>
          }
        />

        {/* Event Routes */}
        <Route
          path="events"
          element={
            <>
              <PageTitle title="Events" />
              <EventsList />
            </>
          }
        />

        {/* Protected Add Event Route */}
        <Route
          path="events/add"
          element={
            <ProtectedRoute requireCurrentBatch={true} title="Add Event">
              <AddEvent />
            </ProtectedRoute>
          }
        />

        {/* Protected Edit Event Route */}
        <Route
          path="events/edit/:id"
          element={
            <ProtectedRoute requireCurrentBatch={true} title="Edit Event">
              <EditEvent />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
