import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import { fetchDashboardOverview } from "../api/dashboardApi";

export default function ManagerDashboard({ onOpenPasswordModal }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    try {
      const overview = await fetchDashboardOverview();
      setStats(overview.manager_stats);
    } catch (err) {
      console.error("Failed to load manager dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const managerActions = [
    {
      title: "Shift Operations & POS",
      description: "Manage register transactions, order queues, and customer service.",
      path: "/pos",
      badge: "Active Station",
      icon: "🏪",
    },
    {
      title: "Orders & Fulfillment",
      description: "Track live customer orders and resolve modifications or cancellations.",
      path: "/orders",
      badge: "Real-time",
      icon: "📋",
    },
    {
      title: "Drink Preparation Queue",
      description: "Monitor barista workflow and prep bottlenecks during rush hours.",
      path: "/preparation",
      badge: "Kitchen Display",
      icon: "☕",
    },
    {
      title: "Menu & Recipe Toggles",
      description: "Update item availability, 86 out-of-stock items, and manage specials.",
      path: "/menu",
      badge: "Catalog",
      icon: "📜",
    },
    {
      title: "Stock Auditing & Waste",
      description: "Review current stock counts, log spoilage/waste, and audit inventory.",
      path: "/inventory",
      badge: "Audit",
      icon: "📦",
    },
    {
      title: "Purchase Request Approvals",
      description: "Review and approve stock restocking requests submitted by inventory team.",
      path: "/purchasing",
      badge: "Supplies",
      icon: "📝",
    },
    {
      title: "Shift & Sales Reports",
      description: "Generate end-of-shift summaries and analyze product popularity.",
      path: "/reports",
      badge: "Analytics",
      icon: "📊",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 p-6 text-white shadow-lg sm:p-10">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
                Manager Command Center
              </span>
              <span className="text-xs text-stone-300">• Live Store Supervision</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Good day, {user?.first_name || "Manager"}!
            </h2>
            <p className="mt-2 max-w-xl text-stone-200 text-sm sm:text-base leading-relaxed">
              Supervise daily coffee shop performance, coordinate shift stations, approve inventory reorders, and ensure seamless customer experience.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-stone-950 shadow-sm transition hover:bg-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-300"
              onClick={loadData}
              type="button"
            >
              <svg className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sync Shift Data
            </button>

            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              to="/pos"
            >
              Open Register
            </Link>

            {onOpenPasswordModal && (
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
                onClick={onOpenPasswordModal}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Password
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Operational Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Shift Revenue</span>
          <p className="mt-3 text-2xl font-extrabold text-stone-900 sm:text-3xl">
            {isLoading ? "…" : `$${Number(stats?.shift_revenue || 0).toFixed(2)}`}
          </p>
          <p className="mt-2 text-xs font-medium text-emerald-700">Settled orders today</p>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Order Pace</span>
          <p className="mt-3 text-2xl font-extrabold text-stone-900 sm:text-3xl">
            {isLoading ? "…" : `${stats?.orders_per_hour || 0} / hr`}
          </p>
          <p className="mt-2 text-xs font-medium text-stone-500">Hourly throughput</p>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Pending Approvals</span>
          <p className="mt-3 text-2xl font-extrabold text-amber-700 sm:text-3xl">
            {isLoading ? "…" : `${stats?.pending_purchases_count || 0} Requisitions`}
          </p>
          <p className="mt-2 text-xs font-medium text-amber-800">Awaiting manager approval</p>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Shift Team</span>
          <p className="mt-3 text-2xl font-extrabold text-blue-800 sm:text-3xl">
            {isLoading ? "…" : `${stats?.active_team_count || 0} Active`}
          </p>
          <p className="mt-2 text-xs font-medium text-emerald-700">Active accounts</p>
        </article>
      </section>

      {/* Manager Action Hub */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        <h3 className="text-xl font-bold text-stone-900">
          Manager Action Hub
        </h3>
        <p className="mt-1 text-sm text-stone-500">
          Direct controls for store supervision, inventory auditing, and shift management.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {managerActions.map((action) => (
            <Link
              className="group flex flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50/50 p-5 transition hover:border-amber-400 hover:bg-white hover:shadow-md"
              key={action.title}
              to={action.path}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-3xl" role="img" aria-label={action.title}>
                    {action.icon}
                  </span>
                  <span className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-stone-700 group-hover:border-amber-300 group-hover:bg-amber-50 group-hover:text-amber-900">
                    {action.badge}
                  </span>
                </div>
                <h4 className="mt-4 text-base font-bold text-stone-900 group-hover:text-amber-950">
                  {action.title}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  {action.description}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-amber-800 transition group-hover:translate-x-1 group-hover:text-amber-950">
                <span>Access module</span>
                <span>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Shift Team on Duty */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              Shift Team on Duty
            </h3>
            <p className="text-xs text-stone-500">
              Active staff members from database.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Live Active
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {stats && stats.shift_team.length > 0 ? (
            stats.shift_team.map((member) => (
              <div
                className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 transition hover:bg-white"
                key={member.user_id}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-sm">{member.full_name}</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
                <p className="mt-1 text-xs font-semibold text-amber-900">{member.role_name}</p>
                <p className="mt-2 text-[11px] text-stone-500">@{member.username}</p>
              </div>
            ))
          ) : (
            <p className="col-span-3 text-xs text-stone-500">No staff members found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
