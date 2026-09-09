import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/useAuth";
import {
  addNewCategory,
  deleteProductPermanently,
  emptyTrashCatalog,
  fetchInventoryOptions,
  fetchMenuCatalog,
  fetchTrashCatalog,
  toggleProductAvailability,
  toggleProductTrash,
} from "../api/menuApi";
import ProductWizardModal from "../components/ProductWizardModal";
import ViewProductModal from "../components/ViewProductModal";
import EditProductModal from "../components/EditProductModal";
import { getImageUrl } from "../utils/image";

export default function MenuManagementPage() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tabs: "active" | "trash"
  const [activeTab, setActiveTab] = useState("active");

  // Filters (inside Current Menu Offerings)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Popover state (contains menu_item_id of open popover)
  const [openPopoverId, setOpenPopoverId] = useState(null);

  // Modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [isDeletingPermanent, setIsDeletingPermanent] = useState(false);

  // New Category Form
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);
  const [catError, setCatError] = useState("");

  const [successBanner, setSuccessBanner] = useState("");
  const [errorBanner, setErrorBanner] = useState("");

  // Check roles
  const userRoles = useMemo(() => {
    return user?.roles?.map((r) => r.role_name.toLowerCase()) || [];
  }, [user]);
  const canManageProducts = userRoles.includes("owner") || userRoles.includes("manager");

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside() {
      setOpenPopoverId(null);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [catData, trashData, invData] = await Promise.all([
        fetchMenuCatalog(),
        canManageProducts ? fetchTrashCatalog() : Promise.resolve([]),
        canManageProducts ? fetchInventoryOptions() : Promise.resolve([]),
      ]);
      setCatalog(catData);
      setTrashItems(trashData);
      setInventoryOptions(invData);
    } catch (err) {
      console.error("Failed to load menu data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [canManageProducts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flatten active items
  const allActiveItems = useMemo(() => {
    return catalog.flatMap((cat) =>
      cat.items.map((item) => ({
        ...item,
        category_name: cat.category_name,
      }))
    );
  }, [catalog]);

  // Current items based on activeTab
  const currentTabItems = useMemo(() => {
    return activeTab === "active" ? allActiveItems : trashItems;
  }, [activeTab, allActiveItems, trashItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return currentTabItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" ||
        item.category_name?.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !query ||
        item.item_name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [currentTabItems, selectedCategory, searchQuery]);

  // Handle availability toggle
  async function handleToggleAvailability(item) {
    try {
      const updated = await toggleProductAvailability(item.menu_item_id, !item.is_available);
      setCatalog((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((i) =>
            i.menu_item_id === updated.menu_item_id
              ? { ...i, is_available: updated.is_available }
              : i
          ),
        }))
      );
      showSuccessToast(
        `"${item.item_name}" is now ${updated.is_available ? "In Stock ✓" : "86'd Out of Stock"}`
      );
    } catch (err) {
      console.error("Failed to toggle product availability:", err);
      showErrorToast("Unable to change availability.");
    }
  }

  // Handle Move to Trash
  async function handleMoveToTrash(item) {
    try {
      await toggleProductTrash(item.menu_item_id, true);
      showSuccessToast(`"${item.item_name}" moved to Trash Bin 🗑️`);
      loadData();
    } catch (err) {
      showErrorToast(err.response?.data?.detail || "Unable to move product to trash.");
    }
  }

  // Handle Restore from Trash
  async function handleRestoreFromTrash(item) {
    try {
      await toggleProductTrash(item.menu_item_id, false);
      showSuccessToast(`"${item.item_name}" restored to Active Catalog! 🎉`);
      loadData();
    } catch (err) {
      showErrorToast(err.response?.data?.detail || "Unable to restore product.");
    }
  }

  // Handle Permanent Delete
  async function handlePermanentDelete() {
    if (!confirmDeleteProduct) return;
    setIsDeletingPermanent(true);
    try {
      await deleteProductPermanently(confirmDeleteProduct.menu_item_id);
      showSuccessToast(`"${confirmDeleteProduct.item_name}" permanently purged from database.`);
      setConfirmDeleteProduct(null);
      loadData();
    } catch (err) {
      showErrorToast(
        err.response?.data?.detail ||
          "Cannot permanently delete this item. Keep it in Trash to protect historical order audit trails."
      );
    } finally {
      setIsDeletingPermanent(false);
    }
  }

  // Handle Empty Trash
  async function handleEmptyTrash() {
    if (!window.confirm("Are you sure you want to permanently delete all products in the trash bin? This cannot be undone.")) {
      return;
    }
    try {
      const res = await emptyTrashCatalog();
      showSuccessToast(res.message || "Trash bin emptied successfully!");
      loadData();
    } catch (err) {
      showErrorToast(err.response?.data?.detail || "Unable to empty trash bin.");
    }
  }

  // Handle Add Category Submit
  async function handleCreateCategory(e) {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmittingCat(true);
    setCatError("");

    try {
      const created = await addNewCategory({
        category_name: newCatName.trim(),
        description: newCatDesc.trim() || null,
        display_order: catalog.length + 1,
      });
      setCatalog((prev) => [...prev, created]);
      setIsAddCategoryOpen(false);
      setNewCatName("");
      setNewCatDesc("");
      showSuccessToast(`Category "${created.category_name}" created successfully!`);
    } catch (err) {
      setCatError(err.response?.data?.detail || "Failed to create category.");
    } finally {
      setIsSubmittingCat(false);
    }
  }

  function handleProductPublished(publishedItem) {
    loadData();
    showSuccessToast(`🎉 "${publishedItem.item_name}" published to live menu!`);
  }

  function handleProductUpdated(updatedItem) {
    loadData();
    showSuccessToast(`✓ "${updatedItem.item_name}" changes saved!`);
  }

  function showSuccessToast(msg) {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(""), 5000);
  }

  function showErrorToast(msg) {
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(""), 6000);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Notifications */}
      {successBanner && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner("")} className="text-emerald-700 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-900 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner("")} className="text-rose-700 hover:text-rose-900">
            ✕
          </button>
        </div>
      )}

      {/* Main Page Header */}
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-base">
              ☕
            </span>
            <h1 className="text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
              Menu & Product Catalog
            </h1>
          </div>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Manage your store&apos;s live menu items, photos, recipes, sizes, and instant availability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/browse"
            target="_blank"
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100 transition shadow-xs"
          >
            <span>👁️</span>
            <span>View Public Storefront</span>
          </Link>

          {canManageProducts && (
            <>
              <button
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-800 hover:bg-stone-50 transition shadow-xs"
                onClick={() => setIsAddCategoryOpen(true)}
                type="button"
              >
                <span>+</span>
                <span>New Category</span>
              </button>

              <button
                className="flex items-center gap-1.5 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-amber-800 transition"
                onClick={() => setIsAddProductOpen(true)}
                type="button"
              >
                <span>✨</span>
                <span>Add New Product</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Offerings Card (with Filters embedded inside) */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        {/* CARD HEADER WITH TABS & EMBEDDED FILTERS */}
        <div className="space-y-4 border-b border-stone-100 pb-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-stone-900 sm:text-xl">
                {activeTab === "active" ? "Current Menu Offerings" : "Trash Bin"} ({filteredItems.length})
              </h2>
              <p className="text-xs text-stone-500">
                {activeTab === "active"
                  ? "Active products visible on customer storefront and counter POS"
                  : "Archived products hidden from customer ordering"}
              </p>
            </div>

            {/* TAB SELECTOR: ACTIVE CATALOG vs TRASH BIN */}
            {canManageProducts && (
              <div className="flex items-center rounded-2xl border border-stone-200 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("active");
                    setSelectedCategory("all");
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    activeTab === "active"
                      ? "bg-white text-stone-900 shadow-xs"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  <span>☕ Active Catalog</span>
                  <span className="rounded-full bg-stone-200 px-1.5 py-0.2 text-[10px] text-stone-700">
                    {allActiveItems.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("trash");
                    setSelectedCategory("all");
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    activeTab === "trash"
                      ? "bg-white text-rose-900 shadow-xs"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  <span>🗑️ Trash Bin</span>
                  {trashItems.length > 0 && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-extrabold text-rose-800">
                      {trashItems.length}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* EMBEDDED FILTER TOOLBAR: CATEGORY DROPDOWN + SEARCH BAR */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-1">
            <div className="flex items-center gap-2">
              <label htmlFor="category-dropdown-filter" className="text-xs font-bold text-stone-600 shrink-0">
                Filter Category:
              </label>
              <select
                id="category-dropdown-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-900 focus:border-amber-700 focus:bg-white focus:outline-none"
              >
                <option value="all">All Categories ({currentTabItems.length})</option>
                {catalog.map((cat) => (
                  <option key={cat.category_id} value={cat.category_name}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === "trash" && trashItems.length > 0 && canManageProducts && (
                <button
                  type="button"
                  onClick={handleEmptyTrash}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 transition shadow-xs"
                >
                  🗑️ Empty All Trash
                </button>
              )}

              {/* Compact Search Box */}
              <div className="relative min-w-[220px]">
                <input
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-7 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:border-amber-700 focus:bg-white focus:outline-none"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search menu offerings…"
                  type="text"
                  value={searchQuery}
                />
                <span className="absolute left-2.5 top-2 text-xs text-stone-400">🔍</span>
                {searchQuery && (
                  <button
                    className="absolute right-2.5 top-2 text-xs text-stone-400 hover:text-stone-700"
                    onClick={() => setSearchQuery("")}
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ITEMS LIST */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-500">Loading catalog…</div>
        ) : filteredItems.length > 0 ? (
          <div className="mt-2 divide-y divide-stone-100">
            {filteredItems.map((item) => (
              <div
                className="group flex flex-col justify-between gap-4 py-4 transition hover:bg-stone-50/50 sm:flex-row sm:items-center sm:px-2 rounded-2xl"
                key={item.menu_item_id}
              >
                {/* Left: Thumbnail & Info */}
                <div
                  className="flex items-start gap-4 flex-1 cursor-pointer"
                  onClick={() => setViewProduct(item)}
                >
                  {/* Thumbnail */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-stone-100 border border-stone-200 shadow-xs">
                    {item.image_url ? (
                      <img
                        src={getImageUrl(item.image_url)}
                        alt={item.item_name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl text-stone-400">
                        ☕
                      </div>
                    )}
                    {item.images && item.images.length > 1 && (
                      <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1 py-0.2 text-[9px] font-bold text-white backdrop-blur-xs">
                        📷 {item.images.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm sm:text-base group-hover:text-amber-950">
                        {item.item_name}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                        {item.category_name}
                      </span>

                      {item.is_deleted ? (
                        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                          🗑️ In Trash
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.is_available
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.is_available ? "In Stock" : "86 Out of Stock"}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-stone-500 line-clamp-1">
                      {item.description || "No description provided."}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-stone-600">
                      <span className="font-extrabold text-amber-950">
                        ${Number(item.base_price).toFixed(2)}
                      </span>
                      {item.sizes && item.sizes.length > 0 && (
                        <span>• Sizes: {item.sizes.map((s) => s.size_name).join(", ")}</span>
                      )}
                      {item.ingredients && item.ingredients.length > 0 && (
                        <span className="text-stone-400">
                          • Recipe: {item.ingredients.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions (View button + File-Management 3-dots Popover) */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setViewProduct(item)}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-100 transition shadow-xs"
                  >
                    View Details
                  </button>

                  {/* THREE-DOTS POPOVER MENU */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPopoverId(
                          openPopoverId === item.menu_item_id ? null : item.menu_item_id
                        );
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition shadow-xs ${
                        openPopoverId === item.menu_item_id
                          ? "border-amber-900 bg-amber-50 text-amber-950"
                          : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                      }`}
                      title="More actions"
                    >
                      <span className="text-base font-black leading-none select-none">⋮</span>
                    </button>

                    {/* Floating Popover Menu */}
                    {openPopoverId === item.menu_item_id && (
                      <div
                        className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {activeTab === "active" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenPopoverId(null);
                                setViewProduct(item);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                            >
                              <span>👁️</span>
                              <span>View Details</span>
                            </button>

                            {canManageProducts && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPopoverId(null);
                                  setEditProduct(item);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                              >
                                <span>✏️</span>
                                <span>Edit Product</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setOpenPopoverId(null);
                                handleToggleAvailability(item);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                            >
                              <span>{item.is_available ? "⏸️" : "▶️"}</span>
                              <span>{item.is_available ? "86 Out of Stock" : "Put in Stock"}</span>
                            </button>

                            {canManageProducts && (
                              <>
                                <div className="my-1 border-t border-stone-100" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenPopoverId(null);
                                    handleMoveToTrash(item);
                                  }}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                                >
                                  <span>🗑️</span>
                                  <span>Move to Trash</span>
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenPopoverId(null);
                                setViewProduct(item);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                            >
                              <span>👁️</span>
                              <span>View Details</span>
                            </button>

                            {canManageProducts && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenPopoverId(null);
                                    handleRestoreFromTrash(item);
                                  }}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition"
                                >
                                  <span>♻️</span>
                                  <span>Restore to Menu</span>
                                </button>

                                <div className="my-1 border-t border-stone-100" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenPopoverId(null);
                                    setConfirmDeleteProduct(item);
                                  }}
                                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                                >
                                  <span>❌</span>
                                  <span>Delete Permanently</span>
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-14 text-center">
            {activeTab === "active" ? (
              <>
                <p className="text-sm font-semibold text-stone-700">No active products match your filter.</p>
                {canManageProducts && (
                  <button
                    className="mt-3 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-800"
                    onClick={() => setIsAddProductOpen(true)}
                    type="button"
                  >
                    + Add New Product
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-1">
                <span className="text-3xl">🗑️</span>
                <p className="text-sm font-semibold text-stone-700">Trash Bin is Empty</p>
                <p className="text-xs text-stone-400">Products moved to trash will appear here.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* VIEW PRODUCT MODAL */}
      <ViewProductModal
        isOpen={Boolean(viewProduct)}
        onClose={() => setViewProduct(null)}
        product={viewProduct}
        canManageProducts={canManageProducts}
        onEditClick={(prod) => setEditProduct(prod)}
        onRestoreClick={(prod) => handleRestoreFromTrash(prod)}
      />

      {/* EDIT PRODUCT MODAL */}
      <EditProductModal
        isOpen={Boolean(editProduct)}
        onClose={() => setEditProduct(null)}
        product={editProduct}
        categories={catalog}
        inventoryOptions={inventoryOptions}
        onProductUpdated={handleProductUpdated}
      />

      {/* PERMANENT DELETE CONFIRMATION DIALOG */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-stone-900">Permanently Delete Product?</h3>
            </div>

            <p className="text-xs leading-relaxed text-stone-600">
              Are you sure you want to permanently delete{" "}
              <strong className="text-stone-900">{confirmDeleteProduct.item_name}</strong>?
              This action cannot be undone. All photo assets and configuration data will be permanently wiped.
            </p>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteProduct(null)}
                disabled={isDeletingPermanent}
                className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={isDeletingPermanent}
                className="rounded-xl bg-rose-700 px-5 py-2 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {isDeletingPermanent ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CATEGORY MODAL */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-bold text-stone-900">Create New Menu Category</h3>
              <button
                className="text-stone-400 hover:text-stone-700"
                onClick={() => setIsAddCategoryOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            {catError && (
              <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-800">
                {catError}
              </div>
            )}

            <form className="mt-4 space-y-3.5" onSubmit={handleCreateCategory}>
              <div>
                <label className="block text-xs font-bold text-stone-700" htmlFor="cat-name-input">
                  Category Name *
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-xs text-stone-900"
                  id="cat-name-input"
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Seasonal Specials, Teas & Refreshers"
                  required
                  type="text"
                  value={newCatName}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700" htmlFor="cat-desc-input">
                  Description (optional)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-xs text-stone-900"
                  id="cat-desc-input"
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Brief description of this section"
                  type="text"
                  value={newCatDesc}
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-stone-100 pt-3">
                <button
                  className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700"
                  onClick={() => setIsAddCategoryOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-amber-900 px-5 py-2 text-xs font-bold text-white hover:bg-amber-950 disabled:opacity-50"
                  disabled={isSubmittingCat || !newCatName.trim()}
                  type="submit"
                >
                  {isSubmittingCat ? "Creating…" : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6-STEP PRODUCT CREATION WIZARD MODAL */}
      <ProductWizardModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        categories={catalog}
        inventoryOptions={inventoryOptions}
        onProductPublished={handleProductPublished}
      />
    </div>
  );
}
