import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import { useBranch } from "../../branches/context/useBranch";
import { fetchDashboardOverview } from "../api/dashboardApi";
import { fetchAlerts, resolveAlert } from "../../notifications/api/notificationsApi";

export default function OwnerDashboard({ onOpenPasswordModal }) {
  const { user } = useAuth();
  const { selectedBranchId, currentBranch } = useBranch();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingId, setIsResolvingId] = useState(null);
  const [error, setError] = useState("");

  const branchParam = selectedBranchId && selectedBranchId !== "all" ? Number(selectedBranchId) : null;

  async function loadData() {
    try {
      setError("");
      const [overview, alertsData] = await Promise.all([
        fetchDashboardOverview(branchParam),
        fetchAlerts(branchParam, false).catch(() => []),
      ]);
      setStats(overview.owner_stats);
      setAlerts(alertsData || []);
    } catch (err) {
      console.error("Failed to load owner dashboard stats:", err);
      setError("Unable to load real-time statistics from database.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000); // 20s auto-refresh
    return () => clearInterval(interval);
  }, [selectedBranchId]);

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
      change: currentBranch ? `Branch: ${currentBranch.name}` : "Across all branches",
      isPositive: true,
      icon: (
        <svg className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-emerald-50",
    },
    {
      title: "Completed Orders",
      value: stats ? `${stats.completed_orders_count} orders` : "0 orders",
      change: stats ? `Total today: ${stats.today_orders_count}` : "0 today",
      isPositive: true,
      icon: (
        <svg className="h-6 w-6 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-amber-50",
    },
    {
      title: "Active Staff",
      value: stats ? `${stats.active_staff_count} members` : "0",
      change: "Team accounts active",
      isPositive: true,
      icon: (
        <svg className="h-6 w-6 text-blue-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-blue-50",
    },
    {
      title: "Stock Health",
      value: stats ? `${stats.low_stock_count} Reorders` : "0",
      change: stats && stats.low_stock_count > 0 ? "Items below minimum" : "All items stocked",
      isPositive: stats?.low_stock_count === 0,
      icon: (
        <svg className="h-6 w-6 text-rose-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-rose-50",
    },
    {
      title: "Shift Cash Balance",
      value: cashVariance === 0 ? "₱0.00" : `₱${cashVariance.toFixed(2)}`,
      change: cashVariance === 0 ? "Shifts balanced" : "Closed shift discrepancy",
      isPositive: cashVariance === 0,
      icon: (
        <svg className="h-6 w-6 text-purple-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-purple-50",
    },
    {
      title: "Queue Health",
      value: `${queueHealth.total_queued} active`,
      change: queueHealth.delayed_count > 0 ? `⚠️ ${queueHealth.delayed_count} delayed (>20m)` : `Avg wait ~${queueHealth.avg_wait_minutes}m`,
      isPositive: queueHealth.delayed_count === 0,
      icon: (
        <svg className="h-6 w-6 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bg: "bg-amber-50",
    },
  ];

  const quickActions = [
    {
      title: "Team & Staff Accounts",
      description: "Add new staff members, set roles, and view access credentials.",
      path: "/team",
      badge: "Owner Exclusive",
      icon: "👥",
    },
    {
      title: "Menu & Pricing",
      description: "Manage drinks, sizes, custom add-ons, and pricing recipes.",
      path: "/menu",
      badge: "Full Control",
      icon: "☕",
    },
    {
      title: "Inventory & Stock",
      description: "Monitor ingredient levels, unit costs, and warehouse stock.",
      path: "/inventory",
      badge: "Real-time",
      icon: "📦",
    },
    {
      title: "Sales & Performance Reports",
      description: "Analyze daily turnover, popular items, and profit trends.",
      path: "/reports",
      badge: "Analytics",
      icon: "📈",
    },
    {
      title: "Purchasing & Approvals",
      description: "Review supplier purchase orders and approve restocking requests.",
      path: "/purchasing",
      badge: "Approval",
      icon: "📑",
    },
    {
      title: "Pickup Display Board",
      description: "Display customer pickup order numbers in full screen.",
      path: "/pickup",
      badge: "Live Screen",
      icon: "📺",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 p-6 text-white shadow-lg sm:p-10">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
                Owner Dashboard
              </span>
              {currentBranch && (
                <span className="rounded-full bg-stone-700/80 px-3 py-1 text-xs font-semibold text-stone-200">
                  📍 {currentBranch.name} ({currentBranch.code})
                </span>
              )}
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome back, {user?.first_name || "Owner"}!
            </h2>
            <p className="mt-2 max-w-xl text-amber-100/90 text-sm sm:text-base leading-relaxed">
              Your coffee shop management database is active. You have full administrative authority to oversee real-time sales, multi-branch stock, operational alerts, and order queues.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              to="/team"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Add Staff Member
            </Link>

            {onOpenPasswordModal && (
              <button
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20 cursor-pointer"
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

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}

      {/* Primary KPI Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <article
            className="group rounded-3xl border border-stone-200 bg-white p-5 shadow-xs transition hover:border-stone-300 hover:shadow-md"
            key={kpi.title}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {kpi.title}
              </span>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-stone-900">
              {isLoading ? "…" : kpi.value}
            </p>
            <p className={`mt-2 flex items-center text-xs font-medium ${kpi.isPositive ? "text-emerald-700" : "text-rose-700"}`}>
              {kpi.change}
            </p>
          </article>
        ))}
      </section>

      {/* Operational Alerts & System Health */}
      {alerts.length > 0 && (
        <section className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6 shadow-xs sm:p-8">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
                </span>
                <h3 className="text-lg font-bold text-stone-900">
                  Operational Alerts ({alerts.length})
                </h3>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                Real-time automated warnings triggered across stock thresholds, shift variances, and queue delays.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
              Action Required
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {alerts.map((alert) => (
              <div
                className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center"
                key={alert.alert_id}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        alert.severity === "critical"
                          ? "bg-rose-100 text-rose-800"
                          : alert.severity === "warning"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-sm font-bold text-stone-900">{alert.title}</span>
                  </div>
                  <p className="text-xs text-stone-600">{alert.message}</p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <button
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-200 disabled:opacity-50 cursor-pointer"
                    disabled={isResolvingId === alert.alert_id}
                    onClick={() => handleResolveAlert(alert.alert_id)}
                    type="button"
                  >
                    {isResolvingId === alert.alert_id ? "Resolving…" : "Resolve ✓"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Owner Management Launchpad */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-bold text-stone-900">
              Owner Management Hub
            </h3>
            <p className="text-sm text-stone-500">
              Direct access to all business modules and administrative tools.
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
            All Workspaces Connected
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              className="group relative flex flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50/50 p-5 transition hover:border-amber-400 hover:bg-white hover:shadow-md"
              key={action.title}
              to={action.path}
            >
              <div>
                <div className="flex items-center justify-between">
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
                <span>Open module</span>
                <span>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Live Store Performance & Orders Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders List */}
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs lg:col-span-2 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Live Store Activity
              </h3>
              <p className="text-xs text-stone-500">
                Real-time orders flowing through POS and customer checkout.
              </p>
            </div>
            <Link className="text-xs font-semibold text-amber-900 hover:underline" to="/orders">
              View all orders →
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {stats && stats.recent_orders.length > 0 ? (
              stats.recent_orders.map((order) => (
                <div
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-100 bg-stone-50/70 p-4 transition sm:flex-row sm:items-center"
                  key={order.order_id}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm">#{order.order_id}</span>
                      <span className="text-xs font-medium text-stone-600">• {order.customer_name}</span>
                      {order.pickup_code && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                          {order.pickup_code}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600">{order.items_summary}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <span className="font-bold text-stone-900 text-sm">₱{Number(order.total_amount).toFixed(2)}</span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        order.order_status === "completed"
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
              <p className="py-6 text-center text-xs text-stone-500">No orders recorded in database yet today.</p>
            )}
          </div>
        </section>

        {/* Low Stock Alerts */}
        <section className="flex flex-col justify-between rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              Low Stock Reorder Alerts
            </h3>
            <p className="text-xs text-stone-500">
              Live items currently below reorder thresholds.
            </p>

            <div className="mt-5 space-y-3">
              {stats && stats.low_stock_items.length > 0 ? (
                stats.low_stock_items.map((item) => (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5" key={item.inventory_item_id}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-amber-950">{item.item_name}</p>
                      <span className="text-[10px] font-bold text-rose-700">
                        {Number(item.quantity_on_hand).toFixed(1)} {item.unit_of_measure} left
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-800">
                      Reorder threshold: {Number(item.reorder_level).toFixed(1)} {item.unit_of_measure}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
                  <p className="text-xs font-bold text-emerald-900">✓ All Stock Levels Healthy</p>
                  <p className="mt-1 text-[11px] text-emerald-700">No ingredient is currently below reorder thresholds.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-stone-100 p-4 text-center">
            <p className="text-xs text-stone-600">
              Manage inventory and create supplier purchase orders.
            </p>
            <Link className="mt-2 inline-block text-xs font-bold text-stone-900 underline" to="/purchasing">
              Open Purchasing Module →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
