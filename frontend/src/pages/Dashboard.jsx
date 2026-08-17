import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";


export default function Dashboard() {
  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const {
    user,
    logout,
    hasRole,
  } = useAuth();

  const navigate = useNavigate();

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

  return (
    <main className="min-h-screen bg-stone-100 p-4 sm:p-8">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-800">
              ldrn&apos;s coffee
            </p>

            <h1 className="mt-2 text-2xl font-bold text-stone-900">
              Welcome, {user.first_name}
            </h1>

            <p className="mt-1 text-sm text-stone-600">
              Signed in as {user.username}
            </p>
          </div>

          <button
            className="rounded-xl border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSigningOut}
            onClick={handleLogout}
            type="button"
          >
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </header>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-stone-900">
            Your workspace
          </h2>

          <p className="mt-2 text-stone-600">
            Your authenticated application is ready.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900"
                key={role.role_name}
              >
                {role.role_name}
              </span>
            ))}
          </div>

          {hasRole("owner") && (
            <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-bold text-amber-950">
                Team management
              </h3>

              <p className="mt-1 text-sm text-amber-900">
                Your Owner account can add and manage team members.
              </p>

              <button
                className="mt-4 rounded-xl bg-amber-900 px-4 py-2 font-semibold text-white"
                type="button"
              >
                Manage team
              </button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}