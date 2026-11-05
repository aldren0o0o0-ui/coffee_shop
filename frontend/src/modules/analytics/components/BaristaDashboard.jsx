import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import { fetchBaristaQueue } from "../api/dashboardApi";
import { updateOrderStatus } from "../../orders/api/ordersApi";
import BaristaThroughputGraph from "./BaristaThroughputGraph";

export default function BaristaDashboard({ onOpenPasswordModal }) {
  const { user } = useAuth();
  const [queueData, setQueueData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const loadQueue = useCallback(async () => {
    try {
      const data = await fetchBaristaQueue();
      setQueueData(data);
    } catch (err) {
      console.error("Failed to load barista queue:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadQueue();
      }
    }, 15000); // 15s auto-refresh for kitchen queue when tab is active
    return () => clearInterval(interval);
  }, [loadQueue]);

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
    <div className="space-y-6">
      {/* Colored Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-wider text-amber-300 uppercase">
                Barista Bar Station
              </span>
              <span className="text-xs text-amber-200/80">• Live Kitchen Display System (KDS)</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Brewing Excellence, {user?.first_name || "Barista"}
            </h1>
            <p className="mt-1.5 max-w-xl text-amber-100/90 text-xs sm:text-sm leading-relaxed">
              Real-time drink tickets from paid customer checkouts and POS registers. Advance tickets as you craft.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-stone-950 shadow-md transition hover:bg-amber-300"
              onClick={loadQueue}
              type="button"
            >
              <svg className={`h-3.5 w-3.5 text-stone-950 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh Tickets
            </button>

            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
              to="/preparation"
            >
              Full Kitchen Screen
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

      {/* Barista KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Queue Waiting</span>
          <p className="mt-2 text-2xl font-extrabold text-amber-900">
            {isLoading ? "…" : `${queueData?.queued_count || 0}`}
          </p>
          <p className="mt-1 text-xs text-amber-800 font-medium">Ready for grinding & steaming</p>
        </article>

        <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Under Preparation</span>
          <p className="mt-2 text-2xl font-extrabold text-stone-900">
            {isLoading ? "…" : `${queueData?.preparing_count || 0}`}
          </p>
          <p className="mt-1 text-xs text-stone-500 font-medium">Currently on espresso bar</p>
        </article>

        <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Completed Today</span>
          <p className="mt-2 text-2xl font-extrabold text-emerald-800">
            {isLoading ? "…" : `${queueData?.completed_today_count || 0}`}
          </p>
          <p className="mt-1 text-xs text-emerald-700 font-medium">Delivered to counter</p>
        </article>

        <article className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Active Queue</span>
          <p className="mt-2 text-2xl font-extrabold text-stone-900">
            {queueData?.tickets?.length || 0}
          </p>
          <p className="mt-1 text-xs text-stone-500">Live order tickets</p>
        </article>
      </section>

      {/* Visual Kitchen Throughput Graph */}
      <BaristaThroughputGraph queueData={queueData} />

      {/* Live Ticket Preparation Cards */}
      <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-stone-900">
              Drink Preparation Queue
            </h2>
            <p className="text-xs text-stone-500">
              Advance tickets through preparation stages
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
            Auto-Sync (10s)
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {queueData && queueData.tickets?.length > 0 ? (
            queueData.tickets.map((ticket) => (
              <div
                className={`flex flex-col justify-between rounded-xl border p-4 transition shadow-2xs ${
                  ticket.order_status === "preparing"
                    ? "border-amber-300 bg-amber-50/30"
                    : ticket.order_status === "ready"
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-stone-200 bg-white"
                }`}
                key={ticket.order_id}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900 text-xs">#{ticket.order_id}</span>
                      {ticket.pickup_code && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                          {ticket.pickup_code}
                        </span>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      ticket.order_status === "preparing"
                        ? "bg-amber-100 text-amber-900"
                        : ticket.order_status === "ready"
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-stone-100 text-stone-700"
                    }`}>
                      {ticket.order_status}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {ticket.items.map((item, idx) => (
                      <div className="rounded-lg bg-stone-50 p-2.5 text-xs text-stone-800" key={idx}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-900">
                            {item.quantity}x {item.item_name}
                          </span>
                          {item.size_name && (
                            <span className="text-[11px] font-medium text-amber-900">
                              ({item.size_name})
                            </span>
                          )}
                        </div>

                        {item.addons?.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-stone-500">
                            Add-ons: {item.addons.join(", ")}
                          </p>
                        )}
                        {item.special_instructions && (
                          <p className="mt-0.5 text-[11px] text-amber-800 font-medium">
                            Note: {item.special_instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2.5">
                  <span className="text-[11px] text-stone-400">
                    {ticket.customer_name} • {ticket.elapsed_minutes}m ago
                  </span>

                  {ticket.order_status === "confirmed" && (
                    <button
                      className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
                      disabled={updatingId === ticket.order_id}
                      onClick={() => handleAdvanceStage(ticket.order_id, "confirmed")}
                      type="button"
                    >
                      {updatingId === ticket.order_id ? "Starting…" : "Start Brewing →"}
                    </button>
                  )}

                  {ticket.order_status === "preparing" && (
                    <button
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                      disabled={updatingId === ticket.order_id}
                      onClick={() => handleAdvanceStage(ticket.order_id, "preparing")}
                      type="button"
                    >
                      {updatingId === ticket.order_id ? "Updating…" : "Mark Ready ✓"}
                    </button>
                  )}

                  {ticket.order_status === "ready" && (
                    <span className="text-xs font-bold text-emerald-800">Ready at Counter</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 rounded-xl border border-stone-200 bg-stone-50 p-6 text-center">
              <p className="text-xs font-semibold text-stone-600">No active drink tickets in preparation queue.</p>
              <p className="mt-0.5 text-[11px] text-stone-400">Paid customer orders and register tickets will appear here automatically.</p>
            </div>
          )}
        </div>
      </section>

      {/* Low Stock Ingredients Alert */}
      {queueData && queueData.low_stock_ingredients?.length > 0 && (
        <section className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Station Inventory Notice
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {queueData.low_stock_ingredients.map((ing) => (
              <span
                className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
                key={ing.inventory_item_id}
              >
                {ing.item_name}: {Number(ing.quantity_on_hand).toFixed(1)} {ing.unit_of_measure} left
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
