import { useState, useEffect } from "react";
import { useAuth } from "../../auth/context/useAuth";
import { fetchAllOrders, updateOrderStatus } from "../api/ordersApi";
import OrderDetailsModal from "../components/OrderDetailsModal";

export default function DrinkPreparationPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  // Polling state
  const [isPollingActive, setIsPollingActive] = useState(true);

  // Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // User roles
  const userRoles = user?.roles?.map((r) => r.role_name.toLowerCase()) || [];

  async function loadQueue(isInitial = false) {
    if (isInitial) {
      setIsLoading(true);
      setIsSlowLoading(false);
    }
    setLoadError("");

    const timer = setTimeout(() => {
      if (isInitial) setIsSlowLoading(true);
    }, 8000);

    try {
      const all = await fetchAllOrders();
      // Only show active queue orders: CONFIRMED and PREPARING
      const queueOrders = all.filter((o) => ["CONFIRMED", "PREPARING"].includes(o.order_status));
      setOrders(queueOrders);
    } catch (err) {
      console.error("Failed to load queue:", err);
      setLoadError("Unable to connect to the drink preparation queue. Please check network connection.");
    } finally {
      clearTimeout(timer);
      setIsLoading(false);
      setIsSlowLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadQueue(true);
  }, []);

  // Live polling every 10 seconds
  useEffect(() => {
    if (!isPollingActive) return;
    const interval = setInterval(() => {
      loadQueue(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [isPollingActive]);

  // Handle advancing status
  async function handleAdvance(orderId, nextStatus) {
    setActionError("");
    try {
      const updated = await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev
          .map((o) => (o.order_id === updated.order_id ? updated : o))
          .filter((o) => ["CONFIRMED", "PREPARING"].includes(o.order_status))
      );
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to advance order status.");
    }
  }

  // Elapsed time helper
  function getElapsedTime(orderDate) {
    const elapsedSec = Math.floor((Date.now() - new Date(orderDate).getTime()) / 1000);
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    return `${mins}m ${secs}s ago`;
  }

  return (
    <div className="space-y-6">
      {/* HEADER & QUEUE STATUS */}
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-950">
              ☕
            </span>
            <h1 className="text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
              Drink Preparation Queue
            </h1>
          </div>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Live barista workstation for newly confirmed tickets and drinks in progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Polling Status */}
          <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${isPollingActive ? "bg-emerald-500 animate-pulse" : "bg-stone-300"}`} />
            <span>
              {isPollingActive ? "Live sync (10s)" : "Paused"}
            </span>
            <button
              onClick={() => setIsPollingActive(!isPollingActive)}
              className="ml-1 text-[11px] font-bold text-amber-900 hover:underline"
              type="button"
            >
              {isPollingActive ? "Pause" : "Resume"}
            </button>
          </div>

          <button
            onClick={() => loadQueue(false)}
            className="flex items-center gap-1.5 rounded-2xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-800 transition"
            type="button"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* ERROR BANNER IF ACTION FAILED */}
      {actionError && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-900 shadow-xs">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError("")} className="text-rose-700 hover:text-rose-900">
            ✕
          </button>
        </div>
      )}

      {/* STATE 1: LOADING SKELETON */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="animate-pulse rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-6 w-20 rounded-xl bg-stone-200" />
                  <div className="h-5 w-16 rounded-lg bg-stone-100" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-3/4 rounded bg-stone-200" />
                  <div className="h-3 w-1/2 rounded bg-stone-100" />
                </div>
                <div className="h-10 w-full rounded-2xl bg-stone-100" />
              </div>
            ))}
          </div>

          {isSlowLoading && (
            <p className="text-center text-xs font-bold text-amber-800 bg-amber-50 p-3 rounded-2xl">
              ⏳ Still loading queue — this is taking longer than expected. Retrying...
            </p>
          )}
        </div>
      ) : loadError ? (
        /* STATE 4: ERROR WITH RETRY */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-rose-200 bg-rose-50/50 p-12 text-center shadow-xs">
          <span className="text-4xl">⚠️</span>
          <h3 className="mt-3 text-base font-bold text-stone-900">Unable to load preparation queue</h3>
          <p className="mt-1 max-w-md text-xs text-stone-600 leading-relaxed">
            {loadError}
          </p>
          <button
            onClick={() => loadQueue(true)}
            type="button"
            className="mt-4 rounded-xl bg-amber-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-800"
          >
            Retry Loading Queue
          </button>
        </div>
      ) : orders.length > 0 ? (
        /* STATE 2: POPULATED QUEUE */
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const isPreparing = order.order_status === "PREPARING";
            const elapsed = getElapsedTime(order.order_date);

            return (
              <div
                key={order.order_id}
                className={`group relative flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-xs transition hover:shadow-md ${
                  isPreparing ? "border-indigo-300 ring-2 ring-indigo-500/20" : "border-stone-200"
                }`}
              >
                <div>
                  {/* TICKET HEADER */}
                  <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-xs font-black text-amber-950">
                        #{order.order_id}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-stone-900 text-sm">
                          {order.customer_name || "Guest"}
                        </h3>
                        <span className="text-[10px] font-bold text-stone-400 uppercase">
                          {order.order_type || "Takeout"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider block ${
                          isPreparing
                            ? "bg-indigo-100 text-indigo-900"
                            : "bg-blue-100 text-blue-900"
                        }`}
                      >
                        {isPreparing ? "In Prep" : "Confirmed"}
                      </span>
                      <span className="text-[10px] font-bold text-stone-400 block">
                        ⏱️ {elapsed}
                      </span>
                    </div>
                  </div>

                  {/* LINE ITEMS */}
                  <div className="my-4 divide-y divide-stone-100">
                    {order.items?.map((item) => (
                      <div key={item.order_item_id} className="py-2 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-stone-900">
                            {item.quantity}x {item.item_name}
                          </span>
                          {item.size_name && (
                            <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-[10px] text-stone-700">
                              {item.size_name}
                            </span>
                          )}
                        </div>

                        {item.addons && item.addons.length > 0 && (
                          <div className="text-[11px] text-stone-500 pl-4">
                            + {item.addons.map((a) => a.addon_name).join(", ")}
                          </div>
                        )}

                        {item.special_instructions && (
                          <div className="rounded-lg bg-amber-50 p-1.5 text-[11px] font-bold text-amber-950 italic">
                            ⚠️ Note: &ldquo;{item.special_instructions}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* TICKET ACTIONS */}
                <div className="border-t border-stone-100 pt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100"
                  >
                    Inspect
                  </button>

                  {!isPreparing ? (
                    <button
                      type="button"
                      onClick={() => handleAdvance(order.order_id, "PREPARING")}
                      className="flex-1 rounded-xl bg-indigo-900 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-950 transition"
                    >
                      Start Prep ⏳
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAdvance(order.order_id, "READY")}
                      className="flex-1 rounded-xl bg-emerald-700 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                    >
                      Mark Ready 🔔
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* STATE 3: EMPTY QUEUE */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-16 text-center shadow-xs space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-3xl">
            ☕
          </div>
          <h3 className="text-base font-extrabold text-stone-900">
            No drinks in the queue right now
          </h3>
          <p className="max-w-sm text-xs text-stone-500 leading-relaxed">
            All confirmed customer and counter orders have been prepared. New tickets will appear here automatically in real time.
          </p>
        </div>
      )}

      {/* ORDER DETAILS MODAL */}
      <OrderDetailsModal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        userRoles={userRoles}
        onOrderUpdated={() => loadQueue(false)}
      />
    </div>
  );
}
