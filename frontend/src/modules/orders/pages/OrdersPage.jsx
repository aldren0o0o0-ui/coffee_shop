import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../auth/context/useAuth";
import { fetchAllOrders, updateOrderStatus } from "../api/ordersApi";
import OrderDetailsModal from "../components/OrderDetailsModal";

const STATE_BADGES = {
  AWAITING_PAYMENT: "bg-amber-100 text-amber-900 border-amber-300",
  CONFIRMED: "bg-blue-100 text-blue-900 border-blue-300",
  PREPARING: "bg-indigo-100 text-indigo-900 border-indigo-300",
  READY: "bg-emerald-100 text-emerald-900 border-emerald-300",
  COMPLETED: "bg-stone-100 text-stone-700 border-stone-300",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-300",
  EXPIRED: "bg-stone-200 text-stone-600 border-stone-300",
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // User roles
  const userRoles = user?.roles?.map((r) => r.role_name.toLowerCase()) || [];
  const isCashierOrManager =
    userRoles.includes("cashier") ||
    userRoles.includes("manager") ||
    userRoles.includes("owner");

  async function loadOrders() {
    setIsLoading(true);
    setLoadError("");
    try {
      const data = await fetchAllOrders();
      setOrders(data);
    } catch (err) {
      console.error("Failed to load orders:", err);
      setLoadError("Unable to load orders from database. Please check your network connection.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      let matchesStatus = true;
      if (statusFilter === "active") {
        matchesStatus = ["AWAITING_PAYMENT", "CONFIRMED", "PREPARING", "READY"].includes(o.order_status);
      } else if (statusFilter !== "all") {
        matchesStatus = o.order_status.toLowerCase() === statusFilter.toLowerCase();
      }

      const matchesSearch =
        !q ||
        o.order_id.toString().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.pickup_code && o.pickup_code.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  async function handleQuickComplete(orderId) {
    try {
      const updated = await updateOrderStatus(orderId, "COMPLETED");
      setOrders((prev) =>
        prev.map((o) => (o.order_id === updated.order_id ? updated : o))
      );
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to mark order as completed.");
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-950">
              📋
            </span>
            <h1 className="text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
              Customer & POS Orders
            </h1>
          </div>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Inspect live orders, audit customer payment receipts, and record drink handoffs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadOrders}
            className="flex items-center gap-1.5 rounded-2xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-800 transition"
            type="button"
          >
            <span>🔄</span>
            <span>Refresh Orders</span>
          </button>
        </div>
      </header>

      {/* FILTER CARD */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All Orders" },
              { id: "active", label: "Active Queue" },
              { id: "CONFIRMED", label: "Confirmed" },
              { id: "PREPARING", label: "Preparing" },
              { id: "READY", label: "Ready for Pickup" },
              { id: "COMPLETED", label: "Completed" },
              { id: "CANCELLED", label: "Cancelled" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === tab.id
                    ? "bg-amber-900 text-white shadow-xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search #, name, or code…"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs font-medium focus:border-amber-700 focus:bg-white focus:outline-none"
            />
            <span className="absolute left-2.5 top-2 text-xs text-stone-400">🔍</span>
          </div>
        </div>

        {/* ORDERS TABLE / FOUR STATES */}
        {isLoading ? (
          /* STATE 1: LOADING SKELETON */
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center justify-between p-4 rounded-2xl bg-stone-50 animate-pulse">
                <div className="h-4 w-24 bg-stone-200 rounded" />
                <div className="h-4 w-32 bg-stone-200 rounded" />
                <div className="h-4 w-16 bg-stone-200 rounded" />
                <div className="h-6 w-20 bg-stone-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          /* STATE 4: ERROR WITH RETRY */
          <div className="py-12 text-center text-xs text-rose-800 bg-rose-50 rounded-2xl p-6">
            <span className="text-3xl block mb-2">⚠️</span>
            <p className="font-bold">{loadError}</p>
            <button
              onClick={loadOrders}
              type="button"
              className="mt-3 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs"
            >
              Retry
            </button>
          </div>
        ) : filteredOrders.length > 0 ? (
          /* STATE 2: POPULATED ORDERS */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-100 text-stone-400 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="pb-3">Order #</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Channel / Type</th>
                  <th className="pb-3">Items Summary</th>
                  <th className="pb-3">Pickup Code</th>
                  <th className="pb-3">Total</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrders.map((order) => {
                  const isReady = order.order_status === "READY";
                  return (
                    <tr
                      key={order.order_id}
                      className="group transition hover:bg-stone-50/70"
                    >
                      <td className="py-4 font-black text-amber-950">
                        #{order.order_id}
                      </td>

                      <td className="py-4 font-bold text-stone-900">
                        {order.customer_name || "Guest"}
                        <span className="block text-[10px] font-normal text-stone-400">
                          {new Date(order.order_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>

                      <td className="py-4">
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700 uppercase">
                          {order.order_channel}
                        </span>
                        <span className="block text-[10px] text-stone-400 mt-0.5">
                          {order.order_type}
                        </span>
                      </td>

                      <td className="py-4 max-w-xs truncate text-stone-600">
                        {order.items?.map((i) => `${i.quantity}x ${i.item_name}`).join(", ")}
                      </td>

                      <td className="py-4 font-black tracking-widest text-amber-950">
                        {order.pickup_code || "—"}
                      </td>

                      <td className="py-4 font-extrabold text-stone-900">
                        ${Number(order.total_amount).toFixed(2)}
                      </td>

                      <td className="py-4">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                            STATE_BADGES[order.order_status] || "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {order.order_status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-100 shadow-xs"
                        >
                          Inspect
                        </button>

                        {isReady && isCashierOrManager && (
                          <button
                            type="button"
                            onClick={() => handleQuickComplete(order.order_id)}
                            className="rounded-xl bg-stone-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-stone-800"
                          >
                            Complete ✓
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* STATE 3: EMPTY STATES */
          <div className="py-16 text-center space-y-2">
            <span className="text-3xl">📋</span>
            {orders.length === 0 ? (
              <>
                <h3 className="text-sm font-extrabold text-stone-900">No orders yet today</h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Once your first customer or counter POS order comes in, it will appear here in real time.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-extrabold text-stone-900">No orders match these filters</h3>
                <p className="text-xs text-stone-500">
                  Try adjusting your search query or status filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-2 text-xs font-bold text-amber-900 hover:underline block mx-auto"
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* INSPECT ORDER DETAILS MODAL */}
      <OrderDetailsModal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        userRoles={userRoles}
        onOrderUpdated={loadOrders}
      />
    </div>
  );
}
