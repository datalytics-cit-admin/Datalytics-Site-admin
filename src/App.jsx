// admin/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { getSession, clearSession, peekSession } from "./services/session";
import { isPublicPath } from "./services/api";
import DashboardLayout from "./components/DashboardLayout";

// The two landing screens stay in the main bundle. Splitting them out cost more
// than it saved: the route chunk can only start downloading after the main
// bundle has parsed, which delays the page's first data request by a whole
// round trip — measured at ~700ms on the dashboard.
import Login from "./pages/Login";
import MembersList from "./pages/MembersList";

// Everything else is fetched on first visit. Opening the dashboard no longer
// also downloads the member editor, the event forms and the admin CRUD.
const MFA = lazy(() => import("./pages/MFA"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AddMember = lazy(() => import("./pages/AddMember"));
const EditMember = lazy(() => import("./pages/EditMember"));
const AdminList = lazy(() => import("./pages/AdminList"));
const AddAdmin = lazy(() => import("./pages/AddAdmin"));
const EditAdmin = lazy(() => import("./pages/EditAdmin"));
const EventsList = lazy(() => import("./pages/EventsList"));
const AddEvent = lazy(() => import("./pages/AddEvent"));
const EditEvent = lazy(() => import("./pages/EditEvent"));
const Roles = lazy(() => import("./pages/Roles"));
const Courses = lazy(() => import("./pages/Courses"));

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

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
// This gate is a UX affordance, not a security boundary — every one of these
// routes is enforced again on the server for each request it makes. That is why
// it is safe to answer it from the persisted session and skip the round trip.
const canAccessCurrentBatch = (admin) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const academicYearStart = currentMonth >= 5 ? currentYear : currentYear - 1;
  const currentBatch = `${academicYearStart}-${academicYearStart + 1}`;

  return admin.role === "superadmin" || admin.batch === currentBatch;
};

const permissionFor = (admin, requireCurrentBatch) => {
  if (!admin) return null; // unknown — must ask the server
  return requireCurrentBatch ? canAccessCurrentBatch(admin) : true;
};

const ProtectedRoute = ({ children, requireCurrentBatch = false, title }) => {
  // Resolved synchronously whenever a session is already known, so navigating
  // to a protected page renders it instead of a "Checking permissions..." card.
  const initial = permissionFor(peekSession(), requireCurrentBatch);

  const [checking, setChecking] = useState(initial === null);
  const [hasPermission, setHasPermission] = useState(initial === true);

  useEffect(() => {
    let alive = true;

    // Still revalidates in the background; getSession only touches the network
    // when its copy is stale.
    getSession()
      .then((admin) => {
        if (!alive) return;
        const allowed = permissionFor(admin, requireCurrentBatch);
        setHasPermission(allowed);
        if (!allowed) {
          alert("Access denied. Only current batch admins can access this page.");
        }
      })
      .catch(() => alive && setHasPermission(false))
      .finally(() => alive && setChecking(false));

    return () => {
      alive = false;
    };
  }, [requireCurrentBatch]);

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
  // A known session means the app can render on the first frame. The check
  // below still runs — it just no longer stands between the user and the UI.
  // If it fails, the api interceptor redirects to /login or /mfa.
  const knownAdmin = peekSession();

  // A page reachable while signed out must not open by demanding a session.
  // Without this the reset link 401s on /admin/me before anything renders and
  // the interceptor sends the user to /login — the one place they cannot get
  // out of, since the whole reason they followed that link is being locked out.
  const publicRoute = isPublicPath();

  const [checking, setChecking] = useState(!publicRoute && knownAdmin === null);
  const [authed, setAuthed] = useState(knownAdmin !== null);

  useEffect(() => {
    // `checking` already starts false for these, so there is nothing to unset.
    if (publicRoute) return;

    getSession()
      .then(() => setAuthed(true))
      .catch(() => {
        clearSession();
        setAuthed(false);
      })
      .finally(() => setChecking(false));
  }, [publicRoute]);

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
    <Suspense fallback={<RouteFallback />}>
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
      {/* Reached from a lock-down email by someone who cannot sign in, so it
          must stay public. Its own authority is the signed token in the URL,
          and the server re-checks that plus an emailed code and the
          authenticator before any password changes. */}
      <Route
        path="/reset-password"
        element={
          <>
            <PageTitle title="Reset Password" />
            <ResetPassword />
          </>
        }
      />

      {/* The verification prompt is a step over the login form, never its own
          page. Anything still pointing here (an old bookmark, a stale tab) goes
          to sign-in, where that step lives. */}
      <Route path="/mfa/verify" element={<Navigate to="/login" replace />} />

      <Route
        path="/mfa/:mode/:id?"
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
    </Suspense>
  );
}
