import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import { fetchDashboardOverview, fetchStoreReports } from "../api/dashboardApi";
import SalesGraph from "./SalesGraph";
import TrendingCoffeeCard from "./TrendingCoffeeCard";
import RecentOrdersCard from "./RecentOrdersCard";

export default function ManagerDashboard({ onOpenPasswordModal }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportPeriod, setReportPeriod] = useState("today");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [overview, reports] = await Promise.all([
        fetchDashboardOverview().catch(() => null),
        fetchStoreReports(reportPeriod).catch(() => null),
      ]);
      if (overview?.manager_stats) {
        setStats(overview.manager_stats);
      }
      setReportData(reports);
    } catch (err) {
      console.error("Failed to load manager dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [reportPeriod]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handlePeriodChange = async (newPeriod) => {
    setReportPeriod(newPeriod);
    setIsLoadingReport(true);
    try {
      const reports = await fetchStoreReports(newPeriod);
      setReportData(reports);
    } catch (err) {
      console.error("Failed to load period report:", err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const managerActions = [
    {
      title: "Register & POS",
      description: "Manage register transactions, order queues, and customer service.",
      path: "/pos",
      badge: "Station",
      icon: (
        <svg className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Orders & Fulfillment",
      description: "Track live customer orders and resolve modifications or cancellations.",
      path: "/orders",
      badge: "Live",
      icon: (
        <svg className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Drink Queue (KDS)",
      description: "Monitor barista workflow and prep bottlenecks during rush hours.",
      path: "/preparation",
      badge: "Kitchen",
      icon: (
        <svg className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Menu & Catalog",
      description: "Update item availability, out-of-stock toggles, and specials.",
      path: "/menu",
      badge: "Catalog",
      icon: (
        <svg className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Stock Auditing",
      description: "Review current stock counts, log spoilage/waste, and audit inventory.",
      path: "/inventory",
      badge: "Stock",
      icon: (
        <svg className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Purchase Approvals",
      description: "Review and approve stock restocking requests submitted by inventory team.",
      path: "/purchasing",
      badge: "Supplies",
      icon: (
        <svg className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Colored Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
                Manager Command Center
              </span>
              <span className="text-xs text-stone-300">• Live Store Supervision</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Good day, {user?.first_name || "Manager"}
            </h1>
            <p className="mt-1.5 max-w-xl text-stone-200 text-xs sm:text-sm leading-relaxed">
              Supervise shift operations, monitor order throughput velocity, and coordinate team workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-stone-950 shadow-sm transition hover:bg-amber-400"
              onClick={loadData}
              type="button"
            >
              <svg className={`h-3.5 w-3.5 text-stone-950 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sync Shift Data
            </button>

            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
              to="/pos"
            >
              Open Register
            </Link>

            {onOpenPasswordModal && (
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-medium text-white backdrop-blur-xs transition hover:bg-white/20"
                onClick={onOpenPasswordModal}
                type="button"
              >
                Password
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Shift Revenue
          </span>
          <p className="mt-2 text-2xl font-extrabold text-stone-900">
            {isLoading ? "…" : `₱${Number(stats?.shift_revenue || 0).toFixed(2)}`}
          </p>
          <p className="mt-1 text-xs text-emerald-700 font-medium">Settled tickets today</p>
        </article>

        <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Order Pace
          </span>
          <p className="mt-2 text-2xl font-extrabold text-stone-900">
            {isLoading ? "…" : `${stats?.orders_per_hour || 0} / hr`}
          </p>
          <p className="mt-1 text-xs text-stone-500">Hourly throughput velocity</p>
        </article>

        <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Pending Approvals
          </span>
          <p className="mt-2 text-2xl font-extrabold text-amber-900">
            {isLoading ? "…" : `${stats?.pending_purchases_count || 0}`}
          </p>
          <p className="mt-1 text-xs text-amber-800">Awaiting purchase sign-off</p>
        </article>

        <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Staff on Duty
          </span>
          <p className="mt-2 text-2xl font-extrabold text-stone-900">
            {isLoading ? "…" : `${stats?.active_team_count || 0}`}
          </p>
          <p className="mt-1 text-xs text-stone-500">Active roster accounts</p>
        </article>
      </section>

      {/* Visual Analytics Section (Matching Reference Image) */}
      <section className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
            <SalesGraph
              isLoading={isLoadingReport}
              onPeriodChange={handlePeriodChange}
              period={reportPeriod}
              timeline={reportData?.timeline || []}
            />
          </div>
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
            <TrendingCoffeeCard
              items={reportData?.top_selling_items || []}
            />
          </div>
        </div>

        <RecentOrdersCard
          orders={stats?.recent_orders || []}
        />
      </section>

      {/* Shift Team on Duty */}
      <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Shift Team on Duty</h2>
            <p className="text-xs text-stone-500">Active branch staff registered in system</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            Active Roster
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {stats && stats.shift_team?.length > 0 ? (
            stats.shift_team.map((member) => (
              <div
                className="rounded-xl border border-stone-100 bg-stone-50/70 p-3.5"
                key={member.user_id}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">{member.full_name}</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="mt-1 text-[11px] font-semibold text-amber-900">{member.role_name}</p>
                {/* <p className="text-[10px] text-stone-400">@{member.username}</p> */}
              </div>
            ))
          ) : (
            <p className="col-span-3 text-xs text-stone-400">No shift team recorded.</p>
          )}
        </div>
      </section>
    </div>
  );
}
