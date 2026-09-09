import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchMenuCatalog } from "../api/menuApi";
import { getImageUrl } from "../utils/image";

export default function CustomerBrowsePage() {
  const [catalog, setCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeItemModal, setActiveItemModal] = useState(null);

  // Selected item modal customization state
  const [modalSelectedSize, setModalSelectedSize] = useState(null);
  const [modalSelectedAddons, setModalSelectedAddons] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    async function loadCatalog() {
      try {
        const data = await fetchMenuCatalog();
        setCatalog(data);
      } catch (err) {
        console.error("Failed to load catalog:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Flatten all items across categories
  const allItems = useMemo(() => {
    return catalog.flatMap((cat) =>
      cat.items.map((item) => ({
        ...item,
        category_name: cat.category_name,
      }))
    );
  }, [catalog]);

  // Extract unique category names
  const categoryNames = useMemo(() => {
    return ["all", ...catalog.map((c) => c.category_name)];
  }, [catalog]);

  // Filtered items based on search and category
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" ||
        item.category_name.toLowerCase() === selectedCategory.toLowerCase();

      const matchesSearch =
        !query ||
        item.item_name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.ingredients && item.ingredients.some((ing) => ing.toLowerCase().includes(query)));

      return matchesCategory && matchesSearch;
    });
  }, [allItems, selectedCategory, searchQuery]);

  function openItemModal(item) {
    setActiveItemModal(item);
    setModalSelectedSize(item.sizes.length > 0 ? item.sizes[0] : null);
    setModalSelectedAddons([]);
  }

  function toggleAddon(addon) {
    setModalSelectedAddons((prev) => {
      const exists = prev.some((a) => a.menu_item_addon_id === addon.menu_item_addon_id);
      if (exists) {
        return prev.filter((a) => a.menu_item_addon_id !== addon.menu_item_addon_id);
      } else {
        return [...prev, addon];
      }
    });
  }

  // Calculated modal price
  const modalTotalPrice = useMemo(() => {
    if (!activeItemModal) return 0;
    let price = Number(activeItemModal.base_price);
    if (modalSelectedSize) {
      price += Number(modalSelectedSize.price_adjustment);
    }
    const addonsTotal = modalSelectedAddons.reduce(
      (sum, a) => sum + Number(a.additional_price),
      0
    );
    return price + addonsTotal;
  }, [activeItemModal, modalSelectedSize, modalSelectedAddons]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-stone-900 selection:bg-amber-200">
      {/* Top Notice Bar */}
      <div className="bg-amber-950 px-4 py-2 text-center text-xs font-semibold text-amber-200">
        <span>☕ Freshly roasted beans daily • Online ordering with zero pickup wait</span>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-stone-200/80 bg-white/95 px-6 backdrop-blur-md sm:px-12">
        <Link className="flex items-center gap-3" to="/">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-900 text-xl text-white shadow-xs">
            ☕
          </div>
          <div>
            <p className="text-lg font-black tracking-tight text-amber-950">ldrn&apos;s coffee</p>
            <p className="text-[10px] font-semibold tracking-wider text-amber-800 uppercase">Artisan Roastery & Bar</p>
          </div>
        </Link>

        {/* Header Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            className="hidden items-center gap-1.5 text-xs font-bold text-stone-600 transition hover:text-amber-950 sm:flex"
            to="/track"
          >
            <svg className="h-4 w-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Track Order</span>
          </Link>

          <Link
            className="flex items-center gap-2 rounded-2xl bg-amber-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-950 active:scale-95"
            to="/order"
          >
            <svg className="h-4 w-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Order & Checkout</span>
          </Link>

          <Link
            className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
            to="/login"
          >
            Staff
          </Link>
        </div>
      </header>

      {/* Hero Welcome & Search Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/70 via-[#FDFBF7] to-[#FDFBF7] px-6 py-12 text-center sm:px-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-100/60 px-4 py-1 text-xs font-bold text-amber-900 uppercase tracking-wider">
            <span>✨</span> Live Menu & Roastery Catalog
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-amber-950 sm:text-5xl lg:text-6xl">
            Taste the Handcrafted Difference.
          </h1>
          <p className="mt-4 text-base text-stone-600 sm:text-lg leading-relaxed">
            Browse our signature espresso beverages, specialty cold brews, non-coffee favorites, and artisanal pastries — freshly prepared to your exact customization.
          </p>

          {/* Interactive Search Bar */}
          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative flex items-center">
              <svg className="absolute left-4 h-5 w-5 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                aria-label="Search menu"
                className="w-full rounded-2xl border border-stone-300 bg-white py-3.5 pl-12 pr-4 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search coffee, tea, latte, ingredients, flavors…"
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 rounded-lg p-1 text-xs text-stone-400 hover:text-stone-700"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Category Navigation Pills */}
      <section className="sticky top-20 z-20 border-y border-stone-200/80 bg-white/90 px-6 py-3.5 backdrop-blur-md sm:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            {categoryNames.map((catName) => {
              const isActive = selectedCategory.toLowerCase() === catName.toLowerCase();
              return (
                <button
                  className={`rounded-2xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? "bg-amber-900 text-white shadow-xs"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                  key={catName}
                  onClick={() => setSelectedCategory(catName)}
                  type="button"
                >
                  {catName === "all" ? "☕ All Offerings" : catName}
                </button>
              );
            })}
          </div>

          <span className="hidden text-xs font-semibold text-stone-500 sm:inline">
            Showing {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
          </span>
        </div>
      </section>

      {/* Product Catalog Grid */}
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-12">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-amber-900" />
            <p className="mt-4 text-sm font-semibold text-stone-600">Loading fresh menu from database…</p>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <article
                className="group relative flex flex-col justify-between rounded-3xl border border-stone-200 bg-white p-6 shadow-xs transition duration-200 hover:-translate-y-1 hover:border-amber-400 hover:shadow-lg"
                key={item.menu_item_id}
              >
                <div>
                  {/* Card Hero Image */}
                  <div className="relative -mx-6 -mt-6 mb-4 aspect-video overflow-hidden rounded-t-3xl bg-stone-100 border-b border-stone-100">
                    {item.image_url ? (
                      <img
                        src={getImageUrl(item.image_url)}
                        alt={item.item_name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-amber-900/5 text-amber-900/40">
                        <span className="text-3xl">☕</span>
                      </div>
                    )}
                    {item.images && item.images.length > 1 && (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                        📷 {item.images.length} photos
                      </span>
                    )}
                  </div>

                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-900 uppercase">
                        {item.category_name}
                      </span>
                      <h3 className="mt-2 text-xl font-bold text-stone-900 group-hover:text-amber-950">
                        {item.item_name}
                      </h3>
                    </div>
                    <span className="text-xl font-black text-amber-900">
                      ${Number(item.base_price).toFixed(2)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mt-2.5 text-xs leading-relaxed text-stone-600">
                    {item.description || "Handcrafted fresh to order with precision brewing standards."}
                  </p>

                  {/* Size & Addon summary pills */}
                  {item.sizes.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-stone-400">Sizes:</span>
                      {item.sizes.map((s) => (
                        <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700" key={s.menu_item_size_id}>
                          {s.size_name} {Number(s.price_adjustment) > 0 ? `(+$${Number(s.price_adjustment).toFixed(2)})` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ingredients Tags */}
                  {item.ingredients.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-bold text-stone-400">Made with:</span>
                      {item.ingredients.map((ing, i) => (
                        <span className="rounded-md bg-amber-50/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" key={i}>
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
                  <button
                    className="text-xs font-bold text-stone-600 underline transition hover:text-amber-900"
                    onClick={() => openItemModal(item)}
                    type="button"
                  >
                    View Details & Recipe →
                  </button>

                  <Link
                    className="flex items-center gap-1 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-950 active:scale-95 shadow-xs"
                    to="/order"
                  >
                    <span>Order Now</span>
                    <span>→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center shadow-xs">
            <span className="text-4xl">☕</span>
            <h3 className="mt-3 text-lg font-bold text-stone-900">No matching drinks found</h3>
            <p className="mt-1 text-xs text-stone-500">Try changing your search keywords or switching category filters.</p>
            <button
              className="mt-4 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              type="button"
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>

      {/* Item Details & Customization Preview Modal */}
      {activeItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl sm:p-8">
            <button
              aria-label="Close dialog"
              className="absolute right-5 top-5 z-10 rounded-full bg-white/80 p-2 text-stone-400 backdrop-blur-xs hover:bg-stone-100 hover:text-stone-700"
              onClick={() => setActiveItemModal(null)}
              type="button"
            >
              ✕
            </button>

            {/* Modal Hero Image */}
            {activeItemModal.image_url && (
              <div className="relative -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5 aspect-video overflow-hidden rounded-t-3xl bg-stone-100 border-b border-stone-100">
                <img
                  src={getImageUrl(activeItemModal.image_url)}
                  alt={activeItemModal.item_name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold tracking-wider text-amber-900 uppercase">
                {activeItemModal.category_name}
              </span>
              <h2 className="mt-2 text-2xl font-black text-stone-900 sm:text-3xl">
                {activeItemModal.item_name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {activeItemModal.description || "Handcrafted fresh to order using artisan roasted beans."}
              </p>
            </div>

            {/* Size Options */}
            {activeItemModal.sizes.length > 0 && (
              <div className="mt-6 border-t border-stone-100 pt-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Select Size
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {activeItemModal.sizes.map((size) => {
                    const isSelected = modalSelectedSize?.menu_item_size_id === size.menu_item_size_id;
                    return (
                      <button
                        className={`flex items-center justify-between rounded-2xl border p-3 text-xs font-bold transition ${
                          isSelected
                            ? "border-amber-900 bg-amber-50 text-amber-950 ring-2 ring-amber-700/20"
                            : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-white"
                        }`}
                        key={size.menu_item_size_id}
                        onClick={() => setModalSelectedSize(size)}
                        type="button"
                      >
                        <span>{size.size_name}</span>
                        <span className="text-stone-500">
                          {Number(size.price_adjustment) > 0 ? `+$${Number(size.price_adjustment).toFixed(2)}` : "Standard"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add-ons Customization */}
            {activeItemModal.addons.length > 0 && (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Custom Add-ons & Flavors
                </label>
                <div className="mt-2 space-y-1.5">
                  {activeItemModal.addons.map((addon) => {
                    const isChecked = modalSelectedAddons.some(
                      (a) => a.menu_item_addon_id === addon.menu_item_addon_id
                    );
                    return (
                      <button
                        className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-xs transition ${
                          isChecked
                            ? "border-amber-900 bg-amber-50/70 font-bold text-amber-950"
                            : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-white"
                        }`}
                        key={addon.menu_item_addon_id}
                        onClick={() => toggleAddon(addon)}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`flex h-4 w-4 items-center justify-center rounded-md border text-[10px] ${isChecked ? "bg-amber-900 text-white border-amber-900" : "border-stone-300"}`}>
                            {isChecked ? "✓" : ""}
                          </span>
                          <span>{addon.addon_name}</span>
                        </div>
                        <span className="font-semibold text-stone-500">
                          +${Number(addon.additional_price).toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ingredients List */}
            {activeItemModal.ingredients.length > 0 && (
              <div className="mt-4 rounded-2xl bg-stone-50 p-3 text-xs text-stone-600">
                <p className="font-bold text-stone-800">Fresh Ingredients:</p>
                <p className="mt-1 text-[11px] text-stone-500">{activeItemModal.ingredients.join(" • ")}</p>
              </div>
            )}

            {/* Modal Footer Price & Checkout Trigger */}
            <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
              <div>
                <span className="text-xs text-stone-500">Calculated Price:</span>
                <p className="text-2xl font-black text-amber-950">${modalTotalPrice.toFixed(2)}</p>
              </div>

              <button
                className="flex items-center gap-2 rounded-2xl bg-amber-900 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-amber-950"
                onClick={() => {
                  setActiveItemModal(null);
                  navigate("/order");
                }}
                type="button"
              >
                <span>Proceed to Order</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white px-6 py-12 text-center text-xs text-stone-500 sm:px-12">
        <p className="font-bold text-stone-700">ldrn&apos;s Coffee Shop Management System</p>
        <p className="mt-1">Real-time menu data synchronized with PostgreSQL database.</p>
        <div className="mt-4 flex justify-center gap-4 text-amber-900 font-semibold">
          <Link to="/order">Online Ordering</Link>
          <span>•</span>
          <Link to="/track">Order Tracking</Link>
          <span>•</span>
          <Link to="/login">Staff Portal</Link>
        </div>
      </footer>
    </div>
  );
}
