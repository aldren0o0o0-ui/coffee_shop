import { useEffect, useMemo, useState } from "react";
import {
  adjustInventoryStock,
  createInventoryItem,
  fetchInventoryItems,
  fetchInventoryTransactions,
  updateInventoryItem,
} from "../api/inventoryApi";
import { formatCurrency } from "../../payments/utils/currency";

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'low' | 'out' | 'active'

  // Modals state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // Adjustment form state
  const [adjustType, setAdjustType] = useState("adjustment"); // 'adjustment' | 'waste'
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustIsDeduction, setAdjustIsDeduction] = useState(false);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Item form state
  const [itemForm, setItemForm] = useState({
    item_name: "",
    unit_of_measure: "kg",
    quantity_on_hand: "0",
    reorder_level: "10",
    unit_cost: "0",
    is_active: true,
  });
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Transaction history state
  const [transactions, setTransactions] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  async function loadItems() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchInventoryItems();
      setItems(data);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || "Failed to load inventory items."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  function showBanner(msg, isSuccess = true) {
    if (isSuccess) {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(""), 4000);
    } else {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(""), 5000);
    }
  }

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.item_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());
      const qty = parseFloat(item.quantity_on_hand);
      const reorder = parseFloat(item.reorder_level);

      if (!matchesSearch) return false;

      if (filterTab === "low") {
        return qty <= reorder && qty > 0;
      }
      if (filterTab === "out") {
        return qty <= 0;
      }
      if (filterTab === "active") {
        return item.is_active;
      }
      return true;
    });
  }, [items, searchQuery, filterTab]);

  // KPIs
  const kpis = useMemo(() => {
    const totalItems = items.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValuation = 0;

    for (const item of items) {
      const qty = parseFloat(item.quantity_on_hand);
      const reorder = parseFloat(item.reorder_level);
      const cost = parseFloat(item.unit_cost);

      if (item.is_active) {
        totalValuation += qty * cost;
        if (qty <= 0) {
          outOfStockCount++;
        } else if (qty <= reorder) {
          lowStockCount++;
        }
      }
    }

    return {
      totalItems,
      lowStockCount,
      outOfStockCount,
      totalValuation,
    };
  }, [items]);

  // Quick Open Adjust Modal
  function openAdjustModal(item = null) {
    setSelectedItem(item || items[0] || null);
    setAdjustType("adjustment");
    setAdjustAmount("");
    setAdjustIsDeduction(false);
    setAdjustNotes("");
    setIsAdjustModalOpen(true);
  }

  async function handleAdjustSubmit(e) {
    e.preventDefault();
    if (!selectedItem) return;

    const parsedQty = parseFloat(adjustAmount);
    if (!parsedQty || parsedQty <= 0) {
      showBanner("Please enter a valid quantity greater than 0.", false);
      return;
    }

    const finalChange = adjustIsDeduction ? -parsedQty : parsedQty;
    const finalType = adjustIsDeduction ? adjustType : "adjustment";

    setIsSubmittingAdjust(true);
    try {
      await adjustInventoryStock(selectedItem.inventory_item_id, {
        quantity_change: finalChange,
        transaction_type: finalType,
        notes: adjustNotes || (adjustIsDeduction ? "Waste / Spoilage" : "Stock Adjustment"),
      });
      showBanner(`Successfully updated stock for ${selectedItem.item_name}.`);
      setIsAdjustModalOpen(false);
      loadItems();
    } catch (err) {
      showBanner(
        err.response?.data?.detail || "Failed to adjust stock. Please check quantity.",
        false
      );
    } finally {
      setIsSubmittingAdjust(false);
    }
  }

  // Add / Edit Item
  function openNewItemModal() {
    setEditingItem(null);
    setItemForm({
      item_name: "",
      unit_of_measure: "kg",
      quantity_on_hand: "0",
      reorder_level: "10",
      unit_cost: "0",
      is_active: true,
    });
    setIsItemModalOpen(true);
  }

  function openEditItemModal(item) {
    setEditingItem(item);
    setItemForm({
      item_name: item.item_name,
      unit_of_measure: item.unit_of_measure,
      quantity_on_hand: String(item.quantity_on_hand),
      reorder_level: String(item.reorder_level),
      unit_cost: String(item.unit_cost),
      is_active: item.is_active,
    });
    setIsItemModalOpen(true);
  }

  async function handleItemSubmit(e) {
    e.preventDefault();
    if (!itemForm.item_name.trim()) {
      showBanner("Item name is required.", false);
      return;
    }

    setIsSubmittingItem(true);
    try {
      if (editingItem) {
        await updateInventoryItem(editingItem.inventory_item_id, {
          item_name: itemForm.item_name.trim(),
          unit_of_measure: itemForm.unit_of_measure.trim(),
          reorder_level: parseFloat(itemForm.reorder_level) || 0,
          unit_cost: parseFloat(itemForm.unit_cost) || 0,
          is_active: itemForm.is_active,
        });
        showBanner(`Updated ${itemForm.item_name}.`);
      } else {
        await createInventoryItem({
          item_name: itemForm.item_name.trim(),
          unit_of_measure: itemForm.unit_of_measure.trim(),
          quantity_on_hand: parseFloat(itemForm.quantity_on_hand) || 0,
          reorder_level: parseFloat(itemForm.reorder_level) || 0,
          unit_cost: parseFloat(itemForm.unit_cost) || 0,
          is_active: itemForm.is_active,
        });
        showBanner(`Added new stock item: ${itemForm.item_name}.`);
      }
      setIsItemModalOpen(false);
      loadItems();
    } catch (err) {
      showBanner(
        err.response?.data?.detail || "Failed to save stock item.",
        false
      );
    } finally {
      setIsSubmittingItem(false);
    }
  }

  // Open History Drawer
  async function openHistoryModal(item = null) {
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
      const logs = await fetchInventoryTransactions(50, item?.inventory_item_id || null);
      setTransactions(logs);
    } catch (err) {
      showBanner(
        err.response?.data?.detail || "Failed to load transactions history.",
        false
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm transition">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm transition">
          {errorMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-amber-950">
            Stock & Ingredient Management
          </h2>
          <p className="text-sm text-stone-500">
            Manage raw coffee beans, dairy, syrups, packaging, and audit stock levels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 hover:text-stone-900"
            onClick={() => openHistoryModal()}
            type="button"
          >
            <svg className="h-4 w-4 text-stone-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Activity Log</span>
          </button>

          <button
            className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
            onClick={() => openAdjustModal()}
            type="button"
          >
            <svg className="h-4 w-4 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Adjust Stock</span>
          </button>

          <button
            className="flex items-center gap-2 rounded-xl bg-amber-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-900"
            onClick={openNewItemModal}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>+ Add Ingredient / Stock Item</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Tracked Items
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-950">
            {kpis.totalItems}
          </p>
          <p className="mt-1 text-xs text-stone-400">Total catalog inventory</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-800">
            Low Stock Alerts
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {kpis.lowStockCount}
          </p>
          <p className="mt-1 text-xs text-amber-700">At or below reorder level</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-rose-800">
            Out of Stock
          </p>
          <p className="mt-2 text-2xl font-bold text-rose-900">
            {kpis.outOfStockCount}
          </p>
          <p className="mt-1 text-xs text-rose-700">Immediate restock required</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Stock Valuation
          </p>
          <p className="mt-2 text-2xl font-bold text-stone-900">
            {formatCurrency(kpis.totalValuation)}
          </p>
          <p className="mt-1 text-xs text-stone-400">Estimated current on-hand cost</p>
        </div>
      </div>

      {/* Table Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xs">
          {[
            { id: "all", label: "All Items" },
            { id: "low", label: `Low Stock (${kpis.lowStockCount})` },
            { id: "out", label: `Out of Stock (${kpis.outOfStockCount})` },
            { id: "active", label: "Active" },
          ].map((tab) => (
            <button
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterTab === tab.id
                  ? "bg-amber-900 text-white shadow-xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-xs text-stone-800 placeholder-stone-400 shadow-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items by name..."
            type="text"
            value={searchQuery}
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-800 border-t-transparent" />
            <p className="mt-3 text-xs text-stone-500">Loading stock inventory...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <span className="text-3xl">☕</span>
            <p className="mt-2 font-bold text-stone-800 text-sm">No ingredients or stock items found</p>
            <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
              {searchQuery
                ? "No items match your search keyword. Try clearing the filter."
                : "Add your coffee beans, dairy, syrups, and supplies here. Once added, they can be linked to drink recipes for automatic stock deduction."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={openNewItemModal}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-800 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-900"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>+ Add First Ingredient / Stock Item</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-100 bg-stone-50/80 font-semibold uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Ingredient / Item</th>
                  <th className="px-4 py-3">Stock Level</th>
                  <th className="px-4 py-3">Threshold</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Valuation</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredItems.map((item) => {
                  const qty = parseFloat(item.quantity_on_hand);
                  const reorder = parseFloat(item.reorder_level);
                  const cost = parseFloat(item.unit_cost);
                  const isOut = qty <= 0;
                  const isLow = qty <= reorder && qty > 0;

                  return (
                    <tr className="transition hover:bg-stone-50/60" key={item.inventory_item_id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-amber-950">{item.item_name}</p>
                        <p className="text-[11px] text-stone-400">Unit: {item.unit_of_measure}</p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 font-bold ${
                              isOut
                                ? "bg-rose-100 text-rose-800"
                                : isLow
                                ? "bg-amber-100 text-amber-900"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {qty.toLocaleString()} {item.unit_of_measure}
                          </span>
                          {isOut && (
                            <span className="text-[10px] font-semibold text-rose-600">
                              Out
                            </span>
                          )}
                          {isLow && (
                            <span className="text-[10px] font-semibold text-amber-700">
                              Low
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-stone-600">
                        {reorder.toLocaleString()} {item.unit_of_measure}
                      </td>

                      <td className="px-4 py-3 font-medium text-stone-800">
                        {formatCurrency(cost)}
                      </td>

                      <td className="px-4 py-3 font-semibold text-stone-900">
                        {formatCurrency(qty * cost)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 font-semibold text-stone-700 shadow-xs transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-950"
                            onClick={() => openAdjustModal(item)}
                            title="Adjust quantity"
                            type="button"
                          >
                            Adjust
                          </button>
                          <button
                            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
                            onClick={() => openEditItemModal(item)}
                            title="Edit details"
                            type="button"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
                            onClick={() => openHistoryModal(item)}
                            title="View item logs"
                            type="button"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Adjust Stock Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  Adjust Inventory Stock
                </h3>
                <p className="text-xs text-stone-500">
                  {selectedItem?.item_name || "Select item to adjust"}
                </p>
              </div>
              <button
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                onClick={() => setIsAdjustModalOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleAdjustSubmit}>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Item Selection
                </label>
                <select
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  onChange={(e) => {
                    const item = items.find(
                      (i) => i.inventory_item_id === parseInt(e.target.value)
                    );
                    setSelectedItem(item);
                  }}
                  value={selectedItem?.inventory_item_id || ""}
                >
                  {items.map((i) => (
                    <option key={i.inventory_item_id} value={i.inventory_item_id}>
                      {i.item_name} ({parseFloat(i.quantity_on_hand)} {i.unit_of_measure})
                    </option>
                  ))}
                </select>
              </div>

              {/* Addition vs Deduction Toggle */}
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Adjustment Action
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition ${
                      !adjustIsDeduction
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                    }`}
                    onClick={() => {
                      setAdjustIsDeduction(false);
                      setAdjustType("adjustment");
                    }}
                    type="button"
                  >
                    <span>+ Add Stock (Restock)</span>
                  </button>
                  <button
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition ${
                      adjustIsDeduction
                        ? "border-rose-400 bg-rose-50 text-rose-900"
                        : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                    }`}
                    onClick={() => {
                      setAdjustIsDeduction(true);
                      setAdjustType("waste");
                    }}
                    type="button"
                  >
                    <span>− Deduct (Waste / Use)</span>
                  </button>
                </div>
              </div>

              {adjustIsDeduction && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Reason Type
                  </label>
                  <select
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                    onChange={(e) => setAdjustType(e.target.value)}
                    value={adjustType}
                  >
                    <option value="waste">Waste / Spoilage / Expired</option>
                    <option value="adjustment">Stock Correction</option>
                    <option value="usage_out">Manual Usage Out</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Quantity ({selectedItem?.unit_of_measure || "units"})
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-sm font-semibold text-stone-900 focus:border-amber-500 focus:outline-none"
                  min="0.001"
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 5"
                  required
                  step="any"
                  type="number"
                  value={adjustAmount}
                />
                {selectedItem && (
                  <p className="mt-1 text-[11px] text-stone-500">
                    Current on hand: {parseFloat(selectedItem.quantity_on_hand)} {selectedItem.unit_of_measure}
                    {adjustAmount && !isNaN(parseFloat(adjustAmount)) && (
                      <span className="ml-2 font-bold text-amber-900">
                        → Result:{" "}
                        {(
                          parseFloat(selectedItem.quantity_on_hand) +
                          (adjustIsDeduction ? -parseFloat(adjustAmount) : parseFloat(adjustAmount))
                        ).toFixed(2)}{" "}
                        {selectedItem.unit_of_measure}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Audit Notes (Optional)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  maxLength={200}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Spilled batch or supplier restock"
                  type="text"
                  value={adjustNotes}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={() => setIsAdjustModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-950 disabled:opacity-50"
                  disabled={isSubmittingAdjust}
                  type="submit"
                >
                  {isSubmittingAdjust ? "Recording…" : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add / Edit Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  {editingItem ? "Edit Ingredient / Stock Item" : "New Ingredient / Stock Item"}
                </h3>
                <p className="text-xs text-stone-500">
                  {editingItem ? "Update raw material attributes." : "Add raw beans, milk, syrups, or packaging."}
                </p>
              </div>
              <button
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                onClick={() => setIsItemModalOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-2.5 text-[11px] text-amber-900 leading-relaxed">
              💡 <strong>Recipe Auto-Deduction:</strong> Ingredients created here appear in <em>Menu Management (Recipe Step 5)</em> to automatically deduct stock on every drink sold.
            </div>

            <form className="mt-3 space-y-3.5" onSubmit={handleItemSubmit}>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Ingredient / Stock Item Name
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  onChange={(e) =>
                    setItemForm({ ...itemForm, item_name: e.target.value })
                  }
                  placeholder="e.g. Espresso Whole Beans, Whole Milk, Vanilla Syrup"
                  required
                  type="text"
                  value={itemForm.item_name}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Unit of Measure
                  </label>
                  <input
                    list="inventory-unit-presets"
                    className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                    onChange={(e) =>
                      setItemForm({ ...itemForm, unit_of_measure: e.target.value })
                    }
                    placeholder="kg, g, L, ml, oz, pcs"
                    required
                    type="text"
                    value={itemForm.unit_of_measure}
                  />
                  <datalist id="inventory-unit-presets">
                    <option value="kg" />
                    <option value="g" />
                    <option value="L" />
                    <option value="ml" />
                    <option value="oz" />
                    <option value="shots" />
                    <option value="pumps" />
                    <option value="pcs" />
                    <option value="units" />
                  </datalist>
                </div>

                {!editingItem && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Initial Quantity
                    </label>
                    <input
                      className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                      min="0"
                      onChange={(e) =>
                        setItemForm({ ...itemForm, quantity_on_hand: e.target.value })
                      }
                      step="any"
                      type="number"
                      value={itemForm.quantity_on_hand}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Reorder Alert Level
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                    min="0"
                    onChange={(e) =>
                      setItemForm({ ...itemForm, reorder_level: e.target.value })
                    }
                    step="any"
                    type="number"
                    value={itemForm.reorder_level}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Unit Cost (₱)
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                    min="0"
                    onChange={(e) =>
                      setItemForm({ ...itemForm, unit_cost: e.target.value })
                    }
                    step="any"
                    type="number"
                    value={itemForm.unit_cost}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  checked={itemForm.is_active}
                  className="h-4 w-4 rounded-sm border-stone-300 text-amber-800 focus:ring-amber-500"
                  id="item_is_active"
                  onChange={(e) =>
                    setItemForm({ ...itemForm, is_active: e.target.checked })
                  }
                  type="checkbox"
                />
                <label className="text-xs font-medium text-stone-700" htmlFor="item_is_active">
                  Item is actively used and available for recipes
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={() => setIsItemModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-950 disabled:opacity-50"
                  disabled={isSubmittingItem}
                  type="submit"
                >
                  {isSubmittingItem ? "Saving…" : editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Audit Log Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  Inventory Activity & Audit Trail
                </h3>
                <p className="text-xs text-stone-500">
                  Recent stock additions, usage deductions, and waste records
                </p>
              </div>
              <button
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                onClick={() => setIsHistoryModalOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-800 border-t-transparent" />
                  <p className="mt-2 text-xs text-stone-500">Loading audit trail...</p>
                </div>
              ) : transactions.length === 0 ? (
                <p className="py-8 text-center text-xs text-stone-500">
                  No stock transactions recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-stone-100 text-xs">
                  {transactions.map((tx) => {
                    const change = parseFloat(tx.quantity_change);
                    const isPositive = change > 0;

                    return (
                      <div className="flex items-start justify-between py-2.5" key={tx.inventory_transaction_id}>
                        <div>
                          <p className="font-bold text-stone-900">{tx.item_name}</p>
                          <p className="text-[11px] text-stone-500">
                            {tx.notes || tx.transaction_type} • By {tx.creator_name || "Staff"}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 font-bold ${
                              isPositive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {change.toLocaleString()} {tx.unit_of_measure}
                          </span>
                          <p className="mt-0.5 text-[10px] text-stone-400">
                            {new Date(tx.transaction_date).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-stone-100 pt-3 text-right">
              <button
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                onClick={() => setIsHistoryModalOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
