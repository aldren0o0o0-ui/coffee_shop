import { useState } from "react";
import { updateOrderStatus } from "../api/ordersApi";

const STATE_COLORS = {
  AWAITING_PAYMENT: "bg-amber-100 text-amber-900 border-amber-300",
  CONFIRMED: "bg-blue-100 text-blue-900 border-blue-300",
  PREPARING: "bg-indigo-100 text-indigo-900 border-indigo-300",
  READY: "bg-emerald-100 text-emerald-900 border-emerald-300",
  COMPLETED: "bg-stone-100 text-stone-800 border-stone-300",
  CANCELLED: "bg-rose-100 text-rose-900 border-rose-300",
  EXPIRED: "bg-stone-200 text-stone-600 border-stone-300",
};

const TIMELINE_STEPS = ["CONFIRMED", "PREPARING", "READY", "COMPLETED"];

export default function OrderDetailsModal({
  isOpen,
  onClose,
  order,
  userRoles = [],
  onOrderUpdated,
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  if (!isOpen || !order) return null;

  const roles = userRoles.map((r) => r.toLowerCase());
  const isBarista = roles.includes("barista");
  const isCashier = roles.includes("cashier");
  const isManagerOrOwner = roles.includes("manager") || roles.includes("owner");

  const status = order.order_status;

  async function handleStatusAdvance(nextStatus) {
    setIsUpdating(true);
    setUpdateError("");
    try {
      const updated = await updateOrderStatus(order.order_id, nextStatus);
      if (onOrderUpdated) {
        onOrderUpdated(updated);
      }
      onClose();
    } catch (err) {
      setUpdateError(err.response?.data?.detail || "Failed to update order status.");
    } finally {
      setIsUpdating(false);
    }
  }

  // Determine permitted actions based on role and current state
  const canStartPrep = (isBarista || isManagerOrOwner) && status === "CONFIRMED";
  const canMarkReady = (isBarista || isManagerOrOwner) && status === "PREPARING";
  const canMarkCompleted = (isCashier || isManagerOrOwner) && status === "READY";
  const canCancel = (isCashier || isManagerOrOwner || isBarista) && ["AWAITING_PAYMENT", "CONFIRMED", "PREPARING"].includes(status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/70 p-3 backdrop-blur-xs sm:p-4 animate-in fade-in duration-150">
      <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-lg font-black text-amber-950">
              #{order.order_id}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-stone-900">
                  {order.customer_name || "Guest Customer"}
                </h3>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${STATE_COLORS[status] || "bg-stone-100 text-stone-700"}`}>
                  {status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                {order.order_channel?.toUpperCase()} • {order.order_type?.toUpperCase()} • Placed{" "}
                {new Date(order.order_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition"
            title="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {updateError && (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3.5 text-xs font-bold text-rose-800 border border-rose-200">
              <span>⚠️</span>
              <span>{updateError}</span>
            </div>
          )}

          {/* STATE MACHINE TIMELINE */}
          {!["CANCELLED", "EXPIRED"].includes(status) && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 block mb-3">
                Order Progression Timeline
              </span>
              <div className="grid grid-cols-4 gap-2 text-center">
                {TIMELINE_STEPS.map((step, idx) => {
                  const stepIndex = TIMELINE_STEPS.indexOf(status);
                  const isCurrent = status === step;
                  const isPassed = stepIndex >= idx;

                  return (
                    <div key={step} className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                          isCurrent
                            ? "bg-amber-900 text-white ring-4 ring-amber-200"
                            : isPassed
                            ? "bg-emerald-600 text-white"
                            : "bg-stone-200 text-stone-500"
                        }`}
                      >
                        {isPassed && !isCurrent ? "✓" : idx + 1}
                      </div>
                      <span className={`mt-1.5 text-[10px] font-bold ${isCurrent ? "text-amber-950 font-extrabold" : isPassed ? "text-stone-700" : "text-stone-400"}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* REFERENCE CODE BANNER FOR PENDING COUNTER ORDERS */}
          {order.reference_code && order.order_status === "AWAITING_PAYMENT" && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50/80 p-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                  Pay at Counter Reference Code
                </span>
                <span className="text-2xl font-black tracking-widest text-amber-950">
                  {order.reference_code}
                </span>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-amber-200/80 px-2.5 py-1 text-[10px] font-bold text-amber-900">
                  Awaiting In-Store Payment
                </span>
              </div>
            </div>
          )}

          {/* PICKUP CODE BANNER FOR CONFIRMED ORDERS */}
          {order.pickup_code && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                  Customer Pickup Code
                </span>
                <span className="text-2xl font-black tracking-widest text-amber-950">
                  {order.pickup_code}
                </span>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-amber-200/80 px-2.5 py-1 text-[10px] font-bold text-amber-900">
                  Single-Use Verified
                </span>
              </div>
            </div>
          )}

          {/* ORDER ITEMS LIST */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
              Ordered Items ({order.items?.length || 0})
            </h4>
            <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {order.items?.map((item) => (
                <div key={item.order_item_id} className="flex items-start justify-between p-3.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 font-extrabold text-amber-950">
                        {item.quantity}x
                      </span>
                      <span className="font-extrabold text-stone-900 text-sm">
                        {item.item_name}
                      </span>
                      {item.size_name && (
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                          {item.size_name}
                        </span>
                      )}
                    </div>

                    {item.addons && item.addons.length > 0 && (
                      <div className="pl-8 text-[11px] text-stone-500 space-y-0.5">
                        {item.addons.map((a) => (
                          <div key={a.order_item_addon_id}>
                            + {a.addon_name}{" "}
                            {Number(a.unit_price) > 0 && (
                              <span className="text-stone-400">
                                (₱{Number(a.unit_price).toFixed(2)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.special_instructions && (
                      <div className="pl-8 text-[11px] font-semibold text-amber-900 italic">
                        Note: &ldquo;{item.special_instructions}&rdquo;
                      </div>
                    )}
                  </div>

                  <span className="font-extrabold text-stone-900">
                    ₱{Number(item.subtotal).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* FINANCIAL TOTALS */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>₱{Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
            {Number(order.tax_amount) > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Tax</span>
                <span>₱{Number(order.tax_amount).toFixed(2)}</span>
              </div>
            )}
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Discount</span>
                <span>-₱{Number(order.discount_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-black text-stone-950">
              <span>Total Due</span>
              <span>₱{Number(order.total_amount || 0).toFixed(2)}</span>
            </div>

            {order.amount_tendered && (
              <div className="flex justify-between text-stone-600 pt-1">
                <span>Cash Tendered:</span>
                <span>₱{Number(order.amount_tendered).toFixed(2)}</span>
              </div>
            )}
            {order.change_due !== null && order.change_due !== undefined && (
              <div className="flex justify-between font-black text-emerald-800">
                <span>Change Given:</span>
                <span>₱{Number(order.change_due).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* RECEIPT PDF LINK */}
          {order.receipt_pdf_url && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 flex items-center justify-between text-xs">
              <span className="font-bold text-stone-700">Official Customer Receipt</span>
              <a
                href={order.receipt_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-1.5 font-bold text-white hover:bg-stone-800 transition"
              >
                <span>📄 View PDF</span>
              </a>
            </div>
          )}
        </div>

        {/* FOOTER & ROLE-GATED ACTIONS */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusAdvance("CANCELLED")}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition"
              >
                Cancel Order
              </button>
            )}

            {canStartPrep && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusAdvance("PREPARING")}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-950 disabled:opacity-50 transition"
              >
                <span>⏳</span>
                <span>{isUpdating ? "Updating..." : "Start Preparing"}</span>
              </button>
            )}

            {canMarkReady && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusAdvance("READY")}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-800 disabled:opacity-50 transition"
              >
                <span>🔔</span>
                <span>{isUpdating ? "Updating..." : "Mark as Ready"}</span>
              </button>
            )}

            {canMarkCompleted && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusAdvance("COMPLETED")}
                className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-stone-800 disabled:opacity-50 transition"
              >
                <span>✓</span>
                <span>{isUpdating ? "Updating..." : "Handed Off / Complete"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
