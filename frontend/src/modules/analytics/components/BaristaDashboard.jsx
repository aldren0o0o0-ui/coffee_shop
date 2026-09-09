import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import { fetchBaristaQueue } from "../api/dashboardApi";
import { updateOrderStatus } from "../../orders/api/ordersApi";

export default function BaristaDashboard({ onOpenPasswordModal }) {
  const { user } = useAuth();
  const [queueData, setQueueData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  async function loadQueue() {
    try {
      const data = await fetchBaristaQueue();
      setQueueData(data);
    } catch (err) {
      console.error("Failed to load barista queue:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 10000); // 10s auto-refresh for kitchen queue
    return () => clearInterval(interval);
  }, []);

  async function handleAdvanceStage(orderId, currentStage) {
    const nextStage = currentStage === "confirmed" ? "preparing" : currentStage === "preparing" ? "ready" : null;
    if (!nextStage) return;

    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, nextStage);
      await loadQueue();
    } catch (err) {
      console.error(`Failed to update order #${orderId} to ${nextStage}:`, err);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Barista Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 p-6 text-white shadow-lg sm:p-10">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
                Barista Bar Station
              </span>
              <span className="text-xs text-amber-200/80">• Live Kitchen Display System (KDS)</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Brewing Excellence, {user?.first_name || "Barista"}!
            </h2>
            <p className="mt-2 max-w-xl text-amber-100 text-sm sm:text-base leading-relaxed">
              Real-time drink tickets from paid customer checkouts and POS registers. Advance tickets as you grind, steam, and serve.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-stone-950 shadow-md transition hover:bg-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300"
              onClick={loadQueue}
              type="button"
            >
              <svg className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh Tickets
            </button>

            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              to="/preparation"
            >
              Full Kitchen Screen
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

      {/* Barista Station Speed & KPI Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Drinks in Queue</span>
          <p className="mt-3 text-2xl font-extrabold text-amber-900 sm:text-3xl">
            {isLoading ? "…" : `${queueData?.queued_count || 0} waiting`}
          </p>
          <p className="mt-2 text-xs text-amber-700 font-medium">Ready for grinding & steaming</p>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Currently Brewing</span>
          <p className="mt-3 text-2xl font-extrabold text-blue-900 sm:text-3xl">
            {isLoading ? "…" : `${queueData?.preparing_count || 0} on bar`}
          </p>
          <p className="mt-2 text-xs text-blue-700 font-medium">Under active preparation</p>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Completed Today</span>
          <p className="mt-3 text-2xl font-extrabold text-emerald-800 sm:text-3xl">
            {isLoading ? "…" : `${queueData?.completed_today_count || 0} crafted`}
          </p>
          <p className="mt-2 text-xs text-emerald-700 font-medium">Handed off to customers</p>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Queue Status</span>
          <p className="mt-3 text-2xl font-extrabold text-stone-900 sm:text-3xl">
            {queueData?.tickets?.length || 0} Active
          </p>
          <p className="mt-2 text-xs text-stone-500">Live ticket queue</p>
        </article>
      </section>

      {/* Live Drink Queue Tickets from PostgreSQL */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-stone-900">
              Live Drink Preparation Queue
            </h3>
            <p className="text-xs text-stone-500">
              Click stage buttons to advance orders in real-time.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            Auto-Sync Active (10s)
          </span>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {queueData && queueData.tickets.length > 0 ? (
            queueData.tickets.map((ticket) => (
              <div
                className={`flex flex-col justify-between rounded-3xl border p-5 transition shadow-xs ${
                  ticket.order_status === "preparing"
                    ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-200"
                    : ticket.order_status === "ready"
                    ? "border-emerald-300 bg-emerald-50/40"
                    : "border-stone-200 bg-white"
                }`}
                key={ticket.order_id}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-stone-900 text-sm">Order #{ticket.order_id}</span>
                      {ticket.pickup_code && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">
                          {ticket.pickup_code}
                        </span>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                      ticket.order_status === "preparing"
                        ? "bg-amber-100 text-amber-900 animate-pulse"
                        : ticket.order_status === "ready"
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-stone-100 text-stone-700"
                    }`}>
                      {ticket.order_status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {ticket.items.map((item, idx) => (
                      <div className="space-y-1 rounded-2xl bg-stone-100/70 p-3 text-xs text-stone-800" key={idx}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-900 text-sm">
                            {item.quantity}x {item.item_name}
                          </span>
                          {item.size_name && (
                            <span className="font-semibold text-amber-900">({item.size_name})</span>
                          )}
                        </div>

                        {item.addons.length > 0 && (
                          <p className="text-stone-600"><span className="font-semibold">Add-ons:</span> {item.addons.join(", ")}</p>
                        )}
                        {item.special_instructions && (
                          <p className="font-medium text-amber-900"><span className="font-semibold">Note:</span> {item.special_instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="text-xs text-stone-500">
                    {ticket.customer_name} • {ticket.elapsed_minutes}m ago
                  </span>

                  {ticket.order_status === "confirmed" && (
                    <button
                      className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-950 disabled:opacity-50"
                      disabled={updatingId === ticket.order_id}
                      onClick={() => handleAdvanceStage(ticket.order_id, "confirmed")}
                      type="button"
                    >
                      {updatingId === ticket.order_id ? "Starting…" : "Start Brewing →"}
                    </button>
                  )}

                  {ticket.order_status === "preparing" && (
                    <button
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                      disabled={updatingId === ticket.order_id}
                      onClick={() => handleAdvanceStage(ticket.order_id, "preparing")}
                      type="button"
                    >
                      {updatingId === ticket.order_id ? "Updating…" : "Mark as Ready ✓"}
                    </button>
                  )}

                  {ticket.order_status === "ready" && (
                    <span className="text-xs font-bold text-emerald-800">Ready for Pickup ✓</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 rounded-3xl border border-stone-200 bg-stone-50 p-8 text-center">
              <p className="text-sm font-semibold text-stone-700">No active drink orders in preparation queue.</p>
              <p className="mt-1 text-xs text-stone-500">When customers complete online checkout or cashiers enter POS orders, they appear here instantly.</p>
            </div>
          )}
        </div>
      </section>

      {/* Low Stock Ingredients Warning */}
      {queueData && queueData.low_stock_ingredients.length > 0 && (
        <section className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 shadow-xs">
          <h3 className="text-sm font-bold text-rose-900">
            ⚠️ Low Stock Alert on Bar Station Ingredients
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {queueData.low_stock_ingredients.map((ing) => (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-800 shadow-2xs" key={ing.inventory_item_id}>
                {ing.item_name}: {Number(ing.quantity_on_hand).toFixed(1)} {ing.unit_of_measure} left
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
