import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import { fetchInventoryDashboard } from "../api/dashboardApi";

export default function InventoryStaffDashboard({ onOpenPasswordModal }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    try {
      const data = await fetchInventoryDashboard();
      setStats(data);
    } catch (err) {
      console.error("Failed to load inventory dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const inventoryStats = [
    { label: "Tracked Items", value: stats ? `${stats.total_tracked_items} items` : "0", sub: "Raw stock & ingredients", color: "text-stone-900", bg: "bg-stone-50" },
    { label: "Low Stock Warnings", value: stats ? `${stats.low_stock_warnings_count} items` : "0", sub: "Below reorder threshold", color: "text-rose-700", bg: "bg-rose-50" },
    { label: "Purchase Requests", value: stats ? `${stats.active_purchase_requests_count} active` : "0", sub: "Requisitions in pipeline", color: "text-amber-800", bg: "bg-amber-50" },
    { label: "Database Status", value: "Live Sync", sub: "PostgreSQL inventory ledger", color: "text-emerald-800", bg: "bg-emerald-50" },
  ];

  const quickActions = [
    {
      title: "Receive Supplier Shipment",
      description: "Check in delivered goods, verify quantities, and update stock counts.",
      path: "/inventory",
      badge: "Stock In",
      icon: "📦",
    },
    {
      title: "Log Spoilage & Waste",
      description: "Record expired dairy, damaged stock, or spilled beans for shrinkage audit.",
      path: "/inventory",
      badge: "Audit",
      icon: "🗑️",
    },
    {
      title: "Create Purchase Request",
      description: "Draft a new restock requisition for Manager/Owner approval.",
      path: "/purchasing",
      badge: "Reorder",
      icon: "📝",
    },
    {
      title: "Ingredient Stock Audit",
      description: "Perform cycle counts and reconcile actual backroom quantities.",
      path: "/inventory",
      badge: "Recount",
      icon: "📊",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 p-6 text-white shadow-lg sm:p-10">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
                Inventory & Logistics
              </span>
              <span className="text-xs text-amber-200/80">• Stockroom Management</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Stockroom Control, {user?.first_name || "Inventory Staff"}!
            </h2>
            <p className="mt-2 max-w-xl text-stone-200 text-sm sm:text-base leading-relaxed">
              Track raw ingredients, audit stock levels, receive supplier shipments, and submit purchase requisitions to prevent shop stockouts.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 shadow-sm transition hover:bg-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-300"
              onClick={loadData}
              type="button"
            >
              <svg className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh Stock
            </button>

            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              to="/purchasing"
            >
              New Purchase Request
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

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {inventoryStats.map((stat) => (
          <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs transition hover:shadow-md" key={stat.label}>
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">{stat.label}</span>
            <p className={`mt-3 text-2xl font-extrabold sm:text-3xl ${stat.color}`}>
              {isLoading ? "…" : stat.value}
            </p>
            <p className="mt-2 text-xs text-stone-500">{stat.sub}</p>
          </article>
        ))}
      </section>

      {/* Quick Action Hub */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        <h3 className="text-xl font-bold text-stone-900">
          Stock Operations Hub
        </h3>
        <p className="mt-1 text-sm text-stone-500">
          Daily logging tools for receiving stock, recording usage, and auditing.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              className="group flex flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50/50 p-5 transition hover:border-amber-400 hover:bg-white hover:shadow-md"
              key={action.title}
              to={action.path}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{action.icon}</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-stone-700 shadow-2xs">
                    {action.badge}
                  </span>
                </div>
                <h4 className="mt-4 text-base font-bold text-stone-900 group-hover:text-amber-950">
                  {action.title}
                </h4>
                <p className="mt-1 text-xs text-stone-600">
                  {action.description}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-amber-900 group-hover:underline">
                <span>Open task</span>
                <span>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Critical Stock Alerts & Recent Transactions from DB */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Items */}
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Low Stock Threshold Alerts
              </h3>
              <p className="text-xs text-stone-500">
                Items requiring immediate purchase requisition.
              </p>
            </div>
            <Link className="text-xs font-semibold text-amber-900 hover:underline" to="/inventory">
              All inventory →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {stats && stats.low_stock_items.length > 0 ? (
              stats.low_stock_items.map((item) => (
                <div
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 sm:flex-row sm:items-center"
                  key={item.inventory_item_id}
                >
                  <div>
                    <p className="font-bold text-stone-900 text-sm">{item.item_name}</p>
                    <p className="text-xs text-stone-600">
                      Remaining: <span className="font-semibold text-rose-700">{Number(item.quantity_on_hand).toFixed(1)} {item.unit_of_measure}</span> (Min: {Number(item.reorder_level).toFixed(1)})
                    </p>
                    <p className="text-[11px] text-stone-400">Unit cost: ${Number(item.unit_cost).toFixed(2)}</p>
                  </div>

                  <Link
                    className="inline-flex items-center justify-center rounded-xl bg-amber-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-950"
                    to="/purchasing"
                  >
                    Request Reorder
                  </Link>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-emerald-700 font-semibold">✓ All stock levels are above reorder minimums.</p>
            )}
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Stock Activity Log
              </h3>
              <p className="text-xs text-stone-500">
                Recent inventory ledger transactions from database.
              </p>
            </div>
            <Link className="text-xs font-semibold text-amber-900 hover:underline" to="/inventory">
              Full log →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {stats && stats.recent_transactions.length > 0 ? (
              stats.recent_transactions.map((tx) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50/70 p-3.5"
                  key={tx.transaction_id}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        tx.transaction_type === "purchase_in"
                          ? "bg-emerald-100 text-emerald-800"
                          : tx.transaction_type === "waste"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-stone-200 text-stone-800"
                      }`}>
                        {tx.transaction_type}
                      </span>
                      <span className="font-semibold text-stone-900 text-xs">{tx.item_name}</span>
                    </div>
                    <p className="text-[11px] text-stone-500">By {tx.created_by_name}</p>
                  </div>

                  <span className={`font-bold text-xs ${
                    Number(tx.quantity_change) > 0 ? "text-emerald-700" : "text-rose-700"
                  }`}>
                    {Number(tx.quantity_change) > 0 ? "+" : ""}{Number(tx.quantity_change).toFixed(2)} {tx.unit_of_measure}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-stone-500">No recent transactions in log.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
