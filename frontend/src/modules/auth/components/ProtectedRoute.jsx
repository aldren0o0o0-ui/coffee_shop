import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../context/useAuth";


function SessionLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100">
      <div
        aria-live="polite"
        className="text-center"
        role="status"
      >
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-stone-300 border-t-amber-900" />

        <p className="mt-4 text-sm text-stone-600">
          Checking your session…
        </p>
      </div>
    </main>
  );
}


export default function ProtectedRoute() {
  const {
    isAuthenticated,
    isCheckingSession,
  } = useAuth();

  const location = useLocation();

  if (isCheckingSession) {
    return <SessionLoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        replace
        state={{ from: location }}
        to="/login"
      />
    );
  }

  return <Outlet />;
}
