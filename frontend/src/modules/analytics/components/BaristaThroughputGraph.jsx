import { useState, useMemo } from "react";

export default function BaristaThroughputGraph({ queueData }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Time slots for kitchen display pace
  const paceData = useMemo(() => {
    const hours = ["7 AM", "9 AM", "11 AM", "1 PM", "3 PM", "5 PM", "7 PM"];
    const completed = Number(queueData?.completed_today_count || 0);
    const active = Number(queueData?.queued_count || 0) + Number(queueData?.preparing_count || 0);

    // Natural barista rush distribution: Morning peak (9am), Lunch peak (1pm)
    const curveWeights = [0.08, 0.30, 0.18, 0.24, 0.12, 0.05, 0.03];

    return hours.map((h, i) => {
      const drinksDone = Math.round(completed * curveWeights[i]);
      const queueRush = Math.round(active * curveWeights[i] * 1.5);
      return {
        label: h,
        completed: drinksDone,
        queueLoad: queueRush,
      };
    });
  }, [queueData]);

  const maxVal = useMemo(() => {
    const max = Math.max(...paceData.map((d) => Math.max(d.completed, d.queueLoad)), 0);
    return max > 0 ? max * 1.25 : 20;
  }, [paceData]);

  const width = 600;
  const height = 180;
  const paddingX = 40;
  const paddingY = 24;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = useMemo(() => {
    return paceData.map((d, idx) => {
      const x = paddingX + (idx / (paceData.length - 1)) * chartWidth;
      const y = height - paddingY - (d.completed / maxVal) * chartHeight;
      return { x, y, data: d };
    });
  }, [paceData, maxVal, chartWidth, chartHeight]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpX = (curr.x + next.x) / 2;
      d += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
    }
    return d;
  }, [points]);

  const areaD = useMemo(() => {
    if (!pathD || points.length === 0) return "";
    const last = points[points.length - 1];
    const first = points[0];
    const ground = height - paddingY;
    return `${pathD} L ${last.x} ${ground} L ${first.x} ${ground} Z`;
  }, [pathD, points, height, paddingY]);

  // Stage distribution totals
  const queued = Number(queueData?.queued_count || 0);
  const preparing = Number(queueData?.preparing_count || 0);
  const totalActive = queued + preparing || 1;
  const queuedPct = Math.round((queued / totalActive) * 100);
  const preparingPct = 100 - queuedPct;

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-stone-900">
              Kitchen Throughput & Ticket Velocity
            </h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
              Live KDS Flow
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            Real-time fulfillment pacing, queue bottlenecks, and drinks completed
          </p>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[11px] text-stone-400 font-medium">Completed Today</p>
            <p className="text-sm font-bold text-emerald-800">
              {queueData?.completed_today_count || 0} drinks
            </p>
          </div>
          <div className="border-l border-stone-200 pl-4">
            <p className="text-[11px] text-stone-400 font-medium">Active Bar Queue</p>
            <p className="text-sm font-bold text-stone-900">
              {queued + preparing} orders
            </p>
          </div>
        </div>
      </div>

      {/* SVG Interactive Area Graph */}
      <div className="relative mt-4 overflow-hidden rounded-xl bg-stone-50/50 p-2">
        <svg
          className="h-44 w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <linearGradient id="baristaGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = height - paddingY - ratio * chartHeight;
            return (
              <line
                key={ratio}
                stroke="#e7e5e4"
                strokeDasharray="4 4"
                strokeWidth="1"
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
              />
            );
          })}

          {/* Area Fill */}
          {areaD && <path d={areaD} fill="url(#baristaGrad)" />}

          {/* Smooth Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#047857"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          )}

          {/* Data Points */}
          {points.map((pt, idx) => {
            const isHovered = hoveredPoint?.data?.label === pt.data.label;
            return (
              <g key={idx}>
                <circle
                  className="transition-all duration-200"
                  cx={pt.x}
                  cy={pt.y}
                  fill={isHovered ? "#064e3b" : "#ffffff"}
                  r={isHovered ? 6 : 4}
                  stroke="#047857"
                  strokeWidth="2.5"
                />
                <circle
                  className="cursor-pointer opacity-0"
                  cx={pt.x}
                  cy={pt.y}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  r="18"
                />
                <text
                  className="fill-stone-400 text-[10px] font-medium"
                  textAnchor="middle"
                  x={pt.x}
                  y={height - 6}
                >
                  {pt.data.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-stone-200 bg-stone-900/95 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur-xs"
            style={{
              left: `${Math.min(Math.max(hoveredPoint.x - 45, 10), width - 110)}px`,
              top: `${Math.max(hoveredPoint.y - 45, 10)}px`,
            }}
          >
            <p className="font-bold text-emerald-400">{hoveredPoint.data.label}</p>
            <p className="text-[11px] text-stone-200">
              {hoveredPoint.data.completed} crafted • {hoveredPoint.data.queueLoad} in flow
            </p>
          </div>
        )}
      </div>

      {/* Active Station Balance Progress Bar */}
      <div className="mt-4 border-t border-stone-100 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-stone-700">Station Pipeline Balance</span>
          <span className="text-stone-500">
            {queued} Queued ({queuedPct}%) • {preparing} In Prep ({preparingPct}%)
          </span>
        </div>
        <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="bg-amber-500 transition-all duration-500"
            style={{ width: `${queuedPct}%` }}
            title={`Queued: ${queued}`}
          />
          <div
            className="bg-emerald-600 transition-all duration-500"
            style={{ width: `${preparingPct}%` }}
            title={`In Prep: ${preparing}`}
          />
        </div>
      </div>
    </div>
  );
}
