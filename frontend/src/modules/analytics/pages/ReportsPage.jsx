import { useEffect, useState } from "react";
import { fetchStoreReports } from "../api/dashboardApi";
import { formatCurrency } from "../../payments/utils/currency";

export default function ReportsPage() {
  const [period, setPeriod] = useState("today");
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadReport(selectedPeriod) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchStoreReports(selectedPeriod);
      setReport(data);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || "Failed to load store analytics report."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReport(period);
  }, [period]);

  function handlePrint() {
    window.print();
  }

  // Calculate maximum sales for timeline scaling
  const maxTimelineSales = Math.max(
    ...(report?.timeline?.map((t) => parseFloat(t.sales)) || [1]),
    1
  );

  return (
    <div className="space-y-6">
      {/* Toast Error */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm">
          {errorMessage}
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-amber-950">
            Reports & Store Analytics
          </h2>
          <p className="text-sm text-stone-500">
            Review sales volume, best sellers, channel distribution, and revenue trends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-xs">
            {[
              { id: "today", label: "Today" },
              { id: "this_week", label: "Last 7 Days" },
              { id: "this_month", label: "This Month" },
              { id: "all_time", label: "All Time" },
            ].map((p) => (
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  period === p.id
                    ? "bg-amber-900 text-white shadow-xs"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
                key={p.id}
                onClick={() => setPeriod(p.id)}
                type="button"
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50 hover:text-stone-900"
            onClick={handlePrint}
            title="Print or save as PDF"
            type="button"
          >
            <svg className="h-4 w-4 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-800 border-t-transparent" />
          <p className="mt-3 text-xs text-stone-500">Compiling financial performance data...</p>
        </div>
      ) : report ? (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Gross Revenue
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-950">
                {formatCurrency(report.total_revenue)}
              </p>
              <p className="mt-1 text-xs text-emerald-700 font-medium">
                Confirmed & Paid Orders
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Completed Orders
              </p>
              <p className="mt-2 text-2xl font-bold text-stone-900">
                {report.completed_orders_count}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Out of {report.total_orders_count} total tickets
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Average Order Value
              </p>
              <p className="mt-2 text-2xl font-bold text-stone-900">
                {formatCurrency(report.average_order_value)}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Per fulfilled customer order
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Fulfillment Rate
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-900">
                {report.total_orders_count > 0
                  ? Math.round(
                      (report.completed_orders_count / report.total_orders_count) *
                        100
                    )
                  : 100}
                %
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Completion efficiency
              </p>
            </div>
          </div>

          {/* Sales Timeline Visualization */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-amber-950">
                  Sales Activity Over Time
                </h3>
                <p className="text-xs text-stone-500">
                  {period === "today"
                    ? "Hourly breakdown throughout the business day"
                    : "Daily volume overview"}
                </p>
              </div>
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                {report.timeline.length} Intervals
              </span>
            </div>

            {report.timeline.length === 0 ? (
              <p className="py-10 text-center text-xs text-stone-400">
                No chronological activity logged for this time window.
              </p>
            ) : (
              <div className="mt-6 flex h-48 items-end gap-2 pt-4 sm:gap-4">
                {report.timeline.map((point, idx) => {
                  const sales = parseFloat(point.sales);
                  const heightPercent =
                    maxTimelineSales > 0
                      ? Math.max(Math.round((sales / maxTimelineSales) * 100), 4)
                      : 4;

                  return (
                    <div
                      className="group flex flex-1 flex-col items-center gap-1.5"
                      key={idx}
                    >
                      {/* Tooltip on hover */}
                      <div className="opacity-0 transition-opacity group-hover:opacity-100 text-center">
                        <span className="rounded-md bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          {formatCurrency(sales)}
                        </span>
                      </div>

                      {/* Bar */}
                      <div className="w-full rounded-t-lg bg-amber-100 transition-all group-hover:bg-amber-800" style={{ height: `${heightPercent}%` }}>
                        <div
                          className="h-full w-full rounded-t-lg bg-amber-800/80 transition group-hover:bg-amber-900"
                          style={{
                            height: sales > 0 ? "100%" : "0%",
                          }}
                        />
                      </div>

                      {/* Label */}
                      <span className="text-[10px] font-semibold text-stone-500 truncate w-full text-center">
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detailed Performance Breakdown Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top 5 Products Leaderboard */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Top Selling Products
                  </h3>
                  <p className="text-xs text-stone-500">
                    Highest volume drink and food orders
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-900">
                  By Units Sold
                </span>
              </div>

              {report.top_selling_items.length === 0 ? (
                <p className="py-12 text-center text-xs text-stone-400">
                  No products sold in this period yet.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-stone-100">
                  {report.top_selling_items.map((item, idx) => (
                    <div
                      className="flex items-center justify-between py-3"
                      key={item.menu_item_id}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0
                              ? "bg-amber-800 text-white"
                              : idx === 1
                              ? "bg-amber-200 text-amber-950"
                              : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-stone-900">
                            {item.item_name}
                          </p>
                          <p className="text-[11px] text-stone-400">
                            {item.quantity_sold} units ordered
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-stone-900">
                          {formatCurrency(item.total_sales)}
                        </p>
                        <p className="text-[10px] text-stone-400">Total Sales</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Channels & Payment Methods */}
            <div className="space-y-6">
              {/* Channels */}
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-sm font-bold text-amber-950">
                    Sales by Channel
                  </h3>
                  <p className="text-xs text-stone-500">
                    In-Store POS register vs Customer Web App orders
                  </p>
                </div>

                {report.sales_by_channel.length === 0 ? (
                  <p className="py-8 text-center text-xs text-stone-400">
                    No channel sales recorded.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {report.sales_by_channel.map((ch, idx) => {
                      const totalRev = parseFloat(report.total_revenue) || 1;
                      const chRev = parseFloat(ch.total_sales);
                      const percent = Math.min(
                        Math.round((chRev / totalRev) * 100),
                        100
                      );

                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-stone-800">
                              {ch.channel} ({ch.order_count} orders)
                            </span>
                            <span className="font-semibold text-amber-950">
                              {formatCurrency(ch.total_sales)} ({percent}%)
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                            <div
                              className="h-full rounded-full bg-amber-800 transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-sm font-bold text-amber-950">
                    Payment Methods
                  </h3>
                  <p className="text-xs text-stone-500">
                    Tender types accepted at counter and online
                  </p>
                </div>

                {report.sales_by_payment_method.length === 0 ? (
                  <p className="py-8 text-center text-xs text-stone-400">
                    No completed payments logged.
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {report.sales_by_payment_method.map((pm, idx) => (
                      <div
                        className="rounded-xl border border-stone-100 bg-stone-50/50 p-3"
                        key={idx}
                      >
                        <p className="text-xs font-bold text-stone-900">
                          {pm.payment_method}
                        </p>
                        <p className="mt-1 text-base font-bold text-amber-950">
                          {formatCurrency(pm.total_amount)}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          {pm.transaction_count} transactions
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
