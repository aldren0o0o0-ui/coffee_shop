import { useEffect, useState } from "react";

import { formatCurrency } from "../../payments/utils/currency";
import { fetchMenuCosting } from "../api/costingApi";

export default function CostingPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMenuCosting().then(setData).catch((err) => setError(err.response?.data?.detail || "Unable to load recipe costing."));
  }, []);

  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-stone-500">Loading recipe costing…</div>;
  return <div className="space-y-5">
    <header><h2 className="text-2xl font-bold text-amber-950">Recipe costing</h2><p className="text-sm text-stone-500">Current ingredient costs and product margins.</p></header>
    <section className="grid gap-3 sm:grid-cols-3">
      <Metric label="Complete recipes" value={`${data.complete_cost_items}/${data.total_items}`} />
      <Metric label="Missing recipe cost" value={data.incomplete_cost_items} />
      <Metric label="Average margin" value={data.average_margin_percent == null ? "—" : `${data.average_margin_percent}%`} />
    </section>
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="divide-y divide-stone-100">
        {data.items.map((item) => <article className="grid gap-2 p-4 sm:grid-cols-5 sm:items-center" key={item.menu_item_id}>
          <div><p className="font-semibold text-stone-900">{item.item_name}</p><p className="text-xs text-stone-500">{item.category_name}</p></div>
          <Value label="Price" value={formatCurrency(item.selling_price)} />
          <Value label="Recipe cost" value={item.has_complete_cost ? formatCurrency(item.ingredient_cost) : "Incomplete"} />
          <Value label="Gross profit" value={item.has_complete_cost ? formatCurrency(item.gross_profit) : "—"} />
          <Value label="Margin" value={item.margin_percent == null ? "—" : `${item.margin_percent}%`} />
        </article>)}
      </div>
    </section>
  </div>;
}

function Metric({ label, value }) { return <div className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-xs font-medium text-stone-500">{label}</p><p className="mt-1 text-xl font-bold text-amber-950">{value}</p></div>; }
function Value({ label, value }) { return <div><p className="text-xs text-stone-500">{label}</p><p className="font-medium text-stone-800">{value}</p></div>; }
