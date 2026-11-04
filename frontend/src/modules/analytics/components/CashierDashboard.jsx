import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import { fetchDashboardOverview } from "../api/dashboardApi";
import { createPosOrder } from "../../orders/api/ordersApi";
import { fetchMenuCatalog } from "../../menu/api/menuApi";
import CashierRegisterGraph from "./CashierRegisterGraph";

export default function CashierDashboard({ onOpenPasswordModal }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick POS modal state
  const [isQuickPosOpen, setIsQuickPosOpen] = useState(false);
  const [menuCatalog, setMenuCatalog] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [customerName, setCustomerName] = useState("Walk-in Guest");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [posSuccess, setPosSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const overview = await fetchDashboardOverview();
      if (overview?.cashier_stats) {
        setStats(overview.cashier_stats);
      }
    } catch (err) {
      console.error("Failed to load cashier dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const catalog = await fetchMenuCatalog();
      setMenuCatalog(catalog);
      if (catalog.length > 0 && catalog[0].items?.length > 0) {
        setSelectedItem(catalog[0].items[0]);
      }
    } catch (err) {
      console.error("Failed to load menu catalog:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadMenu();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData, loadMenu]);

  async function handleQuickSale(e) {
    e.preventDefault();
    if (!selectedItem) return;

    setIsSubmittingOrder(true);
    setPosSuccess("");

    try {
      const result = await createPosOrder({
        customer_name: customerName.trim() || "Walk-in Guest",
        order_type: "takeout",
        payment_method: "cash",
        items: [
          {
            menu_item_id: selectedItem.menu_item_id,
            menu_item_size_id: selectedItem.sizes?.length > 0 ? selectedItem.sizes[0].menu_item_size_id : null,
            quantity: 1,
            special_instructions: "Quick POS sale",
            addons: [],
          },
        ],
      });

      setPosSuccess(`Order #${result.order_id} recorded (Code: ${result.pickup_code || "N/A"})`);
      loadData();
      setTimeout(() => {
        setIsQuickPosOpen(false);
        setPosSuccess("");
      }, 2000);
    } catch (err) {
      console.error("Failed to submit quick POS sale:", err);
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  const cashierStats = [
    { label: "My Orders Taken", value: stats ? `${stats.my_orders_taken_count} orders` : "0", sub: "Shift register tickets", color: "text-stone-900" },
    { label: "Register Sales", value: stats ? `₱${Number(stats.register_sales_total).toFixed(2)}` : "₱0.00", sub: "Settled sales", color: "text-amber-900" },
    { label: "Awaiting Payment", value: stats ? `${stats.awaiting_payment_count} orders` : "0", sub: "Held unpaid carts", color: "text-rose-700" },
    { label: "Ready for Pickup", value: stats ? `${stats.ready_for_pickup_count} orders` : "0", sub: "Ready at counter", color: "text-emerald-800" },
  ];

  return (
    <div className="space-y-6">
      {/* Colored Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-900 via-stone-900 to-stone-950 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
                Front Register Station
              </span>
              <span className="text-xs text-amber-200/80">• Live POS Connected</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Ready for Orders, {user?.first_name || "Cashier"}
            </h1>
            <p className="mt-1.5 max-w-xl text-stone-200 text-xs sm:text-sm leading-relaxed">
              Take counter orders, manage customer tenders, and coordinate beverage hand-off.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-stone-950 shadow-md transition hover:bg-amber-300"
              onClick={() => setIsQuickPosOpen(true)}
              type="button"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Quick Register Sale
            </button>

            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
              to="/pos"
            >
              Full POS Screen
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

      {/* KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cashierStats.map((stat) => (
          <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs" key={stat.label}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{stat.label}</span>
            <p className={`mt-2 text-2xl font-extrabold ${stat.color}`}>
              {isLoading ? "…" : stat.value}
            </p>
            <p className="mt-1 text-xs text-stone-500">{stat.sub}</p>
          </article>
        ))}
      </section>

      {/* Visual Register Velocity Graph */}
      <CashierRegisterGraph activeOrders={stats?.active_orders || []} stats={stats} />

      {/* Front Counter Active Queue */}
      <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-stone-900">
              Front Counter Active Queue
            </h2>
            <p className="text-xs text-stone-500">
              Live orders requiring payment tender or drink collection
            </p>
          </div>
          <button
            className="text-xs font-semibold text-stone-600 hover:text-stone-900"
            onClick={loadData}
            type="button"
          >
            Sync queue
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {stats && stats.active_orders?.length > 0 ? (
            stats.active_orders.map((order) => (
              <div
                className="flex flex-col justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/70 p-3.5 sm:flex-row sm:items-center"
                key={order.order_id}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-xs">#{order.order_id}</span>
                    <span className="text-xs font-medium text-stone-600">• {order.customer_name}</span>
                    <span className="rounded-md bg-stone-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700 capitalize">
                      {order.order_channel}
                    </span>
                    {order.pickup_code && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                        {order.pickup_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{order.items_summary}</p>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="font-extrabold text-stone-900 text-sm">
                    ₱{Number(order.total_amount).toFixed(2)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    order.order_status === "ready"
                      ? "bg-emerald-50 text-emerald-800"
                      : order.order_status === "awaiting_payment"
                      ? "bg-rose-50 text-rose-800"
                      : "bg-amber-50 text-amber-900"
                  }`}>
                    {order.order_status}
                  </span>
                  <Link
                    className="rounded-lg bg-stone-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-stone-800"
                    to="/orders"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-xs text-stone-400">
              No active counter orders at this moment.
            </p>
          )}
        </div>
      </section>

      {/* Quick POS Dialog Modal */}
      {isQuickPosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-sm font-bold text-stone-900">Quick POS Register Sale</h3>
              <button
                className="text-stone-400 hover:text-stone-700"
                onClick={() => setIsQuickPosOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            {posSuccess && (
              <div className="mt-3 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800">
                {posSuccess}
              </div>
            )}

            <form className="mt-4 space-y-4" onSubmit={handleQuickSale}>
              <div>
                <label className="block text-xs font-semibold text-stone-700" htmlFor="pos-guest-name">
                  Customer Name
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2 text-xs focus:border-stone-900 focus:outline-none"
                  id="pos-guest-name"
                  onChange={(e) => setCustomerName(e.target.value)}
                  type="text"
                  value={customerName}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700" htmlFor="pos-product-select">
                  Select Product
                </label>
                <select
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2 text-xs focus:border-stone-900 focus:outline-none"
                  id="pos-product-select"
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const found = menuCatalog.flatMap((c) => c.items).find((it) => it.menu_item_id === id);
                    if (found) setSelectedItem(found);
                  }}
                  value={selectedItem?.menu_item_id || ""}
                >
                  {menuCatalog.map((cat) => (
                    <optgroup key={cat.category_id} label={cat.category_name}>
                      {cat.items?.map((it) => (
                        <option key={it.menu_item_id} value={it.menu_item_id}>
                          {it.item_name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
                <button
                  className="rounded-xl border border-stone-200 px-3.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  onClick={() => setIsQuickPosOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-stone-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
                  disabled={isSubmittingOrder || !selectedItem}
                  type="submit"
                >
                  {isSubmittingOrder ? "Processing…" : "Record Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
