import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useBranch } from "../../branches/context/useBranch";
import { fetchDashboardOverview, fetchStoreReports } from "../api/dashboardApi";
import { fetchAlerts, resolveAlert } from "../../notifications/api/notificationsApi";
import SalesGraph from "./SalesGraph";
import TrendingCoffeeCard from "./TrendingCoffeeCard";
import RecentOrdersCard from "./RecentOrdersCard";

export default function OwnerDashboard() {
  const { selectedBranchId, currentBranch } = useBranch();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [reportPeriod, setReportPeriod] = useState("today");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isResolvingId, setIsResolvingId] = useState(null);
  const [error, setError] = useState("");

  const branchParam = selectedBranchId && selectedBranchId !== "all" ? Number(selectedBranchId) : null;

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [overview, alertsData, reports] = await Promise.all([
        fetchDashboardOverview(branchParam),
        fetchAlerts(branchParam, false).catch(() => []),
        fetchStoreReports(reportPeriod).catch(() => null),
      ]);
      setStats(overview.owner_stats);
      setAlerts(alertsData || []);
      if (reports) setReportData(reports);
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
      setError("Unable to load real-time statistics from server.");
    } finally {
      setIsLoading(false);
    }
  }, [branchParam, reportPeriod]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle graph period toggle
  async function handleGraphPeriodChange(newPeriod) {
    setReportPeriod(newPeriod);
    setIsLoadingReport(true);
    try {
      const data = await fetchStoreReports(newPeriod);
      setReportData(data);
    } catch (err) {
      console.error("Failed to change report period:", err);
    } finally {
      setIsLoadingReport(false);
    }
  }

  async function handleResolveAlert(alertId) {
    try {
      setIsResolvingId(alertId);
      await resolveAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
      if (stats) {
        setStats((prev) => ({
          ...prev,
          active_alerts_count: Math.max(0, (prev.active_alerts_count || 1) - 1),
        }));
      }
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    } finally {
      setIsResolvingId(null);
    }
  }

  const cashVariance = Number(stats?.cash_variance_today || 0);
  const queueHealth = stats?.queue_health || { total_queued: 0, delayed_count: 0, avg_wait_minutes: 0, status: "healthy" };

  const kpis = [
    {
      title: "Today's Revenue",
      value: stats ? `₱${Number(stats.today_revenue).toFixed(2)}` : "₱0.00",
      change: currentBranch ? `${currentBranch.name}` : "All branches",
      isPositive: true,
      icon: (
        <svg className="h-5 w-5 text-emerald-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-emerald-50",
    },
    {
      title: "Completed Orders",
      value: stats ? `${stats.completed_orders_count}` : "0",
      change: stats ? `${stats.today_orders_count} received today` : "0 today",
      isPositive: true,
      icon: (
        <svg className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-amber-50",
    },
    {
      title: "Active Staff",
      value: stats ? `${stats.active_staff_count}` : "0",
      change: "Active user profiles",
      isPositive: true,
      icon: (
        <svg className="h-5 w-5 text-blue-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-blue-50",
    },
    {
      title: "Stock Reorders",
      value: stats ? `${stats.low_stock_count}` : "0",
      change: stats && stats.low_stock_count > 0 ? "Items low on stock" : "Levels adequate",
      isPositive: stats?.low_stock_count === 0,
      icon: (
        <svg className="h-5 w-5 text-rose-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-rose-50",
    },
    {
      title: "Shift Discrepancy",
      value: cashVariance === 0 ? "₱0.00" : `₱${cashVariance.toFixed(2)}`,
      change: cashVariance === 0 ? "Register balanced" : "Drawer discrepancy",
      isPositive: cashVariance === 0,
      icon: (
        <svg className="h-5 w-5 text-purple-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-purple-50",
    },
    {
      title: "Queue Health",
      value: `${queueHealth.total_queued} active`,
      change: queueHealth.delayed_count > 0 ? `${queueHealth.delayed_count} delayed (>20m)` : `Avg ~${queueHealth.avg_wait_minutes}m wait`,
      isPositive: queueHealth.delayed_count === 0,
      icon: (
        <svg className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-amber-50",
    },
  ];

  const quickActions = [
    {
      title: "Team & Access",
      description: "Manage staff accounts, assign roles, and configure system permissions.",
      path: "/team",
      icon: (
        <svg className="h-5 w-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Menu Catalog",
      description: "Configure drinks, cup sizes, custom add-ons, and pricing rules.",
      path: "/menu",
      icon: (
        <svg className="h-5 w-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Stock & Ingredients",
      description: "Track inventory, view unit cost history, and record waste adjustments.",
      path: "/inventory",
      icon: (
        <svg className="h-5 w-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Costing & Margins",
      description: "Analyze ingredient costs, gross margin percentages, and product pricing.",
      path: "/costing",
      icon: (
        <svg className="h-5 w-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Purchasing",
      description: "Create purchase requests, review supplier orders, and receive shipments.",
      path: "/purchasing",
      icon: (
        <svg className="h-5 w-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Customer CRM",
      description: "Review customer purchase profiles, preferences, and loyalty activity.",
      path: "/customers",
      icon: (
        <svg className="h-5 w-5 text-stone-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" />
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
                Executive Command Center
              </span>
              <span className="text-xs text-stone-300">
                • {currentBranch ? `${currentBranch.name} (${currentBranch.code})` : "All Branches Live"}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Store Operations & Performance
            </h1>
            <p className="mt-1.5 max-w-xl text-stone-200 text-xs sm:text-sm leading-relaxed">
              Real-time turnover, product demand velocity, staff roster, and operational health.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Sync (20s)
            </span>

            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 shadow-sm transition hover:bg-amber-400"
            >
              Detailed Reports
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* Primary KPI Metrics */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <article
            className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs transition hover:border-stone-300"
            key={kpi.title}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                {kpi.title}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                {kpi.icon}
              </div>
            </div>
            <p className="mt-2 text-xl font-extrabold tracking-tight text-stone-900">
              {isLoading ? "…" : kpi.value}
            </p>
            <p className={`mt-1 text-[11px] font-medium ${kpi.isPositive ? "text-emerald-700" : "text-rose-600"}`}>
              {kpi.change}
            </p>
          </article>
        ))}
      </section>

      {/* Visual Analytics Section (Matching Reference Image) */}
      <section className="space-y-6">
        {/* Top Row: Sales Analytics (Left) & Trending Coffee (Right) */}
        <div className="grid gap-6 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
            <SalesGraph
              timeline={reportData?.timeline || []}
              period={reportPeriod}
              onPeriodChange={handleGraphPeriodChange}
              isLoading={isLoadingReport}
            />
          </div>
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
            <TrendingCoffeeCard
              items={reportData?.top_selling_items || []}
            />
          </div>
        </div>

        {/* Bottom Row: Recent Orders Table */}
        <RecentOrdersCard
          orders={stats?.recent_orders || []}
        />
      </section>

      {/* Operational Alerts */}
      {alerts.length > 0 && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <h3 className="text-sm font-bold text-stone-900">
                Operational Alerts ({alerts.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-rose-700">Action Required</span>
          </div>

          <div className="mt-3 space-y-2.5">
            {alerts.map((alert) => (
              <div
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3.5 shadow-2xs"
                key={alert.alert_id}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${alert.severity === "critical"
                          ? "bg-rose-100 text-rose-800"
                          : alert.severity === "warning"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs font-bold text-stone-900">{alert.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600">{alert.message}</p>
                </div>

                <button
                  className="self-end sm:self-center rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                  disabled={isResolvingId === alert.alert_id}
                  onClick={() => handleResolveAlert(alert.alert_id)}
                  type="button"
                >
                  {isResolvingId === alert.alert_id ? "Resolving…" : "Resolve"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modern Workstation Launchpad */}
      {/* <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="border-b border-stone-100 pb-3">
          <h3 className="text-sm font-bold text-stone-900">
            Workstation Modules
          </h3>
          <p className="text-xs text-stone-500">
            Direct navigation to operational management views.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              className="group flex flex-col justify-between rounded-xl border border-stone-100 bg-stone-50/50 p-4 transition hover:border-stone-300 hover:bg-white hover:shadow-xs"
              key={action.title}
              to={action.path}
            >
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-700 group-hover:bg-amber-50 group-hover:text-amber-900 transition">
                  {action.icon}
                </div>
                <h4 className="mt-3 text-sm font-bold text-stone-900">
                  {action.title}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">
                  {action.description}
                </p>
              </div>

              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-stone-700 group-hover:text-amber-900 transition">
                <span>Open view</span>
                <span>&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </section> */}

      {/* Live Store Orders & Stock Alerts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders List */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs lg:col-span-2 sm:p-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Live Register Activity
              </h3>
              <p className="text-xs text-stone-500">
                Recent orders processed across POS and customer checkout.
              </p>
            </div>
            <Link className="text-xs font-semibold text-stone-700 hover:text-amber-950 hover:underline" to="/orders">
              All Orders &rarr;
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {stats && stats.recent_orders.length > 0 ? (
              stats.recent_orders.map((order) => (
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-stone-100 bg-stone-50/60 p-3 text-xs"
                  key={order.order_id}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">#{order.order_id}</span>
                      <span className="font-medium text-stone-600">{order.customer_name}</span>
                      {order.pickup_code && (
                        <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-800">
                          {order.pickup_code}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 truncate max-w-md">{order.items_summary}</p>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1">
                    <span className="font-bold text-stone-900">₱{Number(order.total_amount).toFixed(2)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${order.order_status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.order_status === "confirmed" || order.order_status === "preparing"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-stone-200 text-stone-700"
                        }`}
                    >
                      {order.order_status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-stone-400">No transactions recorded yet today.</p>
            )}
          </div>
        </section>

        {/* Low Stock Watch */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6 flex flex-col justify-between">
          <div>
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-sm font-bold text-stone-900">
                Low Stock Thresholds
              </h3>
              <p className="text-xs text-stone-500">
                Active items below minimum reorder levels.
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              {stats && stats.low_stock_items.length > 0 ? (
                stats.low_stock_items.map((item) => (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 text-xs" key={item.inventory_item_id}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-stone-900">{item.item_name}</p>
                      <span className="font-bold text-rose-700 text-[11px]">
                        {Number(item.quantity_on_hand).toFixed(1)} {item.unit_of_measure}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-stone-500">
                      Minimum threshold: {Number(item.reorder_level).toFixed(1)} {item.unit_of_measure}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
                  <p className="text-xs font-bold text-emerald-900">Stock Levels Optimal</p>
                  <p className="mt-0.5 text-[11px] text-emerald-700">All tracked ingredients are above minimum reorder levels.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-stone-50 p-3.5 text-center border border-stone-100">
            <Link className="text-xs font-bold text-stone-800 hover:text-amber-950 underline" to="/purchasing">
              Open Purchasing &amp; Restock &rarr;
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
