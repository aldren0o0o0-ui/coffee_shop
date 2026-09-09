import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trackCustomerOrder } from "../api/ordersApi";

export default function CustomerTrackingPage() {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get("order_id") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [trackingResult, setTrackingResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const qOrderId = searchParams.get("order_id");
    const qEmail = searchParams.get("email");
    if (qOrderId && qEmail) {
      setOrderId(qOrderId);
      setEmail(qEmail);
      performTrack(qOrderId, qEmail);
    }
  }, [searchParams]);

  async function performTrack(targetId, targetEmail) {
    setErrorMessage("");
    setTrackingResult(null);

    if (!targetId || !targetEmail.trim()) {
      setErrorMessage("Please provide both your Order ID and Email address.");
      return;
    }

    setIsSearching(true);
    try {
      const result = await trackCustomerOrder(targetId, targetEmail.trim());
      setTrackingResult(result);
    } catch (err) {
      if (err.response?.status === 404) {
        setErrorMessage("We couldn't find that order — please check your order number and email address.");
      } else {
        setErrorMessage("Unable to retrieve order details. Please check your network and try again.");
      }
    } finally {
      setIsSearching(false);
    }
  }

  async function handleTrack(e) {
    e.preventDefault();
    performTrack(orderId, email);
  }

  const steps = ["confirmed", "preparing", "ready", "completed"];
  const stepLabels = {
    confirmed: "Order Received",
    preparing: "Brewing on Bar",
    ready: "Ready for Pickup",
    completed: "Picked Up",
  };

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900">
      {/* Header */}
      <header className="flex h-20 items-center justify-between border-b border-stone-200 bg-white px-6 sm:px-12">
        <Link className="flex items-center gap-2 text-xl font-black text-amber-950" to="/">
          <span>☕</span>
          <span>ldrn&apos;s coffee</span>
        </Link>
        <div className="flex items-center gap-4 text-xs font-bold text-amber-900">
          <Link className="hover:underline" to="/browse">
            Browse Menu 📖
          </Link>
          <Link className="rounded-xl bg-amber-900 px-3.5 py-1.5 text-white hover:bg-amber-950" to="/order">
            Order Online →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="text-center">
            <span className="text-3xl">🔍</span>
            <h1 className="mt-2 text-2xl font-black text-stone-900 sm:text-3xl">Track Your Order</h1>
            <p className="mt-1 text-xs text-stone-500">
              Enter your Order Number and Email to check preparation status and view your pickup code.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleTrack}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-stone-700" htmlFor="track-order-id">
                  Order Number
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm"
                  id="track-order-id"
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. 102"
                  required
                  type="number"
                  value={orderId}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700" htmlFor="track-email">
                  Email Address
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm"
                  id="track-email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">
                {errorMessage}
              </div>
            )}

            <button
              className="w-full rounded-2xl bg-amber-900 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-950 disabled:opacity-60"
              disabled={isSearching}
              type="submit"
            >
              {isSearching ? "Searching order…" : "Find Order Status"}
            </button>
          </form>

          {/* Tracking Result View */}
          {trackingResult && (
            <div className="mt-8 space-y-6 border-t border-stone-100 pt-6">
              <div className="flex flex-col justify-between gap-4 rounded-2xl bg-amber-50/70 p-5 sm:flex-row sm:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Order #{trackingResult.order_id}
                  </span>
                  <h2 className="text-xl font-black text-stone-900">
                    {trackingResult.customer_name}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Total: ${Number(trackingResult.total_amount).toFixed(2)} • {trackingResult.order_type}
                  </p>
                </div>

                {trackingResult.pickup_code && (
                  <div className="rounded-xl border border-amber-200 bg-white p-3 text-center">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Pickup Code</span>
                    <p className="text-2xl font-black tracking-wider text-amber-950">
                      {trackingResult.pickup_code}
                    </p>
                  </div>
                )}
              </div>

              {/* Status progression meter */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold">
                  {steps.map((st, i) => {
                    const currentIdx = steps.indexOf(trackingResult.order_status);
                    const isPassed = currentIdx >= i;
                    const isCurrent = trackingResult.order_status === st;

                    return (
                      <div className="flex flex-col items-center gap-1.5 text-center" key={st}>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          isCurrent
                            ? "bg-amber-900 text-white ring-4 ring-amber-200"
                            : isPassed
                            ? "bg-emerald-600 text-white"
                            : "bg-stone-200 text-stone-500"
                        }`}>
                          {isPassed && !isCurrent ? "✓" : i + 1}
                        </div>
                        <span className={`text-[10px] sm:text-xs ${isCurrent ? "text-amber-950 font-black" : "text-stone-500"}`}>
                          {stepLabels[st]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Items breakdown */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-bold text-stone-900 uppercase">Items Ordered</p>
                <div className="mt-2 space-y-1.5 text-xs text-stone-700">
                  {trackingResult.items.map((it) => (
                    <div className="flex justify-between" key={it.order_item_id}>
                      <span>{it.quantity}x {it.item_name} {it.size_name ? `(${it.size_name})` : ""}</span>
                      <span className="font-semibold">₱{Number(it.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
