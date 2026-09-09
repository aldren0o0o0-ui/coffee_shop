import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import { fetchDashboardOverview } from "../api/dashboardApi";
import { createPosOrder } from "../../orders/api/ordersApi";
import { fetchMenuCatalog } from "../../menu/api/menuApi";

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

  async function loadData() {
    try {
      const overview = await fetchDashboardOverview();
      setStats(overview.cashier_stats);
    } catch (err) {
      console.error("Failed to load cashier dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMenu() {
    try {
      const catalog = await fetchMenuCatalog();
      setMenuCatalog(catalog);
      if (catalog.length > 0 && catalog[0].items.length > 0) {
        setSelectedItem(catalog[0].items[0]);
      }
    } catch (err) {
      console.error("Failed to load menu catalog:", err);
    }
  }

  useEffect(() => {
    loadData();
    loadMenu();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

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
            menu_item_size_id: selectedItem.sizes.length > 0 ? selectedItem.sizes[0].menu_item_size_id : null,
            quantity: 1,
            special_instructions: "Quick POS sale",
            addons: [],
          },
        ],
      });

      setPosSuccess(`Order #${result.order_id} processed! Pickup code: ${result.pickup_code}`);
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
    { label: "My Orders Taken", value: stats ? `${stats.my_orders_taken_count} orders` : "0", sub: "Today's register tickets", color: "text-amber-900", bg: "bg-amber-50" },
    { label: "Register Sales", value: stats ? `$${Number(stats.register_sales_total).toFixed(2)}` : "$0.00", sub: "Settled sales", color: "text-emerald-800", bg: "bg-emerald-50" },
    { label: "Awaiting Payment", value: stats ? `${stats.awaiting_payment_count} orders` : "0", sub: "Held unpaid carts", color: "text-rose-700", bg: "bg-rose-50" },
    { label: "Ready for Pickup", value: stats ? `${stats.ready_for_pickup_count} orders` : "0", sub: "Ready at counter", color: "text-blue-800", bg: "bg-blue-50" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Cashier Welcome & POS Launch Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-900 via-stone-900 to-stone-950 p-6 text-white shadow-lg sm:p-10">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
                Front Register Station
              </span>
              <span className="text-xs text-amber-200/80">• Live POS Connected</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready for Orders, {user?.first_name || "Cashier"}!
            </h2>
            <p className="mt-2 max-w-xl text-stone-200 text-sm sm:text-base leading-relaxed">
              Take customer orders, apply loyalty points, collect cash & card payments, and coordinate drink pickup at the front counter.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-base font-bold text-stone-950 shadow-md transition hover:bg-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300"
              onClick={() => setIsQuickPosOpen(true)}
              type="button"
            >
              <span className="text-xl">⚡</span>
              Quick Register Sale
            </button>

            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              to="/pos"
            >
              Full POS Screen
            </Link>

            {onOpenPasswordModal && (
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
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

      {/* Cashier Shift Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cashierStats.map((stat) => (
          <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs transition hover:shadow-md" key={stat.label}>
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">{stat.label}</span>
            <p className={`mt-3 text-2xl font-extrabold sm:text-3xl ${stat.color}`}>
              {isLoading ? "…" : stat.value}
            </p>
            <p className="mt-2 text-xs text-stone-500">{stat.sub}</p>
          </article>
        ))}
      </section>

      {/* Active Orders & Held Tickets from DB */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              Front Counter Active Queue
            </h3>
            <p className="text-xs text-stone-500">
              Live orders from database requiring payment or hand-off.
            </p>
          </div>
          <button className="text-xs font-semibold text-amber-900 hover:underline" onClick={loadData} type="button">
            Refresh queue ↻
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {stats && stats.active_orders.length > 0 ? (
            stats.active_orders.map((order) => (
              <div
                className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 sm:flex-row sm:items-center"
                key={order.order_id}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-sm">#{order.order_id}</span>
                    <span className="text-xs font-medium text-stone-600">• {order.customer_name}</span>
                    <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700 capitalize">
                      {order.order_channel}
                    </span>
                    {order.pickup_code && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        Code: {order.pickup_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600">{order.items_summary}</p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="font-extrabold text-stone-900 text-base">
                    ${Number(order.total_amount).toFixed(2)}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    order.order_status === "ready"
                      ? "bg-blue-100 text-blue-800"
                      : order.order_status === "awaiting_payment"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {order.order_status}
                  </span>
                  <Link
                    className="rounded-xl bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-950"
                    to="/orders"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-xs text-stone-500">No active counter orders at this moment.</p>
          )}
        </div>
      </section>

      {/* Quick POS Modal Dialog */}
      {isQuickPosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-bold text-stone-900">Quick POS Register Sale</h3>
              <button className="text-stone-400 hover:text-stone-700" onClick={() => setIsQuickPosOpen(false)} type="button">
                ✕
              </button>
            </div>

            {posSuccess && (
              <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                {posSuccess}
              </div>
            )}

            <form className="mt-4 space-y-4" onSubmit={handleQuickSale}>
              <div>
                <label className="block text-xs font-semibold text-stone-700" htmlFor="pos-guest-name">Customer Name</label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm"
                  id="pos-guest-name"
                  onChange={(e) => setCustomerName(e.target.value)}
                  type="text"
                  value={customerName}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700" htmlFor="pos-drink-select">Select Drink Item</label>
                <select
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm"
                  id="pos-drink-select"
                  onChange={(e) => {
                    const allItems = menuCatalog.flatMap((c) => c.items);
                    const found = allItems.find((i) => i.menu_item_id === Number(e.target.value));
                    setSelectedItem(found);
                  }}
                  value={selectedItem?.menu_item_id || ""}
                >
                  {menuCatalog.flatMap((c) => c.items).map((item) => (
                    <option key={item.menu_item_id} value={item.menu_item_id}>
                      {item.item_name} — ${Number(item.base_price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
                <span>Total Due:</span>
                <span className="text-base">${selectedItem ? Number(selectedItem.base_price * 1.08).toFixed(2) : "0.00"}</span>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700"
                  onClick={() => setIsQuickPosOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-amber-900 px-5 py-2 text-xs font-bold text-white hover:bg-amber-950 disabled:opacity-50"
                  disabled={isSubmittingOrder || !selectedItem}
                  type="submit"
                >
                  {isSubmittingOrder ? "Processing…" : "Charge Cash & Print Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
