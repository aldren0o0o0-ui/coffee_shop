import { useEffect, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../modules/auth/context/useAuth";
import Sidebar from "../components/Sidebar";
import ChangePasswordModal from "../modules/auth/components/ChangePasswordModal";
import BranchSelector from "../modules/branches/components/BranchSelector";

const pageTitles = {
  "/overview": "Overview",
  "/dashboard": "Overview",
  "/": "Overview",
  "/pos": "Point of Sale",
  "/orders": "Orders",
  "/preparation": "Drink Preparation",
  "/menu": "Menu Management",
  "/inventory": "Stock Management",
  "/purchasing": "Purchasing & Procurement",
  "/reports": "Store Analytics & Reports",
  "/team": "Team Accounts",
  "/settings": "Store Settings",
};

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const {
    user,
    logout,
    isPasswordModalOpen,
    openPasswordModal,
    closePasswordModal,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isForcedPasswordChange = Boolean(user?.must_change_password);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function closeWithEscape(event) {
      if (event.key === "Escape" && !isForcedPasswordChange) {
        setIsSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", closeWithEscape);

    return () => {
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [isForcedPasswordChange]);

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

  const pageTitle = pageTitles[location.pathname] ?? "Workspace";

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenPasswordModal={openPasswordModal}
        user={user}
      />

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-stone-200 bg-white/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-expanded={isSidebarOpen}
              aria-label="Open navigation"
              className="rounded-xl border border-stone-200 p-2 text-stone-700 hover:bg-stone-100 lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
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

          <div className="flex items-center gap-2.5">
            {/* Multi-Branch Selector */}
            <BranchSelector />

            {/* View Public Storefront Link */}
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950 sm:flex"
              title="View Public Storefront"
            >
              <span>Storefront</span>
              <span>↗</span>
            </Link>

            <button
              aria-label="Change Password"
              className="hidden items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950 sm:flex"
              onClick={openPasswordModal}
              type="button"
            >
              <svg className="h-4 w-4 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Password</span>
            </button>

            <button
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSigningOut}
              onClick={handleLogout}
              type="button"
            >
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Force or Voluntary Password Change Modal */}
      <ChangePasswordModal
        isForced={isForcedPasswordChange}
        isOpen={isForcedPasswordChange || isPasswordModalOpen}
        onClose={closePasswordModal}
      />
    </div>
  );
}