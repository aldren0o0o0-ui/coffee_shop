import { useState, useMemo } from "react";

export default function InventoryStockHealthGraph({ stats }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  // Compile items with stock on hand vs reorder level
  const stockItems = useMemo(() => {
    const rawItems = stats?.low_stock_items || [];
    if (rawItems.length > 0) {
      return rawItems.slice(0, 6).map((it) => {
        const onHand = Number(it.quantity_on_hand || 0);
        const reorder = Number(it.reorder_level || 1);
        const ratio = Math.round((onHand / (reorder || 1)) * 100);
        return {
          id: it.inventory_item_id,
          name: it.item_name,
          onHand,
          reorder,
          unit: it.unit_of_measure,
          ratio,
          isCritical: it.is_critical || ratio < 50,
        };
      });
    }

    // Default coffee shop staple stock demonstration if no items are currently low
    return [
      { id: 1, name: "Espresso Blend Beans", onHand: 18.5, reorder: 10.0, unit: "kg", ratio: 185, isCritical: false },
      { id: 2, name: "Fresh Whole Milk", onHand: 14.0, reorder: 12.0, unit: "L", ratio: 116, isCritical: false },
      { id: 3, name: "Vanilla Flavor Syrup", onHand: 3.2, reorder: 5.0, unit: "bottles", ratio: 64, isCritical: false },
      { id: 4, name: "Barista Oat Milk", onHand: 2.5, reorder: 8.0, unit: "L", ratio: 31, isCritical: true },
      { id: 5, name: "16oz Hot Cups & Lids", onHand: 120, reorder: 250, unit: "pcs", ratio: 48, isCritical: true },
    ];
  }, [stats]);

  // Transaction flow summary
  const txSummary = useMemo(() => {
    const txs = stats?.recent_transactions || [];
    let stockIn = 0;
    let stockOut = 0;
    txs.forEach((tx) => {
      const chg = Number(tx.quantity_change || 0);
      if (chg > 0) stockIn += chg;
      else stockOut += Math.abs(chg);
    });
    return { stockIn, stockOut, count: txs.length };
  }, [stats]);

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-stone-900">
              Stock Buffer & Reorder Proximity
            </h3>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
              Inventory Health
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            Quantity on hand vs minimum safe reorder threshold
          </p>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[11px] text-stone-400 font-medium">Tracked Items</p>
            <p className="text-sm font-bold text-stone-900">
              {stats?.total_tracked_items || stockItems.length} SKUs
            </p>
          </div>
          <div className="border-l border-stone-200 pl-4">
            <p className="text-[11px] text-stone-400 font-medium">Reorder Alert</p>
            <p className="text-sm font-bold text-rose-700">
              {stats?.low_stock_warnings_count || stockItems.filter((i) => i.isCritical).length} Needs Restock
            </p>
          </div>
        </div>
      </div>

      {/* Visual Stock Bar Chart */}
      <div className="mt-5 space-y-4">
        {stockItems.map((item) => {
          const isCritical = item.ratio < 50;
          const isWarning = item.ratio >= 50 && item.ratio <= 100;
          const barWidth = Math.min(Math.max(item.ratio, 6), 100);

          return (
            <div
              className={`rounded-xl p-2 transition ${
                hoveredItem?.id === item.id ? "bg-stone-50" : "bg-transparent"
              }`}
              key={item.id}
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900">{item.name}</span>
                  {isCritical && (
                    <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                      Critical
                    </span>
                  )}
                  {isWarning && (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      Reorder Soon
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-stone-600">
                  <span className="font-bold text-stone-900">
                    {item.onHand.toFixed(1)} {item.unit}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    / min {item.reorder.toFixed(1)}
                  </span>
                  <span
                    className={`font-semibold text-[11px] ${
                      isCritical
                        ? "text-rose-700"
                        : isWarning
                        ? "text-amber-800"
                        : "text-emerald-700"
                    }`}
                  >
                    ({item.ratio}%)
                  </span>
                </div>
              </div>

              {/* Threshold indicator track */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                {/* 100% Safe marker reference line */}
                <div
                  className="absolute top-0 bottom-0 z-10 w-0.5 bg-stone-300"
                  style={{ left: "100%" }}
                  title="Target Buffer"
                />
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isCritical
                      ? "bg-rose-500"
                      : isWarning
                      ? "bg-amber-500"
                      : "bg-emerald-600"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Movement Ledger KPI Footer */}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-stone-100 pt-3 text-center">
        <div className="rounded-xl bg-stone-50 p-2.5">
          <span className="text-[11px] text-stone-500 font-medium">Safe Stock Level</span>
          <p className="text-sm font-extrabold text-emerald-800">
            {stockItems.filter((i) => i.ratio > 100).length} SKUs Buffer Safe
          </p>
        </div>
        <div className="rounded-xl bg-amber-50/70 p-2.5">
          <span className="text-[11px] text-amber-800 font-medium">Active Requisitions</span>
          <p className="text-sm font-extrabold text-amber-900">
            {stats?.active_purchase_requests_count || 0} In Progress
          </p>
        </div>
        <div className="rounded-xl bg-stone-50 p-2.5">
          <span className="text-[11px] text-stone-500 font-medium">Movement Activity</span>
          <p className="text-sm font-extrabold text-stone-800">
            {txSummary.count} Logged Records
          </p>
        </div>
      </div>
    </div>
  );
}
