import { formatCurrency } from "../../payments/utils/currency";

export default function CategoryDistributionChart({
  topSellingItems = [],
  channelDistribution = [],
  paymentDistribution = [],
}) {
  const maxItemQty = Math.max(
    ...(topSellingItems || []).map((it) => it.quantity_sold || 0),
    1
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Top Performing Menu Items */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="border-b border-stone-100 pb-3">
          <h3 className="text-sm font-bold text-stone-900">
            Top Menu Items
          </h3>
          <p className="text-xs text-stone-500">
            Volume and contribution to current revenue.
          </p>
        </div>

        {(!topSellingItems || topSellingItems.length === 0) ? (
          <div className="py-8 text-center text-xs text-stone-400">
            No sales recorded in this timeframe.
          </div>
        ) : (
          <div className="mt-4 space-y-3.5">
            {topSellingItems.slice(0, 5).map((item, idx) => {
              const pct = Math.round((item.quantity_sold / maxItemQty) * 100);
              return (
                <div key={item.item_name || idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800">
                      {idx + 1}. {item.item_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500">{item.quantity_sold} sold</span>
                      <span className="font-bold text-stone-900">
                        {formatCurrency(item.revenue)}
                      </span>
                    </div>
                  </div>

                  {/* Minimal progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-amber-900 transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ordering Channels & Tender Breakdown */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="border-b border-stone-100 pb-3">
          <h3 className="text-sm font-bold text-stone-900">
            Channel &amp; Settlement Mix
          </h3>
          <p className="text-xs text-stone-500">
            Order origin distribution across POS register and online storefront.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Order Channels
            </span>
            <div className="mt-2 space-y-2">
              {(channelDistribution || []).map((ch) => (
                <div
                  key={ch.channel}
                  className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs"
                >
                  <span className="font-semibold capitalize text-stone-800">
                    {ch.channel.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">{ch.order_count} orders ({ch.percentage}%)</span>
                    <span className="font-bold text-stone-900">
                      {formatCurrency(ch.total_sales)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Payment Methods
            </span>
            <div className="mt-2 space-y-2">
              {(paymentDistribution || []).map((pm) => (
                <div
                  key={pm.method}
                  className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs"
                >
                  <span className="font-semibold uppercase text-stone-800">
                    {pm.method.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">{pm.order_count} paid ({pm.percentage}%)</span>
                    <span className="font-bold text-stone-900">
                      {formatCurrency(pm.total_sales)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
