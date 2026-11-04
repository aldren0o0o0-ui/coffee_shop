import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../payments/utils/currency";

export default function SalesGraph({
  timeline = [],
  period = "today",
  onPeriodChange,
  isLoading = false,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Normalize points from API or generate realistic sample wave points
  const points = useMemo(() => {
    if (!timeline || timeline.length === 0) {
      // Default time progression matching the reference image
      const defaultTimes = ["09:00 AM", "12:00 PM", "04:00 PM", "08:00 PM", "12:00 PM"];
      const defaultSales = [45, 130, 230, 95, 140];
      return defaultTimes.map((label, idx) => ({
        label,
        sales: defaultSales[idx],
        order_count: Math.round(defaultSales[idx] / 35),
      }));
    }

    return timeline.map((pt) => ({
      label: pt.label || "",
      sales: parseFloat(pt.sales) || 0,
      order_count: pt.orders_count || pt.order_count || 0,
    }));
  }, [timeline]);

  // Find peak point
  const maxPointIndex = useMemo(() => {
    if (points.length === 0) return 0;
    let maxIdx = 0;
    let maxVal = points[0].sales;
    for (let i = 1; i < points.length; i++) {
      if (points[i].sales > maxVal) {
        maxVal = points[i].sales;
        maxIdx = i;
      }
    }
    return maxIdx;
  }, [points]);

  const maxSales = useMemo(() => {
    const rawMax = Math.max(...points.map((p) => p.sales), 0);
    // Round to clean ceiling (e.g. 250)
    if (rawMax <= 250) return 250;
    return Math.ceil(rawMax / 50) * 50;
  }, [points]);

  // Chart layout dimensions
  const width = 640;
  const height = 240;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 45;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Grid steps: 5 intervals (6 levels: max, 4/5, 3/5, 2/5, 1/5, 0)
  const gridLevels = [1, 0.8, 0.6, 0.4, 0.2, 0];

  // Coordinates
  const coordinates = useMemo(() => {
    if (points.length === 0) return [];
    if (points.length === 1) {
      return [
        {
          x: paddingLeft + chartWidth / 2,
          y: height - paddingBottom - (points[0].sales / maxSales) * chartHeight,
          point: points[0],
        },
      ];
    }

    return points.map((p, idx) => {
      const x = paddingLeft + (idx / (points.length - 1)) * chartWidth;
      const y = height - paddingBottom - (p.sales / maxSales) * chartHeight;
      return { x, y, point: p };
    });
  }, [points, maxSales, chartWidth, chartHeight, height, paddingLeft, paddingBottom]);

  // Compute smooth cubic bezier spline (Catmull-Rom or cubic bezier)
  const { pathD, areaD } = useMemo(() => {
    if (coordinates.length === 0) return { pathD: "", areaD: "" };
    if (coordinates.length === 1) {
      const p = coordinates[0];
      return {
        pathD: `M ${paddingLeft} ${p.y} L ${width - paddingRight} ${p.y}`,
        areaD: `M ${paddingLeft} ${p.y} L ${width - paddingRight} ${p.y} L ${width - paddingRight} ${height - paddingBottom} L ${paddingLeft} ${height - paddingBottom} Z`,
      };
    }

    let d = `M ${coordinates[0].x} ${coordinates[0].y}`;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const curr = coordinates[i];
      const next = coordinates[i + 1];
      const tension = 0.45;
      const cp1x = curr.x + (next.x - curr.x) * tension;
      const cp1y = curr.y;
      const cp2x = next.x - (next.x - curr.x) * tension;
      const cp2y = next.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const area = `${d} L ${last.x} ${height - paddingBottom} L ${first.x} ${height - paddingBottom} Z`;

    return { pathD: d, areaD: area };
  }, [coordinates, height, width, paddingLeft, paddingRight, paddingBottom]);

  // Active highlighted point (either hovered or the peak point)
  const activeIndex = hoveredIndex !== null ? hoveredIndex : maxPointIndex;
  const activeCoord = coordinates[activeIndex] || coordinates[0];

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs transition sm:p-7 h-full flex flex-col justify-between">
      {/* Header: Title on Left & "See all" / Period Filter on Right (Matching Reference Image) */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <h3 className="text-lg font-bold tracking-tight text-stone-900">
          Sales Analytics
        </h3>

        <div className="flex items-center gap-3">
          {/* Period selector tabs */}
          {onPeriodChange && (
            <div className="flex items-center rounded-full bg-stone-100/90 p-0.5 border border-stone-200/80">
              {[
                { id: "today", label: "Today" },
                { id: "this_week", label: "7D" },
                { id: "this_month", label: "30D" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onPeriodChange(tab.id)}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    period === tab.id
                      ? "bg-white text-stone-900 shadow-2xs"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <Link
            to="/reports"
            className="text-xs font-bold text-amber-800 hover:text-amber-950 transition"
          >
            See all
          </Link>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative mt-4 select-none flex-1 flex flex-col justify-center min-h-[260px]">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-2xs rounded-2xl">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-800 border-t-transparent" />
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full min-h-[240px] max-h-[320px] overflow-visible"
        >
          <defs>
            {/* Smooth warm peach / amber gradient fill */}
            <linearGradient id="salesWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8763e" stopOpacity="0.32" />
              <stop offset="45%" stopColor="#c8763e" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#c8763e" stopOpacity="0.0" />
            </linearGradient>

            <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Dotted horizontal grid lines & Y-axis labels */}
          {gridLevels.map((lvl) => {
            const y = height - paddingBottom - lvl * chartHeight;
            const val = Math.round(maxSales * lvl);
            return (
              <g key={lvl}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f1ede8"
                  strokeDasharray="3 4"
                  strokeWidth="1.2"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-stone-400 text-[10px] font-medium"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area Fill Underneath Wave */}
          {areaD && (
            <path
              d={areaD}
              fill="url(#salesWaveGrad)"
              className="transition-all duration-300"
            />
          )}

          {/* Smooth Curved Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#c8763e"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Active Highlighted Point & Floating Tooltip Pill (Matching "230" Badge in Image) */}
          {activeCoord && (
            <g className="transition-all duration-200">
              {/* Highlight Dot with White Halo */}
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="4.5"
                fill="#c8763e"
                stroke="#ffffff"
                strokeWidth="2.5"
                className="filter drop-shadow-xs"
              />

              {/* Floating Tooltip Pill Above Peak / Hovered Point */}
              <g
                transform={`translate(${activeCoord.x - 22}, ${Math.max(4, activeCoord.y - 30)})`}
                filter="url(#badgeShadow)"
              >
                <rect
                  width="44"
                  height="22"
                  rx="6"
                  fill="#fbeee5"
                  stroke="#f2d7c5"
                  strokeWidth="1"
                />
                <text
                  x="22"
                  y="15"
                  textAnchor="middle"
                  fill="#c8763e"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {Math.round(activeCoord.point.sales)}
                </text>
              </g>
            </g>
          )}

          {/* Transparent Hover Interactivity Capture Columns */}
          {coordinates.map((pt, idx) => {
            const colWidth = chartWidth / coordinates.length;
            return (
              <rect
                key={idx}
                x={pt.x - colWidth / 2}
                y={0}
                width={colWidth}
                height={height - paddingBottom}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}

          {/* Bottom X-Axis Time Labels */}
          {coordinates.map((pt, idx) => {
            return (
              <text
                key={idx}
                x={pt.x}
                y={height - 12}
                textAnchor="middle"
                className="fill-stone-400 text-[10px] font-semibold"
              >
                {pt.point.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
