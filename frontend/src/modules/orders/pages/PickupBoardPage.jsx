import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../../api/client";

export default function PickupBoardPage() {
  const [boardData, setBoardData] = useState({ preparing: [], ready: [], last_updated: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBoard() {
    try {
      const res = await apiClient.get("/customer/pickup-board");
      setBoardData(res.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to sync pickup screen. Reconnecting...");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
    const interval = setInterval(loadBoard, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between p-4 sm:p-8 font-sans">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between border-b border-stone-800 pb-6 gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-3xl text-amber-400">
            ☕
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Order Pickup Display
            </h1>
            <p className="text-xs sm:text-sm text-stone-400">
              Live status for customer collections. Handcrafted fresh to order.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-stone-800 bg-stone-900 px-4 py-1.5 text-xs text-stone-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Live Auto-Sync (5s)</span>
          </div>
          <Link
            to="/order"
            className="rounded-xl border border-stone-700 bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-stone-300 hover:bg-stone-800 transition"
          >
            Order Menu
          </Link>
        </div>
      </header>

      {error && (
        <div className="my-3 rounded-2xl border border-rose-800/50 bg-rose-950/40 p-3 text-center text-xs font-semibold text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {/* Main Board Grid */}
      <main className="my-6 grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* Left Column: Brewing / In Preparation */}
        <section className="flex flex-col rounded-3xl border border-indigo-950/80 bg-stone-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 text-lg">
                ⏳
              </span>
              <h2 className="text-xl font-extrabold uppercase tracking-wider text-indigo-400">
                Brewing on Bar
              </h2>
            </div>
            <span className="rounded-full bg-indigo-950 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-800">
              {boardData.preparing.length} in prep
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 content-start">
            {isLoading ? (
              <p className="col-span-full py-12 text-center text-xs text-stone-500">Loading queue...</p>
            ) : boardData.preparing.length > 0 ? (
              boardData.preparing.map((ticket) => (
                <div
                  key={ticket.pickup_code}
                  className="flex flex-col items-center justify-center rounded-2xl border border-indigo-900/50 bg-indigo-950/20 p-5 text-center transition hover:scale-105"
                >
                  <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-indigo-200">
                    {ticket.pickup_code}
                  </span>
                  <span className="mt-2 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                    {ticket.display_status}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-stone-600">
                <span className="text-3xl">☕</span>
                <p className="mt-2 text-sm">All pending drinks brewed.</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Ready for Pickup */}
        <section className="flex flex-col rounded-3xl border border-emerald-950/80 bg-stone-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-lg">
                🔔
              </span>
              <h2 className="text-xl font-extrabold uppercase tracking-wider text-emerald-400">
                Ready for Pickup
              </h2>
            </div>
            <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-800">
              {boardData.ready.length} ready
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 content-start">
            {isLoading ? (
              <p className="col-span-full py-12 text-center text-xs text-stone-500">Loading counter...</p>
            ) : boardData.ready.length > 0 ? (
              boardData.ready.map((ticket) => (
                <div
                  key={ticket.pickup_code}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-500/60 bg-emerald-950/30 p-5 text-center shadow-lg animate-pulse transition hover:scale-105"
                >
                  <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-emerald-300">
                    {ticket.pickup_code}
                  </span>
                  <span className="mt-2 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                    Ready on Counter
                  </span>
                  {ticket.ready_since_minutes !== null && (
                    <span className="text-[10px] text-emerald-500/80 mt-0.5">
                      Ready ~{ticket.ready_since_minutes}m ago
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-stone-600">
                <span className="text-3xl">🛎️</span>
                <p className="mt-2 text-sm">No orders waiting on counter.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer Instructions */}
      <footer className="border-t border-stone-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-2">
        <p>Please present your pickup code at the dispatch counter to collect your handcrafted beverages.</p>
        <p>Brewed with precision • ldrn&apos;s coffee roastery</p>
      </footer>
    </div>
  );
}
