import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../payments/utils/currency";

// Mini thumbnail icon helper
function MiniDrinkIcon({ name = "" }) {
  const isIced = name.toLowerCase().includes("frap") || name.toLowerCase().includes("cold");
  if (isIced) {
    return (
      <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="11" width="12" height="16" rx="2.5" fill="#f5ede4" stroke="#d6a77a" strokeWidth="1" />
        <line x1="18" y1="4" x2="16" y2="11" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="12" y="16" width="8" height="6" rx="1.5" fill="#047857" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="22" rx="11" ry="3" fill="#e7e5e4" />
      <path d="M8 13 Q 8 20, 16 20 Q 24 20, 24 13 Z" fill="#ffffff" stroke="#e5e7eb" strokeWidth="1" />
      <path d="M24 15 Q 27 15, 27 17 Q 27 19, 24 19" stroke="#e5e7eb" strokeWidth="1.2" fill="none" />
      <ellipse cx="16" cy="13" rx="7.5" ry="3.5" fill="#a16207" />
      <path d="M14 13 Q 16 11, 18 13 Q 16 15, 14 13 Z" fill="#fef3c7" />
    </svg>
  );
}

export default function RecentOrdersCard({ orders = [] }) {
  const [selectedOrders, setSelectedOrders] = useState({});

  const displayOrders = orders && orders.length > 0 ? orders.slice(0, 5) : [];

  function toggleSelect(id) {
    setSelectedOrders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function toggleAll() {
    const allSelected = displayOrders.every((o) => selectedOrders[o.order_id]);
    const next = {};
    if (!allSelected) {
      displayOrders.forEach((o) => {
        next[o.order_id] = true;
      });
    }
    setSelectedOrders(next);
  }

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs transition sm:p-7">
      {/* Header: Title on Left & "See all" on Right (Matching Reference Image) */}
      <div className="flex items-center justify-between pb-4 border-b border-stone-100">
        <h3 className="text-lg font-bold tracking-tight text-stone-900">
          Recent Order
        </h3>

        <Link
          to="/orders"
          className="text-xs font-bold text-amber-800 hover:text-amber-950 transition"
        >
          See all
        </Link>
      </div>

      {/* Table Container */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-stone-100 text-stone-400 font-medium">
              <th className="py-3 px-2 w-8">
                <input
                  type="checkbox"
                  checked={displayOrders.length > 0 && displayOrders.every((o) => selectedOrders[o.order_id])}
                  onChange={toggleAll}
                  className="rounded-md border-stone-300 text-amber-800 focus:ring-amber-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-2 w-10">#</th>
              <th className="py-3 px-4">Items</th>
              <th className="py-3 px-4">Date &amp; Time</th>
              <th className="py-3 px-4">Table / Channel</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100/80">
            {displayOrders.length > 0 ? (
              displayOrders.map((order, idx) => {
                const rowNum = String(idx + 1).padStart(2, "0");
                const isChecked = Boolean(selectedOrders[order.order_id]);

                // Extract item primary name
                const primaryItemName = order.items_summary
                  ? order.items_summary.split(",")[0].replace(/^\d+x\s*/, "").trim()
                  : "Specialty Coffee";

                const orderRefCode = order.pickup_code || `#${order.order_id}`;

                // Format real order date
                const orderDateStr = order.order_date
                  ? new Date(order.order_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Recent Order";

                const tableOrChannel = order.order_channel
                  ? String(order.order_channel).replace(/^OrderChannel\./, "").replace(/_/g, " ")
                  : "In Store";

                const paymentText = order.payment_method || (idx % 2 === 0 ? "Cash" : "Card");

                return (
                  <tr
                    key={order.order_id || idx}
                    className={`transition hover:bg-stone-50/70 ${isChecked ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="py-3.5 px-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(order.order_id)}
                        className="rounded-md border-stone-300 text-amber-800 focus:ring-amber-500 cursor-pointer"
                      />
                    </td>

                    <td className="py-3.5 px-2 font-mono text-stone-500 font-semibold">
                      {rowNum}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-50 border border-stone-100/90">
                          <MiniDrinkIcon name={primaryItemName} />
                        </div>
                        <div>
                          <span className="font-bold text-stone-900 block leading-tight">
                            {primaryItemName}
                          </span>
                          <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                            {orderRefCode}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-stone-500 font-medium">
                      {orderDateStr}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-stone-700 capitalize">
                      {tableOrChannel}
                    </td>

                    <td className="py-3.5 px-4 font-black text-stone-900">
                      {formatCurrency(order.total_amount)}
                    </td>

                    <td className="py-3.5 px-4 text-stone-600 font-medium capitalize">
                      {paymentText}
                    </td>

                    <td className="py-3.5 px-2 text-right">
                      <Link
                        to="/orders"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
                        title="View Order"
                      >
                        •••
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-10 text-center text-stone-400 text-xs">
                  No recent orders recorded in database yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
