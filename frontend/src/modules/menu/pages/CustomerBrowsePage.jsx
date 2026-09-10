import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchMenuCatalog } from "../api/menuApi";
import { getImageUrl } from "../utils/image";

export default function CustomerBrowsePage() {
  const [catalog, setCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured"); // featured | price-asc | price-desc | name
  const [inStockOnly, setInStockOnly] = useState(false);
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

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let items = allItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" ||
        item.category_name.toLowerCase() === selectedCategory.toLowerCase();

      const matchesSearch =
        !query ||
        item.item_name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.ingredients && item.ingredients.some((ing) => ing.toLowerCase().includes(query)));

      const matchesStock = !inStockOnly || item.is_available;

      return matchesCategory && matchesSearch && matchesStock;
    });

    // Apply sorting
    if (sortBy === "price-asc") {
      items.sort((a, b) => Number(a.base_price) - Number(b.base_price));
    } else if (sortBy === "price-desc") {
      items.sort((a, b) => Number(b.base_price) - Number(a.base_price));
    } else if (sortBy === "name") {
      items.sort((a, b) => a.item_name.localeCompare(b.item_name));
    }

    return items;
  }, [allItems, selectedCategory, searchQuery, inStockOnly, sortBy]);

  function openItemModal(item) {
    setActiveItemModal(item);
    setModalSelectedSize(item.sizes && item.sizes.length > 0 ? item.sizes[0] : null);
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
    <div className="min-h-screen bg-[#140e08] font-sans text-[#f5e6d3] antialiased selection:bg-[#c8860a] selection:text-[#140e08]">
      {/* Top Bar Header */}
      <header className="sticky top-0 z-30 border-b border-[#c8860a]/20 bg-[#140e08]/95 px-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
          {/* Top Left Corner: Clean Navigation & Brand */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-full border border-[#c8860a]/30 bg-[#2a1c0d] px-3 py-1.5 text-xs font-semibold text-[#e6a832] transition hover:bg-[#342210] hover:border-[#c8860a]"
              title="Return to Home"
            >
              <span>←</span>
              <span className="hidden sm:inline">Home</span>
            </Link>

            <Link className="flex items-center gap-2" to="/">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#c8860a]/40 bg-[#2a1c0d] text-base text-[#e6a832]">
                ☕
              </span>
              <span className="font-serif text-base font-bold tracking-tight text-[#e6a832] hidden sm:inline">
                LDRN&apos;s Coffee
              </span>
            </Link>
          </div>

          {/* Center Search Bar */}
          <div className="flex-1 max-w-md mx-2 sm:mx-4">
            <div className="relative flex items-center">
              <svg
                className="absolute left-3.5 h-4 w-4 text-[#c8860a]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                aria-label="Search menu"
                className="w-full rounded-full border border-[#c8860a]/30 bg-[#1e1509] py-2 pl-10 pr-9 text-xs sm:text-sm text-[#f5e6d3] outline-none transition placeholder:text-[#b8a08a]/50 focus:border-[#c8860a] focus:ring-2 focus:ring-[#c8860a]/20"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search coffee, drinks, flavors…"
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 rounded-full p-0.5 text-xs text-[#b8a08a] hover:text-[#f5e6d3]"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              className="flex items-center gap-1.5 rounded-full bg-[#c8860a] px-4 py-2 text-xs font-bold text-[#140e08] shadow-md transition hover:bg-[#e6a832] active:scale-95"
              to="/order"
            >
              <span>Order Now</span>
              <span>→</span>
            </Link>

            <Link
              className="hidden sm:inline-flex rounded-full border border-stone-700 bg-stone-900/80 px-3 py-1.5 text-xs font-medium text-[#b8a08a] hover:text-white"
              to="/login"
            >
              Staff
            </Link>
          </div>
        </div>
      </header>

      {/* Browsing Control Strip: Left Title + Sorting & Filters */}
      <section className="border-b border-[#c8860a]/15 bg-[#1a1107] px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Top-Left Title with adjusted font size */}
          <div className="flex items-baseline gap-2.5">
            <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white">
              Browse Menu
            </h1>
            <span className="rounded-full border border-[#c8860a]/30 bg-[#c8860a]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#e6a832]">
              {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Quick Filters & Sorting Controls */}
          <div className="flex items-center gap-2 text-xs">
            {/* Stock Filter Toggle */}
            <button
              onClick={() => setInStockOnly((prev) => !prev)}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold transition border ${
                inStockOnly
                  ? "border-emerald-600/60 bg-emerald-950/40 text-emerald-400"
                  : "border-[#c8860a]/20 bg-[#2a1c0d] text-[#b8a08a] hover:border-[#c8860a]/40"
              }`}
            >
              {inStockOnly ? "✓ In Stock" : "In Stock Only"}
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#c8860a]/20 bg-[#2a1c0d] px-3 py-1 text-xs text-[#b8a08a]">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-[#e6a832] font-semibold outline-none cursor-pointer"
              >
                <option value="featured" className="bg-[#1e1509] text-[#f5e6d3]">Featured</option>
                <option value="price-asc" className="bg-[#1e1509] text-[#f5e6d3]">Price: Low to High</option>
                <option value="price-desc" className="bg-[#1e1509] text-[#f5e6d3]">Price: High to Low</option>
                <option value="name" className="bg-[#1e1509] text-[#f5e6d3]">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Navigation Pills */}
        <div className="mx-auto mt-3 flex max-w-7xl items-center gap-2 overflow-x-auto pb-1">
          {categoryNames.map((catName) => {
            const isActive = selectedCategory.toLowerCase() === catName.toLowerCase();
            return (
              <button
                className={`rounded-full px-4 py-1 text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "bg-[#c8860a] text-[#140e08] shadow-[0_2px_10px_rgba(200,134,10,0.3)]"
                    : "border border-[#c8860a]/20 bg-[#2a1c0d] text-[#b8a08a] hover:border-[#c8860a]/50 hover:text-white"
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
      </section>

      {/* Product Catalog Grid */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#c8860a]/20 border-t-[#c8860a]" />
            <p className="mt-3 text-xs font-semibold text-[#b8a08a]">Loading catalog from roastery…</p>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <article
                className="group relative flex flex-col justify-between rounded-2xl border border-[#c8860a]/20 bg-[#24170d] p-5 shadow-lg transition duration-200 hover:-translate-y-1 hover:border-[#c8860a]/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
                key={item.menu_item_id}
              >
                <div>
                  {/* Card Hero Image */}
                  <div className="relative -mx-5 -mt-5 mb-3.5 aspect-[16/10] overflow-hidden rounded-t-2xl bg-[#140e08] border-b border-[#c8860a]/15">
                    {item.image_url ? (
                      <img
                        src={getImageUrl(item.image_url)}
                        alt={item.item_name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-[#1e1509] text-[#c8860a]/30">
                        <span className="text-3xl">☕</span>
                      </div>
                    )}
                    {item.images && item.images.length > 1 && (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-[#e6a832] backdrop-blur-xs">
                        📷 {item.images.length} photos
                      </span>
                    )}
                  </div>

                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full border border-[#c8860a]/30 bg-[#c8860a]/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#e6a832] uppercase">
                        {item.category_name}
                      </span>
                      <h3 className="mt-1.5 font-serif text-lg font-bold text-white group-hover:text-[#e6a832] transition">
                        {item.item_name}
                      </h3>
                    </div>
                    <span className="font-serif text-lg font-bold text-[#e6a832] flex-shrink-0">
                      ₱{Number(item.base_price).toFixed(2)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mt-2 text-xs leading-relaxed text-[#b8a08a] line-clamp-2">
                    {item.description || "Handcrafted fresh to order with precision brewing standards."}
                  </p>

                  {/* Size Options Pills */}
                  {item.sizes && item.sizes.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-[#b8a08a]">Sizes:</span>
                      {item.sizes.map((s) => (
                        <span
                          className="rounded-md border border-[#c8860a]/20 bg-[#1e1509] px-2 py-0.5 text-[10px] font-medium text-[#f5e6d3]"
                          key={s.menu_item_size_id}
                        >
                          {s.size_name} {Number(s.price_adjustment) > 0 ? `(+₱${Number(s.price_adjustment).toFixed(2)})` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ingredients Tags */}
                  {item.ingredients && item.ingredients.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-bold text-[#b8a08a]">Notes:</span>
                      {item.ingredients.map((ing, i) => (
                        <span
                          className="rounded-md bg-[#c8860a]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#e6a832]"
                          key={i}
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 flex items-center justify-between border-t border-[#c8860a]/15 pt-3.5">
                  <button
                    className="text-xs font-bold text-[#e6a832] underline transition hover:text-[#f4c265]"
                    onClick={() => openItemModal(item)}
                    type="button"
                  >
                    Details &amp; Recipe →
                  </button>

                  <button
                    className="flex items-center gap-1 rounded-full bg-[#c8860a] px-3.5 py-1.5 text-xs font-bold text-[#140e08] shadow-sm transition hover:bg-[#e6a832] active:scale-95 cursor-pointer"
                    onClick={() => {
                      const defaultSize = item.sizes?.find((s) => s.is_default) || item.sizes?.[0] || null;
                      navigate(`/order?item_id=${item.menu_item_id}`, {
                        state: {
                          preselected: {
                            item,
                            size: defaultSize,
                            addons: [],
                          },
                        },
                      });
                    }}
                    type="button"
                  >
                    <span>Order</span>
                    <span>→</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#c8860a]/20 bg-[#24170d] p-10 text-center shadow-lg">
            <span className="text-3xl">☕</span>
            <h3 className="mt-2.5 font-serif text-base font-bold text-white">No matching drinks found</h3>
            <p className="mt-1 text-xs text-[#b8a08a]">
              Try changing your search keywords or switching filters.
            </p>
            <button
              className="mt-3.5 rounded-full bg-[#c8860a] px-4 py-1.5 text-xs font-bold text-[#140e08] transition hover:bg-[#e6a832]"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setInStockOnly(false);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#c8860a]/30 bg-[#24170d] p-6 shadow-2xl text-[#f5e6d3]">
            <button
              aria-label="Close dialog"
              className="absolute right-4 top-4 z-10 rounded-full bg-[#140e08]/80 p-1.5 text-[#b8a08a] backdrop-blur-xs hover:bg-[#140e08] hover:text-white"
              onClick={() => setActiveItemModal(null)}
              type="button"
            >
              ✕
            </button>

            {/* Modal Hero Image */}
            {activeItemModal.image_url && (
              <div className="relative -mx-6 -mt-6 mb-4 aspect-video overflow-hidden rounded-t-3xl bg-[#140e08] border-b border-[#c8860a]/20">
                <img
                  src={getImageUrl(activeItemModal.image_url)}
                  alt={activeItemModal.item_name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div>
              <span className="rounded-full border border-[#c8860a]/30 bg-[#c8860a]/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#e6a832] uppercase">
                {activeItemModal.category_name}
              </span>
              <h2 className="mt-1.5 font-serif text-2xl font-bold text-white">
                {activeItemModal.item_name}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#b8a08a]">
                {activeItemModal.description || "Handcrafted fresh to order using artisan roasted beans."}
              </p>
            </div>

            {/* Size Options */}
            {activeItemModal.sizes && activeItemModal.sizes.length > 0 && (
              <div className="mt-4 border-t border-[#c8860a]/15 pt-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#e6a832]">
                  Select Size
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {activeItemModal.sizes.map((size) => {
                    const isSelected = modalSelectedSize?.menu_item_size_id === size.menu_item_size_id;
                    return (
                      <button
                        className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-bold transition ${
                          isSelected
                            ? "border-[#c8860a] bg-[#c8860a]/20 text-white ring-2 ring-[#c8860a]/30"
                            : "border-[#c8860a]/20 bg-[#1e1509] text-[#b8a08a] hover:border-[#c8860a]/50 hover:text-white"
                        }`}
                        key={size.menu_item_size_id}
                        onClick={() => setModalSelectedSize(size)}
                        type="button"
                      >
                        <span>{size.size_name}</span>
                        <span className="text-[#e6a832]">
                          {Number(size.price_adjustment) > 0 ? `+₱${Number(size.price_adjustment).toFixed(2)}` : "Standard"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add-ons Customization */}
            {activeItemModal.addons && activeItemModal.addons.length > 0 && (
              <div className="mt-3 border-t border-[#c8860a]/15 pt-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#e6a832]">
                  Custom Add-ons &amp; Flavors
                </label>
                <div className="mt-1.5 space-y-1">
                  {activeItemModal.addons.map((addon) => {
                    const isChecked = modalSelectedAddons.some(
                      (a) => a.menu_item_addon_id === addon.menu_item_addon_id
                    );
                    return (
                      <button
                        className={`flex w-full items-center justify-between rounded-xl border p-2 text-xs transition ${
                          isChecked
                            ? "border-[#c8860a] bg-[#c8860a]/20 font-bold text-white"
                            : "border-[#c8860a]/20 bg-[#1e1509] text-[#b8a08a] hover:border-[#c8860a]/50 hover:text-white"
                        }`}
                        key={addon.menu_item_addon_id}
                        onClick={() => toggleAddon(addon)}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`flex h-4 w-4 items-center justify-center rounded-md border text-[10px] ${isChecked ? "bg-[#c8860a] text-[#140e08] border-[#c8860a]" : "border-[#c8860a]/30"}`}>
                            {isChecked ? "✓" : ""}
                          </span>
                          <span>{addon.addon_name}</span>
                        </div>
                        <span className="font-semibold text-[#e6a832]">
                          +₱{Number(addon.additional_price).toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ingredients List */}
            {activeItemModal.ingredients && activeItemModal.ingredients.length > 0 && (
              <div className="mt-3 rounded-xl border border-[#c8860a]/20 bg-[#1e1509] p-2.5 text-xs text-[#b8a08a]">
                <p className="font-bold text-white text-[11px]">Fresh Ingredients:</p>
                <p className="mt-0.5 text-[10px] text-[#e6a832]">{activeItemModal.ingredients.join(" • ")}</p>
              </div>
            )}

            {/* Modal Footer Price & Checkout Trigger */}
            <div className="mt-5 flex items-center justify-between border-t border-[#c8860a]/15 pt-3.5">
              <div>
                <span className="text-[10px] text-[#b8a08a]">Calculated Price:</span>
                <p className="font-serif text-xl font-bold text-[#e6a832]">₱{modalTotalPrice.toFixed(2)}</p>
              </div>

              <button
                className="flex items-center gap-2 rounded-full bg-[#c8860a] px-5 py-2.5 text-xs font-bold text-[#140e08] shadow-md transition hover:bg-[#e6a832]"
                onClick={() => {
                  const preselected = {
                    item: activeItemModal,
                    size: modalSelectedSize,
                    addons: modalSelectedAddons,
                  };
                  setActiveItemModal(null);
                  navigate(`/order?item_id=${activeItemModal.menu_item_id}`, { state: { preselected } });
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

      {/* Compact Clean Footer */}
      <footer className="border-t border-[#c8860a]/20 bg-[#140e08] px-4 py-8 text-center text-xs text-[#b8a08a] sm:px-8">
        <p className="font-serif font-bold text-white">LDRN&apos;s Coffee Roastery &amp; Bar</p>
        <div className="mt-2 flex justify-center gap-4 text-[#e6a832] font-semibold">
          <Link to="/" className="hover:underline">Home</Link>
          <span>•</span>
          <Link to="/order" className="hover:underline">Order Online</Link>
          <span>•</span>
          <Link to="/track" className="hover:underline">Track Order</Link>
          <span>•</span>
          <Link to="/login" className="hover:underline">Staff Portal</Link>
        </div>
      </footer>
    </div>
  );
}
