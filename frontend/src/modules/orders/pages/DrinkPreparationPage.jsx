import { useState, useEffect, useMemo } from "react";
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

  // Tab filter: "queue" (confirmed & preparing) | "ready" (waiting for customer pickup) | "all"
  const [tabFilter, setTabFilter] = useState("all");

  // Polling state
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [prevCount, setPrevCount] = useState(0);

  // Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // User roles
  const userRoles = user?.roles?.map((r) => r.role_name.toLowerCase()) || [];

  function playAlertChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Audio chime unavailable:", e);
    }
  }

  function getEstimatedPrepTime(order, index) {
    const itemCount = order.items ? order.items.reduce((sum, it) => sum + (it.quantity || 1), 0) : 1;
    return 4 + itemCount * 2 + Math.max(index, 0) * 3;
  }

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
      // Show active orders: confirmed (newly paid), preparing (on bar), and ready (on pickup counter)
      const activeOrders = (all || []).filter((o) => {
        const status = (o.order_status || "").toLowerCase();
        return ["confirmed", "preparing", "ready"].includes(status);
      });

      if (!isInitial && activeOrders.length > prevCount && soundEnabled) {
        playAlertChime();
      }
      setPrevCount(activeOrders.length);
      setOrders(activeOrders);
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
      const updated = await updateOrderStatus(orderId, nextStatus.toLowerCase());
      setOrders((prev) => {
        const updatedList = prev.map((o) => (o.order_id === updated.order_id ? updated : o));
        return updatedList.filter((o) => {
          const status = (o.order_status || "").toLowerCase();
          return ["confirmed", "preparing", "ready"].includes(status);
        });
      });
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to advance order status.");
    }
  }

  // Elapsed time helper
  function getElapsedTime(orderDate) {
    if (!orderDate) return "just now";
    const elapsedSec = Math.floor((Date.now() - new Date(orderDate).getTime()) / 1000);
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    return `${mins}m ${secs}s ago`;
  }

  // Segment orders
  const inPrepOrders = useMemo(() => {
    return orders.filter((o) => ["confirmed", "preparing"].includes((o.order_status || "").toLowerCase()));
  }, [orders]);

  const readyOrders = useMemo(() => {
    return orders.filter((o) => (o.order_status || "").toLowerCase() === "ready");
  }, [orders]);

  const displayedOrders = useMemo(() => {
    if (tabFilter === "queue") return inPrepOrders;
    if (tabFilter === "ready") return readyOrders;
    return orders;
  }, [orders, tabFilter, inPrepOrders, readyOrders]);

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
              Drink Preparation Station
            </h1>
          </div>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Live barista workstation for brewing incoming tickets, dispatching orders, and managing customer pickups.
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

          {/* Audio Chime Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-xs transition ${
              soundEnabled
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-stone-200 bg-stone-50 text-stone-500"
            }`}
          >
            <span>{soundEnabled ? "🔔 Chime On" : "🔕 Muted"}</span>
          </button>

          {/* Link to public Pickup Display */}
          <a
            href="/pickup"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-700 shadow-xs hover:bg-stone-100 transition"
          >
            <span>📺</span>
            <span>Pickup TV Screen</span>
          </a>

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

      {/* QUEUE & COUNTER SUMMARY CARDS / TABS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setTabFilter("all")}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition shadow-xs ${
            tabFilter === "all"
              ? "border-amber-900 bg-amber-50/70 ring-2 ring-amber-400"
              : "border-stone-200 bg-white hover:border-stone-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 block">
              All Active Work
            </span>
            <span className="text-xl font-black text-stone-900 mt-0.5 block">
              {orders.length} Tickets
            </span>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-lg">
            📋
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabFilter("queue")}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition shadow-xs ${
            tabFilter === "queue"
              ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-400"
              : "border-stone-200 bg-white hover:border-stone-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 block">
              Brewing Queue
            </span>
            <span className="text-xl font-black text-stone-900 mt-0.5 block">
              {inPrepOrders.length} In Progress
            </span>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-lg">
            ☕
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabFilter("ready")}
          className={`flex items-center justify-between rounded-2xl border p-4 text-left transition shadow-xs ${
            tabFilter === "ready"
              ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-400"
              : "border-stone-200 bg-white hover:border-stone-300"
          }`}
        >
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 block">
              Ready on Counter
            </span>
            <span className="text-xl font-black text-emerald-950 mt-0.5 block">
              {readyOrders.length} Ready for Pickup
            </span>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-lg">
            🛎️
          </span>
        </button>
      </div>

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
      ) : displayedOrders.length > 0 ? (
        /* STATE 2: POPULATED TICKETS */
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayedOrders.map((order) => {
            const status = (order.order_status || "").toLowerCase();
            const isConfirmed = status === "confirmed";
            const isPreparing = status === "preparing";
            const isReady = status === "ready";
            const elapsed = getElapsedTime(order.order_date);

            return (
              <div
                key={order.order_id}
                className={`group relative flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-xs transition hover:shadow-md ${
                  isReady
                    ? "border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/10"
                    : isPreparing
                    ? "border-indigo-300 ring-2 ring-indigo-500/20"
                    : "border-stone-200"
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
                        <h3 className="font-extrabold text-stone-900 text-sm leading-tight">
                          {order.customer_name || "Guest"}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-stone-400 uppercase">
                            {order.order_type || "Takeout"}
                          </span>
                          {order.pickup_code && (
                            <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-[10px] font-black text-amber-950">
                              🏷️ {order.pickup_code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider block ${
                          isReady
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : isPreparing
                            ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
                            : "bg-blue-100 text-blue-900 border border-blue-300"
                        }`}
                      >
                        {isReady ? "Ready for Pickup" : isPreparing ? "In Prep" : "Confirmed"}
                      </span>
                      <span className="text-[10px] font-bold text-stone-400 block">
                        ⏱️ {elapsed}
                      </span>
                      {!isReady && (
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded block">
                          ~{getEstimatedPrepTime(order, 0)}m prep
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PROMINENT READY ON COUNTER BANNER */}
                  {isReady && (
                    <div className="mt-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-3 text-center space-y-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                        Customer Pickup Code
                      </span>
                      <span className="font-mono text-2xl font-black text-emerald-950 tracking-wider block">
                        {order.pickup_code || `#${order.order_id}`}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 block">
                        Ready on counter for customer collection
                      </span>
                    </div>
                  )}

                  {/* LINE ITEMS */}
                  <div className="my-4 divide-y divide-stone-100">
                    {order.items?.map((item) => (
                      <div key={item.order_item_id} className="py-2 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-stone-900">
                            {item.quantity}x {item.item_name}
                          </span>
                          {item.size_name && (
                            <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-700">
                              {item.size_name}
                            </span>
                          )}
                        </div>

                        {item.addons && item.addons.length > 0 && (
                          <div className="text-[11px] text-stone-500 pl-4 font-medium">
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
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition shadow-xs"
                  >
                    Inspect
                  </button>

                  {isConfirmed && (
                    <button
                      type="button"
                      onClick={() => handleAdvance(order.order_id, "preparing")}
                      className="flex-1 rounded-xl bg-indigo-900 py-2.5 text-xs font-black text-white shadow-xs hover:bg-indigo-950 transition"
                    >
                      Start Prep ⏳
                    </button>
                  )}

                  {isPreparing && (
                    <button
                      type="button"
                      onClick={() => handleAdvance(order.order_id, "ready")}
                      className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-800 transition"
                    >
                      Mark Ready 🔔
                    </button>
                  )}

                  {isReady && (
                    <button
                      type="button"
                      onClick={() => handleAdvance(order.order_id, "completed")}
                      className="flex-1 rounded-xl bg-stone-900 py-2.5 text-xs font-black text-white shadow-xs hover:bg-stone-800 transition"
                    >
                      ✓ Hand Off to Customer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* STATE 3: EMPTY QUEUE VIEW */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white p-16 text-center shadow-xs space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-3xl">
            {tabFilter === "ready" ? "🛎️" : "☕"}
          </div>
          <h3 className="text-base font-extrabold text-stone-900">
            {tabFilter === "ready"
              ? "No orders waiting for pickup right now"
              : tabFilter === "queue"
              ? "No drinks currently brewing on bar"
              : "No drinks in preparation station"}
          </h3>
          <p className="max-w-sm text-xs text-stone-500 leading-relaxed">
            {tabFilter === "ready"
              ? "Drinks marked ready will stay here with their pickup codes until handed off to the customer."
              : "All paid customer and counter orders have been prepared. New tickets will appear automatically in real time."}
          </p>
          {tabFilter !== "all" && (
            <button
              type="button"
              onClick={() => setTabFilter("all")}
              className="mt-2 text-xs font-bold text-amber-900 hover:underline"
            >
              View All Active Tickets ({orders.length})
            </button>
          )}
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
