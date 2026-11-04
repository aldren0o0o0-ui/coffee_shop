import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../payments/utils/currency";
import { fetchMenuCatalog } from "../../menu/api/menuApi";
import { getImageUrl } from "../../menu/utils/image";

// Mini SVG Coffee Cup Icon for each drink type
function DrinkCupIcon({ type = "cappuccino", imageUrl = null }) {
  if (imageUrl) {
    return (
      <img
        src={getImageUrl(imageUrl)}
        alt="Drink"
        className="h-8 w-8 object-contain rounded-lg"
      />
    );
  }

  if (type === "frappuccino" || type === "cold" || type === "iced") {
    return (
      <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="13" y="14" width="14" height="20" rx="3" fill="#e8d5c4" stroke="#c89666" strokeWidth="1.2" />
        <path d="M15 14 Q 20 8, 25 14 Z" fill="#fdfbf7" />
        <line x1="22" y1="5" x2="20" y2="14" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
        <rect x="15" y="20" width="10" height="8" rx="2" fill="#047857" />
        <circle cx="20" cy="24" r="2.5" fill="#ffffff" />
      </svg>
    );
  }

  if (type === "latte" || type === "dark" || type === "cortado" || type === "espresso") {
    return (
      <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="20" cy="28" rx="14" ry="4" fill="#1c1917" opacity="0.85" />
        <path d="M10 18 Q 10 26, 20 26 Q 30 26, 30 18 Z" fill="#292524" />
        <ellipse cx="20" cy="18" rx="10" ry="4.5" fill="#d6a77a" />
        <ellipse cx="20" cy="18" rx="6" ry="2.5" fill="#fdf8f0" />
      </svg>
    );
  }

  // Default cup with saucer & latte art
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="27" rx="13" ry="3.5" fill="#e7e5e4" />
      <path d="M11 17 Q 11 25, 20 25 Q 29 25, 29 17 Z" fill="#ffffff" stroke="#e5e7eb" strokeWidth="1.2" />
      <path d="M29 19 Q 33 19, 33 21 Q 33 23, 29 23" stroke="#e5e7eb" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="20" cy="17" rx="9" ry="4" fill="#a16207" />
      <path d="M17 17 Q 20 15, 23 17 Q 20 19, 17 17 Z" fill="#fef3c7" />
    </svg>
  );
}

export default function TrendingCoffeeCard({ items = [], isLoading = false }) {
  const [dbCatalogItems, setDbCatalogItems] = useState([]);

  // Fallback to real menu catalog from database if reports payload hasn't arrived yet
  useEffect(() => {
    if (!items || items.length === 0) {
      fetchMenuCatalog()
        .then((cats) => {
          const flat = (cats || []).flatMap((c) => c.items || []);
          if (flat.length > 0) {
            setDbCatalogItems(flat.slice(0, 5));
          }
        })
        .catch(() => {});
    }
  }, [items]);

  // Use real data from reports (all from database) or fallback to real database catalog items
  const displayItems =
    items && items.length > 0
      ? items.slice(0, 5)
      : dbCatalogItems.map((dbItem) => ({
          menu_item_id: dbItem.menu_item_id,
          item_name: dbItem.item_name,
          price: Number(dbItem.base_price),
          quantity_sold: 0,
          image_url: dbItem.image_url,
        }));

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs transition sm:p-7 h-full flex flex-col justify-between">
      {/* Header: Trending Coffee on Left & "See all" on Right (Matching Reference Image) */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <h3 className="text-lg font-bold tracking-tight text-stone-900">
          Trending Coffee
        </h3>

        <Link
          to="/menu"
          className="text-xs font-bold text-amber-800 hover:text-amber-950 transition"
        >
          See all
        </Link>
      </div>

      {/* Trending Items List */}
      <div className="mt-4 space-y-3 flex-1 flex flex-col justify-between">
        {isLoading && displayItems.length === 0 ? (
          <div className="space-y-4 py-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-stone-100" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-24 bg-stone-200 rounded" />
                    <div className="h-3 w-16 bg-stone-100 rounded" />
                  </div>
                </div>
                <div className="h-4 w-8 bg-stone-100 rounded" />
              </div>
            ))}
          </div>
        ) : displayItems.length > 0 ? (
          displayItems.map((item, idx) => {
            const nameLower = (item.item_name || "").toLowerCase();
            const type = nameLower.includes("frap") || nameLower.includes("cold")
              ? "cold"
              : nameLower.includes("latte") || nameLower.includes("mocha")
              ? "latte"
              : nameLower.includes("espresso") || nameLower.includes("cortado")
              ? "espresso"
              : "cappuccino";

            const unitPrice =
              item.price !== undefined && item.price !== null
                ? Number(item.price)
                : item.total_sales && item.quantity_sold
                ? Number(item.total_sales) / Number(item.quantity_sold)
                : 0;

            return (
              <div
                key={item.menu_item_id || item.item_name || idx}
                className="flex items-center justify-between gap-3 p-1.5 rounded-2xl hover:bg-stone-50/80 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Thumbnail Icon */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-50 border border-stone-100/80">
                    <DrinkCupIcon type={type} imageUrl={item.image_url} />
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-bold text-stone-900 text-sm truncate">
                      {item.item_name}
                    </h4>
                    <p className="text-xs text-stone-400 font-medium mt-0.5">
                      {formatCurrency(unitPrice)}
                    </p>
                  </div>
                </div>

                {/* Real Volume Sold from Database */}
                <span className="font-bold text-stone-900 text-sm shrink-0 font-mono">
                  {item.quantity_sold || 0}
                </span>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-xs text-stone-400">
            No drinks recorded in database yet.
          </div>
        )}
      </div>
    </div>
  );
}
