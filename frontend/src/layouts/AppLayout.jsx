import { useEffect, useState } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Sidebar from "../components/Sidebar";


const pageTitles = {
  "/": "Overview",
  "/pos": "Point of sale",
  "/orders": "Orders",
  "/preparation": "Drink preparation",
  "/menu": "Menu",
  "/inventory": "Stock",
  "/purchasing": "Purchasing",
  "/reports": "Reports",
  "/team": "Team",
  "/settings": "Settings",
};


export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);
  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function closeWithEscape(event) {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", closeWithEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        closeWithEscape,
      );
    };
  }, []);

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await logout();
    } finally {
      navigate("/login", {
        replace: true,
      });
    }
  }

  const pageTitle =
    pageTitles[location.pathname] ?? "Workspace";

  return (
    <div className="min-h-screen bg-stone-100">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
      />

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-stone-200 bg-white/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-expanded={isSidebarOpen}
              aria-label="Open navigation"
              className="rounded-xl border border-stone-200 p-2 text-stone-700 hover:bg-stone-100 lg:hidden"
              onClick={() =>
                setIsSidebarOpen(true)
              }
              type="button"
            >
              <span aria-hidden="true">☰</span>
            </button>

            <div>
              <h1 className="text-xl font-bold text-stone-900">
                {pageTitle}
              </h1>

              <p className="hidden text-sm text-stone-500 sm:block">
                Welcome back, {user.first_name}
              </p>
            </div>
          </div>

          <button
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSigningOut}
            onClick={handleLogout}
            type="button"
          >
            {isSigningOut
              ? "Signing out…"
              : "Sign out"}
          </button>
        </header>

        <main className="p-4 sm:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}