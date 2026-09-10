import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { fetchMenuCatalog } from "../../menu/api/menuApi";
import {
  createPosOrder,
  lookupPendingCounterOrders,
  payPendingCounterOrder,
} from "../api/ordersApi";
import { downloadReceipt, printReceipt } from "../utils/receiptUtils";
import { getImageUrl } from "../../menu/utils/image";

export default function PosPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Mode: "register" | "lookup"
  const [activeMode, setActiveMode] = useState(() => {
    const qMode = new URLSearchParams(window.location.search).get("mode");
    return qMode === "lookup" ? "lookup" : "register";
  });

  // Menu Catalog State
  const [catalog, setCatalog] = useState([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState("");

  // Filters for Register
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Register Ticket & POS Cart
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("Walk-in Guest");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderType, setOrderType] = useState("dine_in");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [editingPendingOrder, setEditingPendingOrder] = useState(null);

  // Customization drawer/modal for selected item
  const [customizingItem, setCustomizingItem] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Checkout submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [posError, setPosError] = useState("");
  const [confirmedReceipt, setConfirmedReceipt] = useState(null);

  // --- LOOK UP PENDING ORDER STATE ---
  const [lookupQuery, setLookupQuery] = useState("");
  const [isSearchingLookup, setIsSearchingLookup] = useState(false);
  const [lookupResults, setLookupResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPendingOrder, setSelectedPendingOrder] = useState(null);
  const [pendingItems, setPendingItems] = useState([]);
  const [showAddDrinkDropdown, setShowAddDrinkDropdown] = useState(false);
  const [addDrinkSearch, setAddDrinkSearch] = useState("");
  const [counterPaymentMethod, setCounterPaymentMethod] = useState("cash");
  const [counterAmountTendered, setCounterAmountTendered] = useState("");
  const [lookupError, setLookupError] = useState("");

  async function loadMenu() {
    setIsLoadingMenu(true);
    setMenuError("");
    try {
      const data = await fetchMenuCatalog();
      setCatalog(data);
    } catch (err) {
      console.error("Failed to load POS catalog:", err);
      setMenuError("Unable to load menu catalog. Please check server connection.");
    } finally {
      setIsLoadingMenu(false);
    }
  }

  useEffect(() => {
    loadMenu();
  }, []);

  const allItems = useMemo(() => {
    return catalog.flatMap((cat) =>
      cat.items.map((item) => ({
        ...item,
        category_name: cat.category_name,
      }))
    );
  }, [catalog]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchesCat =
        selectedCategory === "all" ||
        item.category_name.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !query ||
        item.item_name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query));
      return matchesCat && matchesSearch;
    });
  }, [allItems, selectedCategory, searchQuery]);

  // Open item customization
  function handleSelectDrink(item) {
    setCustomizingItem(item);
    const defaultSize = item.sizes?.find((s) => s.is_default) || item.sizes?.[0] || null;
    setSelectedSize(defaultSize);
    setSelectedAddons([]);
    setSpecialInstructions("");
  }

  // Add customized item to POS cart
  function handleAddCustomizedToCart() {
    if (!customizingItem) return;

    const sizeAdjustment = selectedSize ? Number(selectedSize.price_adjustment || 0) : 0;
    const addonsTotal = selectedAddons.reduce(
      (acc, a) => acc + Number(a.additional_price || 0),
      0
    );
    const unitPrice = Number(customizingItem.base_price) + sizeAdjustment + addonsTotal;

    const cartEntry = {
      cart_id: `pos-${Date.now()}-${Math.random()}`,
      menu_item_id: customizingItem.menu_item_id,
      item_name: customizingItem.item_name,
      menu_item_size_id: selectedSize ? selectedSize.menu_item_size_id : null,
      size_name: selectedSize ? selectedSize.size_name : null,
      addon_ids: selectedAddons.map((a) => a.menu_item_addon_id),
      addons: selectedAddons,
      special_instructions: specialInstructions.trim() || null,
      unit_price: unitPrice,
      quantity: 1,
    };

    if (activeMode === "lookup" && selectedPendingOrder) {
      setPendingItems((prev) => [...prev, cartEntry]);
    } else {
      setCart((prev) => [...prev, cartEntry]);
    }
    setCustomizingItem(null);
  }

  // Cart quantity controls
  function updateCartQuantity(cartId, delta) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cart_id === cartId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  }

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  }, [cart]);

  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  // Change Calculation for Register Cart
  const numericTendered = parseFloat(amountTendered) || 0;
  const registerChangeDue = numericTendered >= total ? numericTendered - total : 0;

  function handleEditPendingOrderInRegister(order) {
    if (!order) return;
    handleSelectPendingOrder(order);
  }

  // Submit POS Order
  async function handleCheckout(e) {
    e.preventDefault();
    if (cart.length === 0) return;

    if (paymentMethod === "cash" && numericTendered < total) {
      setPosError(`Amount tendered (₱${numericTendered.toFixed(2)}) must be at least total due (₱${total.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    setPosError("");

    try {
      const itemsPayload = cart.map((c) => {
        const addonIds = c.addon_ids || (c.addons || []).map((a) => a.addon_id || a.menu_item_addon_id).filter(Boolean);
        return {
          menu_item_id: c.menu_item_id,
          menu_item_size_id: c.menu_item_size_id,
          quantity: c.quantity,
          addon_ids: addonIds,
          addons: addonIds.map((id) => ({
            menu_item_addon_id: id,
            quantity: 1,
          })),
          special_instructions: c.special_instructions,
        };
      });

      let result;
      if (editingPendingOrder) {
        const payload = {
          payment_method: paymentMethod,
          amount_tendered: paymentMethod === "cash" ? numericTendered : null,
          items: itemsPayload,
        };
        result = await payPendingCounterOrder(editingPendingOrder.order_id, payload);
      } else {
        const payload = {
          customer_name: customerName.trim() || "Walk-in Guest",
          customer_email: customerEmail.trim() || null,
          order_type: orderType,
          payment_method: paymentMethod,
          amount_tendered: paymentMethod === "cash" ? numericTendered : null,
          items: itemsPayload,
        };
        result = await createPosOrder(payload);
      }

      setConfirmedReceipt(result);
      setCart([]);
      setEditingPendingOrder(null);
      setCustomerName("Walk-in Guest");
      setCustomerEmail("");
      setAmountTendered("");
    } catch (err) {
      console.error("POS sale failed:", err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409 || (detail && detail.includes("stock"))) {
        setPosError("⚠️ Insufficient Inventory: One of the selected drinks cannot be prepared due to low stock.");
      } else {
        setPosError(detail || "Failed to submit POS register sale.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- PENDING ORDER EDITING & LOOKUP ACTIONS ---
  function updatePendingItemQuantity(cartId, delta) {
    setPendingItems((prev) =>
      prev
        .map((item) => {
          if (item.cart_id === cartId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  }

  function removePendingItem(cartId) {
    setPendingItems((prev) => prev.filter((item) => item.cart_id !== cartId));
  }

  const pendingSubtotal = useMemo(() => {
    return pendingItems.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  }, [pendingItems]);

  const pendingTax = pendingSubtotal * 0.08;
  const pendingTotal = pendingSubtotal + pendingTax;

  const counterNumericTendered = counterAmountTendered !== ""
    ? (parseFloat(counterAmountTendered) || 0)
    : pendingTotal;
  const counterChangeDue = counterNumericTendered >= pendingTotal ? counterNumericTendered - pendingTotal : 0;

  // Automatically synchronize cash amount tendered to match pendingTotal
  useEffect(() => {
    if (selectedPendingOrder && pendingTotal > 0) {
      setCounterAmountTendered((prev) => {
        if (!prev) return pendingTotal.toFixed(2);
        const val = parseFloat(prev);
        if (isNaN(val) || val < pendingTotal) {
          return pendingTotal.toFixed(2);
        }
        return prev;
      });
    }
  }, [selectedPendingOrder?.order_id, pendingTotal]);

  function handleSelectPendingOrder(order) {
    if (!order) {
      setSelectedPendingOrder(null);
      setPendingItems([]);
      setCounterAmountTendered("");
      return;
    }
    setSelectedPendingOrder(order);
    const mapped = (order.items || []).map((it) => {
      const addons = it.addons || [];
      return {
        order_item_id: it.order_item_id,
        cart_id: `pending-${it.order_item_id || it.menu_item_id}-${Date.now()}-${Math.random()}`,
        menu_item_id: it.menu_item_id,
        item_name: it.item_name,
        menu_item_size_id: it.menu_item_size_id || null,
        size_name: it.size_name || null,
        addon_ids: addons.map((a) => a.addon_id || a.menu_item_addon_id).filter(Boolean),
        addons: addons,
        special_instructions: it.special_instructions || null,
        unit_price: Number(it.unit_price),
        quantity: it.quantity,
      };
    });
    setPendingItems(mapped);
    setShowAddDrinkDropdown(false);
    setAddDrinkSearch("");
    const sub = mapped.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);
    const tot = sub + sub * 0.08;
    setCounterAmountTendered(tot.toFixed(2));
  }

  async function loadPendingOrders(query = "", autoSelectRef = "") {
    setIsSearchingLookup(true);
    setLookupError("");
    try {
      const results = await lookupPendingCounterOrders(query);
      setLookupResults(results);
      setHasSearched(true);

      const targetRef = autoSelectRef || query;
      if (targetRef) {
        const cleanRef = targetRef.trim().toLowerCase();
        const matched = results.find(
          (o) =>
            (o.reference_code || "").toLowerCase() === cleanRef ||
            `ref-${o.order_id}`.toLowerCase() === cleanRef ||
            o.order_id.toString() === cleanRef
        );
        if (matched) {
          handleSelectPendingOrder(matched);
        } else if (results.length > 0 && !selectedPendingOrder) {
          handleSelectPendingOrder(results[0]);
        }
      } else if (results.length > 0 && !selectedPendingOrder) {
        handleSelectPendingOrder(results[0]);
      } else if (selectedPendingOrder) {
        const stillPresent = results.find((o) => o.order_id === selectedPendingOrder.order_id);
        if (!stillPresent && results.length > 0) {
          handleSelectPendingOrder(results[0]);
        } else if (!stillPresent) {
          setSelectedPendingOrder(null);
          setPendingItems([]);
        }
      }
    } catch {
      setLookupError("Unable to load pending counter orders. Please check your connection.");
    } finally {
      setIsSearchingLookup(false);
    }
  }

  async function handleLookupSearch(e) {
    if (e) e.preventDefault();
    loadPendingOrders(lookupQuery.trim());
  }

  useEffect(() => {
    loadPendingOrders("");
  }, []);

  useEffect(() => {
    if (activeMode === "lookup") {
      loadPendingOrders(lookupQuery);
    }
  }, [activeMode]);

  useEffect(() => {
    const qMode = searchParams.get("mode") || location.state?.activeMode;
    const qRef = searchParams.get("ref") || location.state?.referenceCode;
    if (qMode === "lookup") {
      setActiveMode("lookup");
      if (qRef) {
        setLookupQuery(qRef);
        // Load all pending orders so the cashier sees the full list, and auto-select the targeted ref
        loadPendingOrders("", qRef);
      } else {
        loadPendingOrders("");
      }
    }
  }, [location.key, location.state, searchParams]);

  async function handleConfirmCounterPayment(e) {
    e.preventDefault();
    if (!selectedPendingOrder) return;

    if (pendingItems.length === 0) {
      setLookupError("Cannot tender payment: The order must contain at least one item.");
      return;
    }

    const effectiveTendered = counterPaymentMethod === "cash"
      ? (counterAmountTendered !== "" ? parseFloat(counterAmountTendered) : pendingTotal)
      : null;

    if (counterPaymentMethod === "cash" && (effectiveTendered === null || isNaN(effectiveTendered) || effectiveTendered < pendingTotal)) {
      const displayVal = effectiveTendered !== null && !isNaN(effectiveTendered) ? effectiveTendered : 0;
      setLookupError(`Amount tendered (₱${displayVal.toFixed(2)}) must be at least total due (₱${pendingTotal.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    setLookupError("");

    try {
      const itemsPayload = pendingItems.map((c) => {
        const addonIds = c.addon_ids || (c.addons || []).map((a) => a.addon_id || a.menu_item_addon_id).filter(Boolean);
        return {
          menu_item_id: c.menu_item_id,
          menu_item_size_id: c.menu_item_size_id,
          quantity: c.quantity,
          addon_ids: addonIds,
          addons: addonIds.map((id) => ({
            menu_item_addon_id: id,
            quantity: 1,
          })),
          special_instructions: c.special_instructions,
        };
      });

      const payload = {
        payment_method: counterPaymentMethod,
        amount_tendered: effectiveTendered,
        items: itemsPayload,
      };

      const result = await payPendingCounterOrder(selectedPendingOrder.order_id, payload);
      setConfirmedReceipt(result);
      setSelectedPendingOrder(null);
      setPendingItems([]);
      setCounterAmountTendered("");
      loadPendingOrders("");
    } catch (err) {
      setLookupError(err.response?.data?.detail || "Failed to confirm payment for counter order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER WITH MODE TABS */}
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-950">
              🖥️
            </span>
            <h1 className="text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
              Point of Sale Register
            </h1>
          </div>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Fast counter checkout, pending order retrieval (REF-XXXX), and instant receipt printing.
          </p>
        </div>

        {/* MODE SELECTOR */}
        <div className="flex items-center rounded-2xl border border-stone-200 bg-stone-50 p-1">
          <button
            type="button"
            onClick={() => setActiveMode("register")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeMode === "register"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <span>🛒 New Counter Sale</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("lookup")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeMode === "lookup"
                ? "bg-amber-900 text-white shadow-xs"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <span>🔍 Look Up Pending Order</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MODE 1: LOOK UP PENDING ORDER                                             */}
      {/* ========================================================================= */}
      {activeMode === "lookup" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* SEARCH & FILTER BAR */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <span>Pending Pay-at-Counter Orders</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900 border border-amber-300">
                    {lookupResults.length} active
                  </span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  All active pending counter orders are displayed automatically below. Select any order to edit quantities, add menu items, or tender payment.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLookupQuery("");
                    loadPendingOrders("");
                  }}
                  className="flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition shadow-2xs"
                  title="Reload all pending orders"
                >
                  <span>🔄 Refresh List</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleLookupSearch} className="flex flex-col sm:flex-row gap-2 max-w-2xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={lookupQuery}
                  onChange={(e) => {
                    setLookupQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      loadPendingOrders("");
                    }
                  }}
                  placeholder="Filter by Reference Code (e.g. REF-4821), customer name, or email..."
                  className="w-full rounded-2xl border border-stone-300 bg-stone-50 py-3 pl-10 pr-10 text-xs font-bold text-stone-900 placeholder:text-stone-400 focus:border-amber-900 focus:bg-white focus:outline-none"
                />
                <span className="absolute left-3.5 top-3.5 text-xs text-stone-400">🔍</span>
                {lookupQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setLookupQuery("");
                      loadPendingOrders("");
                    }}
                    className="absolute right-3.5 top-3 text-xs text-stone-400 hover:text-stone-700"
                    title="Clear filter"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isSearchingLookup}
                className="rounded-2xl bg-amber-900 px-6 py-3 text-xs font-black text-white shadow-xs hover:bg-amber-950 disabled:opacity-50 transition"
              >
                {isSearchingLookup ? "Searching..." : "Filter Orders"}
              </button>
              {lookupQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setLookupQuery("");
                    loadPendingOrders("");
                  }}
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                >
                  Show All ({lookupResults.length})
                </button>
              )}
            </form>

            {lookupError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                ⚠️ {lookupError}
              </div>
            )}
          </section>

          {/* TWO-COLUMN WORKSPACE: LEFT LIST & RIGHT EDITABLE REVIEW */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* LEFT 6 COLS: ORDERS LIST */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
                  Select Order to Review ({lookupResults.length})
                </span>
                <span className="text-[11px] text-stone-400">
                  Auto-loaded in real time
                </span>
              </div>

              {isSearchingLookup ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="animate-pulse rounded-3xl border border-stone-200 bg-white p-5 space-y-2">
                      <div className="h-4 w-32 bg-stone-200 rounded" />
                      <div className="h-3 w-48 bg-stone-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : lookupResults.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-stone-200 bg-white p-12 text-center text-xs text-stone-500 space-y-2">
                  <span className="text-3xl block">⏳</span>
                  <p className="font-bold text-stone-800">
                    {lookupQuery ? `No pending order found matching "${lookupQuery}"` : "No pending counter orders right now"}
                  </p>
                  <p className="text-stone-400 text-[11px]">
                    {lookupQuery
                      ? "Check with the customer or clear filter to display all pending orders."
                      : "When customers choose 'Pay at Counter' online, their orders appear here automatically."}
                  </p>
                  {lookupQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setLookupQuery("");
                        loadPendingOrders("");
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-black text-amber-900 hover:underline"
                    >
                      Show All Pending Orders
                    </button>
                  )}
                </div>
              ) : (
                lookupResults.map((order) => {
                  const isSelected = selectedPendingOrder?.order_id === order.order_id;
                  return (
                    <div
                      key={order.order_id}
                      onClick={() => handleSelectPendingOrder(order)}
                      className={`cursor-pointer w-full text-left rounded-3xl border p-5 transition shadow-xs ${
                        isSelected
                          ? "border-amber-900 bg-amber-50/60 ring-2 ring-amber-400"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-amber-200/70 px-2 py-0.5 text-xs font-black text-amber-950">
                              {order.reference_code || `REF-${order.order_id}`}
                            </span>
                            <span className="font-extrabold text-stone-900 text-sm">
                              {order.customer_name}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-stone-500 line-clamp-2">
                            {order.items?.map((i) => `${i.quantity}x ${i.item_name}`).join(", ")}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-stone-900">
                            ₱{Number(order.total_amount).toFixed(2)}
                          </span>
                          <span className="block text-[10px] font-bold text-amber-800 uppercase mt-0.5">
                            Awaiting Payment
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
                        <span className="text-[11px] text-stone-400">
                          {order.order_type === "takeout" ? "🛍️ Takeout" : "🍽️ Dine-In"} • #{order.order_id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPendingOrder(order);
                          }}
                          className="inline-flex items-center gap-1 font-bold text-amber-900 hover:text-amber-950 underline text-xs"
                        >
                          ✏️ Edit &amp; Review →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* RIGHT 6 COLS: EDITABLE PENDING ORDER REVIEW & CHARGE TERMINAL */}
            <div className="lg:col-span-6">
              {selectedPendingOrder ? (
                <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4 sticky top-6">
                  {/* HEADER */}
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3 gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider block">
                        Pending Order Review &amp; Edit
                      </span>
                      <h3 className="text-lg font-black text-stone-900">
                        {selectedPendingOrder.reference_code || `REF-${selectedPendingOrder.order_id}`} • {selectedPendingOrder.customer_name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900 border border-amber-300">
                        Awaiting Payment
                      </span>
                    </div>
                  </div>

                  {/* ORDER ITEMS HEADER & ADD DRINK BUTTON */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-700">
                      Order Items ({pendingItems.length})
                    </span>

                    {/* ADD DRINK FROM MENU POPUP/DROPDOWN */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAddDrinkDropdown((prev) => !prev)}
                        className="flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-900 hover:bg-amber-100 transition shadow-2xs"
                      >
                        <span>➕ Add Drink from Menu</span>
                      </button>

                      {showAddDrinkDropdown && (
                        <div className="absolute right-0 top-8 z-30 w-72 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl space-y-2 animate-in fade-in duration-100">
                          <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                            <span className="text-xs font-black text-stone-900">Add Menu Drink</span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddDrinkDropdown(false);
                                setAddDrinkSearch("");
                              }}
                              className="text-stone-400 hover:text-stone-700 text-xs"
                            >
                              ✕
                            </button>
                          </div>

                          <input
                            type="text"
                            value={addDrinkSearch}
                            onChange={(e) => setAddDrinkSearch(e.target.value)}
                            placeholder="Search drinks..."
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:border-amber-900 focus:bg-white focus:outline-none"
                            autoFocus
                          />

                          <div className="max-h-52 overflow-y-auto divide-y divide-stone-100 space-y-1">
                            {allItems
                              .filter((it) => {
                                const q = addDrinkSearch.trim().toLowerCase();
                                if (!q) return true;
                                return (
                                  it.item_name.toLowerCase().includes(q) ||
                                  (it.category_name && it.category_name.toLowerCase().includes(q))
                                );
                              })
                              .map((drink) => (
                                <button
                                  key={drink.menu_item_id}
                                  type="button"
                                  onClick={() => {
                                    setShowAddDrinkDropdown(false);
                                    setAddDrinkSearch("");
                                    handleSelectDrink(drink);
                                  }}
                                  className="w-full py-1.5 px-1 text-left flex items-center justify-between hover:bg-amber-50/70 rounded-lg transition"
                                >
                                  <div>
                                    <span className="text-xs font-bold text-stone-900 block">
                                      {drink.item_name}
                                    </span>
                                    <span className="text-[10px] text-stone-400">
                                      {drink.category_name}
                                    </span>
                                  </div>
                                  <span className="text-xs font-black text-amber-900">
                                    ₱{Number(drink.base_price).toFixed(2)}
                                  </span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EDITABLE ITEMS LIST */}
                  <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-stone-100 border-y border-stone-100 py-2">
                    {pendingItems.length === 0 ? (
                      <div className="py-6 text-center text-xs text-stone-400 italic">
                        No items in this order. Add a drink above or re-select the order.
                      </div>
                    ) : (
                      pendingItems.map((item) => (
                        <div key={item.cart_id} className="py-2.5 text-xs flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-stone-900">
                                {item.item_name}
                              </span>
                              {item.size_name && (
                                <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">
                                  {item.size_name}
                                </span>
                              )}
                            </div>

                            {item.addons && item.addons.length > 0 && (
                              <div className="text-[10px] text-stone-500 mt-0.5">
                                + {item.addons.map((a) => a.addon_name).join(", ")}
                              </div>
                            )}

                            {item.special_instructions && (
                              <div className="text-[10px] text-amber-900 italic mt-0.5">
                                Note: {item.special_instructions}
                              </div>
                            )}

                            <div className="text-[11px] font-semibold text-stone-500 mt-0.5">
                              ₱{Number(item.unit_price).toFixed(2)} each
                            </div>
                          </div>

                          {/* QUANTITY CONTROLS & LINE TOTAL */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center rounded-xl border border-stone-200 bg-stone-50 p-0.5">
                              <button
                                type="button"
                                onClick={() => updatePendingItemQuantity(item.cart_id, -1)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg bg-white font-black text-stone-700 hover:bg-stone-200 shadow-2xs transition"
                                title="Decrease quantity"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-xs font-black text-stone-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updatePendingItemQuantity(item.cart_id, 1)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg bg-white font-black text-stone-700 hover:bg-stone-200 shadow-2xs transition"
                                title="Increase quantity"
                              >
                                +
                              </button>
                            </div>

                            <span className="w-16 text-right font-black text-stone-900">
                              ₱{(item.unit_price * item.quantity).toFixed(2)}
                            </span>

                            <button
                              type="button"
                              onClick={() => removePendingItem(item.cart_id)}
                              className="p-1 text-stone-400 hover:text-rose-600 transition"
                              title="Remove item"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* FINANCIAL TOTALS */}
                  <div className="space-y-1 text-xs border-b border-stone-100 pb-3">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span>₱{pendingSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Tax (8%)</span>
                      <span>₱{pendingTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-stone-950 pt-1">
                      <span>Total Due</span>
                      <span className="text-amber-950">₱{pendingTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* CASH & CHANGE TENDER COMPONENT */}
                  <form onSubmit={handleConfirmCounterPayment} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCounterPaymentMethod("cash")}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                          counterPaymentMethod === "cash"
                            ? "border-amber-900 bg-amber-50 text-amber-950"
                            : "border-stone-200 bg-white text-stone-700"
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setCounterPaymentMethod("card")}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                          counterPaymentMethod === "card"
                            ? "border-amber-900 bg-amber-50 text-amber-950"
                            : "border-stone-200 bg-white text-stone-700"
                        }`}
                      >
                        💳 Card
                      </button>
                    </div>

                    {counterPaymentMethod === "cash" && (
                      <div className="rounded-2xl bg-stone-50 p-3 space-y-2 border border-stone-200">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-bold text-stone-700">Amount Tendered (₱):</label>
                          <input
                            type="number"
                            step="0.01"
                            min={pendingTotal}
                            required
                            value={counterAmountTendered}
                            onChange={(e) => setCounterAmountTendered(e.target.value)}
                            placeholder={pendingTotal.toFixed(2)}
                            className="w-28 rounded-xl border border-stone-300 bg-white p-1.5 text-right text-xs font-black text-stone-900"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setCounterAmountTendered(pendingTotal.toFixed(2))}
                            className="rounded-lg bg-stone-200 px-2 py-0.5 text-[10px] font-bold hover:bg-stone-300"
                          >
                            Exact
                          </button>
                          <button
                            type="button"
                            onClick={() => setCounterAmountTendered("100.00")}
                            className="rounded-lg bg-stone-200 px-2 py-0.5 text-[10px] font-bold hover:bg-stone-300"
                          >
                            ₱100
                          </button>
                          <button
                            type="button"
                            onClick={() => setCounterAmountTendered("500.00")}
                            className="rounded-lg bg-stone-200 px-2 py-0.5 text-[10px] font-bold hover:bg-stone-300"
                          >
                            ₱500
                          </button>
                          <button
                            type="button"
                            onClick={() => setCounterAmountTendered("1000.00")}
                            className="rounded-lg bg-stone-200 px-2 py-0.5 text-[10px] font-bold hover:bg-stone-300"
                          >
                            ₱1,000
                          </button>
                        </div>

                        <div className="flex justify-between items-center text-xs font-black text-emerald-800 border-t border-stone-200 pt-2">
                          <span>Change Due:</span>
                          <span className="text-sm">₱{counterChangeDue.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        pendingItems.length === 0 ||
                        (counterPaymentMethod === "cash" && counterNumericTendered < pendingTotal)
                      }
                      className="w-full rounded-2xl bg-amber-900 py-3.5 text-xs font-black text-white shadow-md hover:bg-amber-950 disabled:opacity-50 transition"
                    >
                      {isSubmitting ? "Processing..." : `Charge ₱${pendingTotal.toFixed(2)} & Dispatch to Barista 🚀`}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-200 bg-stone-50/50 p-12 text-center text-xs text-stone-400">
                  Select a pending counter order on the left to review items, edit quantities, and collect payment.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: NEW COUNTER SALE                                                  */}
      {/* ========================================================================= */}
      {activeMode === "register" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* EDITING PENDING ORDER BANNER */}
          {editingPendingOrder && (
            <div className="rounded-3xl border-2 border-amber-500 bg-amber-50 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-xl font-black text-amber-950">
                  ✏️
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-amber-900 px-2.5 py-0.5 text-xs font-black text-white">
                      {editingPendingOrder.reference_code || `REF-${editingPendingOrder.order_id}`}
                    </span>
                    <span className="text-sm font-black text-stone-900">
                      Modifying Order: {editingPendingOrder.customer_name}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 mt-0.5">
                    Modify drinks, sizes, modifiers, or quantities below. Totals recalculate live. When finished, collect payment to dispatch order straight to the Barista!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingPendingOrder(null);
                  setCart([]);
                  setCustomerName("Walk-in Guest");
                  setCustomerEmail("");
                }}
                className="rounded-xl border border-amber-400 bg-white px-3.5 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 transition shadow-xs shrink-0"
              >
                ✕ Cancel Editing
              </button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT 7 COLS: MENU CATALOG */}
          <section className="lg:col-span-7 space-y-4">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <label htmlFor="pos-category-select" className="text-xs font-bold text-stone-600 shrink-0">
                    Category:
                  </label>
                  <select
                    id="pos-category-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-900 focus:border-amber-700 focus:outline-none"
                  >
                    <option value="all">All Items ({allItems.length})</option>
                    {catalog.map((c) => (
                      <option key={c.category_id} value={c.category_name}>
                        {c.category_name} ({c.items.length})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative min-w-[200px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search drinks..."
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs font-semibold focus:border-amber-700 focus:bg-white focus:outline-none"
                  />
                  <span className="absolute left-2.5 top-2 text-xs text-stone-400">🔍</span>
                </div>
              </div>
            </div>

            {/* CATALOG GRID */}
            {isLoadingMenu ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="animate-pulse rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                    <div className="aspect-video w-full rounded-xl bg-stone-200" />
                    <div className="h-4 w-3/4 rounded bg-stone-200" />
                    <div className="h-3 w-1/2 rounded bg-stone-100" />
                  </div>
                ))}
              </div>
            ) : menuError ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-8 text-center">
                <span className="text-3xl">⚠️</span>
                <p className="mt-2 text-xs font-bold text-rose-800">{menuError}</p>
                <button
                  onClick={loadMenu}
                  type="button"
                  className="mt-3 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white shadow-xs"
                >
                  Retry
                </button>
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.menu_item_id}
                    onClick={() => handleSelectDrink(item)}
                    type="button"
                    disabled={!item.is_available}
                    className={`group flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-3.5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md ${
                      !item.is_available ? "opacity-50 grayscale cursor-not-allowed" : "border-stone-200"
                    }`}
                  >
                    <div>
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-stone-100 border border-stone-100 mb-2.5">
                        {item.image_url ? (
                          <img
                            src={getImageUrl(item.image_url)}
                            alt={item.item_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl text-stone-400">
                            ☕
                          </div>
                        )}
                      </div>

                      <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-amber-900">
                        {item.category_name}
                      </span>
                      <h4 className="mt-1 font-bold text-stone-900 text-xs sm:text-sm line-clamp-1 group-hover:text-amber-950">
                        {item.item_name}
                      </h4>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
                      <span className="font-extrabold text-amber-950">
                        ₱{Number(item.base_price).toFixed(2)}
                      </span>
                      <span className="rounded-lg bg-amber-900 text-white px-2 py-0.5 text-[10px] font-bold">
                        + Add
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center text-xs text-stone-500">
                No products found matching &ldquo;{searchQuery}&rdquo;.
              </div>
            )}
          </section>

          {/* RIGHT 5 COLS: REGISTER ORDER TICKET */}
          <section className="lg:col-span-5">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-stone-900">
                    {editingPendingOrder ? `Pending Order #${editingPendingOrder.order_id}` : "Register Ticket"} ({cart.reduce((a, c) => a + c.quantity, 0)} items)
                  </h3>
                  {editingPendingOrder && (
                    <span className="text-[11px] font-bold text-amber-800 block mt-0.5">
                      Editing for {editingPendingOrder.customer_name} ({editingPendingOrder.reference_code})
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-bold text-rose-700 hover:underline"
                  >
                    Clear Ticket
                  </button>
                )}
              </div>

              {posError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                  {posError}
                </div>
              )}

              {/* CUSTOMER NAME, EMAIL & TYPE */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700">Order Type</label>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2 text-xs font-semibold"
                  >
                    <option value="dine_in">Dine-In 🍽️</option>
                    <option value="takeout">Takeout 🛍️</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700">Optional Receipt Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="guest@example.com (optional)"
                  className="mt-1 w-full rounded-xl border border-stone-300 p-2 text-xs font-medium"
                />
              </div>

              {/* CART TICKET ITEMS */}
              {cart.length > 0 ? (
                <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 border-y border-stone-100 my-2">
                  {cart.map((item) => (
                    <div key={item.cart_id} className="py-2.5 flex items-start justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-stone-900">
                          {item.item_name}{" "}
                          {item.size_name && (
                            <span className="text-[11px] font-semibold text-stone-500">
                              ({item.size_name})
                            </span>
                          )}
                        </div>
                        {item.addons && item.addons.length > 0 && (
                          <div className="text-[10px] text-stone-500">
                            + {item.addons.map((a) => a.addon_name).join(", ")}
                          </div>
                        )}
                        {item.special_instructions && (
                          <div className="text-[10px] text-amber-900 italic">
                            Note: {item.special_instructions}
                          </div>
                        )}
                        <div className="text-[11px] font-extrabold text-amber-950">
                          ₱{(item.unit_price * item.quantity).toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.cart_id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold hover:bg-stone-200"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.cart_id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold hover:bg-stone-200"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-stone-400 border border-dashed border-stone-200 rounded-2xl">
                  Tap drinks on the left to add to ticket.
                </div>
              )}

              {/* TOTALS */}
              <div className="space-y-1 text-xs border-b border-stone-100 pb-3">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Estimated Tax (8%)</span>
                  <span>₱{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-stone-950 pt-1">
                  <span>Total Due</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>
              </div>

              {/* PAYMENT METHOD & CASH TENDER */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                      paymentMethod === "cash"
                        ? "border-amber-900 bg-amber-50 text-amber-950"
                        : "border-stone-200 bg-white text-stone-700"
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                      paymentMethod === "card"
                        ? "border-amber-900 bg-amber-50 text-amber-950"
                        : "border-stone-200 bg-white text-stone-700"
                    }`}
                  >
                    💳 Card
                  </button>
                </div>

                {paymentMethod === "cash" && (
                  <div className="rounded-2xl bg-stone-50 p-3 space-y-2 border border-stone-200 text-xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-700">Amount Tendered (₱):</label>
                      <input
                        type="number"
                        step="0.01"
                        min={total}
                        value={amountTendered}
                        onChange={(e) => setAmountTendered(e.target.value)}
                        placeholder={total.toFixed(2)}
                        className="w-28 rounded-xl border border-stone-300 bg-white p-1.5 text-right font-black text-stone-900"
                      />
                    </div>

                    <div className="flex items-center gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => setAmountTendered(total.toFixed(2))}
                        className="rounded-lg bg-stone-200 px-2 py-0.5 text-[10px] font-bold hover:bg-stone-300"
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmountTendered("100.00")}
                        className="rounded-lg bg-stone-200 px-2 py-0.5 text-[10px] font-bold hover:bg-stone-300"
                      >
                        ₱100
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmountTendered("500.00")}
                        className="rounded-lg bg-stone-200 px-2 py-0.5 text-[10px] font-bold hover:bg-stone-300"
                      >
                        ₱500
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmountTendered("1000.00")}
                        className="rounded-lg bg-stone-200 px-2 py-0.5 text-[10px] font-bold hover:bg-stone-300"
                      >
                        ₱1,000
                      </button>
                    </div>

                    <div className="flex justify-between items-center font-black text-emerald-800 border-t border-stone-200 pt-1.5">
                      <span>Change Due:</span>
                      <span className="text-sm">₱{registerChangeDue.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={cart.length === 0 || isSubmitting || (paymentMethod === "cash" && amountTendered && numericTendered < total)}
                  onClick={handleCheckout}
                  className="w-full rounded-2xl bg-amber-900 py-3.5 text-xs font-black text-white shadow-md hover:bg-amber-950 disabled:opacity-50 transition"
                >
                  {isSubmitting
                    ? "Processing..."
                    : editingPendingOrder
                    ? `Charge ₱${total.toFixed(2)} & Dispatch to Barista 🚀`
                    : `Charge ₱${total.toFixed(2)} & Complete 📄`}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    )}

      {/* CUSTOMIZE ITEM MODAL */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900">{customizingItem.item_name}</h3>
                <span className="text-xs text-amber-950 font-bold">
                  Base: ₱{Number(customizingItem.base_price).toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => setCustomizingItem(null)}
                className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            {/* SIZES */}
            {customizingItem.sizes && customizingItem.sizes.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 block uppercase tracking-wider">
                  Choose Size
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {customizingItem.sizes.map((s) => (
                    <button
                      key={s.menu_item_size_id}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex justify-between ${
                        selectedSize?.menu_item_size_id === s.menu_item_size_id
                          ? "border-amber-900 bg-amber-50 text-amber-950 ring-2 ring-amber-300"
                          : "border-stone-200 text-stone-700"
                      }`}
                    >
                      <span>{s.size_name}</span>
                      <span>
                        {Number(s.price_adjustment) > 0
                          ? `+₱${Number(s.price_adjustment).toFixed(2)}`
                          : "Base"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ADDONS */}
            {customizingItem.addons && customizingItem.addons.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 block uppercase tracking-wider">
                  Add-ons & Flavors
                </label>
                <div className="space-y-1.5">
                  {customizingItem.addons.map((a) => {
                    const isChecked = selectedAddons.some((x) => x.menu_item_addon_id === a.menu_item_addon_id);
                    return (
                      <label
                        key={a.menu_item_addon_id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                          isChecked ? "border-amber-900 bg-amber-50" : "border-stone-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAddons((prev) => [...prev, a]);
                              } else {
                                setSelectedAddons((prev) =>
                                  prev.filter((x) => x.menu_item_addon_id !== a.menu_item_addon_id)
                                );
                              }
                            }}
                          />
                          <span>{a.addon_name}</span>
                        </div>
                        <span className="text-amber-900">+₱{Number(a.additional_price).toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SPECIAL INSTRUCTIONS */}
            <div>
              <label className="text-xs font-bold text-stone-700 block">Special Instructions</label>
              <input
                type="text"
                placeholder="e.g. Extra hot, oat milk"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomizedToCart}
                className="rounded-xl bg-amber-900 px-5 py-2 text-xs font-black text-white hover:bg-amber-800 shadow-md"
              >
                Add to Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS & COUNTER RECEIPT CONFIRMATION DIALOG */}
      {confirmedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-3xl mx-auto">
              ✓
            </div>

            <div>
              <h3 className="text-xl font-black text-stone-900">Payment Confirmed!</h3>
              <p className="text-xs text-stone-500">
                Order #{confirmedReceipt.order_id} sent to Barista Queue.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider block">
                Single-Use Pickup Code
              </span>
              <span className="text-3xl font-black tracking-widest text-amber-950 block mt-1">
                {confirmedReceipt.pickup_code}
              </span>
            </div>

            <div className="rounded-2xl border border-stone-100 bg-stone-50 p-3.5 text-xs space-y-1.5 text-left">
              <div className="flex justify-between text-stone-600">
                <span>Customer:</span>
                <span className="font-bold text-stone-900">{confirmedReceipt.customer_name}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Total Paid:</span>
                <span className="font-extrabold text-stone-900">₱{Number(confirmedReceipt.total_amount).toFixed(2)}</span>
              </div>
              {confirmedReceipt.amount_tendered && (
                <div className="flex justify-between text-stone-600">
                  <span>Cash Tendered:</span>
                  <span>₱{Number(confirmedReceipt.amount_tendered).toFixed(2)}</span>
                </div>
              )}
              {confirmedReceipt.change_due !== null && confirmedReceipt.change_due !== undefined && (
                <div className="flex justify-between font-black text-emerald-800 border-t border-stone-200 pt-1">
                  <span>Change Given:</span>
                  <span>₱{Number(confirmedReceipt.change_due).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* PRINT & DOWNLOAD RECEIPT PDF BUTTONS */}
            {confirmedReceipt.receipt_pdf_url && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => printReceipt(confirmedReceipt.receipt_pdf_url)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 py-2.5 text-xs font-bold text-stone-800 hover:bg-stone-100 transition"
                >
                  <span>🖨️ Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadReceipt(confirmedReceipt.receipt_pdf_url, confirmedReceipt.order_id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
                >
                  <span>⬇️ Download PDF</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setConfirmedReceipt(null)}
              className="w-full rounded-2xl bg-amber-900 py-3 text-xs font-black text-white shadow-md hover:bg-amber-800 transition"
            >
              Next Customer / New Sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
